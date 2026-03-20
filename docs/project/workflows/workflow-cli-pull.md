---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Workflow: CLI — Pull Model

## Summary
Downloads a model from HuggingFace Hub via command line. Resolves model name, detects hardware, recommends quantization, displays progress bar, and verifies download integrity.

## Trigger
- User runs `vxllm pull <model>` from terminal
- User runs `vxllm pull llama3.1:8b`
- User runs `vxllm pull llama3.1:8b --force` (re-download)
- User runs `vxllm pull llama3.1:8b --variant Q8_0` (specific quantization)

## Actors
- **CLI** (citty command parser)
- **Bun** (fetch + streaming)
- **@huggingface/hub** (model metadata)
- **Database** (Drizzle + SQLite)
- **Disk** (models directory)
- **os/system** (hardware detection)

## Preconditions
- Bun runtime is installed
- VxLLM package is installed
- Internet connectivity (HuggingFace Hub accessible)
- models_dir exists and is writable
- Database schema initialized (models, download_queue tables)

## Happy Path

### Step 1: Parse Command
- User runs command from terminal:
  ```bash
  vxllm pull llama3.1:8b --force
  ```
- CLI parser (citty) extracts arguments:
  ```js
  const args = {
    model: "llama3.1:8b",
    force: false,
    variant: null,
    quiet: false
  };
  ```

### Step 2: Resolve Model Name
- Load models.json registry from package:
  ```js
  import modelsRegistry from "./data/models.json";
  const modelData = modelsRegistry["llama3.1:8b"];

  if (!modelData) {
    console.error(`Error: model 'llama3.1:8b' not found in registry`);
    console.error("Available models:");
    Object.keys(modelsRegistry).forEach(name => {
      console.error(`  - ${name}`);
    });
    process.exit(1);
  }
  ```
- Extract HuggingFace repo and variants:
  ```js
  const repo = modelData.repo; // "meta-llama/Llama-2-7b"
  const variants = modelData.variants; // [
    // { quantization: "Q4_K_M", filename: "...", sizeBytes: 5... },
    // { quantization: "Q8_0", filename: "...", sizeBytes: 8... }
  // ]
  ```

### Step 3: Check If Model Already Downloaded
- Query database for existing model:
  ```js
  const db = await initDatabase();
  const existing = await db.select().from(models)
    .where(eq(models.name, "llama3.1:8b"))
    .limit(1);

  if (existing.length > 0 && existing[0].status === "downloaded") {
    const localPath = existing[0].localPath;
    const sizeGB = (existing[0].sizeBytes / 1024 / 1024 / 1024).toFixed(1);

    if (args.force) {
      console.log(`→ Force flag set, re-downloading...`);
      // Continue to Step 4 (download)
    } else {
      console.log(`✓ Already downloaded: ${localPath} (${sizeGB} GB)`);
      process.exit(0);
    }
  }
  ```

### Step 4: Detect Hardware & Recommend Variant
- Query system hardware:
  ```js
  const gpu = detectGPU(); // { type: "nvidia", vram: 24, name: "RTX 3090" }
  const cpu = os.cpus().length;
  const totalMemory = os.totalmem();

  console.log(`Hardware detected:`);
  console.log(`  GPU: ${gpu.name} (${gpu.vram}GB VRAM)`);
  console.log(`  CPU: ${cpu} cores`);
  console.log(`  RAM: ${(totalMemory / 1024 / 1024 / 1024).toFixed(1)}GB`);
  ```
- Decision logic for quantization:
  ```js
  let recommendedVariant;
  if (gpu.vram >= 16) {
    recommendedVariant = "Q8_0"; // Best quality, ~8-9 GB
  } else if (gpu.vram >= 8) {
    recommendedVariant = "Q4_K_M"; // Balanced, ~5 GB
  } else if (gpu.vram >= 4) {
    recommendedVariant = "IQ3_M"; // Smaller, ~3 GB
  } else {
    recommendedVariant = "IQ3_M"; // CPU fallback, smallest
  }
  ```

### Step 5: Select Variant
- If --variant flag provided:
  ```js
  const userVariant = args.variant; // e.g., "Q8_0"
  const variantData = variants.find(v => v.quantization === userVariant);
  if (!variantData) {
    console.error(`Error: variant '${userVariant}' not available`);
    console.log("Available variants:");
    variants.forEach(v => {
      const size = (v.sizeBytes / 1024 / 1024 / 1024).toFixed(1);
      console.log(`  - ${v.quantization} (${size} GB)`);
    });
    process.exit(1);
  }
  selectedVariant = userVariant;
  ```
