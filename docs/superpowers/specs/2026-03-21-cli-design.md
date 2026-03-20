# Sub-project #8: CLI — Design Spec

> **Project:** VxLLM
> **Sub-project:** 8 of 14 — CLI
> **Date:** 2026-03-21
> **Status:** Approved

---

## Context

The CLI provides developer-facing terminal commands for managing VxLLM: starting the server, downloading models, running interactive chat, listing/removing models, and viewing hardware info. Uses `citty` (UnJS) for typed command definitions.

### Dependencies

- Sub-project #2 (Inference Engine): ModelManager, DownloadManager, Registry, detectHardware, provider
- Sub-project #5 (oRPC Routes): DB queries for models/settings
- `apps/server`: Hono server for `serve` command

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| 7 CLI commands (serve, pull, run, list, ps, rm, info) | Voice CLI commands |
| Streaming terminal chat with markdown rendering | GUI/TUI interface |
| Progress bars for downloads | Model conversion (safetensors → GGUF) |
| `--json` flag for machine-readable output | Shell completion |
| Colored terminal output | |

---

## Package Structure

```
apps/cli/
├── src/
│   ├── index.ts              # Main: defineCommand with subcommands
│   ├── commands/
│   │   ├── serve.ts          # Start Hono server
│   │   ├── pull.ts           # Download model
│   │   ├── run.ts            # Interactive streaming chat
│   │   ├── list.ts           # List downloaded models
│   │   ├── ps.ts             # Server status + loaded models
│   │   ├── rm.ts             # Remove model
│   │   └── info.ts           # Hardware profile
│   └── utils/
│       ├── format.ts         # Table formatting, colors, size formatting
│       └── markdown.ts       # Terminal markdown (ANSI bold, code blocks)
├── package.json
└── tsconfig.json
```

## Commands

### `vxllm serve`

Starts the full Hono server with all REST + WebSocket endpoints.

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 11500 | Server port |
| `--host` | 127.0.0.1 | Bind host (use 0.0.0.0 for remote) |
| `--model` | — | Auto-load model on startup |

Imports and runs `apps/server/src/index.ts`. Displays connection info table on startup. Handles SIGTERM/SIGINT for graceful shutdown.

### `vxllm pull <name>`

Downloads a model from HuggingFace. No server needed.

| Flag | Default | Description |
|------|---------|-------------|
| `--variant` | auto | Quantization variant (q4_k_m, q8_0, etc.) |
| `--force` | false | Re-download even if exists |

Uses `DownloadManager.pull()` directly. Shows progress bar with speed and ETA.

Output:
```
Pulling qwen2.5:7b (Q4_K_M, 4.7 GB)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 67% 3.1 GB / 4.7 GB  45.2 MB/s  ETA 35s
```

### `vxllm run <name>`

Interactive streaming chat in terminal. No server needed.

| Flag | Default | Description |
|------|---------|-------------|
| `--system` | — | System prompt |
| `--temperature` | 0.7 | Temperature |

1. Loads model via `ModelManager` (shows loading message)
2. Readline prompt loop (`>>> `)
3. Streams tokens to stdout in real-time (`process.stdout.write`)
4. After response: renders terminal markdown (ANSI bold, code blocks with language labels, colored inline code)
5. Shows token count + tok/s after each response
6. Ctrl+C exits

### `vxllm list`

Lists all downloaded models.

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | false | JSON output |
| `--type` | — | Filter by type (llm/stt/tts/embedding) |

Table output:
```
NAME              TYPE   VARIANT   SIZE     STATUS
qwen2.5:7b        llm    q4_k_m    4.7 GB   downloaded
nomic-embed:v1.5   emb    q4_k_m    80 MB    downloaded
```

### `vxllm ps`

Shows server status and loaded models.

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | false | JSON output |

Checks server via `GET http://localhost:11500/health`. If running, shows loaded models. If not, shows "Server not running."

### `vxllm rm <name>`

Removes a downloaded model.

| Flag | Default | Description |
|------|---------|-------------|
| `--force` | false | Skip confirmation |

Prompts "Remove qwen2.5:7b? (y/N)" unless `--force`. Deletes file from disk + DB entry.

### `vxllm info`

Shows hardware profile.

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | false | JSON output |

Output:
```
Platform:    darwin (arm64)
GPU:         Apple M3 (Metal) — 12 GB VRAM
CPU:         Apple M3 — 8 cores (8 logical)
RAM:         16 GB total, 8.2 GB available

Recommended: qwen2.5:7b (Q4_K_M) — fits in VRAM
```

---

## Dependencies

```json
{
  "dependencies": {
    "citty": "^0.1.6",
    "consola": "^3.2.3",
    "@vxllm/inference": "workspace:*",
    "@vxllm/llama-provider": "workspace:*",
    "@vxllm/db": "workspace:*",
    "@vxllm/env": "workspace:*",
    "ai": "^6.0.0"
  }
}
```

---

## File Impact

| Area | Files Created |
|------|--------------|
| `apps/cli/` | ~12 (package.json, tsconfig, index, 7 commands, 2 utils) |
| Root | 1 modify (package.json — add dev:cli script) |

## Success Criteria

- [ ] `bun run apps/cli/src/index.ts serve --port 11500` starts the server
- [ ] `bun run apps/cli/src/index.ts pull phi-4-mini` downloads with progress bar
- [ ] `bun run apps/cli/src/index.ts run phi-4-mini` starts interactive chat with streaming
- [ ] `bun run apps/cli/src/index.ts list` shows downloaded models table
- [ ] `bun run apps/cli/src/index.ts ps` shows server status
- [ ] `bun run apps/cli/src/index.ts rm phi-4-mini` removes with confirmation
- [ ] `bun run apps/cli/src/index.ts info` shows hardware profile
- [ ] `--json` flag works on list, ps, info
- [ ] `bun run check-types` passes

---

*Spec version: 1.0 | Approved: 2026-03-21*
