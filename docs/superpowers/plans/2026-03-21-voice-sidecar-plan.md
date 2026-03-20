# Voice Sidecar + Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Python voice sidecar (STT/TTS/VAD via FastAPI), Hono proxy routes for OpenAI-compatible audio endpoints, and voice UI in the chat interface (recorder + TTS toggle).

**Architecture:** Python sidecar on port 11501 (FastAPI + faster-whisper + Kokoro + silero-vad). Hono server proxies audio requests to sidecar. Chat UI adds microphone recorder button and voice output toggle.

**Tech Stack:** Python 3.11+, uv, FastAPI, Uvicorn, faster-whisper, Kokoro, silero-vad, torch (CPU). Hono proxy. React MediaRecorder API.

**Spec:** `docs/superpowers/specs/2026-03-21-voice-sidecar-design.md`

---

## Task 1: Scaffold Python sidecar with uv

**Files:**
- Create: `sidecar/voice/pyproject.toml`
- Create: `sidecar/voice/app/__init__.py`
- Create: `sidecar/voice/app/main.py`
- Create: `sidecar/voice/app/config.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p sidecar/voice/app/routes sidecar/voice/app/engines
touch sidecar/voice/app/__init__.py
touch sidecar/voice/app/routes/__init__.py
touch sidecar/voice/app/engines/__init__.py
```

- [ ] **Step 2: Create `pyproject.toml`**

```toml
[project]
name = "vxllm-voice"
version = "0.1.0"
description = "VxLLM Voice Sidecar — STT, TTS, and VAD"
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
    "python-multipart>=0.0.9",
]

[project.scripts]
vxllm-voice = "app.main:start"
```

- [ ] **Step 3: Create config.py**

```python
import os

PORT = int(os.getenv("VOICE_SIDECAR_PORT", "11501"))
HOST = os.getenv("VOICE_SIDECAR_HOST", "127.0.0.1")
STT_MODEL = os.getenv("STT_MODEL", "large-v3-turbo")
TTS_VOICE = os.getenv("TTS_VOICE", "af_sky")
MODELS_DIR = os.path.expanduser(os.getenv("MODELS_DIR", "~/.vxllm/models"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
```

- [ ] **Step 4: Create main.py**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import PORT, HOST, CORS_ORIGINS

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: preload models
    from app.engines.stt import stt_engine
    from app.engines.tts import tts_engine
    from app.engines.vad import vad_engine
    yield
    # Shutdown: cleanup

app = FastAPI(title="VxLLM Voice Sidecar", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routes
from app.routes import transcribe, speak, stream, voices, health
app.include_router(transcribe.router)
app.include_router(speak.router)
app.include_router(stream.router)
app.include_router(voices.router)
app.include_router(health.router)

def start():
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False)
```

- [ ] **Step 5: Initialize uv and install dependencies**

```bash
cd sidecar/voice
uv init  # if pyproject.toml already exists, skip
uv sync
```

Note: `faster-whisper`, `kokoro`, and `torch` are large downloads. This may take several minutes. If `kokoro` is not available on PyPI, check the correct package name (it might be `kokoro-onnx` or installed from GitHub).

- [ ] **Step 6: Verify FastAPI starts**

```bash
cd sidecar/voice
uv run uvicorn app.main:app --port 11501
```

Expected: FastAPI starts (routes may error since engines aren't implemented yet, but the server runs).

- [ ] **Step 7: Commit**

```bash
git add sidecar/ && git commit -m "feat(voice): scaffold Python voice sidecar with FastAPI and uv"
```

---

## Task 2: Implement STT, TTS, and VAD engines

**Files:**
- Create: `sidecar/voice/app/engines/stt.py`
- Create: `sidecar/voice/app/engines/tts.py`
- Create: `sidecar/voice/app/engines/vad.py`

- [ ] **Step 1: Implement STT engine (faster-whisper)**

```python
# stt.py
from faster_whisper import WhisperModel
from app.config import STT_MODEL
import logging

logger = logging.getLogger(__name__)

