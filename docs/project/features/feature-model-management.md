---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: Model Management

## Summary

Download, store, track, and manage GGUF models from HuggingFace Hub with progress reporting, integrity verification, and intelligent storage management. Provides user-friendly model discovery via curated registry and hardware-aware variant recommendations.

## Problem Statement

Users need a simple, intuitive way to discover and download GGUF models without manually navigating HuggingFace, managing complex file paths, or understanding quantization trade-offs. Currently, users must:
1. Visit HuggingFace manually
2. Copy model repo and file URLs
3. Use external tools (wget, curl, git-lfs) with no progress feedback
4. Manually place files in correct directories
5. Guess which quantization variant suits their hardware

This is a significant friction point. VxLLM must abstract away complexity while providing granular control for power users.

## User Stories

- As a beginner user, I want to find and install "Llama 3.1 8B" with one click so I can start chatting immediately without understanding quantization.
- As a power user, I want to see available quantization variants and their estimated VRAM usage so I can choose the best trade-off for my hardware.
- As a user with limited bandwidth, I want to pause/resume downloads so I can manage my internet connection without losing progress.
- As a storage-conscious user, I want to see disk usage per model and delete old models so I can reclaim space efficiently.
- As a developer, I want an API to list models, check download status, and trigger downloads programmatically.
- As an offline-first user, I want my app to work with locally cached models even if HuggingFace is unreachable.

## Scope

### In Scope
- **Model Registry**: Curated models.json index with metadata (repo URL, file names, quantization, VRAM estimate, architecture)
- **Download Pipeline**: Fetch GGUF files from HuggingFace Hub via @huggingface/hub SDK + Bun fetch with byte-range support
- **Progress Tracking**: Real-time download progress (bytes/s, ETA, %) stored in download_queue table
- **Storage Management**: Local filesystem storage at ~/.vxllm/models/ (configurable via MODELS_DIR env var)
- **Model Metadata**: Database tracking (models table) with size, hash, quantization, architecture, created_at, last_loaded_at
- **Model Listing**: Endpoint to list all installed models with size, metadata, hardware compatibility
- **Model Deletion**: Safely remove model files and database records; reclaim disk space
- **Download Queue**: Priority-based queue for concurrent downloads (max 2 simultaneous)
- **Pause/Resume**: Pause in-flight downloads; resume from last byte offset
- **Hardware Recommendations**: Suggest quantization variants based on available VRAM
- **Integrity Verification**: SHA256 hash validation of downloaded files
- **Auto-Retry**: Exponential backoff for failed downloads

### Out of Scope
- Model training or fine-tuning
- GGUF conversion (safetensors, PyTorch → GGUF)
- Custom model creation or upload
- Model sharing or publishing to HuggingFace
- Advanced search (filtered by architecture, license, rating)
- Model version pinning (always latest available)
- P2P distribution or torrenting

## Requirements

### Must Have
1. Display curated model list (via bundled models.json) with friendly names, size, and quantization info
2. Download GGUF files from HuggingFace with real-time progress (bytes downloaded, bytes/s, ETA minutes)
3. Persist download progress in download_queue table so interruptions don't lose state
4. Resume interrupted downloads from last byte offset (via HTTP Range header)
5. Track downloaded models in models table with metadata (size, hash, quantization, created_at)
6. List installed models with total disk usage
7. Delete models and remove from database; verify deletion
8. Support friendly name → HuggingFace repo resolution (e.g., "llama3.1:8b" → TheBloke/Llama-3.1-8B-Instruct-GGUF)
9. Model metadata validation (ensure GGUF file format before marking complete)
10. Error messages with clear remediation (e.g., "Storage full: need 5GB, have 1GB available")

### Should Have
1. Recommend quantization variant based on available VRAM (e.g., "Q4_K_M recommended for 8GB VRAM")
2. Verify file integrity via SHA256 hash from HuggingFace metadata
3. Concurrent downloads (max 2 simultaneous) to balance parallelism and network load
4. Auto-retry failed downloads with exponential backoff (1s → 2s → 4s → 8s, max 5 retries)
5. Disk space check before download; alert if insufficient
6. Download speed statistics (current speed, average speed, estimated time remaining)
7. Cancel in-flight download
8. Model search across HuggingFace (API call to search endpoint)

