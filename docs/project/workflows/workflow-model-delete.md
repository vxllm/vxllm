---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Workflow: Model — Delete

## Summary
Removes downloaded model file from disk and resets model status to "available". Handles active model unloading, permission issues, and disk space recalculation. Updates models and download_queue tables.

## Trigger
- User clicks delete/trash icon on installed model card in Settings → Models
- User runs `vxllm rm <model>` from CLI
- Client sends DELETE to `/rpc/models.delete` with model name

## Actors
- **Frontend** (React, confirmation dialog)
- **Hono Server** (orchestration, file deletion)
- **node-llama-cpp** (model unloading)
- **Database** (Drizzle + SQLite)
- **Disk** (local models directory)

## Preconditions
- Server is running
- Model entry exists in models table
- Database connection is active
- User has write permissions to models_dir

## Happy Path

### Step 1: User Initiates Delete
- **UI Path**: User navigates to Settings → Models, finds installed model card, clicks delete/trash icon
- **CLI Path**: User runs `vxllm rm llama3.1:8b`
- **API Path**: DELETE request to `/rpc/models.delete` with body: `{"model": "llama3.1:8b"}`

### Step 2: Show Confirmation Dialog (UI Only)
- **UI Path**:
  - Fetch current model info:
    ```js
    const model = await db.select().from(models)
      .where(eq(models.name, "llama3.1:8b"));
    const sizeGB = (model.sizeBytes / 1024 / 1024 / 1024).toFixed(1);
    ```
  - Display confirmation modal:
    ```
    Delete "Llama 3.1 8B"?

    This will permanently remove the model file and free 5.1 GB of disk space.
    You can re-download it later from the Models tab.

    [Cancel] [Delete]
    ```
  - Wait for user confirmation
  - If user clicks Cancel → exit, return no-op response
  - If user clicks Delete → proceed to Step 3

- **CLI Path**:
  - Display confirmation prompt:
    ```
    Delete "Llama 3.1 8B" (5.1 GB)? (y/n)
    ```
  - Read user input from stdin
  - If user enters "n" → exit, log "Deletion cancelled"
  - If user enters "y" → proceed to Step 3

- **API Path**:
  - Check optional `confirm: true` parameter in request body
  - If confirm not set → return 400: "Deletion requires explicit confirmation (set confirm: true)"
  - If confirm=false → return 200: "Deletion cancelled"
  - If confirm=true → proceed to Step 3

### Step 3: Check If Model Is Currently Loaded
- Query inference state:
  ```js
  const loadedModel = getActiveModelInMemory();
  ```
- If loadedModel && loadedModel.name === "llama3.1:8b":
  - Model is currently loaded and in use
  - Check if any active inference requests are using this model:
    ```js
    const activeRequests = getActiveInferenceRequests()
      .filter(r => r.modelName === "llama3.1:8b");
    ```
  - If activeRequests.length > 0:
    - Proceed to Step 3a (Unload and Wait)
  - Else:
    - Proceed to Step 4 (Unload Immediately)
- Else:
  - Model is not loaded, proceed directly to Step 4

### Step 3a: Wait for Active Requests to Complete
- Show user: "Waiting for active requests to complete before unloading model..."
- Poll active requests every 500ms:
  ```js
  while (getActiveInferenceRequests().length > 0) {
    await sleep(500);
  }
  ```
- Timeout: If requests still active after 30 seconds:
  - Force-kill remaining requests with error response
  - Log warning: "Forced termination of X active requests during model delete"
  - Proceed to Step 4

### Step 4: Unload Model from Memory
- Check if model is loaded in node-llama-cpp:
  ```js
  const llama = await getLlama();
  if (llama.currentModel?.name === "llama3.1:8b") {
    await llama.unloadModel();
    clearModelCache("llama3.1:8b");
  }
  ```
- On success:
  - Log: "Model llama3.1:8b unloaded from memory"
  - Proceed to Step 5
- On failure (rare):
  - Log error: "Failed to unload model from memory: {error}"
  - Continue to Step 5 anyway (file deletion still proceeds)

### Step 5: Delete File from Disk
- Retrieve localPath from models table:
  ```js
  const model = await db.select().from(models)
    .where(eq(models.name, "llama3.1:8b"));
  const filePath = model.localPath;
  ```
- Check if file exists:
  ```js
  const fileExists = await Bun.file(filePath).exists();
  ```
- If file doesn't exist:
  - Log warning: "Model file not found at {filePath}, skipping delete"
  - Proceed to Step 6 (update DB anyway)