class STTEngine:
    def __init__(self):
        self.model = None

    def load(self, model_size=None):
        size = model_size or STT_MODEL
        logger.info(f"Loading Whisper model: {size}")
        self.model = WhisperModel(size, device="auto", compute_type="auto")
        logger.info("Whisper model loaded")

    def transcribe(self, audio_path: str, language: str | None = None) -> dict:
        if not self.model:
            self.load()
        segments, info = self.model.transcribe(
            audio_path, language=language, beam_size=5, vad_filter=True
        )
        text = " ".join(s.text for s in segments).strip()
        return {
            "text": text,
            "language": info.language,
            "confidence": round(info.language_probability, 3),
            "duration_seconds": round(info.duration, 2),
        }

stt_engine = STTEngine()
```

- [ ] **Step 2: Implement TTS engine (Kokoro)**

```python
# tts.py
import io
import soundfile as sf
from app.config import TTS_VOICE
import logging

logger = logging.getLogger(__name__)

class TTSEngine:
    def __init__(self):
        self.pipeline = None
        self.voices = []

    def load(self, lang_code="a"):
        logger.info("Loading Kokoro TTS...")
        from kokoro import KPipeline
        self.pipeline = KPipeline(lang_code=lang_code)
        # Discover available voices
        self.voices = [
            {"id": "af_sky", "name": "Sky (Female)", "language": "en"},
            {"id": "am_michael", "name": "Michael (Male)", "language": "en"},
            {"id": "af_bella", "name": "Bella (Female)", "language": "en"},
        ]
        logger.info("Kokoro TTS loaded")

    def get_voices(self) -> list[dict]:
        return self.voices

    async def synthesize_stream(self, text: str, voice: str | None = None, speed: float = 1.0):
        if not self.pipeline:
            self.load()
        v = voice or TTS_VOICE
        for _, _, audio in self.pipeline(text, voice=v, speed=speed, split_pattern=r"[.!?]"):
            buf = io.BytesIO()
            sf.write(buf, audio, 24000, format="WAV")
            buf.seek(0)
            yield buf.read()

tts_engine = TTSEngine()
```

Note: The Kokoro package API may differ — verify `from kokoro import KPipeline` during implementation. If the package name or API is different, adapt accordingly.

- [ ] **Step 3: Implement VAD engine (silero-vad)**

```python
# vad.py
import torch
import numpy as np
import logging

logger = logging.getLogger(__name__)

class VADEngine:
    def __init__(self, threshold=0.5, min_silence_ms=500):
        self.model = None
        self.threshold = threshold
        self.min_silence_ms = min_silence_ms
        self.sample_rate = 16000

    def load(self):
        logger.info("Loading silero-vad...")
        self.model, _ = torch.hub.load("snakers4/silero-vad", "silero_vad")
        logger.info("silero-vad loaded")

    def is_speech(self, audio_chunk: bytes) -> bool:
        if not self.model:
            self.load()
        audio = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
        tensor = torch.from_numpy(audio)
        prob = self.model(tensor, self.sample_rate).item()
        return prob > self.threshold

    def reset(self):
        if self.model:
            self.model.reset_states()

vad_engine = VADEngine()
```

- [ ] **Step 4: Commit**

```bash
git add sidecar/ && git commit -m "feat(voice): implement STT (faster-whisper), TTS (Kokoro), and VAD (silero-vad) engines"
```

---

## Task 3: Implement sidecar routes

**Files:**
- Create: `sidecar/voice/app/routes/transcribe.py`
- Create: `sidecar/voice/app/routes/speak.py`
- Create: `sidecar/voice/app/routes/stream.py`
- Create: `sidecar/voice/app/routes/voices.py`
- Create: `sidecar/voice/app/routes/health.py`

- [ ] **Step 1: Implement /transcribe route**

```python
from fastapi import APIRouter, UploadFile, File, Form
from app.engines.stt import stt_engine
import tempfile, os

router = APIRouter()

@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form("whisper:large-v3-turbo"),
    language: str | None = Form(None),
):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = stt_engine.transcribe(tmp_path, language=language)
        return result
    finally:
        os.unlink(tmp_path)
```

- [ ] **Step 2: Implement /speak route**

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.engines.tts import tts_engine

router = APIRouter()

class SpeakRequest(BaseModel):
    text: str
    voice: str | None = None
    speed: float = 1.0

@router.post("/speak")
async def speak(req: SpeakRequest):
    return StreamingResponse(
        tts_engine.synthesize_stream(req.text, req.voice, req.speed),
        media_type="audio/wav",
    )
```

