export function GET() {
  const content = `# VxLLM

> Open-source, self-hostable AI model server with LLM inference, voice I/O, and OpenAI-compatible API.

## About

VxLLM is a unified model server that runs LLM, STT (Speech-to-Text), and TTS (Text-to-Speech) models locally or on a remote server. It exposes a fully OpenAI-compatible REST API, provides real-time voice I/O via WebSocket, and has a Tauri 2 desktop app and a developer CLI.

## Key Features

- In-process LLM inference via node-llama-cpp (Metal/CUDA/CPU auto-detect)
- OpenAI-compatible REST API (drop-in replacement)
- Voice pipeline: STT (faster-whisper) + TTS (Kokoro) + VAD (silero-vad)
- Real-time WebSocket voice chat
- Tauri 2 desktop app with system tray
- CLI: serve, pull, run, list, ps, rm, info
- Model downloads from HuggingFace with progress tracking
- Dashboard with hardware monitoring and inference metrics
- Docker deployment (server + voice service)
- API key authentication with rate limiting

## Tech Stack

- Runtime: Bun
- Server: Hono
- LLM: node-llama-cpp v3
- AI SDK: Vercel AI SDK v6
- Database: Drizzle ORM + SQLite
- Frontend: React 19 + Vite + TanStack Router
- UI: shadcn/ui + AI Elements
- Desktop: Tauri 2
- CLI: citty
- Voice: Python FastAPI (faster-whisper + Kokoro + silero-vad)
- Monorepo: Turborepo + Bun workspaces

## Links

- Website: https://vxllm.com
- Documentation: https://docs.vxllm.com
- GitHub: https://github.com/datahase/vxllm
- License: MIT

## API Endpoints

- POST /v1/chat/completions — Chat with streaming SSE
- POST /v1/completions — Text completion
- POST /v1/embeddings — Text embeddings
- GET /v1/models — List models
- POST /v1/audio/transcriptions — Speech to text
- POST /v1/audio/speech — Text to speech
- WS /ws/audio/stream — Real-time STT
- WS /ws/chat — Full voice chat loop
- GET /metrics — Prometheus metrics
- GET /health — Server health check
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