- Else use recommended:
  ```js
  selectedVariant = recommendedVariant;
  ```
- Display choice:
  ```
  Selected variant: Q4_K_M
  Size: 5.1 GB
  ```

### Step 6: Fetch Model Metadata
- Get file info from HuggingFace:
  ```js
  const hf = new HuggingFaceApi({ token: process.env.HF_TOKEN }); // optional token
  const files = await hf.listRepoFiles({ repo: "meta-llama/Llama-2-7b" });
  const modelFile = files.find(f => f.name === "Llama-2-7b-Chat-Q4_K_M.gguf");

  if (!modelFile) {
    console.error(`Error: file not found in HuggingFace repo`);
    process.exit(1);
  }

  const huggingfaceUrl = `https://huggingface.co/${repo}/resolve/main/${modelFile.name}`;
  const fileSize = modelFile.size;
  ```

### Step 7: Show Download Confirmation
- Display download details:
  ```
  Model: Llama 3.1 8B
  Variant: Q4_K_M
  Size: 5.1 GB
  URL: https://huggingface.co/meta-llama/Llama-2-7b/resolve/...

  Downloading...
  ```

### Step 8: Start Download with Progress Bar
- Create download_queue entry in database:
  ```js
  const queueEntry = await db.insert(downloadQueue).values({
    id: uuid(),
    model: "llama3.1:8b",
    variant: "Q4_K_M",
    huggingfaceUrl: huggingfaceUrl,
    targetPath: targetPath,
    totalBytes: fileSize,
    downloadedBytes: 0,
    progressPct: 0,
    status: "downloading",
    startedAt: now()
  });
  ```
- Update models table:
  ```js
  await db.update(models).set({
    status: "downloading",
    variant: "Q4_K_M"
  }).where(eq(models.name, "llama3.1:8b"));
  ```

### Step 9: Stream Download
- Fetch file with streaming:
  ```js
  const response = await fetch(huggingfaceUrl, {
    headers: {
      "User-Agent": "vxllm/1.0"
    }
  });

  if (!response.ok) {
    console.error(`Error: HTTP ${response.status} ${response.statusText}`);
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      console.error(`Rate limited by HuggingFace. Retry after ${retryAfter}s`);
    }
    process.exit(1);
  }

  const contentLength = parseInt(response.headers.get("content-length"), 10);
  const reader = response.body.getReader();
  ```
- Write to disk with progress reporting:
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

    // Update progress bar every 100ms
    const now = Date.now();
    if (now - lastUpdateTime >= 100) {
      const elapsedSeconds = (now - startTime) / 1000;
      const speedBps = downloadedBytes / elapsedSeconds;
      const remainingBytes = contentLength - downloadedBytes;
      const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;
      const progressPct = Math.round((downloadedBytes / contentLength) * 100);

      // Update CLI progress bar
      displayProgressBar({
        current: downloadedBytes,
        total: contentLength,
        percentage: progressPct,
        speed: formatSpeed(speedBps),
        eta: formatEta(etaSeconds)
      });

      // Update database
      await db.update(downloadQueue)
        .set({
          downloadedBytes,
          progressPct,
          speedBps: Math.round(speedBps)
        })
        .where(eq(downloadQueue.id, queueEntry.id));

      lastUpdateTime = now;
    }
  }

  await file.flush();
  file.close();
  ```

### Step 10: Progress Bar Display
- CLI shows rich progress bar:
  ```
  Downloading llama3.1:8b (Q4_K_M)

  [████████████████░░░░░░░░░░░] 61% | 3.1/5.1 GB | 24.5 MB/s | ETA 1m 18s
  ```
- Updates every 100ms for smooth animation

### Step 11: Verify Download
- Check file size:
  ```js
  const stats = await Bun.file(targetPath).stat();
  if (stats.size !== contentLength) {
    console.error(`\n✗ Download failed: size mismatch`);
    console.error(`  Expected: ${contentLength} bytes`);
    console.error(`  Got: ${stats.size} bytes`);
    await Bun.file(targetPath).delete();
    process.exit(1);
  }
  ```