- [ ] **Step 3: Implement /stream WebSocket route**

```python
from fastapi import APIRouter, WebSocket
from app.engines.stt import stt_engine
from app.engines.vad import vad_engine
import tempfile, os, json

router = APIRouter()

@router.websocket("/stream")
async def audio_stream(ws: WebSocket):
    await ws.accept()
    audio_buffer = bytearray()
    silence_frames = 0

    try:
        while True:
            data = await ws.receive_bytes()
            audio_buffer.extend(data)

            if vad_engine.is_speech(data):
                silence_frames = 0
                # Could send partial transcription here
            else:
                silence_frames += 1

            # 500ms silence = end of speech (at 16kHz, ~8 frames of 1024 samples)
            if silence_frames >= 8 and len(audio_buffer) > 0:
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    import soundfile as sf
                    import numpy as np
                    audio = np.frombuffer(bytes(audio_buffer), dtype=np.int16)
                    sf.write(tmp.name, audio, 16000)

                result = stt_engine.transcribe(tmp.name)
                os.unlink(tmp.name)
                await ws.send_json({"type": "final", "text": result["text"], "confidence": result["confidence"]})
                audio_buffer.clear()
                silence_frames = 0
                vad_engine.reset()
    except Exception:
        pass
    finally:
        await ws.close()
```

- [ ] **Step 4: Implement /voices and /health**

Simple GET endpoints returning model status and voice list.

- [ ] **Step 5: Test sidecar**

```bash
cd sidecar/voice
uv run uvicorn app.main:app --port 11501

# In another terminal:
curl http://localhost:11501/health
curl http://localhost:11501/voices
```

- [ ] **Step 6: Commit**

```bash
git add sidecar/ && git commit -m "feat(voice): implement transcribe, speak, stream, voices, and health routes"
```

---

## Task 4: Hono proxy routes

**Files:**
- Create: `apps/server/src/routes/v1/audio/transcriptions.ts`
- Create: `apps/server/src/routes/v1/audio/speech.ts`
- Create: `apps/server/src/routes/v1/audio/voices.ts`
- Create: `apps/server/src/routes/ws/stream.ts`
- Modify: `apps/server/src/index.ts` (mount routes)

- [ ] **Step 1: Create transcriptions proxy**

```typescript
// POST /v1/audio/transcriptions → sidecar POST /transcribe
const audio = new Hono();

audio.post("/transcriptions", async (c) => {
  const sidecarUrl = env.VOICE_SIDECAR_URL;
  const body = await c.req.raw.clone().arrayBuffer();
  const headers = new Headers(c.req.raw.headers);

  const res = await fetch(`${sidecarUrl}/transcribe`, {
    method: "POST",
    headers,
    body,
  });

  const data = await res.json();
  return c.json({ text: data.text }); // OpenAI format
});
```

- [ ] **Step 2: Create speech proxy (streaming)**

