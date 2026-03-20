# Remaining Sub-projects Implementation Plan (11-14)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete VxLLM with Tauri desktop app (process management, system tray), server mode (auth + Docker), documentation content, and marketing website.

**Architecture:** 4 independent sub-projects in one plan. Tauri adds Rust process management. Docker wraps existing services. Docs and marketing are content.

**Tech Stack:** Rust/Tauri 2, Docker, MDX/Fumadocs, Next.js/React

**Spec:** `docs/superpowers/specs/2026-03-21-remaining-subprojects-design.md`

---

## Task 1: Tauri Desktop — Process Management

**Files:**
- Create: `apps/app/src-tauri/src/process.rs`
- Modify: `apps/app/src-tauri/src/lib.rs`
- Modify: `apps/app/src-tauri/Cargo.toml`

- [ ] **Step 1: Read existing Tauri files**

Read `apps/app/src-tauri/src/lib.rs`, `src/main.rs`, `Cargo.toml`, `tauri.conf.json`.

- [ ] **Step 2: Add dependencies to Cargo.toml**

Add: `tauri-plugin-shell`, `tauri-plugin-autostart`, `reqwest` (with `rustls-tls` feature), `tokio` (with `time` feature), `log`.

- [ ] **Step 3: Create `process.rs`**

Rust module for spawning and managing child processes:

```rust
use std::process::{Command, Child};
use std::sync::Mutex;

pub struct ProcessManager {
    server: Mutex<Option<Child>>,
    sidecar: Mutex<Option<Child>>,
}

impl ProcessManager {
    pub fn new() -> Self { ... }

    pub fn spawn_server(&self, port: u16, host: &str) -> Result<(), String> {
        // Spawn: bun run apps/server/src/index.ts
        // Set PORT and HOST env vars
    }

    pub fn spawn_sidecar(&self, port: u16) -> Result<(), String> {
        // Spawn: uv run uvicorn app.main:app --port {port}
        // Working dir: sidecar/voice/
    }

    pub fn kill_all(&self) {
        // SIGTERM then SIGKILL after timeout
    }

    pub fn is_server_running(&self) -> bool { ... }
    pub fn is_sidecar_running(&self) -> bool { ... }
}
```

- [ ] **Step 4: Update `lib.rs` to spawn processes on startup**

In the `.setup()` closure:
1. Create `ProcessManager`
2. Spawn server on port 11500
3. Spawn sidecar on port 11501
4. Store manager in app state via `app.manage()`

On app exit: kill all processes.

- [ ] **Step 5: Commit**

```bash
git add apps/app/src-tauri/ && git commit -m "feat(tauri): add process management for server and voice sidecar"
```

---

## Task 2: Tauri Desktop — System Tray + Window Behavior

**Files:**
- Create: `apps/app/src-tauri/src/tray.rs`
- Create: `apps/app/src-tauri/src/commands.rs`
- Modify: `apps/app/src-tauri/src/lib.rs`
- Modify: `apps/app/src-tauri/tauri.conf.json`

- [ ] **Step 1: Create `tray.rs`**

System tray with Tauri 2's tray API:

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    Manager,
};

pub fn create_tray(app: &tauri::App) -> Result<TrayIcon, tauri::Error> {
    let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide Window", true, None::<&str>)?;
    let server_status = MenuItem::with_id(app, "server_status", "Server: Starting...", false, None::<&str>)?;
    let voice_status = MenuItem::with_id(app, "voice_status", "Voice: Starting...", false, None::<&str>)?;
    let restart_server = MenuItem::with_id(app, "restart_server", "Restart Server", true, None::<&str>)?;
    let restart_voice = MenuItem::with_id(app, "restart_voice", "Restart Voice", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit VxLLM", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &show_hide,
        &PredefinedMenuItem::separator(app)?,
        &server_status,
        &voice_status,
        &restart_server,
        &restart_voice,
        &PredefinedMenuItem::separator(app)?,
        &quit,
    ])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show_hide" => { /* toggle main window visibility */ },
                "restart_server" => { /* kill + respawn server */ },
                "restart_voice" => { /* kill + respawn sidecar */ },
                "quit" => { /* kill processes + exit */ },
                _ => {}
            }
        })
        .build(app)
}
```

Note: Tauri 2's tray API may differ from this — check the installed `tauri` crate version and adapt. The key methods are `TrayIconBuilder`, `Menu`, `MenuItem`.

- [ ] **Step 2: Create `commands.rs`**

IPC commands for frontend:

```rust
#[tauri::command]
pub fn get_server_status(state: tauri::State<ProcessManager>) -> serde_json::Value {
    json!({ "running": state.is_server_running(), "port": 11500 })
}

