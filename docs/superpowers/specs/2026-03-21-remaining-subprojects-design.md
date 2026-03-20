# Sub-projects #11-14: Tauri + Docker + Docs + Marketing — Design Spec

> **Project:** VxLLM
> **Sub-projects:** 11-14 of 14
> **Date:** 2026-03-21
> **Status:** Approved

---

## Sub-project #11: Tauri Desktop

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| Spawn/kill Bun server + Python sidecar | Auto-update mechanism |
| System tray with full menu | Custom window chrome |
| Minimize to tray on window close | Multi-window support |
| Auto-start on OS login | |
| Health polling + restart on crash | |
| Tauri IPC commands for frontend | |

### Rust Files

**`apps/app/src-tauri/src/process.rs`**
- `ServerProcess` struct managing Bun server child process
- `SidecarProcess` struct managing Python voice sidecar
- `spawn_server(port, host)` → `Child`
- `spawn_sidecar(port)` → `Child`
- `kill_process(child)` → graceful SIGTERM then SIGKILL
- Health polling: `check_health(url)` → bool (fetch `/health` every 5s)
- Auto-restart on crash detection

**`apps/app/src-tauri/src/tray.rs`**
- System tray icon (reuse app icon)
- Menu items:
  - Show/Hide Window (toggle)
  - ── separator ──
  - Server: Running ● / Stopped ○ (dynamic)
  - Voice: Running ● / Stopped ○ (dynamic)
  - Restart Server
  - Restart Voice
  - ── separator ──
  - Quit VxLLM
- Click on tray icon → toggle window visibility

**`apps/app/src-tauri/src/commands.rs`**
- `#[tauri::command] get_server_status()` → `{ running: bool, port: u16 }`
- `#[tauri::command] get_voice_status()` → `{ running: bool, port: u16 }`
- `#[tauri::command] restart_server()` → kills + respawns
- `#[tauri::command] restart_voice()` → kills + respawns

**`apps/app/src-tauri/src/lib.rs`** — Updated:
- Setup: spawn processes, create tray, register IPC commands
- Window close event → hide instead of quit
- App quit → kill all child processes

**`tauri.conf.json`** — Updates:
- Add tray configuration
- Add required Tauri plugins: `tauri-plugin-shell`, `tauri-plugin-autostart`, `tauri-plugin-notification`
- Update window config for tray-minimize behavior

**`Cargo.toml`** — Add dependencies:
- `tauri-plugin-shell`
- `tauri-plugin-autostart`
- `tauri-plugin-notification`
- `reqwest` (for health checking)
- `tokio` (async runtime for polling)

---

## Sub-project #12: Server Mode + Docker

### Auth Middleware

**`apps/server/src/middleware/auth.ts`**

```
Request → Is localhost? → Skip auth (pass through)
       → Is /health?   → Skip auth (pass through)
       → Has Bearer token? → Hash with SHA-256 → Lookup in api_keys table
         → Found + not expired + rate limit OK → Pass through
         → Not found → 401 Unauthorized
         → Expired → 401 Unauthorized
         → Rate limited → 429 Too Many Requests
```

- In-memory token bucket for rate limiting (per key ID)
- Updates `lastUsedAt` on successful auth
- Error responses in OpenAI format

Mount in `apps/server/src/index.ts` BEFORE all routes, AFTER CORS.

### Docker Files

**`docker/Dockerfile.server`**
```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install --production
EXPOSE 11500
CMD ["bun", "run", "apps/server/src/index.ts"]
```

**`docker/Dockerfile.voice`**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install uv
COPY sidecar/voice/ .
RUN uv sync
EXPOSE 11501
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "11501"]
```

**`docker/docker-compose.yml`**
```yaml
services:
  server:
    build: { context: .., dockerfile: docker/Dockerfile.server }
    ports: ["11500:11500"]
    environment:
      HOST: "0.0.0.0"
      VOICE_SIDECAR_URL: "http://voice:11501"
      DATABASE_URL: "file:/data/local.db"
      MODELS_DIR: "/data/models"
    volumes:
      - vxllm-data:/data

  voice:
    build: { context: .., dockerfile: docker/Dockerfile.voice }
    ports: ["11501:11501"]
    volumes:
      - vxllm-data:/data

