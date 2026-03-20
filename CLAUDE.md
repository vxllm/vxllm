# VxLLM

## Overview

VxLLM is an open-source, self-hostable AI model server that runs LLM, STT (Speech-to-Text), and TTS (Text-to-Speech) models locally or on a remote server. It exposes a fully OpenAI-compatible REST API, provides real-time voice I/O via WebSocket, and has a Tauri 2 desktop app for non-technical users and a CLI for developers.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Bun |
| Server | Hono |
| LLM Inference | node-llama-cpp v3 (in-process, Metal/CUDA/CPU auto-detect) |
| AI SDK | ai (Vercel) + ai-sdk-llama-cpp (forked) + @ai-sdk/react |
| API (app routes) | oRPC + Zod |
| API (OpenAI compat) | Raw Hono routes |
| Database | Drizzle ORM + SQLite (libsql/Turso) |
| Frontend | React 19 + Vite + TanStack Router + Tailwind v4 |
| UI Components | shadcn/ui + lucide-react |
| Client State | zustand |
| Server State | TanStack Query + oRPC client |
| Chat UI | @ai-sdk/react (useChat, useCompletion) |
| Charts | recharts |
| Markdown | react-markdown + shiki |
| Desktop | Tauri 2 (Rust backend) |
| CLI | citty (UnJS) |
| Model Downloads | @huggingface/hub + Bun native fetch |
| Voice STT | faster-whisper (Python sidecar) |
| Voice TTS | Kokoro-82M (Python sidecar) |
| Voice VAD | silero-vad (Python sidecar) |
| Voice Framework | FastAPI + Uvicorn |
| Auth | API key (server mode only, localhost = no auth) |
| Config | @t3-oss/env-core + Zod |
| Monorepo | Turborepo + Bun workspaces |
| Docs | Fumadocs (Next.js) |
| License | MIT |

## Architecture

```
Tauri 2 (Rust) — spawns processes:
├── Bun/Hono server (port 11500) — node-llama-cpp in-process
│   ├── /v1/* (OpenAI-compatible) → node-llama-cpp directly
│   ├── /v1/audio/* → proxy to voice sidecar
│   ├── /ws/* → proxy to voice sidecar
│   └── /rpc/* (oRPC) → DB queries, model mgmt, settings
│
└── Python voice sidecar (port 11501) — only if voice models downloaded
    ├── POST /transcribe → faster-whisper
    ├── POST /speak → Kokoro TTS
    └── WS /stream → real-time VAD + STT

React UI (apps/web) talks to Hono (localhost:11500)
```

## User Roles

| Role | Description | Auth |
|------|-------------|------|
| Desktop User | Uses the Tauri app locally | No auth (localhost) |
| Developer | Uses CLI or API directly | No auth (localhost) |
| Server Client | Connects to remote VxLLM server | API key required |

## Core Features

- In-process LLM inference via node-llama-cpp (GGUF models, Metal/CUDA/CPU)
- OpenAI-compatible REST API (`/v1/chat/completions`, `/v1/embeddings`, etc.)
- Model management: download from HuggingFace, progress tracking, registry
- Chat UI with streaming responses, conversation history, markdown rendering
- Voice pipeline: STT (faster-whisper) + TTS (Kokoro) + VAD (silero-vad)
- Real-time WebSocket voice chat
- Tauri 2 desktop app with system tray
- CLI: `vxllm serve`, `vxllm pull`, `vxllm run`, `vxllm list`, `vxllm ps`, `vxllm rm`
- Dashboard with hardware monitoring and inference metrics
- API key auth for server/cloud deployment mode
- Docker support (server + voice sidecar)

## Monorepo Structure

```
vxllm/
├── apps/
│   ├── web/              # React+Vite+TanStack Router+Tauri 2
│   │   └── src-tauri/    # Rust: process mgmt, system tray
│   ├── server/           # Hono+Bun+node-llama-cpp (main API)
│   ├── cli/              # citty CLI
│   └── fumadocs/         # Documentation site
├── packages/
│   ├── inference/        # node-llama-cpp wrapper, hardware detect, model downloads
│   ├── llama-provider/   # Forked ai-sdk-llama-cpp (AI SDK LanguageModelV3 provider)
│   ├── api/              # oRPC router definitions + Zod schemas
│   ├── db/               # Drizzle schemas + migrations (SQLite)
│   ├── ui/               # shadcn/ui shared components
│   ├── env/              # t3-env validated config
│   └── config/           # Shared tsconfig
├── sidecar/
│   └── voice/            # Python: FastAPI + faster-whisper + Kokoro + silero-vad
├── docker/               # Dockerfiles + docker-compose
├── models.json           # Curated model index (community-maintained)
└── turbo.json
```

## Database

Drizzle ORM + SQLite (libsql). Tables: `models`, `tags`, `model_tags`, `download_queue`, `conversations`, `messages`, `settings`, `api_keys`, `usage_metrics`, `voice_profiles`.

Primary keys use nanoid (text). Timestamps are integer (Unix epoch ms). No enums — text with CHECK constraints.

## Documentation

All project docs in `docs/project/`:

- **Features:** `docs/project/features/` — 8 feature specs
- **API Specs:** `docs/project/api/` — 6 API specs (oRPC + OpenAI-compatible)
- **Database:** `docs/project/database/` — 4 schema specs
- **Workflows:** `docs/project/workflows/` — 7 workflow specs
- **Architecture Decisions:** `docs/project/decisions.md` — 10 ADRs
- **Tech Stack:** `docs/project/tech-stack.md`
- **Design Guidelines:** `docs/project/design-guidelines.md`
- **Glossary:** `docs/project/glossary.md`

## Development Commands

```bash
bun install              # Install dependencies
bun run dev              # Start all apps in dev mode
bun run dev:web          # Start web app only
bun run dev:server       # Start server only
bun run build            # Build all apps
bun run check-types      # TypeScript type checking
bun run db:push          # Push schema to database
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Open Drizzle Studio
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | `file:./local.db` | SQLite database path or Turso URL |
| PORT | No | `11500` | Server port |
| HOST | No | `127.0.0.1` | Bind host (use 0.0.0.0 for server mode) |
| MODELS_DIR | No | `~/.vxllm/models` | Model storage directory |
| VOICE_SIDECAR_URL | No | `http://localhost:11501` | Python voice sidecar URL |
| API_KEY | No | — | API key for server mode auth |
| LOG_LEVEL | No | `info` | Logging verbosity |
| DEFAULT_MODEL | No | — | Model to auto-load on startup |
| CORS_ORIGINS | No | `*` | Allowed CORS origins |
| MAX_CONTEXT_SIZE | No | `8192` | Default context window size |
| GPU_LAYERS_OVERRIDE | No | — | Manual GPU layer count (overrides auto) |