### Nice to Have
1. Direct URL download (for models hosted outside HuggingFace)
2. Bandwidth throttling (limit download speed for background transfers)
3. Disk space warning threshold (notify when free space < 2GB)
4. Model comparison table (size vs. speed trade-offs)
5. Automatic cleanup of failed/partial downloads
6. Model statistics (last used, load count, total inference tokens)

## UX

### Screens & Interactions

**Model Management Screen**
- Top: Download bar with friendly name, progress %, speed (MB/s), ETA, pause/cancel buttons
- Middle: Table of installed models
  - Columns: Model Name, Quantization, Size, Arch, Actions (Load, Delete)
  - Row expansion: Show VRAM estimate, context size, last used date
  - Sorting: By size, date added, last used
- Bottom: "Browse HuggingFace" or "Add Model by URL" advanced options

**Download Dialog**
- Title: "Download Model"
- Dropdown: Select from curated list (with search)
- Hardware info: "Your VRAM: 8GB. Recommended: Q4_K_M (4GB)."
- Button: "Download" (starts immediately)
- Progress: Real-time bar, bytes/s, ETA

**Empty State**
- "No models installed" with large "Download Your First Model" CTA
- Quick-start cards for popular models (Llama 3.1 8B, Mistral 7B, etc.)

**Error States**
- "Download failed: Connection timeout. Retrying... (2/5)"
- "Storage full: Need 5GB, have 1GB. Free up space or choose smaller model."
- "Model corrupted: Hash mismatch. Delete and re-download?"

### Visual Indicators
- Green checkmark: Model fully downloaded and verified
- Yellow clock: Download in progress
- Red X: Download failed or model corrupted
- Info icon: Shows VRAM estimate, context size, quantization details

## Business Rules

1. **Registry Source**: models.json fetched from GitHub on app startup; falls back to bundled version if network unavailable
2. **Storage Path**: All models stored at `{MODELS_DIR}/models/` where MODELS_DIR defaults to `~/.vxllm/`; configurable via environment variable
3. **Download Persistence**: Download progress saved to download_queue table with model_id, file_path, bytes_downloaded, total_bytes, status, error_message, last_attempt_at
4. **Single Download per Model**: If user requests same model twice, deduplicate to single queue entry
5. **Concurrent Limit**: Maximum 2 simultaneous downloads to avoid overwhelming network
6. **Retry Strategy**: Exponential backoff up to 5 retries; abandon after max retries with persistent error state
7. **Verification**: SHA256 hash from HuggingFace metadata compared against downloaded file; mismatch triggers re-download
8. **Deletion Safety**: Soft delete in DB (mark as deleted, hidden from UI); hard delete from filesystem only after user confirmation
9. **Model Metadata**: Include quantization, architecture, context_size, vocab_size, created_at, downloaded_at, file_hash in models table
10. **Friendly Names**: Mapping maintained in models.json; format is "{name}:{size}_{quant}" e.g., "llama3.1:8b_q4km"

## Edge Cases

### Empty States
- **No models in registry**: Seed models.json from bundled copy on first run; show setup wizard
- **Download queue empty**: Show empty state "No downloads in progress" with CTA to browse models
- **No internet connection**: Fall back to bundled models.json; prevent new downloads; show offline mode banner

### Boundary Conditions
- **Disk full during download**: Detect free space drop to < 100MB; pause download, alert user, offer to free space or cancel
- **Very large model (70B+)**: Estimate download time at user's current speed; show warning "This will take ~45 minutes at 5MB/s. Continue?"
- **Very small disk (< 500MB free)**: Prevent download of large models; recommend external storage
- **Model file extremely large (>100GB hypothetically)**: Split download into chunks (not applicable for current models, but future-proof)
- **Storage quota exceeded**: Return 507 Insufficient Storage with recommendation to delete models

### Concurrent Requests
- **Two users request same model simultaneously**: Deduplicate; both receive single progress stream via pub/sub
- **User requests model while different download in progress**: Queue second download; start when first completes or reaches concurrency limit
- **User attempts to load model while downloading**: Return 409 Conflict "Model still downloading. Wait or cancel download."
- **Download pause + model deletion request**: Pause takes precedence; deletion blocked until pause/resume completed

