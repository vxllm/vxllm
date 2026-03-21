<p align="center">
  <img src="apps/www/public/logo-no-bg.png" width="80" height="80" alt="VxLLM" />
</p>

<h1 align="center">VxLLM</h1>

<p align="center">
  <strong>Open-source local AI server with voice</strong><br/>
  Run LLMs, STT, and TTS locally with an OpenAI-compatible API.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-2EFAA0.svg?style=flat-square" alt="MIT License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-1.3-f9f1e1.svg?style=flat-square&logo=bun&logoColor=black" alt="Bun" /></a>
  <a href="https://hub.docker.com/r/datahase/vxllm"><img src="https://img.shields.io/badge/Docker-datahase%2Fvxllm-2496ED.svg?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-2EFAA0.svg?style=flat-square" alt="PRs Welcome" /></a>
</p>

<p align="center">
  <a href="https://vxllm.com">Website</a> ·
  <a href="https://docs.vxllm.com">Docs</a> ·
  <a href="https://github.com/vxllm/vxllm/releases">Download</a> ·
  <a href="https://hub.docker.com/r/datahase/vxllm">Docker Hub</a>
</p>

---

## What Makes VxLLM Different

| Feature | VxLLM | Ollama | LM Studio |
|---------|:-----:|:------:|:---------:|
| Open Source | ✅ | ✅ | ❌ |
| Voice (STT + TTS) | ✅ | ❌ | ❌ |
| WebSocket Voice Chat | ✅ | ❌ | ❌ |
| Native Desktop GUI | ✅ | ✅ | ✅ |
| CLI | ✅ | ✅ | ❌ |
| OpenAI-Compatible API | ✅ | ✅ | ✅ |
| In-Process Inference | ✅ | ⚠️ Go wrapper | ✅ |
| Docker Hub Image | ✅ | ✅ | ❌ |
| Prometheus Metrics | ✅ | ❌ | ❌ |
| Hardware Dashboard | ✅ | ❌ | ✅ |

## Quick Start

### Install & Run

```bash
curl -fsSL https://vxllm.com/install.sh | sh
vxllm pull qwen2.5:7b
vxllm serve
```

The API runs at `http://localhost:11500` and the web UI at `http://localhost:3001`.

### Docker

```bash
docker pull datahase/vxllm
docker run -p 11500:11500 datahase/vxllm
```

### Use with Any OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:11500/v1", api_key="vxllm")

response = client.chat.completions.create(
    model="qwen2.5:7b",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

<details>
<summary><strong>TypeScript / JavaScript</strong></summary>

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:11500/v1",
  apiKey: "vxllm",
});