#[tauri::command]
pub fn restart_server(state: tauri::State<ProcessManager>) -> Result<(), String> {
    state.kill_server();
    state.spawn_server(11500, "127.0.0.1")
}
```

- [ ] **Step 3: Update `lib.rs`**

Wire tray + commands + window close behavior:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            let pm = ProcessManager::new();
            pm.spawn_server(11500, "127.0.0.1")?;
            pm.spawn_sidecar(11501)?;
            app.manage(pm);
            create_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_server_status,
            commands::restart_server,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Update `tauri.conf.json`**

Add tray icon path and any required plugin permissions.

- [ ] **Step 5: Test (if Rust toolchain available)**

```bash
cd apps/app && bun tauri dev
```

If Rust/cargo isn't set up, skip the test — the code should compile when the user runs it.

- [ ] **Step 6: Commit**

```bash
git add apps/app/src-tauri/ && git commit -m "feat(tauri): add system tray, window minimize-to-tray, and IPC commands"
```

---

## Task 3: Server Mode — Auth Middleware + Rate Limiting

**Files:**
- Create: `apps/server/src/middleware/auth.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create auth middleware**

```typescript
import { env } from "@vxllm/env/server";
import { db } from "@vxllm/db";
import { apiKeys } from "@vxllm/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

// In-memory rate limit buckets
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export async function authMiddleware(c: Context, next: Next) {
  // Skip auth on localhost
  const host = c.req.header("host") || "";
  if (host.startsWith("127.0.0.1") || host.startsWith("localhost")) {
    return next();
  }

  // Skip auth on /health
  if (c.req.path === "/health") return next();

  // Check Bearer token
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing API key", type: "authentication_error" } }, 401);
  }

  const token = authHeader.slice(7);
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);

  if (!key) {
    return c.json({ error: { message: "Invalid API key", type: "authentication_error" } }, 401);
  }

  if (key.expiresAt && key.expiresAt < Date.now()) {
    return c.json({ error: { message: "API key expired", type: "authentication_error" } }, 401);
  }

  // Rate limiting
  if (key.rateLimit) {
    const bucket = rateBuckets.get(key.id) || { count: 0, resetAt: Date.now() + 60000 };
    if (Date.now() > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = Date.now() + 60000;
    }
    bucket.count++;
    rateBuckets.set(key.id, bucket);

    if (bucket.count > key.rateLimit) {
      return c.json({ error: { message: "Rate limit exceeded", type: "rate_limit_error" } }, 429);
    }
  }

  // Update lastUsedAt (fire and forget)
  db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, key.id)).catch(() => {});

  return next();
}
```

- [ ] **Step 2: Mount in index.ts**

Add `app.use("/*", authMiddleware)` AFTER CORS middleware, BEFORE routes. The middleware itself handles localhost bypass.

- [ ] **Step 3: Verify**

```bash
bun run check-types
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/ && git commit -m "feat(server): add API key auth middleware with rate limiting"
```

---

## Task 4: Docker — Dockerfiles + Compose

**Files:**
- Create: `docker/Dockerfile.server`
- Create: `docker/Dockerfile.voice`
- Create: `docker/docker-compose.yml`
- Create: `docker/.env.example`

- [ ] **Step 1: Create `docker/Dockerfile.server`**

```dockerfile
FROM oven/bun:1.3 AS base
WORKDIR /app

# Copy package files
COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json apps/server/
COPY packages/*/package.json packages/*/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY apps/server/ apps/server/
COPY packages/ packages/
COPY models.json .

# Expose port
EXPOSE 11500

# Set defaults
ENV HOST=0.0.0.0
ENV PORT=11500
ENV DATABASE_URL=file:/data/local.db
ENV MODELS_DIR=/data/models

CMD ["bun", "run", "apps/server/src/index.ts"]
```

- [ ] **Step 2: Create `docker/Dockerfile.voice`**

```dockerfile
FROM python:3.11-slim AS base
WORKDIR /app

# Install uv
RUN pip install uv

# Copy sidecar
COPY sidecar/voice/ .

# Install dependencies
RUN uv sync --no-dev

EXPOSE 11501

ENV VOICE_SIDECAR_HOST=0.0.0.0
ENV VOICE_SIDECAR_PORT=11501

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "11501"]
```

- [ ] **Step 3: Create `docker/docker-compose.yml`**

```yaml
version: "3.8"

services:
  server:
    build:
      context: ..
      dockerfile: docker/Dockerfile.server
    ports:
      - "${PORT:-11500}:11500"
    environment:
      - HOST=0.0.0.0
      - PORT=11500
      - VOICE_SIDECAR_URL=http://voice:11501
      - DATABASE_URL=file:/data/local.db
      - MODELS_DIR=/data/models
      - API_KEY=${API_KEY:-}
      - CORS_ORIGINS=${CORS_ORIGINS:-*}
    volumes:
      - vxllm-data:/data
    depends_on:
      - voice

  voice:
    build:
      context: ..
      dockerfile: docker/Dockerfile.voice
    ports:
      - "${VOICE_PORT:-11501}:11501"
    environment:
      - VOICE_SIDECAR_HOST=0.0.0.0
      - VOICE_SIDECAR_PORT=11501
      - MODELS_DIR=/data/models
    volumes:
      - vxllm-data:/data

volumes:
  vxllm-data:
```