### Network Conditions
- **Download interrupted mid-transfer**: Save last byte offset; resume from Range: bytes={offset}- header
- **Corrupted chunk received**: Retry entire download from offset (fallback to full restart if Range not supported)
- **HuggingFace rate-limited (429)**: Exponential backoff with Retry-After header; show user "Service temporarily busy. Retrying in 30s..."
- **DNS failure**: Treat as network error; show offline mode prompt
- **Partial connectivity** (e.g., WiFi unreliable): Auto-pause if speed drops below 100KB/s for > 30s; alert user

### Data Integrity
- **Downloaded file hash mismatch**: Mark download as failed; quarantine file; prompt user to re-download; log warning
- **Partial file corruption mid-transfer**: Retry from last successful byte; if repeated failures, recommend full restart
- **models.json corrupted**: Detect via JSON parse failure; fall back to bundled version; log error
- **Model file deleted manually by user after download**: Detect on model load attempt; mark as missing; offer re-download

### Time-Based
- **Download stalled (0 bytes/s for > 60s)**: Timeout and retry
- **Model download queued but not started for hours**: No timeout imposed; user can manually cancel
- **Stale cache (models.json > 24 hours old)**: Re-fetch from GitHub on next startup attempt
- **Multiple retries over hours**: Log metrics; alert user after 10th failed attempt with suggestion to report issue

### Permission & Access
- **No write permission to MODELS_DIR**: Detect at startup; show error "Cannot write to {path}. Check permissions or change MODELS_DIR."
- **Read-only filesystem**: Prevent all downloads; show "Read-only storage detected. Download models to writable location."

## Success Criteria

1. **Download Performance**: Download 5GB model with accurate progress reporting; achieve > 90% of network bandwidth utilization
2. **Resume Capability**: Interrupt download, kill app, restart app, resume from last byte without re-downloading entire file
3. **List Performance**: List 20+ models and metadata in < 100ms
4. **Recommendation Accuracy**: Variant recommendations match user hardware (e.g., Q4_K_M for 8GB VRAM within ±1GB)
5. **Reliability**: Download 100 models sequentially without corruption; 0 hash mismatches
6. **Error Recovery**: All network failures (timeout, 429, DNS) handled gracefully with retry and user notification
7. **Metadata Accuracy**: Model metadata (size, hash) matches HuggingFace source; no stale cached metadata

## Dependencies

### Internal
- Drizzle ORM: models, download_queue table management
- SQLite: Persistent storage of model metadata and download progress
- Hono: HTTP endpoint routing
- oRPC: App-route type safety

### External
- **@huggingface/hub**: Model download SDK with built-in retry logic
- **Bun fetch API**: HTTP client with ReadableStream for progress tracking
- **HuggingFace Hub API**: Model metadata endpoint (GET /api/models/{repo_id})
- **GitHub API**: Fetch latest models.json (or serve via raw.githubusercontent.com)
- **Crypto module** (Node.js built-in): SHA256 hashing for integrity verification

### Runtime
- Filesystem access to ~/.vxllm/models/ directory (configurable)
- Network access to huggingface.co and GitHub

## Related Documentation

- **api-model-management.md**: REST API endpoints (GET /models, POST /models/{id}/download, DELETE /models/{id})
- **schema-models.md**: Database schema for models and download_queue tables
- **schema-download-queue.md**: Download queue table structure and status lifecycle
- **workflow-model-download.md**: End-to-end download flow with progress streaming
- **workflow-model-delete.md**: Safe deletion and cleanup pipeline
- **feature-inference.md**: Model loading into inference engine post-download

## Open Questions

1. **Model Variants**: Should users be able to download multiple quantization variants of the same model, or one per model? (Current: one per model to simplify UX)
2. **Custom Models**: Should we support user-added models not in curated registry? How to validate format? (Current: out of scope; Phase 2)
3. **Bandwidth Limits**: Should we implement throttling for metered connections? (Current: no; user stops downloads manually)
4. **P2P Distribution**: Phase 2 consideration — could peer nodes share model files via BitTorrent or IPFS?
5. **Model Analytics**: Should we track which models are most popular to bias curation? (Privacy consideration.)

## Changelog

### v1.0 (2026-03-20) — Initial Draft
- Defined model registry concept and HuggingFace integration
- Specified download pipeline with progress tracking and resume capability
- Outlined storage management and integrity verification
- Detailed hardware-aware variant recommendations
- Covered all edge cases and error recovery strategies