const stream = await client.chat.completions.create({
  model: "qwen2.5:7b",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

</details>

<details>
<summary><strong>curl</strong></summary>

```bash
curl http://localhost:11500/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:7b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

</details>

## Features

| | Feature | Description |
|---|---------|-------------|
| ⚡ | **LLM Inference** | In-process via node-llama-cpp. Metal, CUDA, CPU auto-detected. No subprocess overhead. |
| 🎤 | **Voice I/O** | STT (faster-whisper) + TTS (Kokoro) + VAD (silero-vad). Real-time WebSocket voice chat. |
| 🔌 | **OpenAI API** | Drop-in replacement. Chat completions, embeddings, audio. Any OpenAI SDK works. |
| 🖥️ | **Desktop App** | Tauri 2 native app (~5MB). System tray, chat UI, model library, dashboard. |
| ⌨️ | **CLI** | `serve`, `pull`, `run`, `list`, `ps`, `rm`, `info`. Interactive streaming chat. |
| 🐳 | **Docker** | `docker pull datahase/vxllm`. Server + voice service in one compose file. |
| 📊 | **Dashboard** | Real-time GPU/CPU/RAM gauges, metrics charts, Prometheus endpoint. |
| 🔐 | **Server Mode** | API key auth, rate limiting, CORS. Deploy anywhere. |

## CLI Commands

```bash
vxllm serve                    # Start the server (port 11500)
vxllm pull qwen2.5:7b          # Download a model from HuggingFace
vxllm run qwen2.5:7b           # Interactive streaming chat
vxllm list                     # Show downloaded models
vxllm ps                       # Server status + loaded models
vxllm rm qwen2.5:7b            # Remove a model
vxllm info                     # Hardware profile + recommendations
```

## Tech Stack

| | Technology | Purpose |
|---|-----------|---------|
| 🏃 | [Bun](https://bun.sh) | Runtime |
| 🌐 | [Hono](https://hono.dev) | HTTP server |
| 🧠 | [node-llama-cpp](https://node-llama-cpp.withcat.ai) | LLM inference (Metal/CUDA/CPU) |
| 🤖 | [Vercel AI SDK](https://ai-sdk.dev) | Streaming, tools, structured output |
| 🗄️ | [Drizzle](https://orm.drizzle.team) + SQLite | Database |
| ⚛️ | React 19 + Vite + [TanStack Router](https://tanstack.com/router) | Frontend |
| 🎨 | [shadcn/ui](https://ui.shadcn.com) + [Tailwind v4](https://tailwindcss.com) | Components + styling |
| 🖥️ | [Tauri 2](https://tauri.app) | Desktop app |
| 📦 | [Turborepo](https://turbo.build/repo) | Monorepo build |
| 🎙️ | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) + [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) | Voice (Python voice service) |

## Project Structure

```
vxllm/
├── apps/
│   ├── app/              # React frontend + Tauri desktop
│   ├── server/           # Hono API server
│   ├── cli/              # Terminal CLI (citty)
│   ├── docs/             # Documentation (Fumadocs)
│   ├── www/              # Marketing website (Next.js)
│   └── voice/            # Python FastAPI (STT + TTS + VAD)
├── packages/
│   ├── inference/        # node-llama-cpp engine wrapper
│   ├── llama-provider/   # AI SDK language model adapter
│   ├── api/              # oRPC routers + Zod schemas
│   ├── db/               # Drizzle ORM (10 tables)
│   ├── ui/               # 38 shadcn/ui components
│   ├── env/              # Validated env config (17 vars)
│   └── config/           # Shared tsconfig/eslint/tailwind
├── docker/               # Dockerfiles + compose
└── models.json           # Curated model registry (5 models)
```

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Python](https://python.org) >= 3.11 (for voice service, optional)
- [Rust](https://rustup.rs) (for Tauri desktop builds, optional)

### Setup

```bash
git clone https://github.com/vxllm/vxllm.git
cd vxllm
bun install
bun run db:push
```

### Run

```bash
bun run dev              # Start all apps (server + app + docs + www)
bun run dev:server       # API server only → http://localhost:11500
bun run dev:app          # Frontend only → http://localhost:3001
bun run dev:docs         # Docs site only → http://localhost:4000
bun run dev:www          # Marketing site only → http://localhost:3000
```

### Voice Service (optional)

```bash
cd apps/voice
uv sync
uv run uvicorn app.main:app --port 11501
```

### Build & Test

```bash
bun run build            # Build all apps
bun run check-types      # TypeScript type checking
bun run db:studio        # Open Drizzle Studio (database UI)
```

### Desktop App

```bash
cd apps/app
bun run desktop:dev      # Start Tauri dev mode
bun run desktop:build    # Build .dmg / .exe / .AppImage
```

### Docker

```bash
# From Docker Hub
docker pull datahase/vxllm
docker run -p 11500:11500 datahase/vxllm

# Or build from source
docker compose -f docker/docker-compose.yml up -d
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./local.db` | SQLite or Turso connection |
| `PORT` | `11500` | Server port |
| `HOST` | `127.0.0.1` | Bind host (`0.0.0.0` for server mode) |
| `MODELS_DIR` | `~/.vxllm/models` | Model storage directory |
| `VOICE_URL` | `http://localhost:11501` | Python voice service |
| `API_KEY` | — | Auth key (required when `HOST=0.0.0.0`) |
| `DEFAULT_MODEL` | — | Auto-load model on startup |
| `MAX_CONTEXT_SIZE` | `8192` | Default context window |
| `GPU_LAYERS_OVERRIDE` | — | Manual GPU layer count |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Chat with streaming SSE |
| POST | `/v1/completions` | Text completion |
| POST | `/v1/embeddings` | Text embeddings |
| GET | `/v1/models` | List downloaded models |
| POST | `/v1/audio/transcriptions` | Speech to text |
| POST | `/v1/audio/speech` | Text to speech |
| WS | `/ws/audio/stream` | Real-time STT |
| WS | `/ws/chat` | Full voice chat loop |
| GET | `/metrics` | Prometheus metrics |
| GET | `/health` | Health check |
| POST | `/api/models/pull` | Download a model |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

The easiest way to contribute is adding models to `models.json` — see the [contributing guide](CONTRIBUTING.md#contributing-to-modelsjson).

## Community

- [GitHub Issues](https://github.com/vxllm/vxllm/issues) — Bug reports
- [GitHub Discussions](https://github.com/vxllm/vxllm/discussions) — Questions & ideas
- [Documentation](https://docs.vxllm.com) — Full docs
- [Contributing Guide](CONTRIBUTING.md) — How to contribute
- [Security Policy](SECURITY.md) — Reporting vulnerabilities

## License

[MIT](LICENSE) — Built by [DataHase](https://github.com/datahase).