- [ ] **Step 4: Create `docker/.env.example`**

```
API_KEY=
PORT=11500
VOICE_PORT=11501
CORS_ORIGINS=*
```

- [ ] **Step 5: Commit**

```bash
git add docker/ && git commit -m "feat(docker): add Dockerfiles and docker-compose for server and voice sidecar"
```

---

## Task 5: Documentation Content

**Files:**
- Create: ~12 MDX files in `apps/docs/content/docs/`

- [ ] **Step 1: Check Fumadocs content structure**

Read `apps/docs/` to understand how content is organized. Check for `content/` directory, `source.ts`, and any existing MDX files.

- [ ] **Step 2: Create content directory structure**

```bash
mkdir -p apps/docs/content/docs/api apps/docs/content/docs/cli apps/docs/content/docs/voice apps/docs/content/docs/deployment
```

- [ ] **Step 3: Create documentation pages**

Write MDX content for each page. Each page should have frontmatter (title, description) and content with code examples.

Key pages:
1. `index.mdx` — Getting Started overview with links to sub-pages
2. `installation.mdx` — Three methods: CLI (`bun add -g vxllm`), Desktop (download), Docker
3. `quickstart.mdx` — 5-minute guide: install → pull model → chat
4. `configuration.mdx` — All env vars table + settings explanation
5. `api/index.mdx` — API overview + base URL + auth
6. `api/chat-completions.mdx` — Full POST /v1/chat/completions with curl + Python + JS examples
7. `api/embeddings.mdx` — POST /v1/embeddings examples
8. `api/models.mdx` — Model management endpoints
9. `api/audio.mdx` — Audio transcription + speech endpoints
10. `cli/commands.mdx` — All 7 CLI commands with flags and examples
11. `voice/setup.mdx` — Voice sidecar installation + config
12. `deployment/docker.mdx` — Docker compose guide

Content should reference actual VxLLM endpoints and real examples that match the implemented API.

- [ ] **Step 4: Verify docs build**

```bash
bun run -F docs build
```

- [ ] **Step 5: Commit**

```bash
git add apps/docs/ && git commit -m "feat(docs): add documentation content (getting started, API, CLI, voice, deployment)"
```

---

## Task 6: Marketing Website

**Files:**
- Create: `apps/www/src/components/` (hero, features, comparison, install, footer)
- Modify: `apps/www/src/app/page.tsx`

- [ ] **Step 1: Create landing page components**

**`hero.tsx`** — Big headline, description, GitHub + Download buttons
**`features.tsx`** — 6-card grid with icons and descriptions
**`comparison.tsx`** — Table: VxLLM vs Ollama vs LM Studio
**`install-section.tsx`** — Tabbed code blocks (CLI, Docker, Desktop)
**`footer.tsx`** — Links: GitHub, Docs, MIT License, DataHase

- [ ] **Step 2: Update `page.tsx`**

Stack all sections:
```tsx
export default function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <Comparison />
      <InstallSection />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 3: Verify**

```bash
bun run -F www build
```

- [ ] **Step 4: Commit**

```bash
git add apps/www/ && git commit -m "feat(www): implement marketing landing page with features, comparison, and install sections"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Type check everything**

```bash
bun run check-types
```

- [ ] **Step 2: Verify server starts**

```bash
bun run dev:server
curl http://localhost:11500/health
```

- [ ] **Step 3: Verify app builds**

```bash
bun run -F app build
```

- [ ] **Step 4: Verify docs build**

```bash
bun run -F docs build
```

- [ ] **Step 5: Verify www build**

```bash
bun run -F www build
```

- [ ] **Step 6: Git log**

```bash
git log --oneline -20
```

- [ ] **Step 7: Commit fixes**

```bash
git add . && git commit -m "fix: resolve final verification issues"
```

---

## Summary

| Task | Sub-project | Description |
|------|-------------|-------------|
| 1 | #11 Tauri | Process management (spawn/kill server + sidecar) |
| 2 | #11 Tauri | System tray, minimize-to-tray, IPC commands |
| 3 | #12 Docker | Auth middleware with rate limiting |
| 4 | #12 Docker | Dockerfiles + docker-compose |
| 5 | #13 Docs | Documentation MDX content (~12 pages) |
| 6 | #14 Marketing | Landing page (hero, features, comparison, install) |
| 7 | — | Final verification |
