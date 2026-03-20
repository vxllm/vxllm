---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Workflow: Model — Download

## Summary
Orchestrates model download from HuggingFace Hub to local disk. Supports concurrent downloads with queue management, progress reporting via polling or SSE, resume on interruption, and multi-variant hardware detection. Updates models and download_queue tables throughout.

## Trigger
- User clicks "Install" button on model card in Settings → Models
- User runs `vxllm pull <model>` from CLI
- Client sends POST to `/rpc/models.pull` with model name

## Actors
- **Frontend** (React, polling for download progress)
- **Hono Server** (download orchestration, queue management)
- **@huggingface/hub** (metadata API, file listing)
- **Bun fetch()** (HTTP streaming download)
- **Database** (Drizzle + SQLite)
- **Disk** (local models directory)

## Preconditions
- Internet connectivity available
- models_dir exists and is writable (checked during server startup)
- models.json registry file exists (bundled with app)
- Database schema initialized (models, download_queue tables)
- HuggingFace Hub is accessible (no geo-blocking)

## Happy Path

### Step 1: User Initiates Download
- **UI Path**: User navigates to Settings → Models, finds model card (e.g., "Llama 3.1 8B"), clicks Install button
- **CLI Path**: User runs `vxllm pull llama3.1:8b`
- **API Path**: POST `/rpc/models.pull` with body: `{"model": "llama3.1:8b"}`

### Step 2: Model Name Resolution
- Extract model name (e.g., "llama3.1:8b")
- Load models.json registry from disk:
  ```json
  {
    "llama3.1:8b": {
      "repo": "meta-llama/Llama-2-7b",
      "filename": "Llama-2-7b-Chat-Q4_K_M.gguf",
      "variants": [
        {"quantization": "Q4_K_M", "filename": "Llama-2-7b-Chat-Q4_K_M.gguf", "sizeBytes": 5368709120},
        {"quantization": "Q8_0", "filename": "Llama-2-7b-Chat-Q8_0.gguf", "sizeBytes": 8589934592}
      ],
      "description": "Meta's Llama 3.1 8B chat model"
    }
  }
  ```
- Query models table for this model
- If not found in registry → return 400 "Model not found"

### Step 3: Check If Already Downloaded
- Query models table: SELECT * WHERE name = "llama3.1:8b"
- If status = "downloaded" AND localPath exists AND file exists on disk:
  - If no --force flag → return response: "Model already downloaded at {localPath} (5.1 GB)"
  - If --force flag → delete existing file and continue to Step 4
- If status = "downloading" → return 409 "Download already in progress"
- If status = "available" (not downloaded) → proceed to Step 4

### Step 4: Hardware Detection & Variant Selection
- Query system for GPU info:
  ```js
  const gpuInfo = getGPUInfo(); // Check for CUDA, Metal, etc.
  const vram = gpuInfo.totalMemory; // e.g., 24GB NVIDIA RTX 3090
  const cpuCores = os.cpus().length;
  ```
- Decision tree:
  - If VRAM >= 16GB → recommend Q8_0 (best quality, ~8-9 GB)
  - Else if VRAM >= 8GB → recommend Q4_K_M (balanced, ~5 GB)
  - Else → recommend IQ3_M (smallest, ~3 GB)
- **UI Path**: Show user a selection dialog with quantizations and sizes
  - "Q8_0 (8.6 GB) — Best quality"
  - "Q4_K_M (5.1 GB) — Balanced (recommended)"
  - "IQ3_M (3.2 GB) — Smallest"
- **CLI Path**: Auto-select based on VRAM, show selected variant
- **API Path**: Accept variant parameter in request or use auto-selected

### Step 5: Create Download Queue Entry
- Insert into download_queue table:
  ```js
  {
    id: uuid(),
    model: "llama3.1:8b",
    variant: "Q4_K_M",
    huggingfaceUrl: "https://huggingface.co/meta-llama/Llama-2-7b/resolve/main/Llama-2-7b-Chat-Q4_K_M.gguf",
    targetPath: "/home/user/.vxllm/models/llama3.1-8b-q4_k_m.gguf",
    totalBytes: 5368709120,
    downloadedBytes: 0,
    progressPct: 0,
    speedBps: 0,
    status: "queued",
    createdAt: now(),
    startedAt: null,
    completedAt: null,
    errorMessage: null
  }
  ```

