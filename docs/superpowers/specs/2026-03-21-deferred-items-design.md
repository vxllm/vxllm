# Deferred Items — Design Spec

> **Project:** VxLLM
> **Date:** 2026-03-21
> **Status:** Approved
> **Scope:** Kokoro TTS, WebSocket voice streaming, Prometheus metrics

---

## 1. Kokoro TTS Integration

Replace placeholder TTS engine with real Kokoro (v0.9.4, available on PyPI).

**File:** `sidecar/voice/app/engines/tts.py`

- Install `kokoro>=0.9` via uv
- Replace placeholder with `KPipeline(lang_code='a')`
- `synthesize_stream()` yields WAV chunks from `pipeline(text, voice, speed, split_pattern=r'[.!?]')`
- Voice list: query available voices from Kokoro
- Audio output: 24kHz mono WAV

**Voices to expose:**
- `af_heart` — Heart (Female, American)
- `af_sky` — Sky (Female, American)
- `am_michael` — Michael (Male, American)
- `bf_emma` — Emma (Female, British)

## 2. WebSocket Real-Time Voice Streaming

Two WebSocket endpoints on the Hono server using Bun's native WebSocket API.

### `WS /ws/audio/stream` — Real-time STT

- Client sends: binary PCM audio frames (16-bit, 16kHz, mono)
- Server proxies to Python sidecar `WS /stream`
- Server relays back: JSON `{ type: "partial" | "final", text, confidence? }`
- Bidirectional WebSocket proxy between client and sidecar

### `WS /ws/chat` — Full Voice Chat Loop

- Client sends: binary PCM audio frames
- Server orchestrates: audio → sidecar STT → LLM inference → sidecar TTS → audio back
- Server sends multiplexed events:
  - `{ type: "stt_partial", text }` — partial transcription
  - `{ type: "stt_final", text }` — final transcription
  - `{ type: "llm_token", text }` — LLM streaming token
  - `{ type: "llm_done" }` — LLM finished
  - Binary audio frames — TTS output chunks
  - `{ type: "turn_end" }` — full cycle complete

**Implementation:** Use Hono's `upgradeWebSocket()` helper or Bun's native `Bun.serve({ websocket: {...} })` pattern.

### Files

```
apps/server/src/routes/ws/
├── audio-stream.ts    # WS /ws/audio/stream (STT proxy)
└── chat-voice.ts      # WS /ws/chat (full voice loop)
```

## 3. Prometheus `/metrics` Endpoint

**File:** `apps/server/src/routes/metrics.ts`

`GET /metrics` returns Prometheus exposition format (text/plain):

```
# HELP vxllm_requests_total Total inference requests
# TYPE vxllm_requests_total counter
vxllm_requests_total{type="chat"} 42
vxllm_requests_total{type="completion"} 5
vxllm_requests_total{type="embedding"} 15
vxllm_requests_total{type="stt"} 8
vxllm_requests_total{type="tts"} 8

# HELP vxllm_request_latency_ms Request latency in milliseconds
# TYPE vxllm_request_latency_ms summary
vxllm_request_latency_ms_sum 12500
vxllm_request_latency_ms_count 70

# HELP vxllm_tokens_total Total tokens processed
# TYPE vxllm_tokens_total counter
vxllm_tokens_total{direction="in"} 5000
vxllm_tokens_total{direction="out"} 12000

# HELP vxllm_model_loaded Currently loaded model
# TYPE vxllm_model_loaded gauge
vxllm_model_loaded{name="qwen2.5:7b"} 1
```

Queries `usage_metrics` table for counts and aggregates. Skips auth (like `/health`).

---

## File Impact

| Area | Files Created | Files Modified |
|------|--------------|----------------|
| `sidecar/voice/` | 0 | 2 (tts.py, pyproject.toml) |
| `apps/server/src/routes/ws/` | 2 (audio-stream.ts, chat-voice.ts) | 0 |
| `apps/server/src/routes/` | 1 (metrics.ts) | 1 (index.ts — mount routes) |
| **Total** | **3** | **3** |

## Success Criteria

- [ ] `POST /speak` returns real Kokoro TTS audio (not silence)
- [ ] `WS /ws/audio/stream` receives audio frames and returns transcriptions
- [ ] `WS /ws/chat` completes full voice loop: audio → text → LLM → audio
- [ ] `GET /metrics` returns Prometheus-format text
- [ ] `bun run check-types` passes

---

*Spec version: 1.0 | Approved: 2026-03-21*
