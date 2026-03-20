# Sub-project #9+10: Voice Sidecar + Integration — Design Spec

> **Project:** VxLLM
> **Sub-project:** 9+10 of 14 — Voice Sidecar (Python) + Voice Integration
> **Date:** 2026-03-21
> **Status:** Approved

---

## Context

Builds the Python voice sidecar (STT/TTS/VAD), Hono proxy routes (OpenAI-compatible audio endpoints), and voice UI in the chat interface. Per ADR-003, voice runs as a separate Python process for ecosystem access (faster-whisper, Kokoro, silero-vad) and fault isolation.

### Dependencies

- Sub-project #2 (Inference Engine): server running, env vars (VOICE_SIDECAR_URL)
- Sub-project #6 (Chat UI): chat input, header, useChat integration

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| Python sidecar: FastAPI + faster-whisper + Kokoro + silero-vad | Real-time WebSocket voice chat loop (full duplex) |
| POST /transcribe (file → text) | Voice cloning (F5-TTS) |
| POST /speak (text → streaming audio) | Continuous VAD mode (always listening) |
| WS /stream (real-time audio → text) | Multi-language voice profiles UI |
| Hono proxy: /v1/audio/transcriptions, /v1/audio/speech | |
| Voice recorder UI (click-to-start/stop) | |
| Voice output toggle (TTS auto-play for all responses when on) | |
| Voice list endpoint (/voices) | |

---

## Python Sidecar (`sidecar/voice/`)

### Structure

```
sidecar/voice/
├── pyproject.toml
├── uv.lock
├── app/
│   ├── main.py                # FastAPI app, CORS, lifespan (model preload)
│   ├── config.py              # Settings: port, model paths, defaults
│   ├── routes/
│   │   ├── transcribe.py      # POST /transcribe
│   │   ├── speak.py           # POST /speak
│   │   ├── stream.py          # WS /stream
│   │   ├── voices.py          # GET /voices
│   │   └── health.py          # GET /health
│   └── engines/
│       ├── stt.py             # faster-whisper wrapper
│       ├── tts.py             # Kokoro-82M wrapper
│       └── vad.py             # silero-vad wrapper
└── README.md
```

### Endpoints

**`POST /transcribe`**
- Input: multipart file upload (`audio/wav`, `audio/webm`, `audio/mp3`)
- Body: `file` (required), `model` (optional, default "whisper:large-v3-turbo"), `language` (optional)
- Process: Load audio → run faster-whisper transcription
- Output: `{ text: string, language: string, confidence: number, duration_seconds: number }`

**`POST /speak`**
- Input: JSON `{ text: string, voice?: string, speed?: number }`
- Default voice: "af_sky", default speed: 1.0
- Process: Kokoro TTS generates audio sentence-by-sentence
- Output: streaming `audio/wav` (chunked transfer encoding, 24kHz mono)

**`WS /stream`**
- Client sends: binary PCM audio frames (16-bit, 16kHz, mono)
- Server processes: silero-vad detects speech → faster-whisper transcribes
- Server sends: JSON `{ type: "partial" | "final", text: string, confidence?: number }`
- Partial transcripts sent during speech, final on silence detection (500ms)

**`GET /voices`**
- Returns: `{ voices: [{ id: string, name: string, language: string }] }`
- Lists available Kokoro voices

**`GET /health`**
- Returns: `{ status: "ok", models: { stt: string | null, tts: string | null, vad: boolean } }`

### Engine Wrappers

**`stt.py`** — faster-whisper
```python
class STTEngine:
    def __init__(self, model_size="large-v3-turbo", device="auto", compute_type="auto"):
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(self, audio_path, language=None):
        segments, info = self.model.transcribe(audio_path, beam_size=5, vad_filter=True)
        text = " ".join(s.text for s in segments)
        return { "text": text.strip(), "language": info.language, "confidence": info.language_probability }
```

**`tts.py`** — Kokoro-82M
```python
class TTSEngine:
    def __init__(self, lang_code="a"):
        self.pipeline = KPipeline(lang_code=lang_code)

    async def synthesize_stream(self, text, voice="af_sky", speed=1.0):
        for _, _, audio in self.pipeline(text, voice=voice, speed=speed, split_pattern=r"[.!?]"):
            buf = io.BytesIO()
            sf.write(buf, audio, 24000, format="WAV")
            yield buf.getvalue()
```