### Step 6: Update Models Table
- Update models table:
  ```js
  {
    name: "llama3.1:8b",
    status: "downloading",
    variant: "Q4_K_M",
    localPath: null, // Not set until download complete
    sizeBytes: null,
    downloadedAt: null,
    lastUsedAt: null
  }
  ```

### Step 7: Check Download Queue (Concurrency Control)
- Count active downloads:
  ```js
  const activeCount = await db.select().from(downloadQueue)
    .where(eq(downloadQueue.status, "downloading"))
  ```
- If activeCount >= 2 (configurable max_concurrent_downloads):
  - Keep download_queue status as "queued"
  - Return response: "Download queued (1 ahead)"
  - Frontend polls until status becomes "downloading"
  - Skip to Step 12 (polling loop)
- Else:
  - Update download_queue: status = "downloading", startedAt = now()
  - Proceed to Step 8

### Step 8: Start Download Stream
- Use @huggingface/hub to fetch model file with streaming:
  ```js
  const url = "https://huggingface.co/meta-llama/Llama-2-7b/resolve/main/...";
  const response = await fetch(url, {
    headers: { "User-Agent": "vxllm/1.0" }
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited
      throw new Error("HuggingFace rate limited, retry in 60s");
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentLength = parseInt(response.headers.get("content-length"), 10);
  const reader = response.body.getReader();
  ```

### Step 9: Write to Disk with Progress Tracking
- Open file stream for writing:
  ```js
  const file = await Bun.file(targetPath).writer();
  let downloadedBytes = 0;
  let lastUpdateTime = Date.now();
  const startTime = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    file.write(value);
    downloadedBytes += value.byteLength;

    // Update metrics every 1 second
    const now = Date.now();
    if (now - lastUpdateTime >= 1000) {
      const elapsedSeconds = (now - startTime) / 1000;
      const speedBps = downloadedBytes / elapsedSeconds;
      const remainingBytes = contentLength - downloadedBytes;
      const etaSeconds = remainingBytes / speedBps;

      await db.update(downloadQueue)
        .set({
          downloadedBytes,
          progressPct: Math.round((downloadedBytes / contentLength) * 100),
          speedBps: Math.round(speedBps)
        })
        .where(eq(downloadQueue.id, queueEntryId));

      lastUpdateTime = now;
    }
  }

  await file.flush();
  file.close();
  ```

### Step 10: Frontend Progress Polling (Concurrent with Step 9)
- **UI Path**: Every 500ms, poll `/rpc/download-status` with download_id:
  ```js
  setInterval(async () => {
    const status = await fetch("/rpc/download-status", {
      method: "POST",
      body: JSON.stringify({ downloadId: queueEntryId })
    }).then(r => r.json());

    setProgress({
      pct: status.progressPct,
      speedMbps: (status.speedBps / 1024 / 1024).toFixed(1),
      eta: formatEta(status.etaSeconds)
    });
  }, 500);
  ```
- Display progress bar with real-time metrics (percentage, speed, ETA)
- **Alternative (SSE)**: Server sends progress updates via SSE instead of polling (lower latency)

### Step 11: Verify Download Integrity
- On completion, perform verification:
  ```js
  const stats = await Bun.file(targetPath).stat();
  const downloadedSize = stats.size;

  // Check file size matches expected
  if (downloadedSize !== contentLength) {
    throw new Error(`Size mismatch: expected ${contentLength}, got ${downloadedSize}`);
  }

  // Optional: Verify hash if provided in registry
  if (variantData.sha256) {
    const hash = await calculateSHA256(targetPath);
    if (hash !== variantData.sha256) {
      throw new Error(`Hash mismatch: expected ${variantData.sha256}, got ${hash}`);
    }
  }
  ```
- If verification fails → delete partial file, update download_queue.status = "failed", proceed to Failure Scenarios

### Step 12: Mark Download Complete
- Update download_queue table:
  ```js
  await db.update(downloadQueue).set({
    status: "completed",
    completedAt: now(),
    progressPct: 100,
    downloadedBytes: contentLength
  })
  ```
