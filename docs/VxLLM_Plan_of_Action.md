# VxLLM — Open Source Local AI Server with Voice
### Detailed Plan of Action

> A unified, open-source model server inspired by Ollama/LM Studio — with first-class TTS/STT support,
> a Tauri 2 desktop GUI, OpenAI-compatible REST + WebSocket APIs, and support for both local and server deployment.

---

## Table of Contents
1. [Project Vision & Goals](#1-project-vision--goals)
2. [Technical Decisions & Rationale](#2-technical-decisions--rationale)
3. [Architecture Overview](#3-architecture-overview)
4. [Model Format & Backend Strategy](#4-model-format--backend-strategy)
5. [Model Sources & Registry](#5-model-sources--registry)
6. [Full Project Structure](#6-full-project-structure)
7. [API Design](#7-api-design)
8. [Inference Engine Details](#8-inference-engine-details)
9. [Voice Pipeline (STT + TTS)](#9-voice-pipeline-stt--tts)
10. [Desktop UI (Tauri 2)](#10-desktop-ui-tauri-2)
11. [CLI Design](#11-cli-design)
12. [Hardware Optimisation Strategy](#12-hardware-optimisation-strategy)
13. [Server / Cloud Deployment Mode](#13-server--cloud-deployment-mode)
14. [Phased Build Plan](#14-phased-build-plan)
15. [Open Source Strategy](#15-open-source-strategy)

---

## 1. Project Vision & Goals

VxLLM is an **open-source, self-hostable AI model server** that:

- Runs LLM, STT (Speech-to-Text), and TTS (Text-to-Speech) models locally or on a remote server
- Exposes a fully **OpenAI-compatible REST API** so any existing OpenAI SDK client works with zero changes
- Provides **real-time voice I/O** via WebSocket (microphone stream → STT → LLM → TTS → audio out)
- Has a **Tauri 2 desktop app** for non-technical users (like LM Studio) and a CLI for developers (like Ollama)
- Is **hardware-aware** — auto-detects GPU/CPU/Apple Silicon and picks the best backend + quantization
- Supports models from **HuggingFace Hub** in GGUF and MLX formats
- Can be deployed as a **server** on cloud VMs with Docker, not just locally

### What Makes It Different from Ollama / LM Studio

| Feature | Ollama | LM Studio | VxLLM |
|---|---|---|---|
| Open source | ✅ | ❌ | ✅ |
| Voice (TTS/STT) | ❌ | ❌ | ✅ |
| Real-time WebSocket voice | ❌ | ❌ | ✅ |
| MLX backend (Apple Silicon) | ✅ | ✅ | ✅ |
| GGUF backend | ✅ | ✅ | ✅ |
| Desktop GUI | ❌ | ✅ | ✅ |
| CLI | ✅ | ❌ | ✅ |
| Server/Cloud mode | Partial | ❌ | ✅ |
| Go wrapper overhead | ✅ (~38% slower) | N/A | ❌ (direct native calls) |
| Embeddable / modular | ❌ | ❌ | ✅ |

---

## 2. Technical Decisions & Rationale

### Backend Language: Python + FastAPI

**Decision: Python with FastAPI + Uvicorn**

Rationale:
- Python has the deepest AI/ML native library ecosystem — `faster-whisper`, `kokoro`, `mlx-lm`, `huggingface_hub` all have Python-first bindings
- FastAPI provides async-native SSE streaming, WebSocket, and OpenAPI docs out of the box
- Performance is not bottlenecked by Python — all actual inference is delegated to native binaries (llama.cpp) or C-backed libraries (CTranslate2, MLX)
- Bun/Node.js rejected: zero native bindings for any inference library

**NOT using:**
- `llama-cpp-python` for serving — the raw `llama.cpp` server binary is ~28% faster
- Django/Flask — too heavy and not async-native
- Bun — no AI library ecosystem

### Desktop UI: Tauri 2 + React + Tailwind

**Decision: Tauri 2 (Rust backend) + React/TypeScript + Tailwind CSS**

Rationale:
- Tauri 2 binary is ~5MB vs ~150MB for Electron (no bundled Chromium)
- Rust backend handles child process management for llama.cpp/Python subprocesses natively
- System tray, auto-start, and OS-level notifications via Tauri plugins
- React frontend talks to `localhost:11500` — UI and API are fully decoupled
- Tailwind is the user's preferred CSS framework

### Inference Backends: llama.cpp + MLX (Dual)

**Decision: Both backends, selected at runtime based on hardware**

- **GGUF via llama.cpp native binary** → Windows, Linux, macOS Intel, all NVIDIA/AMD GPUs, CPU-only
- **MLX via `mlx-lm`** → Apple Silicon (M1/M2/M3/M4) ONLY — significantly faster for generation tasks on M2+
- Backend is abstracted behind a unified Python interface — the FastAPI layer never knows which is running

### Model Formats

| Format | Backend | Platform | Notes |
|---|---|---|---|
| GGUF | llama.cpp binary | Universal | Primary format, supports all quantizations |
| MLX (4-bit, 8-bit) | mlx-lm Python lib | Apple Silicon only | ~2x faster generation on M2+ |
| Safetensors | Import only | Any | Auto-converted to GGUF/MLX on import |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    VxLLM Desktop (Tauri 2)             │
│  React UI (localhost:11500)  ←→  Rust process manager   │
└─────────────────┬───────────────────────┬───────────────┘
                  │ HTTP / WebSocket       │ IPC (Tauri commands)
                  ▼                        ▼
┌─────────────────────────────┐  ┌────────────────────────┐
│   FastAPI Gateway           │  │  llama.cpp server       │
│   Python + Uvicorn          │  │  (C++ binary, port 8080)│
│   Port: 11500               │◄─►  spawned as subprocess  │
│   OpenAI-compatible API     │  └────────────────────────┘
│   WebSocket voice pipeline  │
│   Model registry            │  ┌────────────────────────┐
│   Hardware detection        │  │  MLX backend (macOS)    │
└─────────────────────────────┘  │  mlx-lm Python process  │
          │                      └────────────────────────┘
          │
    ┌─────┴──────┐
    │            │
┌───▼───┐  ┌────▼────┐
│Whisper│  │ Kokoro  │
│faster-│  │ TTS     │
│whisper│  │ (82M)   │
└───────┘  └─────────┘
```

**Data flow for a voice chat request:**
```
Microphone audio (PCM chunks via WebSocket)
    → silero-vad (detect end of speech)
    → faster-whisper (transcribe to text)
    → llama.cpp / mlx-lm (generate response text, streaming)
    → Kokoro TTS (text → audio chunks, streaming)
    → Audio playback in UI
```

---

## 4. Model Format & Backend Strategy

### Backend Router Logic (config.py)

```python
def select_backend(model_name: str, hardware: HardwareProfile) -> Backend:
    if hardware.platform == "darwin" and hardware.is_apple_silicon:
        # Check if MLX variant exists in registry
        if registry.has_mlx(model_name):
            return MLXBackend(model_name)
    # Fallback to llama.cpp GGUF for all other cases
    return LlamaCppBackend(model_name)
```

### Hardware Profile Auto-Detection

```python
@dataclass
class HardwareProfile:
    platform: str           # darwin | linux | windows
    is_apple_silicon: bool  # True for M1/M2/M3/M4
    gpu_vram_gb: float      # NVIDIA/AMD VRAM
    system_ram_gb: float
    cpu_physical_cores: int
    recommended_gpu_layers: int   # auto-calculated
    recommended_quantization: str # Q4_K_M, Q5_K_M, Q8_0
```

### Model Registry Entry Structure (models.json)

```json
{
  "name": "llama3.1:8b",
  "display_name": "Llama 3.1 8B Instruct",
  "description": "Meta's Llama 3.1, 8B parameters. Best for general chat.",
  "type": "llm",
  "min_ram_gb": 6,
  "recommended_vram_gb": 8,
  "variants": {
    "gguf_q4_k_m": {
      "repo": "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
      "file": "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
      "size_gb": 4.9
    },
    "gguf_q8_0": {
      "repo": "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
      "file": "Meta-Llama-3.1-8B-Instruct-Q8_0.gguf",
      "size_gb": 8.5
    },
    "mlx_4bit": {
      "repo": "mlx-community/Meta-Llama-3.1-8B-Instruct-4bit",
      "size_gb": 4.5
    }
  },
  "tags": ["chat", "instruct", "general"]
}
```

---

## 5. Model Sources & Registry

### Primary Sources

| Source | Model Types | How |
|---|---|---|
| HuggingFace Hub | LLM (GGUF), LLM (MLX), STT, TTS weights | `huggingface_hub` Python library |
| `mlx-community` HF org | Pre-quantized MLX models | Direct HF pull |
| Direct URL | Any `.gguf` file | HTTP download with progress |
| Local file import | `.gguf`, `.safetensors` | File picker in UI, auto-convert if needed |
| VxLLM model index | Curated friendly names | `models.json` hosted on GitHub |

### VxLLM Curated Model Index

Maintain a community-contributed `models.json` in the GitHub repo that maps:
- Friendly name (`llama3.2:3b`) → HuggingFace repo + filename
- Hardware recommendations per model
- Model type tags: `llm`, `stt`, `tts`, `embedding`
- Trusted community sources (bartowski, mlx-community, unsloth, etc.)

### STT Model Sources

| Model | Source | Size | Speed |
|---|---|---|---|
| Whisper tiny | HuggingFace (auto via faster-whisper) | 75MB | Fastest |
| Whisper base | HuggingFace | 145MB | Fast |
| Whisper small | HuggingFace | 466MB | Balanced |
| Whisper large-v3 | HuggingFace | 1.5GB | Most accurate |
| Whisper large-v3-turbo | HuggingFace | 809MB | Best balance 2026 |

### TTS Model Sources

| Model | Source | Size | Quality |
|---|---|---|---|
| Kokoro v1.1 | `hexgrad/Kokoro-82M` HuggingFace | ~330MB | Excellent |
| F5-TTS | `SWivid/F5-TTS` HuggingFace | ~1.2GB | Voice cloning |
| Chatterbox | HuggingFace | ~800MB | Emotional TTS |

---

## 6. Full Project Structure

```
vxllm/
├── core/
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── backend_router.py       # Hardware detection → backend selector
│   │   ├── llama_cpp_backend.py    # llama.cpp server subprocess manager
│   │   ├── mlx_backend.py          # mlx-lm inference wrapper (macOS only)
│   │   ├── stt.py                  # faster-whisper wrapper
│   │   ├── tts.py                  # Kokoro / F5-TTS wrapper
│   │   ├── vad.py                  # silero-vad voice activity detection
│   │   └── embeddings.py           # llama.cpp /embeddings proxy
│   ├── models/
│   │   ├── registry.py             # Load/query models.json manifest
│   │   ├── downloader.py           # HuggingFace Hub + direct URL download
│   │   ├── converter.py            # safetensors → GGUF via llama.cpp script
│   │   └── storage.py              # ~/.vxllm/models/ path management
│   ├── hardware/
│   │   ├── detect.py               # GPU VRAM, CPU cores, platform detection
│   │   └── recommendations.py      # Auto-calc gpu_layers, quantization tier
│   └── config.py                   # Global config, env vars, paths
│
├── api/
│   ├── routes/
│   │   ├── chat.py                 # POST /v1/chat/completions (SSE stream)
│   │   ├── completions.py          # POST /v1/completions
│   │   ├── embeddings.py           # POST /v1/embeddings
│   │   ├── audio_stt.py            # POST /v1/audio/transcriptions
│   │   ├── audio_tts.py            # POST /v1/audio/speech (streaming)
│   │   ├── models.py               # GET /v1/models, POST /api/models/pull
│   │   └── health.py               # GET /health, GET /metrics
│   ├── websockets/
│   │   ├── audio_stream.py         # WS /ws/audio/stream (real-time STT)
│   │   └── chat_voice.py           # WS /ws/chat (full voice chat loop)
│   ├── middleware/
│   │   ├── auth.py                 # Optional API key validation
│   │   ├── cors.py                 # Configurable CORS origins
│   │   └── logging.py              # Request/response logging
│   └── main.py                     # FastAPI app, route registration, lifespan
│
├── cli/
│   ├── __main__.py                 # Entry: `python -m vxllm` or `vxllm`
│   ├── commands/
│   │   ├── serve.py                # vxllm serve [--port] [--no-ui]
│   │   ├── pull.py                 # vxllm pull <model>
│   │   ├── run.py                  # vxllm run <model> (interactive chat)
│   │   ├── list_models.py          # vxllm list
│   │   ├── ps.py                   # vxllm ps (running models + memory)
│   │   └── rm.py                   # vxllm rm <model>
│   └── utils/
│       ├── progress.py             # Rich progress bars for downloads
│       └── table.py                # Rich table formatting for list/ps
│
├── ui/                             # Tauri 2 desktop app
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs             # Tauri app entry
│   │   │   ├── process.rs          # Spawn/kill vxllm Python server
│   │   │   ├── tray.rs             # System tray icon + menu
│   │   │   └── commands.rs         # Tauri IPC commands
│   │   ├── tauri.conf.json
│   │   └── Cargo.toml
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Chat.tsx            # Chat UI with voice input button
│   │   │   ├── Models.tsx          # Model library + download manager
│   │   │   ├── Settings.tsx        # Server config, GPU layers, port
│   │   │   └── Dashboard.tsx       # API stats, GPU/CPU/RAM meters
│   │   ├── components/
│   │   │   ├── VoiceButton.tsx     # Hold-to-talk / VAD toggle
│   │   │   ├── AudioPlayer.tsx     # TTS response playback
│   │   │   ├── ModelCard.tsx       # Model install card
│   │   │   ├── DownloadProgress.tsx
│   │   │   └── HardwareStats.tsx   # Real-time GPU/RAM gauges
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts     # WS connection for voice stream
│   │   │   ├── useMicrophone.ts    # getUserMedia + PCM chunking
│   │   │   └── useModelRegistry.ts # Fetch /v1/models
│   │   ├── lib/
│   │   │   └── api.ts              # Typed API client (fetch wrapper)
│   │   └── App.tsx
│   └── package.json
│
├── docker/
│   ├── Dockerfile.cpu              # Python + llama.cpp CPU build
│   ├── Dockerfile.gpu              # CUDA 12.x + llama.cpp CUDA build
│   ├── docker-compose.yml          # Full stack: gateway + llama.cpp + kokoro
│   └── .env.example
│
├── scripts/
│   ├── install_llamacpp.py         # Download correct llama.cpp binary for OS/arch
│   ├── install_kokoro.py           # Download Kokoro weights
│   └── build_tauri.sh              # Cross-platform Tauri build script
│
├── models.json                     # Curated model index (community-maintained)
├── pyproject.toml                  # Python package config (uv / pip)
├── requirements.txt
└── README.md
```

---

## 7. API Design

### OpenAI-Compatible Endpoints

All endpoints mirror OpenAI's API spec — any OpenAI SDK works by changing `base_url`:

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11500/v1", api_key="vxllm")
```

#### LLM Endpoints

```
POST /v1/chat/completions       # Streaming SSE + non-streaming
POST /v1/completions            # Raw completion
POST /v1/embeddings             # Embedding vectors
GET  /v1/models                 # List all downloaded models
```

#### Audio Endpoints

```
POST /v1/audio/transcriptions   # File upload → transcription (Whisper)
     Content-Type: multipart/form-data
     Body: { file: <audio>, model: "whisper:large-v3", language: "en" }

POST /v1/audio/speech           # Text → streaming audio (Kokoro)
     Body: { model: "kokoro:v1.1", input: "Hello", voice: "af_sky", speed: 1.0 }
     Response: audio/mpeg stream (chunked)
```

#### Model Management Endpoints

```
POST /api/models/pull           # Download a model { name: "llama3.2:3b" }
POST /api/models/delete         # Delete a model
GET  /api/models/status         # Download progress for in-flight downloads
GET  /health                    # Server health check
GET  /metrics                   # Prometheus-format metrics
```

#### WebSocket Endpoints

```
WS /ws/audio/stream
  # Client sends: PCM 16-bit mono 16kHz audio chunks (binary frames)
  # Server sends: { type: "partial", text: "Hello" } JSON frames
  #               { type: "final", text: "Hello world." } on VAD silence
  #               { type: "error", message: "..." }

WS /ws/chat
  # Full voice chat loop:
  # Client sends: audio chunks
  # Server sends: transcript, then LLM tokens, then TTS audio chunks
  # All multiplexed over one WebSocket connection
```

---

## 8. Inference Engine Details

### llama.cpp Backend

**Key principle:** Spawn the `llama.cpp` server binary as a subprocess — do NOT use `llama-cpp-python` for serving (28% slower due to Python GIL overhead).

```python
# llama_cpp_backend.py
class LlamaCppBackend:
    def __init__(self, model_path: str, hardware: HardwareProfile):
        self.process = None
        self.base_url = "http://127.0.0.1:8080"
        self.args = self._build_args(model_path, hardware)

    def _build_args(self, model_path, hw) -> list[str]:
        args = [
            LLAMACPP_BINARY_PATH,
            "--model", model_path,
            "--port", "8080",
            "--host", "127.0.0.1",
            "--n-gpu-layers", str(hw.recommended_gpu_layers),
            "--ctx-size", "8192",
            "--batch-size", "512",
            "--threads", str(hw.cpu_physical_cores - 1),
            "--cache-type-k", "q8_0",    # KV cache quantization
            "--cache-type-v", "q8_0",
            "--flash-attn",              # Flash attention (reduces VRAM)
            "--parallel", "4",           # Concurrent request slots
            "--cont-batching",           # Continuous batching for throughput
        ]
        return args

    async def chat(self, messages, stream=True) -> AsyncIterator[str]:
        # Proxy to llama.cpp OpenAI-compatible /v1/chat/completions
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{self.base_url}/v1/chat/completions",
                                     json={"messages": messages, "stream": stream}) as r:
                async for chunk in r.aiter_text():
                    yield chunk
```

### MLX Backend (Apple Silicon only)

```python
# mlx_backend.py  — only imported on darwin + Apple Silicon
from mlx_lm import load, generate, stream_generate

class MLXBackend:
    def __init__(self, model_repo: str):
        self.model, self.tokenizer = load(model_repo)

    async def chat(self, messages, stream=True) -> AsyncIterator[str]:
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False)
        for token in stream_generate(self.model, self.tokenizer, prompt, max_tokens=2048):
            yield token
```

### llama.cpp Optimization Flags Reference

| Flag | Purpose | When to Use |
|---|---|---|
| `--n-gpu-layers 99` | Offload all layers to GPU | When VRAM fits the model |
| `--flash-attn` | Reduce KV cache VRAM by ~30% | Always (if supported) |
| `--cache-type-k q8_0` | Quantize K cache | Always for VRAM savings |
| `--cache-type-v q8_0` | Quantize V cache | Always for VRAM savings |
| `--cont-batching` | Handle multiple requests efficiently | Server mode |
| `--parallel 4` | Concurrent request slots | Server mode |
| `--mmap` | Memory-map model file | CPU/low RAM systems |
| `--numa` | NUMA-aware thread allocation | Multi-socket CPUs |

### Quantization Tier Auto-Selection

```python
def recommend_quantization(vram_gb: float, model_params_b: float) -> str:
    model_size_q4 = model_params_b * 0.5   # ~0.5 GB per billion params at Q4
    model_size_q8 = model_params_b * 1.0   # ~1.0 GB per billion params at Q8

    if vram_gb == 0:  # CPU only
        return "Q4_K_M"   # Best speed/quality for CPU
    elif vram_gb >= model_size_q8 * 1.2:
        return "Q8_0"     # Near full quality
    elif vram_gb >= model_size_q4 * 1.2:
        return "Q4_K_M"   # Best quantized quality
    else:
        return "Q4_K_S"   # Partial GPU offload
```

---

## 9. Voice Pipeline (STT + TTS)

### STT: faster-whisper

```python
# stt.py
from faster_whisper import WhisperModel

class STTEngine:
    def __init__(self, model_size="large-v3-turbo", device="auto", compute_type="auto"):
        # compute_type: "float16" on CUDA, "int8" on CPU — auto-detected
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(self, audio_path: str, language=None) -> str:
        segments, info = self.model.transcribe(audio_path, language=language,
                                                beam_size=5, vad_filter=True)
        return " ".join(s.text for s in segments)

    async def transcribe_stream(self, audio_chunks: AsyncIterator[bytes]) -> AsyncIterator[str]:
        # Buffer chunks, run VAD, transcribe on detected utterances
        ...
```

### VAD: silero-vad

Used in the WebSocket endpoint to detect when the user stops speaking:

```python
# vad.py
import torch
model, utils = torch.hub.load('snakers4/silero-vad', 'silero_vad')
(get_speech_timestamps, _, read_audio, *_) = utils

def detect_speech_end(audio_buffer: bytes, sample_rate=16000) -> bool:
    # Returns True when silence detected after speech
    ...
```

### TTS: Kokoro-82M

```python
# tts.py
from kokoro import KPipeline
import soundfile as sf
import io

class TTSEngine:
    def __init__(self, lang_code="a"):  # "a" = American English
        self.pipeline = KPipeline(lang_code=lang_code)

    async def synthesize_stream(self, text: str, voice="af_sky", speed=1.0) -> AsyncIterator[bytes]:
        # Stream audio chunks as they are generated
        generator = self.pipeline(text, voice=voice, speed=speed, split_pattern=r"[.!?]")
        for _, _, audio in generator:
            buf = io.BytesIO()
            sf.write(buf, audio, 24000, format="WAV")
            yield buf.getvalue()
```

### Real-Time Voice Chat WebSocket Flow

```
Client WebSocket /ws/chat
│
├─ Client → Server: { type: "config", stt_model: "whisper:large-v3-turbo",
│                     llm_model: "llama3.1:8b", tts_model: "kokoro:v1.1",
│                     voice: "af_sky" }
│
├─ Client → Server: <binary PCM audio chunks>  (16-bit, 16kHz, mono)
│
├─ VAD detects end of speech
│   └─ Server → Client: { type: "stt_partial", text: "Hello, how are..." }
│   └─ Server → Client: { type: "stt_final", text: "Hello, how are you?" }
│
├─ LLM generates response (streaming tokens)
│   └─ Server → Client: { type: "llm_token", text: "I " }
│   └─ Server → Client: { type: "llm_token", text: "am " }
│   ...
│
├─ TTS synthesizes sentence by sentence (parallel to LLM generation)
│   └─ Server → Client: <binary audio chunk>  (WAV/PCM)
│   └─ Server → Client: <binary audio chunk>
│   ...
│
└─ Server → Client: { type: "turn_end" }
```

---

## 10. Desktop UI (Tauri 2)

### Tauri Rust Backend Responsibilities

```rust
// process.rs — manages the vxllm Python server process
use std::process::{Command, Child};

pub struct VxLLMServer {
    process: Option<Child>,
    port: u16,
}

impl VxLLMServer {
    pub fn start(&mut self) -> Result<()> {
        let child = Command::new("python")
            .args(["-m", "vxllm", "serve", "--port", &self.port.to_string(), "--no-ui"])
            .spawn()?;
        self.process = Some(child);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(mut p) = self.process.take() {
            let _ = p.kill();
        }
    }
}
```

### UI Screens

**1. Chat Screen**
- Message thread with user/assistant bubbles
- Voice input: hold-to-talk button OR continuous VAD toggle
- TTS playback toggle (auto-play assistant responses as audio)
- Model selector dropdown (LLM + STT + TTS independently selectable)
- Token/sec counter in footer

**2. Model Library**
- Grid of model cards grouped by type (LLM / STT / TTS)
- Each card shows: name, size, hardware requirement badge, "Install" button
- Download manager with progress bars, pause/resume
- Search and filter by type/size/tag
- "Installed" tab showing local models with disk usage

**3. Dashboard**
- Real-time GPU VRAM usage gauge (via `nvidia-smi` / Metal API)
- CPU + RAM usage
- Active requests counter
- Tokens/sec throughput graph (rolling 60s)
- Copy API base URL (`http://localhost:11500/v1`)

**4. Settings**
- Port configuration
- Model storage path
- GPU layer override (manual or auto)
- Default context size
- CORS allowed origins (for server mode)
- API key (server mode)
- Startup behavior (auto-start server on app open)

---

## 11. CLI Design

Built with **Python Typer** (modern, typed, auto-generates help text):

```
vxllm serve                     Start server (default port 11500)
  --port INT                      Custom port
  --no-ui                         Headless mode (server deployment)
  --model TEXT                    Pre-load a model at startup
  --host TEXT                     Bind host (default: 127.0.0.1, use 0.0.0.0 for server)

vxllm pull llama3.1:8b          Download LLM model (auto-selects GGUF or MLX)
vxllm pull llama3.1:8b --gguf   Force GGUF format
vxllm pull llama3.1:8b --mlx    Force MLX format
vxllm pull whisper:large-v3     Download STT model
vxllm pull kokoro:v1.1          Download TTS model
vxllm pull https://...file.gguf Download from direct URL

vxllm run llama3.1:8b           Interactive CLI chat (streams to terminal)
  --system TEXT                   System prompt
  --voice                         Enable voice I/O in terminal

vxllm list                      List all downloaded models + disk usage
vxllm ps                        Show currently loaded models + memory usage
vxllm rm llama3.1:8b            Remove a downloaded model

vxllm convert ./model.safetensors  Convert safetensors → GGUF
  --quantize Q4_K_M

vxllm info                      Show hardware profile + recommendations
```

---

## 12. Hardware Optimisation Strategy

### Auto GPU Layer Calculation

```python
def calculate_gpu_layers(model_params_b: float, quant: str, vram_gb: float) -> int:
    bytes_per_param = {"Q4_K_M": 0.56, "Q5_K_M": 0.70, "Q8_0": 1.0, "F16": 2.0}
    bpp = bytes_per_param.get(quant, 0.56)
    model_gb = model_params_b * bpp
    kv_cache_gb = 0.5  # Reserve for KV cache
    os_overhead_gb = 0.5
    available_vram = vram_gb - kv_cache_gb - os_overhead_gb
    ratio = min(available_vram / model_gb, 1.0)
    # Typical 7B/8B model = 32 transformer layers
    total_layers = int(model_params_b * 4)  # Approximate
    return int(ratio * total_layers)
```

### Hardware Tier Recommendations

| Hardware | Recommended Model | STT | TTS | Quantization |
|---|---|---|---|---|
| CPU only (8GB RAM) | Llama 3.2 3B | Whisper tiny/base | Kokoro CPU | Q4_K_M |
| CPU only (16GB RAM) | Llama 3.1 8B | Whisper small | Kokoro CPU | Q4_K_M |
| 4GB VRAM | Llama 3.1 8B (partial) | Whisper small | Kokoro GPU | Q4_K_M |
| 8GB VRAM | Llama 3.1 8B (full) | Whisper large-v3 | Kokoro GPU | Q4_K_M / Q8_0 |
| 12GB VRAM | Qwen 2.5 14B | Whisper large-v3 | F5-TTS | Q4_K_M |
| Apple M1/M2 8GB | Llama 3.1 8B MLX | Whisper large-v3-turbo | Kokoro | 4-bit MLX |
| Apple M2/M3 16GB+ | Llama 3.1 70B MLX | Whisper large-v3 | F5-TTS | 4-bit MLX |

### Performance Principles

1. **Never import llama-cpp-python for serving** — always use the llama.cpp binary server subprocess and proxy via HTTP
2. **KV cache quantization always on** (`--cache-type-k q8_0 --cache-type-v q8_0`) — saves ~30% VRAM
3. **Flash attention always on** (`--flash-attn`) — faster and lower VRAM
4. **Continuous batching** (`--cont-batching`) — handle concurrent requests without model reload
5. **Avoid Go wrapper overhead** — do not shell out to Ollama binary; call llama.cpp directly
6. **MLX for Apple Silicon** — mlx-lm generation is ~2x faster than llama.cpp on M2+
7. **Pin CPU threads to physical cores** (`--threads $(nproc --only physical)`)
8. **Use streaming everywhere** — SSE for LLM, chunked audio for TTS, WebSocket for STT

---

## 13. Server / Cloud Deployment Mode

When `--host 0.0.0.0` is used, VxLLM switches to server mode:

### Docker Compose (GPU server)

```yaml
# docker-compose.yml
services:
  gateway:
    build: ./docker/Dockerfile.gpu
    ports:
      - "11500:11500"
    environment:
      - VOXCORE_API_KEY=${API_KEY}
      - VOXCORE_MODELS_DIR=/data/models
    volumes:
      - ./models:/data/models
    depends_on:
      - llamacpp

  llamacpp:
    image: ghcr.io/ggerganov/llama.cpp:server-cuda
    runtime: nvidia
    volumes:
      - ./models:/data/models
    command: ["--model", "/data/models/llama3.1-8b-q4_k_m.gguf", "--port", "8080", "--flash-attn", "--cont-batching"]

  kokoro:
    build: ./docker/Dockerfile.kokoro
    ports:
      - "8880:8880"
    volumes:
      - ./models:/data/models
```

### Server Mode Additions

- **API key auth middleware** — `Authorization: Bearer <key>` required on all endpoints
- **Rate limiting** — per-key token limits via Redis or in-memory counter
- **Prometheus `/metrics`** — tokens/sec, queue depth, active sessions, VRAM usage
- **Web UI** — React build served as static files by FastAPI at `/ui` route (no Tauri needed)
- **Model auto-download on first request** — pull model if not present when requested

---

## 14. Phased Build Plan

### Phase 1 — Core Inference Layer (Weeks 1–3)
**Goal:** `vxllm serve` works, can chat via API

- [ ] Project scaffold: `pyproject.toml`, directory structure, `uv` environment
- [ ] `install_llamacpp.py` — download correct pre-built binary for OS/arch/GPU
- [ ] `hardware/detect.py` — GPU VRAM, CPU cores, Apple Silicon detection
- [ ] `hardware/recommendations.py` — auto-calc gpu_layers and quantization
- [ ] `models/registry.py` — load and query `models.json`
- [ ] `models/downloader.py` — HuggingFace Hub GGUF download with progress
- [ ] `engine/llama_cpp_backend.py` — subprocess manager + HTTP proxy
- [ ] `api/routes/chat.py` — `/v1/chat/completions` with SSE streaming
- [ ] `api/routes/models.py` — `/v1/models`, `/api/models/pull`
- [ ] `cli/commands/serve.py`, `pull.py`, `list.py`, `run.py`
- [ ] Basic `models.json` with 10 popular GGUF models
- [ ] README with quickstart

**Deliverable:** `pip install vxllm && vxllm pull llama3.2:3b && vxllm serve`

---

### Phase 2 — MLX Backend (Weeks 3–4)
**Goal:** Apple Silicon users get native MLX speed

- [ ] `engine/mlx_backend.py` — mlx-lm load + stream_generate
- [ ] `engine/backend_router.py` — hardware detection → backend selector
- [ ] `models/registry.py` — add MLX variants to model entries
- [ ] `models/downloader.py` — HuggingFace MLX repo download
- [ ] `models.json` — add MLX variants for top 10 models
- [ ] Test on M2/M3 hardware, benchmark vs llama.cpp

**Deliverable:** Auto-selects MLX on Apple Silicon transparently

---

### Phase 3 — Voice Layer (Weeks 4–6)
**Goal:** TTS and STT fully functional via API

- [ ] `engine/stt.py` — faster-whisper wrapper, all model sizes
- [ ] `engine/tts.py` — Kokoro-82M integration, voice list
- [ ] `engine/vad.py` — silero-vad integration
- [ ] `api/routes/audio_stt.py` — `/v1/audio/transcriptions`
- [ ] `api/routes/audio_tts.py` — `/v1/audio/speech` (streaming)
- [ ] `api/websockets/audio_stream.py` — real-time STT WebSocket
- [ ] `api/websockets/chat_voice.py` — full voice chat loop
- [ ] `cli/commands/pull.py` — support STT and TTS model pulls
- [ ] `models.json` — add Whisper and Kokoro model entries
- [ ] F5-TTS integration for voice cloning

**Deliverable:** Full OpenAI audio API compatibility + real-time voice WebSocket

---

### Phase 4 — Desktop UI (Weeks 6–10)
**Goal:** Non-technical users can use the app

- [ ] Tauri 2 project init, configure with React + TypeScript + Tailwind
- [ ] `src-tauri/src/process.rs` — spawn/kill Python server
- [ ] `src-tauri/src/tray.rs` — system tray icon
- [ ] `ui/src/lib/api.ts` — typed API client
- [ ] `ui/src/hooks/useMicrophone.ts` — getUserMedia + PCM chunking
- [ ] `ui/src/hooks/useWebSocket.ts` — voice WebSocket management
- [ ] Chat screen with voice button + TTS playback
- [ ] Model library screen with download manager
- [ ] Settings screen
- [ ] Dashboard with GPU/CPU/RAM stats
- [ ] Cross-platform builds (macOS arm64/x86, Windows, Linux)

**Deliverable:** Installable desktop app (.dmg, .exe, .AppImage)

---

### Phase 5 — Server Mode + Polish (Weeks 10–12)
**Goal:** Deployable on cloud, production-ready

- [ ] `api/middleware/auth.py` — API key validation
- [ ] `api/routes/health.py` — Prometheus metrics endpoint
- [ ] `Dockerfile.cpu`, `Dockerfile.gpu`, `docker-compose.yml`
- [ ] Web UI build served by FastAPI (for headless server deployments)
- [ ] Rate limiting
- [ ] `models/converter.py` — safetensors → GGUF conversion
- [ ] Documentation site (Mintlify or Docusaurus)
- [ ] GitHub Actions CI: lint, test, cross-platform builds

**Deliverable:** `docker compose up` works, full documentation

---

## 15. Open Source Strategy

### License
**MIT License** — maximally permissive, encourages adoption and contribution

### GitHub Repository Structure
```
github.com/your-org/vxllm
├── /vxllm         (Python package — pip installable)
├── /ui              (Tauri desktop app)
├── /docs            (Documentation)
├── models.json      (Community-maintained model index — PRs welcome)
└── CONTRIBUTING.md
```

### Community Contributions
- `models.json` is the primary contribution surface — anyone can PR new model entries
- Plugin system (Phase 6+) for custom STT/TTS backends
- Docker Hub: `vxllm/vxllm-cpu` and `vxllm/vxllm-gpu`

### Python Package

```toml
# pyproject.toml
[project]
name = "vxllm"
version = "0.1.0"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "httpx>=0.27",
    "faster-whisper>=1.1",
    "kokoro>=0.9",
    "silero-vad>=5.1",
    "huggingface-hub>=0.24",
    "typer>=0.12",
    "rich>=13.7",
    "soundfile>=0.12",
    "torch>=2.3",       # CPU torch for VAD (minimal)
    "psutil>=5.9",
]

[project.optional-dependencies]
mlx = ["mlx-lm>=0.18"]        # macOS Apple Silicon only
cuda = ["torch[cuda]>=2.3"]   # NVIDIA GPU support
f5tts = ["f5-tts>=1.1"]       # Voice cloning TTS

[project.scripts]
vxllm = "vxllm.cli.__main__:app"
```

---

*Document version: 1.0 | Based on architecture decisions finalised March 2026*
*Stack: Python + FastAPI + llama.cpp + MLX + faster-whisper + Kokoro + Tauri 2 + React*