**`vad.py`** — silero-vad
```python
class VADEngine:
    def __init__(self, threshold=0.5, min_silence_ms=500):
        self.model, self.utils = torch.hub.load('snakers4/silero-vad', 'silero_vad')
        self.threshold = threshold
        self.min_silence_ms = min_silence_ms

    def is_speech(self, audio_chunk, sample_rate=16000):
        # Returns True if speech detected in chunk
```

### Dependencies (pyproject.toml)

```toml
[project]
name = "vxllm-voice"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "faster-whisper>=1.1",
    "kokoro>=0.9",
    "soundfile>=0.12",
    "numpy>=1.26",
    "torch>=2.3",
    "websockets>=13.0",
]
```

### Configuration

```python
# config.py
import os

PORT = int(os.getenv("VOICE_SIDECAR_PORT", "11501"))
HOST = os.getenv("VOICE_SIDECAR_HOST", "127.0.0.1")
STT_MODEL = os.getenv("STT_MODEL", "large-v3-turbo")
TTS_VOICE = os.getenv("TTS_VOICE", "af_sky")
MODELS_DIR = os.getenv("MODELS_DIR", "~/.vxllm/models")
```

---

## Hono Proxy Routes

### New route files in `apps/server/src/routes/`

**`v1/audio/transcriptions.ts`** — `POST /v1/audio/transcriptions`
- Accepts multipart file upload (same as OpenAI API)
- Proxies to sidecar `POST /transcribe` at `env.VOICE_SIDECAR_URL`
- Returns: `{ text: string }` (OpenAI format)

**`v1/audio/speech.ts`** — `POST /v1/audio/speech`
- Accepts JSON `{ model, input, voice, speed }`
- Proxies to sidecar `POST /speak`
- Returns: streaming `audio/wav` (passthrough)

**`ws/stream.ts`** — `WS /ws/stream`
- Bidirectional WebSocket proxy to sidecar `WS /stream`
- Client ↔ Hono ↔ sidecar

**`v1/audio/voices.ts`** — `GET /v1/audio/voices`
- Proxies to sidecar `GET /voices`

---

## Voice UI

### Components

**`apps/app/src/components/chat/voice-toggle.tsx`**
- Toggle button in chat header: speaker icon + "Voice" label
- When ON: all assistant responses auto-play via TTS
- Stored in local state (or zustand)
- Visual indicator: green dot when active

**`apps/app/src/components/chat/voice-recorder.tsx`**
- Microphone button next to chat input's send button
- **Click to start:** Button turns red with pulse animation, `MediaRecorder` captures audio
- **Click to stop:** Recording stops, audio blob sent to `/v1/audio/transcriptions`
- Transcribed text inserted into input → auto-sent as user message
- States: idle → recording → transcribing → done

**Audio pipeline:**
```
Click mic → getUserMedia({ audio: true })
→ MediaRecorder (webm/opus)
→ Click stop → blob
→ POST /v1/audio/transcriptions (multipart)
→ { text } response
→ sendMessage({ text })
→ [If voice toggle ON] → response text
→ POST /v1/audio/speech → Audio().play()
```

### Integration points

- `voice-recorder.tsx` sits next to the send button in `chat-input.tsx`
- `voice-toggle.tsx` sits in `chat-header.tsx`
- Voice output auto-play hooks into the `useChat` `onFinish` callback or watches message status

---

## File Impact

| Area | Files Created | Files Modified |
|------|--------------|----------------|
| `sidecar/voice/` | ~12 (pyproject, main, config, 5 routes, 3 engines, README) | 0 |
| `apps/server/src/routes/` | 4 (transcriptions, speech, stream WS, voices) | 1 (index.ts — mount routes) |
| `apps/app/src/components/chat/` | 2 (voice-toggle, voice-recorder) | 2 (chat-input, chat-header) |
| **Total** | **~18** | **~3** |

## Success Criteria

- [ ] `uv run uvicorn app.main:app --port 11501` starts the sidecar
- [ ] `POST /transcribe` transcribes an audio file
- [ ] `POST /speak` returns streaming audio
- [ ] `WS /stream` handles real-time audio transcription
- [ ] `GET /voices` lists Kokoro voices
- [ ] `POST /v1/audio/transcriptions` (Hono) proxies to sidecar
- [ ] `POST /v1/audio/speech` (Hono) proxies streaming audio
- [ ] Voice recorder in chat UI: click start, speak, click stop → transcribed text sent
- [ ] Voice toggle ON → assistant response auto-plays as TTS audio
- [ ] Voice toggle OFF → no audio playback
- [ ] `bun run check-types` passes (TypeScript side)

---

*Spec version: 1.0 | Approved: 2026-03-21*