- If file exists, delete:
  ```js
  try {
    await Bun.file(filePath).delete();
    const deletedSizeBytes = model.sizeBytes;
    log(`Model file deleted: ${filePath} (freed ${deletedSizeBytes / 1024 / 1024 / 1024} GB)`);
  } catch (error) {
    if (error.code === "EACCES") {
      throw new PermissionError(`No permission to delete ${filePath}`);
    } else if (error.code === "ENOENT") {
      // File already gone, continue
    } else {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
  ```
- On permission error → go to Failure Scenarios
- On success → proceed to Step 6

### Step 6: Update Models Table
- Reset model to "available" state:
  ```js
  await db.update(models)
    .set({
      status: "available",
      localPath: null,
      sizeBytes: null,
      variant: null,
      downloadedAt: null,
      lastUsedAt: null
    })
    .where(eq(models.name, "llama3.1:8b"));
  ```
- Verify update successful

### Step 7: Clean Up Download Queue Entries
- Delete all related download_queue entries:
  ```js
  await db.delete(downloadQueue)
    .where(eq(downloadQueue.model, "llama3.1:8b"));
  ```
- Log: "Deleted X download queue entries for llama3.1:8b"

### Step 8: Recalculate Disk Usage
- Query all downloaded models:
  ```js
  const allModels = await db.select().from(models)
    .where(eq(models.status, "downloaded"));
  const totalUsedBytes = allModels.reduce((sum, m) => sum + m.sizeBytes, 0);
  const totalFreeBytes = os.freemem(); // or better: getFreeDiskSpace(modelsDir);
  ```
- Update settings or in-memory cache:
  ```js
  updateDiskUsageMetrics({
    usedBytes: totalUsedBytes,
    freeBytes: totalFreeBytes,
    percentUsed: (totalUsedBytes / (totalUsedBytes + totalFreeBytes)) * 100
  });
  ```
- This metric is used to update the Settings UI disk space display

### Step 9: Show Success Notification
- **UI Path**: Toast notification:
  ```
  ✓ "Llama 3.1 8B" deleted (freed 5.1 GB)
  ```
  - Toast appears for 3 seconds, then auto-dismisses
  - Disk usage chart in Settings updates in real-time
  - Model card disappears from installed models list

- **CLI Path**: Log output:
  ```
  ✓ llama3.1:8b deleted successfully
  Freed: 5.1 GB
  Models directory: /home/user/.vxllm/models (12.4 GB used, 87.6 GB free)
  ```

- **API Path**: Return JSON response:
  ```json
  {
    "success": true,
    "message": "Model deleted successfully",
    "model": "llama3.1:8b",
    "freedBytes": 5368709120,
    "freedGB": 5.1
  }
  ```

## Alternative Paths

### Delete with --cascade Flag (Future)
- If user specifies `vxllm rm llama3.1:8b --cascade`:
- Also delete associated conversation history with this model
- Also delete metrics entries for this model
- (Not implemented in v1.0)

### Soft Delete (Archive Instead of Permanent)
- Instead of deleting file, move to trash/archive folder
- Allows recovery without re-download
- `~/.vxllm/models/.trash/llama3.1-8b.gguf.bak`
- (Not implemented in v1.0, future feature)

### Partial Deletion (Keep Base, Delete Quantizations)
- If model has multiple quantizations downloaded:
  - `llama3.1-8b-q4_k_m.gguf` (4.9 GB)
  - `llama3.1-8b-q8_0.gguf` (8.5 GB)
- User could delete only one variant while keeping the other
- (Requires refactoring to track variants separately; not in current design)

## Failure Scenarios

### File Deletion Permission Denied
- **Symptom**: Bun.file().delete() throws EACCES
- **Detection**: Exception in Step 5
- **Response**:
  - Update models: status remains "downloaded" (no change)
  - Log error: "Permission denied deleting {filePath}"
  - Return HTTP 403 Forbidden:
    ```json
    {
      "error": "Permission denied",
      "details": "Cannot delete model file. Check folder permissions.",
      "suggestion": "Run 'sudo chmod 755 {modelsDir}' or check file ownership"
    }
    ```
  - **UI Path**: Show error dialog:
    ```
    ✗ Deletion Failed

    Cannot delete model file — permission denied.
    Check that the models folder is writable.

    Fix: Run this in terminal:
    chmod 755 ~/.vxllm/models
    ```

- **Recovery**:
  - User fixes folder permissions
  - User retries deletion
  - If user is on Windows, may need to run as Administrator or check file handles

### Model File Not Found (Already Deleted)
- **Symptom**: Bun.file().exists() returns false in Step 5
- **Detection**: fileExists === false
- **Response**:
  - Log info: "Model file not found (may have been deleted manually)"
  - Continue with database cleanup (Step 6)
  - Still update models to "available", still return success
  - (File already gone, so outcome is correct)