```typescript
// POST /v1/audio/speech → sidecar POST /speak
audio.post("/speech", async (c) => {
  const body = await c.req.json();
  const res = await fetch(`${env.VOICE_SIDECAR_URL}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.input, voice: body.voice, speed: body.speed }),
  });

  // Stream through
  return new Response(res.body, {
    headers: { "Content-Type": "audio/wav", "Transfer-Encoding": "chunked" },
  });
});
```

- [ ] **Step 3: Create WebSocket proxy**

Bidirectional WS proxy: client ↔ Hono ↔ sidecar. Use Hono's WebSocket upgrade or Bun's native WS.

- [ ] **Step 4: Create voices proxy**

Simple GET passthrough to sidecar `/voices`.

- [ ] **Step 5: Mount all routes in index.ts**

```typescript
app.route("/v1/audio", audioRoutes);
app.route("/ws", wsRoutes);
```

- [ ] **Step 6: Verify**

```bash
bun run check-types
# Start both sidecar and server, then:
curl -X POST http://localhost:11500/v1/audio/transcriptions -F file=@test.wav
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/ && git commit -m "feat(server): add Hono proxy routes for audio endpoints"
```

---

## Task 5: Voice UI in chat

**Files:**
- Create: `apps/app/src/components/chat/voice-recorder.tsx`
- Create: `apps/app/src/components/chat/voice-toggle.tsx`
- Modify: `apps/app/src/components/chat/chat-input.tsx` (add recorder button)
- Modify: `apps/app/src/components/chat/chat-header.tsx` (add voice toggle)

- [ ] **Step 1: Create voice-recorder.tsx**

Microphone button with states: idle → recording → transcribing.

```tsx
export function VoiceRecorder({ onTranscription }: { onTranscription: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      setState("transcribing");
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      try {
        const res = await fetch("http://localhost:11500/v1/audio/transcriptions", {
          method: "POST", body: formData,
        });
        const data = await res.json();
        if (data.text) onTranscription(data.text);
      } catch (err) { console.error("Transcription failed:", err); }
      setState("idle");
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setState("recording");
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // Render: mic button (idle) / red pulsing stop button (recording) / spinner (transcribing)
}
```

- [ ] **Step 2: Create voice-toggle.tsx**

```tsx
export function VoiceToggle() {
  const [voiceOutput, setVoiceOutput] = useState(false);

  return (
    <Button variant={voiceOutput ? "default" : "ghost"} size="sm" onClick={() => setVoiceOutput(!voiceOutput)}>
      {voiceOutput ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      <span className="ml-1 text-xs">Voice</span>
    </Button>
  );
}
```

Voice output state needs to be shared with the message rendering layer. Use React context or lift state to the chat route.

- [ ] **Step 3: Wire TTS auto-play**

When voice toggle is ON and a new assistant message completes, call `/v1/audio/speech` with the response text and play the returned audio:

```typescript
const playTTS = async (text: string) => {
  const res = await fetch("http://localhost:11500/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "kokoro:v1.0", input: text, voice: "af_sky" }),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play();
};
```

Hook this into the chat flow: watch for `status` changing from `"streaming"` to `"ready"`, then play the last assistant message.

- [ ] **Step 4: Add recorder to chat-input.tsx**

Place `<VoiceRecorder>` next to the send button. When transcription returns, call `sendMessage({ text })`.

- [ ] **Step 5: Add toggle to chat-header.tsx**

Place `<VoiceToggle>` in the header next to the model selector.

- [ ] **Step 6: Verify**

```bash
bun run check-types
bun run dev:app
```

- [ ] **Step 7: Commit**

```bash
git add apps/app/ && git commit -m "feat(app): add voice recorder and TTS toggle to chat UI"
```

---

## Task 6: Final verification

- [ ] **Step 1: Start sidecar**

```bash
cd sidecar/voice && uv run uvicorn app.main:app --port 11501
```

- [ ] **Step 2: Start server**

```bash
bun run dev:server
```

- [ ] **Step 3: Start app**

```bash
bun run dev:app
```

- [ ] **Step 4: Test voice flow**

1. Click mic button → speak → click stop
2. Verify transcription appears as user message
3. Verify response streams
4. Toggle "Voice" ON
5. Send another voice message
6. Verify TTS auto-plays the response

- [ ] **Step 5: Test API directly**

```bash
# Transcription
curl -X POST http://localhost:11500/v1/audio/transcriptions -F file=@test.wav

# Speech
curl -X POST http://localhost:11500/v1/audio/speech -H "Content-Type: application/json" -d '{"model":"kokoro:v1.0","input":"Hello world","voice":"af_sky"}' --output test_output.wav

# Voices
curl http://localhost:11500/v1/audio/voices
```

- [ ] **Step 6: Commit fixes**

```bash
git add . && git commit -m "fix: resolve voice integration verification issues"
```

---

## Summary

| Task | Description | Stack |
|------|-------------|-------|
| 1 | Scaffold Python sidecar | Python, uv, FastAPI |
| 2 | STT/TTS/VAD engines | faster-whisper, Kokoro, silero-vad |
| 3 | Sidecar routes | FastAPI routes + WebSocket |
| 4 | Hono proxy routes | TypeScript, Hono |
| 5 | Voice UI | React, MediaRecorder, Audio API |
| 6 | Final verification | All |
