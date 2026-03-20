---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# Changelog

All notable changes to VxLLM are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com).

Versions follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`
- `MAJOR`: Breaking changes to API or deployment model
- `MINOR`: New features, backwards-compatible
- `PATCH`: Bug fixes, performance improvements

---

## [0.1.0] - 2026-03-20

**Phase 1 MVP Release**

Complete local AI server with full voice support, desktop integration, and OpenAI compatibility.

### Added

#### Core Server
- Hono + Bun HTTP server on port 11500
- node-llama-cpp in-process LLM inference
- Auto-detection of hardware acceleration (Metal/CUDA/CPU)
- OpenAI-compatible `/v1/chat/completions`, `/v1/models`, `/v1/completions` endpoints
- oRPC procedure layer for type-safe internal APIs

#### Model Management
- Curated model registry (`models.json`) with popular open-source models
- Download models from Hugging Face Hub with resume support
- Support for GGUF quantizations: Q4_K_M, Q5_K_M, Q8_0
- Model metadata (name, size, parameter count, quantization variants)
- Automatic VRAM detection and GPU layer optimization
- CLI commands: `pull`, `list`, `rm` for model management

#### Chat & Conversations
- Multi-turn conversation support with full history
- Streaming responses via HTTP Server-Sent Events (SSE)
- Conversation persistence to SQLite database
- Message tagging and organization
- Chat import/export (JSON)
- Conversation deletion with confirmation

#### Voice Support
- **Speech-to-Text (STT):** faster-whisper on Python sidecar (port 11501)
  - Multi-language support
  - Automatic language detection
  - Runs on CPU or GPU
- **Text-to-Speech (TTS):** Kokoro-82M on Python sidecar
  - Multiple voice options
  - Speed and pitch control
  - Streaming audio output
- **Voice Activity Detection (VAD):** silero-vad on Python sidecar
  - Real-time silence detection
  - Auto-stop recording
  - Low latency (<50ms)
- Audio input/output management (microphone, speakers)
- Voice profile settings per conversation

#### Desktop Application (Tauri 2)
- Cross-platform desktop wrapper (macOS, Windows, Linux)
- Process management (auto-start server on launch, health checks)
- System tray integration (minimize to tray, quick access)
- Native file dialogs for model downloads
- Auto-update mechanism (checks for new releases)
- System info display (GPU, VRAM, CPU usage)
- App settings: theme, language, appearance

#### Frontend (React + Vite)
- Single-page app works in browser and Tauri webview
- Chat interface with streaming message display
- Real-time token count display
- Model selector with filtering
- Settings panel (theme, API endpoint, default model, voice settings)
- Dashboard with usage metrics and system status
- Responsive design (mobile, tablet, desktop)
- Dark mode (respects system preference)
- Keyboard shortcuts (Ctrl+K for quick search, Esc for modals, etc.)

#### Database (Drizzle + SQLite)
- **Tables:**
  - `models` → Downloaded/available models with metadata
  - `conversations` → Chat sessions with metadata (created_at, updated_at, tags)
  - `messages` → Individual chat messages with role, content, token_count
  - `settings` → User preferences (theme, language, API endpoint)
  - `api_keys` → API keys for server mode authentication
  - `usage_metrics` → Token counts, inference times, model usage statistics
  - `voice_profiles` → TTS voice settings per conversation
  - `tags` → Reusable tags for organizing conversations
  - `model_tags` → Many-to-many relationship between models and tags
  - `download_queue` → Pending and in-progress model downloads
- Full schema with proper relationships and constraints
- Migration support via Drizzle Kit
- Type-safe queries via Drizzle ORM

#### API & Type Safety
- oRPC with Zod validation for internal procedures
- OpenAI REST compatibility layer
- Automatic API documentation (OpenAPI via Hono)
- Request/response type validation
- Environment variable validation via @t3-oss/env-core
- CORS support (configurable origins)

#### CLI Tool
- `vxllm serve` → Start server (standalone or Tauri)
- `vxllm pull <model>` → Download model from registry
- `vxllm run <model> <prompt>` → Single prompt inference
- `vxllm list` → Show available/downloaded models
- `vxllm ps` → Show running instances
- `vxllm rm <model>` → Delete downloaded model
- Pretty colored output with progress bars

#### Configuration
- Environment-based config with validation
- Key variables:
  - `DATABASE_URL` → SQLite connection
  - `PORT`, `HOST` → Server binding
  - `MODELS_DIR` → Model download directory
  - `VOICE_SIDECAR_URL` → Python sidecar endpoint
  - `API_KEY` → Required for server mode (0.0.0.0)
  - `LOG_LEVEL` → debug, info, warn, error
  - `DEFAULT_MODEL` → Model to load at startup
  - `GPU_LAYERS_OVERRIDE` → Manual GPU layer tuning
  - `CORS_ORIGINS` → Comma-separated CORS whitelist
  - `MAX_CONTEXT_SIZE` → Context window limit

#### DevOps
- Docker & Docker Compose for reproducible deployment
  - `Dockerfile.server` → Hono + node-llama-cpp
  - `Dockerfile.voice` → FastAPI + whisper + kokoro
  - `docker-compose.yml` → Orchestrates both services
- Turborepo for monorepo task orchestration
- Development scripts: `bun dev`, `bun build`, `turbo dev`, etc.
- Production builds for desktop (.dmg, .msi, .AppImage)

#### Documentation
- Project README with setup instructions
- Tech stack documentation (technologies, versions, rationale)
- Architecture Decision Records (10 major decisions documented)
- Glossary of domain-specific and technical terms
- Design guidelines (Tailwind, shadcn/ui, accessibility, responsive design)
- Contributing guidelines (code style, testing, PR process)

#### Development Experience
- Hot module reload (HMR) for React and server code
- Full TypeScript support with strict mode
- ESLint + Prettier for code quality
- Type-safe databases (Drizzle ORM)
- Type-safe APIs (oRPC + Zod)
- Monorepo structure with shared packages

### Key Features by Category

#### LLM Capabilities
- [x] Load and run GGUF models
- [x] OpenAI API compatibility (chat, completions)
- [x] Streaming responses
- [x] Context window management
- [x] Token counting
- [x] Multi-turn conversations
- [x] Model switching
- [x] Prompt templates (auto-detected)
- [x] Chat templates (auto-detected)

#### Hardware Support
- [x] Apple Silicon (Metal backend)
- [x] NVIDIA GPUs (CUDA)
- [x] CPU fallback (SSE)
- [x] Automatic hardware detection
- [x] VRAM estimation
- [x] GPU layer optimization

#### Voice Features
- [x] Real-time speech input (microphone)
- [x] Voice output (speaker)
- [x] Audio file upload
- [x] Language detection (STT)
- [x] Voice selection (TTS)
- [x] Voice activity detection (auto-stop)
- [x] Streaming audio playback
- [x] Audio visualization (waveform)

#### User Interface
- [x] Chat interface with streaming
- [x] Model selector
- [x] Settings panel
- [x] System dashboard
- [x] Conversation history
- [x] Dark mode support
- [x] Responsive design
- [x] Keyboard navigation
- [x] Accessibility features (WCAG 2.1 AA)

#### Deployment Options
- [x] Desktop app (Tauri)
- [x] Localhost server (no auth)
- [x] Network server (API key required)
- [x] Docker containers
- [x] CLI tool
- [x] Browser deployment (web version)

### Technical Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Runtime | Bun | Latest, single unified runtime |
| Server | Hono + node-llama-cpp | In-process inference |
| Frontend | React 19 + Vite | Single app for web + Tauri |
| Desktop | Tauri 2 (Rust) | Process management, native integration |
| Database | Drizzle + SQLite | Type-safe persistence |
| Voice | FastAPI + Python | STT, TTS, VAD |
| UI Components | shadcn/ui + Tailwind v4 | Accessible, responsive |
| State | Zustand (client) + TanStack Query (server) | Lightweight, type-safe |
| API | oRPC + Hono | Type-safe internal + OpenAI-compatible external |
| CLI | citty | Lightweight, modern |
| Monorepo | Turborepo + Bun workspaces | Efficient builds, shared packages |

### Known Limitations

- **Single Inference:** Only one model can run at a time (JavaScript single-threaded)
- **No Batching:** Requests are processed sequentially
- **No MLX:** Uses Metal backend of node-llama-cpp instead
- **No Embeddings:** Not included in Phase 1
- **No Fine-Tuning:** Inference-only
- **No Model Quantization:** Use pre-quantized models from registry
- **Single API Key:** No user/permission model in server mode
- **No Cloud Sync:** Conversations stored locally only
- **No Plugins:** Extensibility via code only
- **No Function Calling:** Not yet implemented

### Performance Characteristics

- **Inference Latency:** 1-5 seconds per response (7B model on GPU), 15-30 seconds (CPU)
- **Startup Time:** <1 second (Tauri), 200ms (server)
- **Memory (Idle):** ~150MB (server process)
- **Memory (Inference):** +model size (e.g., 5GB for Q4_K_M 7B)
- **Chat Loading:** <100ms (SQLite local query)
- **Voice Latency:**
  - STT: 0.5-2 seconds
  - TTS: 0.2-0.5 seconds
  - VAD: <50ms

### Supported Models

Initial registry includes:
- Mistral 7B (multiple quantizations)
- Llama 2 7B, 13B
- Neural Hermes 2 7B
- Orca Mini 3B
- Wizard Vicuña 7B
- Solar 10.7B
- And 15+ others (see `models.json`)

Users can download any GGUF model from Hugging Face Hub.

### Deployment Scenarios

#### Desktop (Tauri)
1. Download app for macOS/Windows/Linux
2. Launch → Server starts automatically
3. Chat in local webview
4. Models download to `~/.vxllm/models`
5. No configuration needed

#### Docker (Server)
```bash
docker compose up
# http://localhost:11500 (from host machine)
curl -X POST http://localhost:11500/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "mistral-7b", "messages": [{"role": "user", "content": "Hi"}]}'
```

#### Standalone Server
```bash
bun run server
# http://localhost:11500
```

#### Browser (Web)
```bash
bun run web
# http://localhost:5173
```

### Security

- **Localhost (127.0.0.1):** No authentication required
- **Network (0.0.0.0):** API key (Bearer token) required
- **Models:** Downloaded from Hugging Face (verify fingerprints if concerned)
- **Conversations:** Stored locally in SQLite (no cloud sync)
- **API Keys:** Not sent to frontend, server-side only
- **CORS:** Configurable, defaults to localhost only

### Monitoring & Debugging

- `LOG_LEVEL` env var controls verbosity
- Server startup logs model loading, VRAM usage
- Conversation metrics logged (tokens, latency)
- Voice sidecar logs STT/TTS performance
- Browser DevTools for frontend debugging
- SQLite browser tools for database inspection

### Development

- `bun dev` → Full stack development (server + web + voice sidecar)
- `bun db:generate` → Regenerate Drizzle types
- `bun db:migrate` → Apply database migrations
- `bun lint` → ESLint + TypeScript check
- `bun format` → Prettier formatting
- `bun test` → Test suite (Jest)
- `turbo build` → Production build all packages

### Feedback & Contributions

This is a community project. Issues, PRs, and feedback welcome on GitHub.

---

## Future Roadmap (Post-Phase 1)

### Phase 2 (2026 Q2)
- [ ] Model fine-tuning (LoRA)
- [ ] Embeddings & semantic search over conversations
- [ ] Cloud model hosting (inference delegation)
- [ ] Multi-modal (image input/output)
- [ ] Plugin system (JavaScript extensions)

### Phase 3 (2026 Q3+)
- [ ] Multi-user support (team server deployments)
- [ ] Function calling / tools
- [ ] Advanced RAG (Retrieval-Augmented Generation)
- [ ] Web search integration
- [ ] Custom model training UI
- [ ] Model marketplace (publish/share models)

### Infrastructure
- [ ] Kubernetes deployment guide
- [ ] Horizontal scaling (multiple inference servers)
- [ ] Load balancing
- [ ] Caching layer (Redis)
- [ ] Monitoring/observability (Prometheus, logs)
- [ ] Analytics dashboard

### UX/Design
- [ ] Mobile app (iOS/Android via React Native)
- [ ] Web version feature parity with desktop
- [ ] Theme customization (brand colors)
- [ ] Plugin marketplace UI
- [ ] Model training wizard
- [ ] Advanced prompt management

---

## Older Releases

None yet — 0.1.0 is the first release.

---

## Release Process

1. **Version Bump:** Update version in `package.json` (root and apps)
2. **Changelog:** Document all changes in this file
3. **Tag:** `git tag v0.1.0`
4. **Build:** `bun build && bun tauri build`
5. **Release Notes:** Create GitHub release with highlights
6. **Announce:** Share on forums, social media, etc.

---

## How to Report Issues

Found a bug or have a feature request?

1. **Check existing issues** on GitHub
2. **Open a new issue** with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs. actual behavior
   - Environment (OS, GPU, VxLLM version)
   - Relevant logs (enable `LOG_LEVEL=debug`)
3. **Pull requests welcome** — see CONTRIBUTING.md

---

## Support

- **Discord:** [Link]
- **GitHub Discussions:** [Link]
- **Email:** support@vxllm.io (if established)
- **Docs:** `/docs` folder in repo

---

## License

VxLLM is open-source under the MIT License. See LICENSE file for details.

---

**Last Updated:** 2026-03-20
**Next Review:** 2026-06-20 (Phase 2 planning)