### Active Requests Still Processing After Timeout
- **Symptom**: After 30-second wait in Step 3a, requests still active
- **Detection**: activeRequests.length > 0 after timeout
- **Response**:
  - Force-terminate active inference requests
  - Send error response to clients: "Model unloaded due to deletion"
  - Log warning: "Force-killed X active inference requests"
  - Unload model anyway (Step 4)
  - Continue with deletion (Step 5)
  - **UI Path**: Show warning notification:
    ```
    ⚠ Active inference requests were terminated during model deletion.
    Affected users may see errors in their chat.
    ```

### Model Not Found in Database
- **Symptom**: Query in Step 3 returns no results for model name
- **Detection**: models table lookup fails
- **Response**:
  - Return HTTP 404 Not Found:
    ```json
    {
      "error": "Model not found",
      "message": "Model 'llama3.1:8b' not found in registry"
    }
    ```
  - Log info: "Deletion attempted for non-existent model"
  - Exit, no further action

### Database Update Failed
- **Symptom**: db.update() or db.delete() throws error
- **Detection**: Exception in Step 6 or 7
- **Response**:
  - If update failed AFTER file deleted: **Data inconsistency**
    - File is gone from disk, but models table still shows "downloaded"
    - Log error: "CRITICAL: Database update failed after file deletion for {model}"
    - Send HTTP 500 Internal Server Error:
      ```json
      {
        "error": "Internal server error",
        "details": "Model file deleted but database update failed. Please restart server.",
        "model": "llama3.1:8b"
      }
      ```
    - Alert admin to manually run:
      ```sql
      UPDATE models SET status='available', localPath=NULL WHERE name='llama3.1:8b';
      ```
  - If update failed BEFORE file deleted:
    - File still exists on disk
    - Return HTTP 500 and retry database operation up to 3 times
    - On persistent failure, advise user to retry

### Concurrent Deletion Conflict
- **Symptom**: Two simultaneous DELETE requests for same model
- **Detection**: Race condition check (add deletion lock)
- **Response**:
  - First request acquires lock, proceeds normally
  - Second request receives HTTP 409 Conflict:
    ```json
    {
      "error": "Model deletion already in progress",
      "message": "Wait for current deletion to complete"
    }
    ```
  - Second request retries with backoff
  - Or returns error and user re-initiates

### Model Directory Inaccessible
- **Symptom**: models_dir path doesn't exist or is unmounted
- **Detection**: Bun.file(filePath).delete() throws ENOENT or other
- **Response**:
  - Log error: "Models directory inaccessible: {modelsDir}"
  - Return HTTP 500 with message:
    ```json
    {
      "error": "Models directory inaccessible",
      "suggestion": "Check that models directory exists and is properly mounted"
    }
    ```
  - Alert admin if running as background service

## Permissions
- **Desktop Mode**: Full deletion access
- **Server Mode**: Deletion access controlled via API key (optional)
- **File System**: Must have write permissions to models_dir and the model file itself

## Exit Conditions
- **Success**: models.status = "available", file deleted, notification shown
- **Cancelled**: User clicks Cancel or enters "n" → exit cleanly, no changes
- **Failed**: Error prevents deletion → error notification shown, model remains "downloaded", user shown recovery instructions
- **Forced**: Active requests terminated → deletion proceeds, warning shown to affected users

## Data Changes

### Tables Written
- **models**
  - Update: status → "available", localPath → NULL, sizeBytes → NULL, variant → NULL, downloadedAt → NULL, lastUsedAt → NULL

- **download_queue**
  - Delete: all entries where model = "llama3.1:8b"

- **usage_metrics** (optional, if cascading)
  - Delete: entries for this model (future feature)

### Files Deleted
- **{models_dir}/{model_name}-{variant}.gguf** (model file)

### In-Memory State
- Clear model from node-llama-cpp cache
- Clear model from any cached model lists

## Related Documentation
- `/docs/api/endpoints.md` — DELETE /rpc/models.delete endpoint spec
- `/docs/cli/commands.md` — vxllm rm command reference
- `/docs/deployment/storage.md` — Models directory management, permissions
- `workflow-model-download.md` — Model download (inverse operation)
- `workflow-settings-update.md` — Disk usage configuration

## Changelog
- **v1.0** (2026-03-20): Initial workflow documentation
  - Safe unloading of active models
  - Confirmation dialogs for CLI and UI
  - Disk space recalculation
  - Comprehensive failure scenarios
  - Permission and timeout handling
