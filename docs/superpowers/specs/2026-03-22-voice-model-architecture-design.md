# Voice & Model Architecture Redesign

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Model management unification, voice service refactoring, streaming endpoints, CLI integration

## Problem

The current architecture has three independent model download paths (STT auto-downloads via faster-whisper, TTS auto-downloads via Kokoro, VAD auto-downloads via silero-vad), leading to:

- Models downloaded outside VxLLM's control (no progress tracking, no DB entries)
- Format mismatches when loading models (e.g., NeMo model passed to faster-whisper engine)
- Voice service always running even when unused (~200MB idle RAM)
- Two processes with poor coordination causing runtime bugs

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language stack | JS (Bun) for LLM/API/UI, Python for voice | CLI-first tool doesn't need Tauri packaging concerns. Python has richest STT/TTS ecosystem |
| Model ownership | Bun server is single source of truth | Eliminates dual-download paths, single DB, single storage |
| Voice auto-download | Removed (except VAD) | VAD is a tiny internal dependency (~2MB). STT/TTS are user-managed models |
| Voice process lifecycle | Lazy spawn on demand | No wasted resources for chat-only users. Faster startup |
| Control mechanism | HTTP API (POST /models/load) | Runtime hot-swapping, already implemented, health checking built-in |
| Model discovery | Curated registry + HF search | Curated = tested/verified models. HF = power user freedom |
| STT backends | Multi-backend with auto-detection | Backend hint from DB, file-based fallback detection |
| Streaming | Composable (existing) + unified voice-call (new) | Maximum flexibility. Composable for UI, unified for low-latency voice |
| Startup requirement | Voice service requires pre-downloaded models | No startup without models, clear error messages |

## Architecture

```
VxLLM (Bun, port 11500) — primary process, always running
├── LLM/Embedding inference: node-llama-cpp (in-process)
├── Model management: downloads, DB, registry, settings
├── API layer: oRPC + OpenAI-compatible routes
├── Voice process manager: spawns/kills Python process on demand
└── Voice-chat orchestrator: bridges STT→LLM→TTS for /ws/voice-chat

Python Voice Service (port 11501) — spawned on demand
├── STT engine: faster-whisper (+ NeMo stub for future)
├── TTS engine: Kokoro
├── VAD engine: silero-vad (auto-downloads, internal dependency)
└── Stateless: loads what it's told, no model management
```

### Model Loading Flow

```
User clicks "Load STT" in UI
  → Frontend: orpc.models.loadModel({ id, type: "stt" })
  → Bun model router:
      1. Read model row from DB (get localPath, backend)
      2. Validate localPath exists on disk
      3. voiceProcessManager.ensureRunning()
      4. POST http://localhost:11501/models/load { type, model_path, backend }
      5. If success: persistModelSetting("loaded_stt_id", modelId)
      6. Return success to frontend
  → Frontend: toast "STT model loaded", voice features enabled
```

## Section 1: Model Management — Single Source of Truth

VxLLM's Bun server owns all model storage, discovery, download, and lifecycle. The Python voice service is a stateless executor that loads what it's told.

### Model Storage Layout

```
~/.vxllm/models/
├── llm/           # GGUF files for node-llama-cpp
├── embedding/     # GGUF files for embedding models
├── stt/           # faster-whisper / NeMo model directories
└── tts/           # Kokoro .pth checkpoints
```

### Schema Change

Add `backend` column to `models` table:

```
backend TEXT  -- "llama-cpp" | "faster-whisper" | "nemo" | "kokoro" | "whisper-cpp" | null
```

- `type` = what the model does: `llm`, `embedding`, `stt`, `tts`
- `format` = file format: `gguf`, `whisper`, `kokoro`
- `backend` = which engine loads it: specific enough for voice service dispatch

### Auto-Detection Rules

| File signature | Detected type | Detected format | Detected backend |
|---------------|---------------|-----------------|-------------------|
| `.gguf` file | `llm` (or `embedding` if name contains `embed`) | `gguf` | `llama-cpp` |
| Directory with `model.bin` | `stt` | `whisper` | `faster-whisper` |
| `.nemo` file | `stt` | `nemo` | `nemo` |
| `.pth` file in TTS context | `tts` | `kokoro` | `kokoro` |
| Directory with `tokenizer.json` + `preprocessor_config.json` | `stt` | `whisper` | `faster-whisper` |