- Optional: Verify SHA256 hash (if in registry):
  ```js
  if (variantData.sha256) {
    console.log("Verifying integrity...");
    const hash = await calculateSHA256(targetPath);
    if (hash !== variantData.sha256) {
      console.error(`\n✗ Hash verification failed`);
      console.error(`  Expected: ${variantData.sha256}`);
      console.error(`  Got: ${hash}`);
      await Bun.file(targetPath).delete();
      process.exit(1);
    }
  }
  ```

### Step 12: Update Database
- Mark download complete:
  ```js
  await db.update(downloadQueue)
    .set({
      status: "completed",
      completedAt: now(),
      progressPct: 100
    })
    .where(eq(downloadQueue.id, queueEntry.id));

  await db.update(models)
    .set({
      status: "downloaded",
      localPath: targetPath,
      sizeBytes: contentLength,
      downloadedAt: now(),
      variant: "Q4_K_M"
    })
    .where(eq(models.name, "llama3.1:8b"));
  ```

### Step 13: Show Success & Summary
- Display final summary:
  ```
  ✓ Download complete!

  Model: Llama 3.1 8B (Q4_K_M)
  Size: 5.1 GB
  Location: /home/user/.vxllm/models/llama3.1-8b-q4_k_m.gguf

  Time: 2m 34s
  Average speed: 33.2 MB/s

  Ready to use! Try: vxllm serve --model llama3.1:8b
  ```

### Step 14: Exit Cleanly
- Process exits with code 0:
  ```bash
  $ vxllm pull llama3.1:8b
  ...
  ✓ Download complete!
  $ echo $?
  0
  ```

## Alternative Paths

### With --force Flag
1. User runs `vxllm pull llama3.1:8b --force`
2. Model is already downloaded
3. Instead of showing "already downloaded", delete existing file
4. Continue with fresh download (Step 8+)

### With --variant Flag
1. User runs `vxllm pull llama3.1:8b --variant Q8_0`
2. Skip hardware detection (Step 4)
3. Use specified variant directly
4. Proceed with download

### With --quiet Flag
1. User runs `vxllm pull llama3.1:8b --quiet`
2. No progress bar output
3. Only show final success/error message
4. Useful for scripting or background tasks

### Resume Interrupted Download
1. User runs `vxllm pull llama3.1:8b` (interrupted by Ctrl+C or network loss)
2. Partial file exists on disk
3. On next pull, detect partial file:
   ```js
   const existing = await Bun.file(targetPath).stat();
   const existingSize = existing.size;
   ```
4. Use Range header to resume:
   ```js
   const response = await fetch(url, {
     headers: {
       "Range": `bytes=${existingSize}-`,
       "User-Agent": "vxllm/1.0"
     }
   });
   ```
5. Continue download from byte offset
6. Show: "Resuming download (3.2/5.1 GB already downloaded)"

### Pre-Downloaded Model
1. User manually copies model file to ~/.vxllm/models
2. User runs `vxllm scan-models` (future command)
3. Server detects existing file, updates models table
4. Model becomes available without downloading

### Offline Mode
1. User downloads model on machine with internet
2. Transfers model file via USB/external drive to offline machine
3. Copies to ~/.vxllm/models
4. No download needed

## Failure Scenarios

### Model Not Found in Registry
- **Symptom**: User types `vxllm pull gpt-5:enormous`
- **Detection**: Model not found in models.json in Step 2
- **Response**:
  ```
  Error: model 'gpt-5:enormous' not found in registry

  Available models:
    - llama3.1:8b
    - llama3.1:70b
    - mistral:7b
    - gemma:2b
  ```
- **Recovery**:
  - User selects correct model name: `vxllm pull llama3.1:8b`

### No Internet Connection
- **Symptom**: Network disconnected or HuggingFace unreachable
- **Detection**: fetch() throws NetworkError in Step 8
- **Response**:
  ```
  ✗ Network error: Cannot reach HuggingFace Hub

  Check your internet connection and try again.
  If HuggingFace is down, try later: status.huggingface.co
  ```
- **Recovery**:
  - User checks internet connection
  - User waits for HuggingFace to come back online
  - User retries: `vxllm pull llama3.1:8b`

### HuggingFace Rate Limited (HTTP 429)
- **Symptom**: Too many requests from IP or token
- **Detection**: response.status === 429 in Step 8
- **Response**:
  ```
  ✗ Rate limited by HuggingFace

  You've exceeded the download limit. Retry after 60 seconds.
  Or use HuggingFace API token: export HF_TOKEN=hf_...
  ```