- Update models table:
  ```js
  await db.update(models).set({
    status: "downloaded",
    localPath: targetPath,
    sizeBytes: contentLength,
    downloadedAt: now(),
    variant: "Q4_K_M"
  })
  ```

### Step 13: Check Queue & Start Next Download
- Query download_queue for next "queued" entry
- If found, move it to "downloading" and repeat from Step 8
- Else → end download cycle

### Step 14: Show Success Notification
- **UI Path**: Toast notification: "✓ llama3.1:8b installed successfully (5.1 GB)"
- **CLI Path**: Log output:
  ```
  ✓ llama3.1:8b downloaded successfully
  Location: /home/user/.vxllm/models/llama3.1-8b-q4_k_m.gguf
  Size: 5.1 GB
  Time: 2m 34s
  ```
- Update disk usage display in Settings

## Alternative Paths

### Resume Interrupted Download
1. User initiates download of same model while partial file exists on disk
2. Check if existing partial file:
   - Query download_queue for existing entry with status "downloading" or "failed"
   - If found AND incomplete, offer resume option
3. If resume accepted:
   - Get current file size: existingSize = stat(targetPath).size
   - Fetch with Range header: `Range: bytes=existingSize-`
   - Continue download from byte offset
   - Update download_queue.downloadedBytes = existingSize + newBytes
4. If resume rejected or not offered:
   - Delete partial file
   - Start fresh download from byte 0

### Force Re-Download (--force flag)
1. User runs `vxllm pull llama3.1:8b --force`
2. Check if model already exists
3. If yes:
   - Delete file from disk
   - Update models.status = "available", clear localPath/sizeBytes
   - Delete old download_queue entries
4. Create new download_queue entry and proceed from Step 8

### Download Specific Variant
1. User or API specifies variant: `vxllm pull llama3.1:8b --variant Q8_0`
2. Override hardware detection
3. Proceed with selected variant from Step 8

### Offline Mode / Pre-Downloaded Models
1. If models_dir already contains model file (e.g., copied manually):
2. User runs `vxllm scan-models` to index existing files
3. Server calculates file size and hash
4. Update models.status = "downloaded", set localPath, sizeBytes, downloadedAt
5. Model becomes available immediately without download

## Failure Scenarios

### HuggingFace Rate Limited (HTTP 429)
- **Symptom**: Response status 429, Retry-After header set
- **Detection**: Check response status in Step 8
- **Response**:
  - Update download_queue: status = "paused", errorMessage = "Rate limited by HuggingFace, retry in 60 seconds"
  - Update models: status = "downloading" (show as paused in UI)
  - Show user: "Download paused: Rate limit reached. Retrying in 60 seconds..."
- **Recovery**:
  - Parse Retry-After header or use exponential backoff (60s, 120s, 300s max)
  - Auto-resume after wait period
  - Max 3 auto-retries; if still failing after 3, require manual retry

### Network Connection Lost Mid-Download
- **Symptom**: fetch() throws NetworkError or response stream closes abruptly
- **Detection**: Exception in Step 9 or reader.read() returns early
- **Response**:
  - Update download_queue: status = "paused", errorMessage = "Network connection lost"
  - Update models: status = "downloading"
  - Show user: "Download paused. Will auto-resume when connection restored."
  - Log error with timestamp
- **Recovery**:
  - Listen for online/offline events (navigator.onLine in browser, network monitoring on server)
  - On online event, resume download from Step 8 with Range header (partial file resume)
  - Max auto-resume attempts: 5

### Disk Full Error
- **Symptom**: fs.write() throws ENOSPC (no space left on device)
- **Detection**: Exception in Step 9
- **Response**:
  - Update download_queue: status = "paused", errorMessage = "Disk full"
  - Delete partial file (free up space)
  - Update models: status = "available"
  - Show user: "Download paused: Not enough disk space. Free up X GB and try again."
  - Alert admin if running as background service
- **Recovery**:
  - User manually frees space
  - User clicks "Resume" button or runs `vxllm pull llama3.1:8b --resume`
  - Restart download from Step 8