**Format enum update:** Add `"nemo"` to the `format` column enum: `["gguf", "whisper", "kokoro", "nemo"]`

### HF Download Dialog Changes

- Type selector stays (LLM / STT / TTS / Embedding)
- Add backend selector for STT and TTS types:
  - STT: "Auto-detect", "faster-whisper", "NeMo" (disabled, "coming soon")
  - TTS: "Auto-detect", "Kokoro"
- Auto-detect is the default

### Curated Registry

`models.json` entries gain a `backend` field:

```json
{
  "name": "whisper-large-v3-turbo",
  "displayName": "Whisper Large V3 Turbo",
  "type": "stt",
  "format": "whisper",
  "backend": "faster-whisper",
  "repo": "Systran/faster-whisper-large-v3",
  "downloadMethod": "repo"
}
```

### Validation on Model Load

Before sending to voice service, Bun checks: does the `localPath` exist? Does it contain the expected file signatures for the `backend`? Clear error messages on mismatch.

## Section 2: Voice Service — Stateless Executor

The Python voice service does one thing — run STT/TTS/VAD inference on models it's told to load. No model management, no auto-downloading, no state persistence.

### Startup Behavior

- NOT started on `vxllm serve` boot
- Spawned lazily when first voice model is loaded
- Killed when all voice models are unloaded (or on shutdown)
- `vxllm serve --voice` force-starts immediately

### Load API Contract

```
POST /models/load
{
  "type": "stt" | "tts",
  "model_path": "/absolute/path/to/model",
  "backend": "faster-whisper" | "nemo" | "kokoro" | null
}
```

- `backend` hint from DB. If `null`, engine auto-detects from file signatures
- Returns `200` with model info on success, `400` with specific error on format mismatch

### STT Engine Refactor

- Remove the 3-tier fallback search (pre-downloaded → scan dirs → auto-download)
- `load(model_path, backend)`: validate path → detect/confirm backend → load → done or error
- Backend detection: `model.bin` → faster-whisper, `.nemo` → NeMo, `.gguf` → whisper.cpp (future)
- NeMo support: stubbed as error ("NeMo backend not yet implemented")

### TTS Engine Refactor

- Remove `MODELS_DIR/tts/` scanning and Kokoro default resolution fallback
- `load(model_path, backend)`: validate `.pth` exists → load KPipeline with explicit path → done or error
- No more "silence placeholder" fallback — fail clearly

### VAD Engine

- Unchanged — keeps auto-downloading silero-vad (internal dependency, not user model)
- Loaded on first voice service boot

### Unload API Contract

```
POST /models/unload
{
  "type": "stt" | "tts"
}
```

Returns `200 { "success": true }`. Bun decides whether to kill the voice process based on whether both STT and TTS are now unloaded.

### TTS Error Handling (no more silence fallback)

When TTS fails to load or inference errors:
- `POST /speak` returns `503 { "error": "TTS model not loaded" }` or `500 { "error": "<specific error>" }`
- Frontend: shows toast "TTS unavailable — load a TTS model in Settings", disables voice output toggle
- `/ws/chat` voice-call mode: sends `{ "type": "error", "message": "TTS unavailable" }` and continues with text-only responses

### Health Endpoint

