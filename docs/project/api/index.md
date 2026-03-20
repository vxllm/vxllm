---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# API Registry

## Overview

VxLLM uses a hybrid API approach: **oRPC** for type-safe app-specific routes and **raw Hono** for OpenAI-compatible proxy routes.

## API Endpoints

### OpenAI-Compatible (Raw Hono Routes)

| Endpoint | Method | Description | Proxies To | Link |
|----------|--------|-------------|------------|------|
| `/v1/chat/completions` | POST | Chat with streaming SSE | node-llama-cpp (in-process) | [→](./api-inference.md) |
| `/v1/completions` | POST | Raw text completion | node-llama-cpp | [→](./api-inference.md) |
| `/v1/embeddings` | POST | Generate embeddings | node-llama-cpp | [→](./api-inference.md) |
| `/v1/models` | GET | List available models | DB query | [→](./api-inference.md) |
| `/v1/audio/transcriptions` | POST | Speech-to-text | Voice sidecar | [→](./api-voice.md) |
| `/v1/audio/speech` | POST | Text-to-speech (streaming) | Voice sidecar | [→](./api-voice.md) |
| `/v1/audio/voices` | GET | List TTS voices | Voice sidecar | [→](./api-voice.md) |
| `/ws/audio/stream` | WS | Real-time STT | Voice sidecar | [→](./api-voice.md) |
| `/ws/chat` | WS | Full voice chat loop | Voice sidecar + node-llama-cpp | [→](./api-voice.md) |
| `/health` | GET | Server health check | — | [→](./api-dashboard.md) |
| `/metrics` | GET | Prometheus metrics | — | [→](./api-dashboard.md) |

### App Routes (oRPC — Type-Safe)

| Router | Procedures | Description | Link |
|--------|------------|-------------|------|
| `modelRouter` | 7 | Model CRUD, downloads, registry | [→](./api-model-management.md) |
| `chatRouter` | 7 | Conversations + messages | [→](./api-chat.md) |
| `settingsRouter` | 7 | Settings, API keys, hardware info | [→](./api-settings.md) |
| `dashboardRouter` | 3 | Stats, metrics, hardware monitoring | [→](./api-dashboard.md) |

## Authentication

| Mode | Auth Required | Mechanism |
|------|---------------|-----------|
| Desktop (localhost) | No | Host binding check |
| Server (0.0.0.0) | Yes | `Authorization: Bearer <api_key>` |

## Base URL

```
http://localhost:11500      # Default
http://localhost:11500/v1   # OpenAI-compatible prefix
```