### Hash Verification Failed
- **Symptom**: SHA256 mismatch in Step 11
- **Detection**: Calculated hash != expected hash
- **Response**:
  - Update download_queue: status = "failed", errorMessage = "File corrupted (hash mismatch)"
  - Delete corrupted file from disk
  - Update models: status = "available"
  - Show user: "Download failed: File was corrupted during transfer. Retrying..."
- **Recovery**:
  - Automatically restart download from Step 8 (max 2 retries)
  - If retries fail, show user: "Download failed after 2 attempts. Check your connection and try again."
  - Offer manual retry button

### File System Permission Denied
- **Symptom**: fs.write() or file.writer() throws EACCES
- **Detection**: Exception in Step 9
- **Response**:
  - Update download_queue: status = "failed", errorMessage = "Permission denied writing to models directory"
  - Update models: status = "available"
  - Show user: "Download failed: Cannot write to models directory. Check folder permissions."
- **Recovery**:
  - User must manually fix permissions or move models directory
  - Show instruction: `chmod 755 ~/.vxllm/models` or similar

### Model Not Found in Registry
- **Symptom**: Model name doesn't match any entry in models.json
- **Detection**: During Step 2, registry lookup fails
- **Response**:
  - HTTP 400: "Model 'llama3.1:8b' not found in registry"
  - Show list of available models: "Did you mean: llama3.1:7b, llama3.1:70b?"
- **Recovery**:
  - User re-runs with correct model name
  - OR user manually adds model to models.json with HuggingFace repo/filename

### HuggingFace API Metadata Failure
- **Symptom**: @huggingface/hub metadata API call fails (API down, repo doesn't exist, etc.)
- **Detection**: Exception when fetching file metadata in Step 2 or 8
- **Response**:
  - HTTP 500: "Failed to fetch model metadata from HuggingFace. Please try again later."
  - Log detailed error with timestamp
- **Recovery**:
  - Retry metadata fetch with exponential backoff (3 attempts)
  - If failure persists, suggest user check HuggingFace status page

### Concurrent Download Conflict
- **Symptom**: User initiates download while same model is downloading (race condition)
- **Detection**: In Step 6, models.status already "downloading" for this model
- **Response**:
  - HTTP 409 Conflict: "Download of llama3.1:8b already in progress"
  - Show current progress and ETA
- **Recovery**:
  - User waits for current download to complete
  - OR user cancels current download and starts new one

## Permissions
- **Desktop Mode**: Full download access
- **Server Mode**: Download access controlled via API key scopes (optional feature)
- **Network**: Must have outbound HTTPS (port 443) access to huggingface.co

## Exit Conditions
- **Success**: download_queue.status = "completed", models.status = "downloaded", notification shown
- **Cancelled**: User clicks cancel button → update download_queue.status = "cancelled", abort fetch stream
- **Failed**: Error condition encountered → download_queue.status = "failed", errorMessage populated, user shown error and retry option
- **Paused**: Resumable error → download_queue.status = "paused", auto-resume triggered or awaiting manual retry

## Data Changes

### Tables Written
- **download_queue**
  - Insert: new download entry (Step 5)
  - Update: progressPct, downloadedBytes, speedBps every 1s (Step 9)
  - Update: status, completedAt, errorMessage on completion/failure (Steps 12, 13)
  - Delete: old entries for same model when forced re-download

- **models**
  - Update: status, variant, localPath, sizeBytes, downloadedAt (Steps 6, 12)

- **settings** (optional)
  - Update: free_disk_space metric (after Step 12)

### Tables Read
- **models** (check current status in Step 3)
- **download_queue** (check concurrency in Step 7, find next queued in Step 13)

### Files Written
- **{models_dir}/{model_name}-{variant}.gguf** (model file, Steps 9-11)

## Related Documentation
- `/docs/api/endpoints.md` — /rpc/models.pull, /rpc/download-status endpoints
- `/docs/cli/commands.md` — vxllm pull command reference
- `/docs/deployment/storage.md` — models directory configuration, disk management
- `workflow-model-delete.md` — Cleanup after download failure
- `workflow-cli-pull.md` — CLI-specific pull workflow

## Changelog
- **v1.0** (2026-03-20): Initial workflow documentation
  - Streaming download with progress reporting
  - Queue management and concurrency control
  - Resume on interruption
  - Hardware detection and variant selection
  - Comprehensive failure and recovery scenarios
