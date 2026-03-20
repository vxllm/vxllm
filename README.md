# VxLLM

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-f9f1e1.svg)](https://bun.sh)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> Open-source local AI server with voice — run LLMs, STT, and TTS locally with an OpenAI-compatible API.

VxLLM is a unified, self-hostable model server that runs LLM, Speech-to-Text, and Text-to-Speech models on your hardware. It exposes a fully OpenAI-compatible REST API, provides real-time voice I/O via WebSocket, and includes a Tauri 2 desktop app and a developer CLI.

## What Makes VxLLM Different

| Feature | Ollama | LM Studio | VxLLM |
|---------|--------|-----------|-------|
| Open source | Yes | No | Yes |
| Voice (TTS/STT) | No | No | Yes |
| Real-time WebSocket voice | No | No | Yes |
| Desktop GUI | No | Yes | Yes |
| CLI | Yes | No | Yes |
| Server/Cloud mode | Partial | No | Yes |
| In-process inference | No (Go wrapper) | N/A | Yes (node-llama-cpp) |

## Quick Start

```bash
# Install dependencies
bun install

# Push database schema
bun run db:push

# Start development server
bun run dev
```

The web app runs at [http://localhost:3001](http://localhost:3001) and the API at [http://localhost:11500](http://localhost:11500).

### Use with any OpenAI SDK

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:11500/v1",
  apiKey: "vxllm", // any string works in desktop mode
});

const response = await client.chat.completions.create({
  model: "llama3.1:8b",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of response) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

## Features

**LLM Inference** — In-process inference via node-llama-cpp with automatic Metal/CUDA/CPU detection. No subprocess overhead, direct memory access, stateful KV cache.

**OpenAI-Compatible API** — Drop-in replacement for OpenAI's API. Chat completions with SSE streaming, embeddings, and audio endpoints. Any OpenAI SDK works by changing `base_url`.

**Voice Pipeline** — Speech-to-text via faster-whisper, text-to-speech via Kokoro-82M, voice activity detection via silero-vad. Real-time WebSocket voice chat with hold-to-talk and continuous VAD modes.

**Model Management** — Download models from HuggingFace by friendly name (`vxllm pull llama3.1:8b`). Progress tracking, pause/resume, hardware-aware variant recommendations.

**Desktop App** — Tauri 2 desktop app with chat UI, model library, dashboard, and settings. System tray, auto-start, lightweight (~5MB binary).

**CLI** — Terminal-based management: `vxllm serve`, `vxllm pull`, `vxllm run` (interactive chat), `vxllm list`, `vxllm ps`, `vxllm rm`.

**Dashboard** — Real-time GPU/CPU/RAM monitoring, tokens/sec throughput graphs, request counters, and active model display.

**Server Mode** — Deploy on cloud VMs with Docker. API key authentication, CORS configuration, Prometheus metrics.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Bun |
| Server | Hono |
| Inference | node-llama-cpp v3 (Metal/CUDA/CPU) |
| AI SDK | Vercel AI SDK + @ai-sdk/react |
| Database | Drizzle ORM + SQLite (libsql/Turso) |
| Frontend | React 19 + Vite + TanStack Router + Tailwind v4 |
| Components | shadcn/ui |
| Desktop | Tauri 2 |
| CLI | citty |
| Voice | faster-whisper + Kokoro-82M + silero-vad (Python sidecar) |
| Monorepo | Turborepo |

## Project Structure

```
vxllm/
├── apps/
│   ├── app/              # React frontend + Tauri desktop
│   ├── server/           # Hono API server
│   ├── cli/              # Terminal CLI
│   ├── docs/             # Documentation site (Fumadocs)
│   └── www/              # Marketing website (Next.js)
├── packages/
│   ├── inference/        # node-llama-cpp engine wrapper
│   ├── llama-provider/   # AI SDK provider for llama.cpp
│   ├── api/              # oRPC router definitions
│   ├── db/               # Drizzle database schemas
│   ├── ui/               # Shared shadcn/ui components
│   ├── env/              # Environment variable validation
│   └── config/           # Shared TypeScript config
├── sidecar/
│   └── voice/            # Python voice sidecar (STT + TTS + VAD)
├── docker/               # Docker deployment files
└── models.json           # Curated model registry
```

## Development Commands

```bash
bun install              # Install all dependencies
bun run dev              # Start all apps (web + server + docs)
bun run dev:app          # Start app only
bun run dev:server       # Start API server only
bun run build            # Build all apps for production
bun run check-types      # TypeScript type checking
bun run db:push          # Push schema to database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio
```

### Desktop App

```bash
cd apps/app
bun run desktop:dev      # Start Tauri dev mode
bun run desktop:build    # Build desktop app (.dmg, .exe, .AppImage)
```

### Docker Deployment

```bash
docker compose up -d     # Start server + voice sidecar
```

## UI Customization

Shared shadcn/ui components live in `packages/ui`. Add more:

```bash
npx shadcn@latest add accordion dialog popover -c packages/ui
```

Import in your app:

```tsx
import { Button } from "@vxllm/ui/components/button";
```

## Documentation

Full project documentation lives in `docs/project/`:

- [Features](docs/project/features/) — Feature specifications
- [API Specs](docs/project/api/) — Endpoint documentation
- [Database](docs/project/database/) — Schema documentation
- [Workflows](docs/project/workflows/) — User flow documentation
- [Architecture Decisions](docs/project/decisions.md) — ADRs
- [Tech Stack](docs/project/tech-stack.md) — Technology choices
- [Glossary](docs/project/glossary.md) — Term definitions

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./local.db` | SQLite or Turso connection |
| `PORT` | `11500` | Server port |
| `HOST` | `127.0.0.1` | Bind host |
| `MODELS_DIR` | `~/.vxllm/models` | Model storage path |
| `VOICE_SIDECAR_URL` | `http://localhost:11501` | Voice sidecar URL |
| `API_KEY` | — | Server mode auth key |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution: Add a Model

The easiest way to contribute is adding models to `models.json`. See the [contributing guide](CONTRIBUTING.md#contributing-to-modelsjson) for details.

## Community

- [GitHub Issues](https://github.com/DataHase/vxllm/issues) — Bug reports
- [GitHub Discussions](https://github.com/DataHase/vxllm/discussions) — Questions & ideas
- [Contributing Guide](CONTRIBUTING.md) — How to contribute
- [Code of Conduct](CODE_OF_CONDUCT.md) — Community standards
- [Security Policy](SECURITY.md) — Reporting vulnerabilities

## License

VxLLM is open-source software licensed under the [MIT License](LICENSE).

Built by [DataHase](https://github.com/DataHase).