- **Recovery**:
  - User waits and retries
  - User adds HF_TOKEN for higher limits

### Disk Full
- **Symptom**: Not enough space to write file
- **Detection**: file.write() throws ENOSPC in Step 9
- **Response**:
  ```
  ✗ Disk full

  Need 5.1 GB free space, but only 2.3 GB available.
  Free up space and try again: df -h
  ```
- **Recovery**:
  - User frees disk space
  - User retries: `vxllm pull llama3.1:8b --resume`

### File Write Permission Denied
- **Symptom**: models_dir is read-only
- **Detection**: file.writer() throws EACCES in Step 9
- **Response**:
  ```
  ✗ Permission denied: cannot write to ~/.vxllm/models

  Fix with: chmod 755 ~/.vxllm/models
  ```
- **Recovery**:
  - User fixes permissions
  - User retries

### Hash Verification Failed
- **Symptom**: Downloaded file is corrupted
- **Detection**: SHA256 mismatch in Step 11
- **Response**:
  ```
  ✗ Hash verification failed

  File may be corrupted. Re-downloading...
  ```
- **Response**:
  - Automatically delete and retry (max 2 retries)
  - If retries fail: user manually retries with `--force`

### Database Connection Failed
- **Symptom**: Cannot connect to SQLite
- **Detection**: db.insert() fails in Steps 8 or 12
- **Response**:
  ```
  ✗ Database error: cannot update models table

  The file was downloaded successfully, but database update failed.
  Restart the server to recover: vxllm serve
  ```
- **Recovery**:
  - User restarts server (database recovers)
  - Model is still on disk, database will resync

### Model Variant Not Available
- **Symptom**: User requests --variant that doesn't exist
- **Detection**: variantData lookup fails in Step 5
- **Response**:
  ```
  Error: variant 'Q9_0' not available

  Available variants:
    - Q4_K_M (5.1 GB)
    - Q8_0 (8.5 GB)
    - IQ3_M (3.2 GB)
  ```
- **Recovery**:
  - User selects available variant: `vxllm pull llama3.1:8b --variant Q4_K_M`

### Concurrent Download Attempts
- **Symptom**: User runs `vxllm pull llama3.1:8b` twice simultaneously
- **Detection**: download_queue entry already exists with status "downloading"
- **Response**:
  ```
  ✗ Download already in progress

  Wait for current download to complete, or use:
  vxllm pull llama3.1:8b --force
  ```
- **Recovery**:
  - User waits for first download to finish
  - User uses --force to cancel and restart

### Partial File Corruption
- **Symptom**: Resume interrupted, but partial file is corrupted
- **Detection**: Size mismatch after resume in Step 11
- **Response**:
  ```
  ✗ Partial file corrupted

  Deleting corrupted file and starting fresh...
  ```
- **Recovery**:
  - Auto-delete and restart (max 2 attempts)

## Permissions
- **File System**: Write access to ~/.vxllm/models directory
- **Network**: Outbound HTTPS to huggingface.co
- **Database**: Write access to sqlite database
- **HuggingFace**: Optional API token for higher rate limits (HF_TOKEN env var)

## Exit Conditions
- **Success**: Download complete, file verified, database updated, exit code 0
- **User Cancel**: Ctrl+C pressed, partial file kept, exit code 130
- **Error**: Validation fails, network fails, disk full, etc., exit code 1
- **Resume Prompt**: Partial file detected, user chooses resume or restart

## Data Changes

### Tables Written
- **models**
  - Insert: new row if model doesn't exist
  - Update: status → "downloading", then "downloaded"
  - Update: localPath, sizeBytes, variant, downloadedAt

- **download_queue**
  - Insert: new queue entry at start
  - Update: progressPct, downloadedBytes, speedBps every 100ms
  - Update: status → "completed", completedAt on success

### Files Written
- **{models_dir}/{model_name}-{variant}.gguf** (model file)

## Related Documentation
- `/docs/cli/commands.md` — Full vxllm CLI reference
- `/docs/models/registry.md` — Model registry and available models
- `/docs/deployment/models.md` — Model management and storage
- `workflow-model-download.md` — Server-side download (same logic, async)
- `workflow-cli-serve.md` — Using --model flag with downloaded models

## Changelog
- **v1.0** (2026-03-20): Initial workflow documentation
  - Hardware detection and variant recommendation
  - Rich progress bar with ETA
  - SHA256 verification
  - Resume on interruption
  - Comprehensive error scenarios and recovery