**Breaking change:** Response key changes from `models` to `engines` to better reflect the structure. Consumers (Bun model router's `voiceServiceRequest("/health")`) must be updated.

```json
{
  "status": "ok",
  "engines": {
    "stt": { "loaded": true, "backend": "faster-whisper", "model": "large-v3-turbo" },
    "tts": { "loaded": true, "backend": "kokoro", "model": "kokoro-v1.0" },
    "vad": { "loaded": true }
  }
}
```

## Section 3: Voice Lifecycle Management

The Bun server owns the Python voice process lifecycle.

### VoiceProcessManager

New module in `apps/server/src/voice/`:

```
VoiceProcessManager
├── spawn()         — start Python process, wait for /health 200
├── kill()          — graceful SIGTERM, force SIGKILL after 5s
├── isRunning()     — check process alive + /health reachable
├── ensureRunning() — spawn if not running, no-op if already up
└── getStatus()     — returns health response or null
```

### Spawn Triggers

- User loads an STT or TTS model → `ensureRunning()` before load request
- `vxllm serve --voice` flag → spawn on boot
- Persisted voice model settings on restart → spawn during startup

### Kill Triggers

- All voice models unloaded → kill after 10s grace period
- Server shutdown → kill alongside everything else
- Voice process crashes → one automatic restart attempt. If restart also fails, clear settings and show "Voice service crashed — Restart?" button in UI

### Port Management

- Default: `11501` from `VOICE_PORT` env var
- `VOICE_URL` is deprecated — Bun constructs it from `HOST` + `VOICE_PORT` since it owns the process
- Manager checks port is free before spawning
- Port passed as CLI arg when spawning

## Section 4: Streaming & Endpoints

Two streaming modes — composable for flexibility, unified voice-call for low-latency.

### Endpoint Map

```
Bun Server (port 11500)
├── /api/chat                    POST  — AI SDK v6 UIMessage stream (frontend)
├── /v1/chat/completions         POST  — OpenAI-compatible SSE (CLI, external)
├── /v1/audio/transcriptions     POST  — STT (proxy to voice service)
├── /v1/audio/speech             POST  — TTS (proxy to voice service)
├── /ws/audio/stream             WS    — Real-time VAD + STT (proxy to voice)
├── /ws/chat                     WS    — Unified audio→STT→LLM→TTS→audio loop (refactored from existing chat-voice.ts)
├── /rpc/*                       POST  — oRPC (models, conversations, settings)
└── /api/models/hf/*             POST  — HF search, files, download (existing REST routes)
```

### Composable Mode (existing)

Frontend orchestrates: record → `/v1/audio/transcriptions` → text → `/api/chat` → stream response → `/v1/audio/speech` → play audio. Each step independent.

### Unified Voice-Call Mode (new)

```
Client                          Bun Server                    Voice Service
  |-- raw audio frames (PCM) -->|                              |
  |                              |-- proxy to /ws/stream ----->|
  |                              |<-- transcription json ------|
  |                              |-- node-llama-cpp (stream)   |
  |                              |-- POST /speak ------------->|
  |                              |<-- WAV audio chunks --------|
  |<-- audio + text messages ----|                              |
```

### Voice-Call WebSocket Protocol

Client sends: raw PCM audio frames (16-bit LE, 16kHz mono, ~30ms chunks)

Server sends:
```json
{ "type": "vad", "is_speech": true }
{ "type": "transcript", "text": "hello", "language": "en" }
{ "type": "response_start" }
{ "type": "response_delta", "text": "I'm doing" }
{ "type": "response_delta", "text": " great!" }
{ "type": "response_end", "text": "I'm doing great!" }
{ "type": "audio", "data": "<base64 WAV chunk>" }
```

Bun orchestrates the loop. Voice service stays a dumb STT/TTS executor. LLM inference stays in-process.

**Breaking change from existing `chat-voice.ts`:** The existing implementation uses types `stt_result`, `llm_token`, `llm_done`, `tts_audio`, `turn_end`, `config_ack`. This spec replaces them with the protocol above. The existing `chat-voice.ts` file will be refactored in place (not a new file).

## Section 5: CLI Integration

CLI is the primary interface. Every operation is available as a command.

### Commands

```bash
# Model management
vxllm pull <model>                # Download from curated registry
vxllm pull <hf-repo> --file <f>   # Download from HuggingFace
vxllm list                        # List models with type/backend/status
vxllm rm <model>                  # Remove model + files

# Server
vxllm serve                       # Start Bun server (voice on demand)
vxllm serve --voice                # Start with voice service

# Model loading
vxllm run <model>                  # Load LLM + interactive chat
vxllm run <model> --voice          # Load LLM + default STT/TTS + voice chat

# Voice commands
vxllm voice load stt <model>       # Load STT (spawns voice service if needed)
vxllm voice load tts <model>       # Load TTS
vxllm voice unload stt             # Unload STT
vxllm voice unload tts             # Unload TTS
vxllm voice status                 # Show voice service status

# Voice testing
vxllm voice transcribe <file>      # Transcribe audio file
vxllm voice speak <text>           # Speak text to speaker

# Status
vxllm ps                           # Show loaded models + voice status
```

### Output Examples

`vxllm list`:
```
NAME                      TYPE    BACKEND          SIZE     STATUS
llama-3.2-1b-q4_k_m      llm     llama-cpp        0.8 GB   downloaded
whisper-large-v3-turbo    stt     faster-whisper   1.5 GB   downloaded  ✓ loaded
kokoro-v1.0               tts     kokoro           0.3 GB   downloaded  ✓ loaded
```

`vxllm ps`:
```
MODEL                     TYPE    MEMORY     SESSION
llama-3.2-1b-q4_k_m      llm     1.2 GB     abc123

VOICE SERVICE: running (port 11501)
  STT: whisper-large-v3-turbo (faster-whisper)
  TTS: kokoro-v1.0 (kokoro)
  VAD: silero-vad (auto)
```

## Section 6: Error Handling

Every failure returns an actionable error message. No silent failures.

| Scenario | Error message |
|----------|---------------|
| Python not installed | "Python 3.11+ is required for voice features. Install: `brew install python@3.12`" |
| Voice deps not installed | "Voice dependencies not installed. Run: `cd apps/voice && uv sync`" |
| Voice process crashes | 503: "Voice service stopped — reload models to restart" |
| NeMo model loaded | 400: "NeMo backend is not yet supported. Supported: faster-whisper" |
| Invalid model format | 400: "No model.bin found in directory — not a faster-whisper model" |
| Port conflict | "Port 11501 is in use. Set VOICE_PORT for a different port" |
| STT unloaded, TTS still loaded | Voice process stays running |
| Model file deleted from disk | Next inference fails, model marked "error", setting cleared |
| Concurrent load requests | Serialized per type, second waits for first |

### Health Check Strategy

- Bun pings `/health` every 30s (only when voice process is running)
- 3 consecutive failures → mark process dead, clear settings
- No polling when voice service is not running

## Migration

- `backend` column is nullable. Existing models default to `null`
- At read time, if `backend` is null: infer `"llama-cpp"` for `type=llm|embedding`, leave null for STT/TTS (user must re-download or manually set)
- Migration: `bun run db:generate` + `bun run db:push` (standard Drizzle flow)
- `VOICE_URL` env var deprecated — kept for backward compat but `VOICE_PORT` is the canonical setting

## Files to Create/Modify

### New Files
- `apps/server/src/voice/voice-process-manager.ts` — voice process lifecycle (server concern, not inference)
- `apps/cli/src/commands/voice.ts` — voice subcommand group

### Modified Files
- `packages/db/src/schema/models.ts` — add `backend` column, add `"nemo"` to format enum
- `packages/api/src/schemas/models.ts` — add `backend` to `ModelFilterInput`, `LoadModelInput`, `ModelOutput`
- `packages/api/src/routers/model.router.ts` — enhanced load/unload with voice lifecycle
- `packages/inference/src/types.ts` — add `backend` field to `ModelInfo` interface
- `apps/server/src/index.ts` — integrate voice process manager, update route registration
- `apps/server/src/routes/ws/chat-voice.ts` — refactor to new WebSocket protocol (not a new file)
- `apps/voice/app/engines/stt.py` — remove auto-download, add backend dispatch
- `apps/voice/app/engines/tts.py` — remove auto-download, explicit path loading only, remove silence fallback
- `apps/voice/app/main.py` — remove preload on startup, require explicit load calls
- `apps/voice/app/routes/models.py` — add `backend: str | None = None` to `LoadModelRequest`, accept backend hint
- `apps/voice/app/routes/health.py` — change response key from `models` to `engines`, return backend info
- `apps/cli/src/commands/serve.ts` — add --voice flag
- `apps/cli/src/commands/run.ts` — add --voice flag
- `apps/app/src/components/models/hf-download-dialog.tsx` — add backend selector for STT/TTS
- `models.json` — add curated STT/TTS models with backend field
- `packages/env/src/server.ts` — deprecate `VOICE_URL`, keep `VOICE_PORT` as canonical