volumes:
  vxllm-data:
```

**`docker/.env.example`**
```
API_KEY=your-secret-key
HOST=0.0.0.0
CORS_ORIGINS=*
```

---

## Sub-project #13: Docs Content

### MDX Files in `apps/docs/content/docs/`

```
content/docs/
├── index.mdx                # Getting Started overview
├── installation.mdx         # CLI (bun), Desktop (download), Docker
├── quickstart.mdx           # First chat in 5 minutes
├── configuration.mdx        # All environment variables + settings
├── api/
│   ├── index.mdx            # API overview
│   ├── chat-completions.mdx # POST /v1/chat/completions (stream + non-stream)
│   ├── completions.mdx      # POST /v1/completions
│   ├── embeddings.mdx       # POST /v1/embeddings
│   ├── models.mdx           # GET /v1/models + model management
│   └── audio.mdx            # /v1/audio/transcriptions, /v1/audio/speech
├── cli/
│   └── commands.mdx         # All 7 CLI commands with examples
├── voice/
│   └── setup.mdx            # Voice sidecar installation + configuration
└── deployment/
    └── docker.mdx           # Docker compose deployment guide
```

Each MDX file includes: description, code examples, parameter tables, response examples.

---

## Sub-project #14: Marketing Website

### Pages in `apps/www/src/app/`

**`page.tsx`** — Landing page sections:

1. **Hero** — "Run AI models locally" headline, subtext, GitHub + Download CTAs
2. **Features grid** — 6 cards:
   - LLM Inference (node-llama-cpp, Metal/CUDA)
   - Voice I/O (STT + TTS, real-time)
   - OpenAI-Compatible API (drop-in replacement)
   - Desktop App (Tauri, system tray)
   - CLI (serve, pull, run, list)
   - Docker Ready (compose up)
3. **Comparison table** — VxLLM vs Ollama vs LM Studio (features matrix)
4. **Install section** — Tabbed code blocks (CLI, Docker, Desktop)
5. **Footer** — GitHub, Docs, MIT License, DataHase

Uses `@vxllm/ui` components, Geist fonts, dark theme.

---

## File Impact Summary

| Sub-project | Files Created | Files Modified |
|-------------|--------------|----------------|
| #11 Tauri | 3 Rust (process, tray, commands) | 3 (lib.rs, Cargo.toml, tauri.conf.json) |
| #12 Docker | 4 (Dockerfile.server, Dockerfile.voice, compose, .env) + 1 TS (auth.ts) | 1 (server index.ts) |
| #13 Docs | ~12 MDX files | 0 |
| #14 Marketing | ~5 React components + update page.tsx | 1 (page.tsx) |
| **Total** | **~25** | **~5** |

## Success Criteria

**Tauri:**
- [ ] `bun tauri dev` launches app, spawns server + sidecar
- [ ] System tray shows with all menu items
- [ ] Window close minimizes to tray (doesn't quit)
- [ ] Tray → Quit kills all processes
- [ ] Server auto-restarts on crash

**Docker:**
- [ ] `docker compose up` starts both services
- [ ] API key auth works on non-localhost
- [ ] Auth skipped on localhost
- [ ] Rate limiting returns 429

**Docs:**
- [ ] `bun run dev:docs` shows documentation site
- [ ] All pages render with correct content
- [ ] API examples include request/response samples

**Marketing:**
- [ ] `bun run dev:www` shows landing page
- [ ] All sections render (hero, features, comparison, install)
- [ ] Responsive on mobile

---

*Spec version: 1.0 | Approved: 2026-03-21*
