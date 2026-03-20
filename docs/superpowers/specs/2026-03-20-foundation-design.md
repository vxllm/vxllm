# Sub-project #1: Foundation — Design Spec

> **Project:** VxLLM
> **Sub-project:** 1 of 13 — Foundation
> **Date:** 2026-03-20
> **Status:** Approved
> **Approach:** Layered Foundation (3 layers, bottom-up)

---

## Context

VxLLM is decomposed into 13 sub-projects built sequentially. This is the first — it establishes the database schemas, environment configuration, shared TypeScript configs, API contracts, package scaffolds, and UI component platform that all downstream sub-projects depend on.

### Build Order (Full Project)

1. **Foundation** (this spec)
2. Inference Engine
3. Model Management
4. Server API — OpenAI Compatible
5. Server API — oRPC App Routes
6. Chat UI
7. Dashboard + Settings UI
8. CLI
9. Voice Sidecar (Python)
10. Voice Integration
11. Tauri Desktop
12. Server Mode + Docker
13. Fumadocs Content

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| All 10 database tables + relations + migrations | Actual inference logic |
| Full environment variable schema | Business logic in API routes |
| Shared config package (tsconfig, tailwind, eslint) | Node-llama-cpp integration |
| Zod schemas for all API contracts | Voice sidecar (Python) |
| oRPC router stubs (signatures only) | CLI app scaffolding |
| Inference + llama-provider package scaffolds | Tauri Rust backend |
| UI teardown + radix-nova reinstall + full component set | Page/feature implementations |
| Geist font + dark theme + color tokens | — |

---

## Layer 1 — Core Infrastructure

### 1.1 Config Package (`packages/config`)

Export shared configs consumed by all apps and packages.

**Files to create:**

```
packages/config/
├── tsconfig/
│   ├── base.json          # Strict, ESNext, Bun moduleResolution, path aliases
│   ├── react.json         # Extends base, JSX preserve, React 19 types
│   └── bun.json           # Extends base, Bun globals, node compat
├── tailwind/
│   └── preset.ts          # Shared Tailwind v4 preset: Geist fonts, slate/blue tokens, dark-first, radius scale
├── eslint/
│   └── base.js            # Flat config, TypeScript-ESLint, import ordering
├── package.json
└── index.ts               # Re-exports for convenience
```

**Consumer pattern:** Each app/package `tsconfig.json` extends the appropriate shared config:
- `apps/web` → `@vxllm/config/tsconfig/react.json`
- `apps/server` → `@vxllm/config/tsconfig/bun.json`
- `packages/*` → `@vxllm/config/tsconfig/base.json`

The root `tsconfig.json` becomes a project references file only.

### 1.2 Environment Variables (`packages/env`)

Replace the current minimal env with the full validated schema. Uses `@t3-oss/env-core` + Zod.

**`server.ts`** — consumed by `apps/server`:

| Variable | Required | Default | Type | Description |
|----------|----------|---------|------|-------------|
| `DATABASE_URL` | Yes | `file:./local.db` | string | SQLite path or Turso URL |
| `DATABASE_AUTH_TOKEN` | No | — | string | Turso auth token |
| `PORT` | No | `11500` | number (1024-65535) | Server port |
| `HOST` | No | `127.0.0.1` | string | Bind host |
| `MODELS_DIR` | No | `~/.vxllm/models` | string (path) | Model storage directory |
| `VOICE_SIDECAR_URL` | No | `http://localhost:11501` | string (url) | Python voice sidecar base URL |
| `VOICE_SIDECAR_PORT` | No | `11501` | number (1024-65535) | Voice sidecar port |
| `API_KEY` | No | — | string | Legacy single API key (server mode) |
| `LOG_LEVEL` | No | `info` | enum: debug/info/warn/error | Logging verbosity |
| `DEFAULT_MODEL` | No | — | string | Model to auto-load on startup |
| `CORS_ORIGINS` | No | `*` | string | Allowed CORS origins (comma-separated) |
| `MAX_CONTEXT_SIZE` | No | `8192` | number | Default context window size |
| `GPU_LAYERS_OVERRIDE` | No | — | number | Manual GPU layer count |
| `MAX_CONCURRENT_DOWNLOADS` | No | `2` | number (1-5) | Max parallel model downloads |
| `NODE_ENV` | No | `development` | enum: development/production/test | Environment |

**`web.ts`** — consumed by `apps/web`:

| Variable | Required | Default | Type | Description |
|----------|----------|---------|------|-------------|
| `VITE_SERVER_URL` | No | `http://localhost:11500` | string (url) | Hono server base URL |
| `VITE_WS_URL` | No | `ws://localhost:11500` | string (url) | WebSocket base URL |

### 1.3 Database Schema (`packages/db`)

All 10 tables using Drizzle ORM + SQLite. Schema files organized by domain.

**Files:**

```
packages/db/src/schema/
├── models.ts              # models, tags, model_tags, download_queue
├── conversations.ts       # conversations, messages
├── settings.ts            # settings, api_keys
├── metrics.ts             # usage_metrics, voice_profiles
├── relations.ts           # All Drizzle relations() definitions
└── index.ts               # Re-exports all tables + relations
```

**Table Definitions:**

#### `models`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `name` | text | NOT NULL, UNIQUE |
| `display_name` | text | NOT NULL |
| `type` | text | NOT NULL, CHECK (llm/stt/tts/embedding) |
| `format` | text | CHECK (gguf/mlx/safetensors) |
| `quantization` | text | e.g. Q4_K_M, Q8_0 |
| `parameters` | text | e.g. "8B", "3B" |
| `size_bytes` | integer | File size on disk |
| `local_path` | text | Absolute path to model file |
| `huggingface_repo` | text | Source repo |
| `huggingface_file` | text | Source filename |
| `context_length` | integer | Max context window |
| `status` | text | NOT NULL, CHECK (available/downloading/downloaded/error), DEFAULT 'available' |
| `description` | text | Human-readable description |
| `created_at` | integer | NOT NULL, Unix epoch ms |
| `updated_at` | integer | NOT NULL, Unix epoch ms |

#### `tags`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `name` | text | NOT NULL |
| `slug` | text | NOT NULL, UNIQUE |

#### `model_tags`
| Column | Type | Constraints |
|--------|------|------------|
| `model_id` | text | FK → models.id, ON DELETE CASCADE |
| `tag_id` | text | FK → tags.id, ON DELETE CASCADE |
| — | — | PK (model_id, tag_id) |

#### `download_queue`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `model_id` | text | FK → models.id, ON DELETE CASCADE |
| `status` | text | NOT NULL, CHECK (queued/active/paused/completed/failed) |
| `progress_pct` | integer | DEFAULT 0 (0-100) |
| `downloaded_bytes` | integer | DEFAULT 0 |
| `total_bytes` | integer | |
| `speed_bps` | integer | Bytes per second |
| `error_message` | text | On failure |
| `started_at` | integer | Unix epoch ms |
| `completed_at` | integer | Unix epoch ms |
| `created_at` | integer | NOT NULL, Unix epoch ms |

#### `conversations`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `title` | text | NOT NULL |
| `model_id` | text | FK → models.id, ON DELETE SET NULL |
| `system_prompt` | text | |
| `created_at` | integer | NOT NULL, Unix epoch ms |
| `updated_at` | integer | NOT NULL, Unix epoch ms |

#### `messages`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `conversation_id` | text | FK → conversations.id, ON DELETE CASCADE |
| `role` | text | NOT NULL, CHECK (system/user/assistant) |
| `content` | text | NOT NULL |
| `tokens_in` | integer | Prompt tokens |
| `tokens_out` | integer | Completion tokens |
| `latency_ms` | integer | Time to generate |
| `created_at` | integer | NOT NULL, Unix epoch ms |

#### `settings`
| Column | Type | Constraints |
|--------|------|------------|
| `key` | text | PK |
| `value` | text | NOT NULL, JSON-encoded |
| `updated_at` | integer | NOT NULL, Unix epoch ms |

#### `api_keys`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `key_hash` | text | NOT NULL, UNIQUE, SHA-256 |
| `key_prefix` | text | NOT NULL, UNIQUE, e.g. "vx_sk_abc" |
| `label` | text | NOT NULL |
| `permissions` | text | JSON array, e.g. ["chat", "models"] |
| `rate_limit` | integer | Requests per minute |
| `expires_at` | integer | Unix epoch ms, nullable |
| `last_used_at` | integer | Unix epoch ms, nullable |
| `created_at` | integer | NOT NULL, Unix epoch ms |

#### `usage_metrics`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `model_id` | text | FK → models.id, ON DELETE SET NULL |
| `type` | text | NOT NULL, CHECK (chat/completion/embedding/stt/tts) |
| `tokens_in` | integer | |
| `tokens_out` | integer | |
| `latency_ms` | integer | |
| `created_at` | integer | NOT NULL, Unix epoch ms |

#### `voice_profiles`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `name` | text | NOT NULL |
| `stt_model` | text | e.g. "whisper:large-v3-turbo" |
| `tts_model` | text | e.g. "kokoro:v1.1" |
| `tts_voice` | text | e.g. "af_sky" |
| `language` | text | DEFAULT 'en' |
| `is_default` | integer | DEFAULT 0, CHECK (0/1) |
| `created_at` | integer | NOT NULL, Unix epoch ms |
| `updated_at` | integer | NOT NULL, Unix epoch ms |

**Relations:**
- `models` 1:N `download_queue` (cascade delete)
- `models` N:N `tags` via `model_tags` (cascade delete)
- `models` 1:N `conversations` (set null on delete)
- `models` 1:N `usage_metrics` (set null on delete)
- `conversations` 1:N `messages` (cascade delete)

After schema definition, run `bun run db:generate` and `bun run db:push` to create the initial migration and apply it.

---

## Layer 2 — Shared Contracts

### 2.1 API Schemas & Router Stubs (`packages/api`)

Restructure `packages/api` into a full contract layer.

**Directory structure:**

```
packages/api/src/
├── schemas/
│   ├── openai.ts          # OpenAI-compatible request/response Zod schemas
│   ├── models.ts          # Model CRUD, download, registry
│   ├── chat.ts            # Conversation + message types
│   ├── voice.ts           # STT/TTS/VAD config types
│   ├── settings.ts        # Settings + API key types
│   ├── dashboard.ts       # Metrics + hardware status types
│   └── common.ts          # Pagination, error, nanoid, sort
├── routers/
│   ├── model.router.ts    # 7 procedures (stub)
│   ├── chat.router.ts     # 7 procedures (stub)
│   ├── settings.router.ts # 7 procedures (stub)
│   ├── dashboard.router.ts# 3 procedures (stub)
│   └── index.ts           # Merged router export
├── context.ts             # oRPC context type (db, inferenceEngine refs)
├── client.ts              # Typed oRPC client factory
└── index.ts               # Public exports
```

**`schemas/openai.ts`** key schemas:
- `ChatCompletionRequest` — messages[], model, temperature, max_tokens, stream, top_p, frequency_penalty, presence_penalty, stop, n, user
- `ChatCompletionResponse` — id, object:"chat.completion", created, model, choices[]{message, finish_reason, index}, usage{prompt_tokens, completion_tokens, total_tokens}
- `ChatCompletionChunk` — id, object:"chat.completion.chunk", created, model, choices[]{delta{role?, content?}, finish_reason, index}
- `EmbeddingRequest` — input (string | string[]), model, encoding_format
- `EmbeddingResponse` — object:"list", data[]{embedding, index, object:"embedding"}, model, usage
- `AudioTranscriptionRequest` — file, model, language, prompt, response_format, temperature
- `AudioSpeechRequest` — model, input, voice, response_format, speed
- `ModelObject` — id, object:"model", created, owned_by
- `ModelListResponse` — object:"list", data: ModelObject[]
- `OpenAIError` — error{message, type, code, param}

**`schemas/common.ts`**:
- `PaginationInput` — z.object({ cursor: z.string().optional(), limit: z.number().min(1).max(100).default(20) })
- `PaginationOutput<T>` — z.object({ items: z.array(T), nextCursor: z.string().nullable() })
- `SortInput` — z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) })
- `ApiErrorResponse` — z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() })

**Router stub signatures (input → output):**

| Router | Procedure | Input | Output |
|--------|-----------|-------|--------|
| `model` | `list` | PaginationInput + filters | PaginatedModels |
| `model` | `getById` | { id: string } | Model |
| `model` | `download` | { name: string, format?: string } | DownloadQueueEntry |
| `model` | `cancelDownload` | { id: string } | void |
| `model` | `delete` | { id: string, force?: boolean } | void |
| `model` | `getDownloadStatus` | { id: string } | DownloadProgress |
| `model` | `search` | { query: string, type?: ModelType } | Model[] |
| `chat` | `createConversation` | { title?, modelId?, systemPrompt? } | Conversation |
| `chat` | `getConversation` | { id: string } | Conversation |
| `chat` | `listConversations` | PaginationInput | PaginatedConversations |
| `chat` | `deleteConversation` | { id: string } | void |
| `chat` | `addMessage` | { conversationId, role, content } | Message |
| `chat` | `getMessages` | { conversationId } + PaginationInput | PaginatedMessages |
| `chat` | `regenerateLastMessage` | { conversationId } | Message |
| `settings` | `get` | { key: string } | SettingValue |
| `settings` | `set` | { key: string, value: unknown } | void |
| `settings` | `getAll` | void | Setting[] |
| `settings` | `createApiKey` | { label, permissions?, rateLimit?, expiresAt? } | { key: string (shown once), id } |
| `settings` | `listApiKeys` | void | ApiKey[] (without hash) |
| `settings` | `deleteApiKey` | { id: string } | void |
| `settings` | `getHardwareInfo` | void | HardwareProfile |
| `dashboard` | `getMetricsSummary` | { period?: "1h"/"6h"/"24h" } | MetricsSummary |
| `dashboard` | `getUsageBreakdown` | { period?: "1h"/"6h"/"24h" } | UsageBreakdown |
| `dashboard` | `getHardwareStatus` | void | HardwareStatus |

All stubs throw `new Error("Not implemented")` — they exist only to define the contract.

### 2.2 Inference Package Scaffold (`packages/inference`)

```
packages/inference/
├── src/
│   ├── types.ts           # All inference-related TypeScript types
│   ├── hardware.ts        # detectHardware() stub
│   ├── model-manager.ts   # ModelManager class stub
│   ├── download.ts        # DownloadManager class stub
│   ├── registry.ts        # Registry class stub (reads models.json)
│   ├── constants.ts       # Paths, quantization tiers, enums
│   └── index.ts           # Public exports
├── package.json
└── tsconfig.json
```

**`types.ts`** key types:

```typescript
interface HardwareProfile {
  platform: "darwin" | "linux" | "win32"
  arch: "arm64" | "x64"
  isAppleSilicon: boolean
  gpu: {
    available: boolean
    vendor: "apple" | "nvidia" | "amd" | "none"
    name: string
    vramBytes: number
  }
  cpu: {
    model: string
    physicalCores: number
    logicalCores: number
  }
  ram: {
    totalBytes: number
    availableBytes: number
  }
}

interface ModelInfo {
  name: string
  displayName: string
  type: "llm" | "stt" | "tts" | "embedding"
  format: "gguf" | "mlx" | "safetensors"
  quantization: string | null
  parameters: string | null
  sizeBytes: number
  contextLength: number
  localPath: string | null
  huggingfaceRepo: string
  huggingfaceFile: string | null
}

interface InferenceOptions {
  temperature: number
  maxTokens: number
  topP: number
  topK: number
  repeatPenalty: number
  stop: string[]
  stream: boolean
}

interface LoadedModel {
  modelInfo: ModelInfo
  sessionId: string
  memoryUsageBytes: number
  gpuLayersLoaded: number
  contextSize: number
  createdAt: number
}

interface DownloadProgress {
  modelId: string
  status: "queued" | "active" | "paused" | "completed" | "failed"
  progressPct: number
  downloadedBytes: number
  totalBytes: number
  speedBps: number
  eta: number | null
  error: string | null
}
```

**Class stubs** have constructor + method signatures with JSDoc, throwing `Not implemented`.

### 2.3 LLM Provider Scaffold (`packages/llama-provider`)

AI SDK custom provider following the LanguageModelV2 interface:

```
packages/llama-provider/
├── src/
│   ├── index.ts           # createLlamaProvider() factory
│   ├── llama-chat-model.ts    # LlamaChatLanguageModel (implements LanguageModelV2)
│   ├── llama-embedding-model.ts # LlamaEmbeddingModel
│   └── types.ts           # LlamaProviderSettings
├── package.json
└── tsconfig.json
```

**`index.ts`** exports:
```typescript
function createLlamaProvider(settings: LlamaProviderSettings): {
  chat: (modelId: string) => LanguageModelV2
  embedding: (modelId: string) => EmbeddingModelV2
}
```

Stubs implement the correct interface methods (`doGenerate`, `doStream` for chat; `doEmbed` for embeddings) but throw `Not implemented`.

---

## Layer 3 — UI Platform

### 3.1 Teardown

Delete all existing components from `packages/ui/src/components/`:
- button, card, checkbox, dropdown-menu, input, label, skeleton, sonner

Remove existing shadcn configuration.

### 3.2 Reinitialize shadcn/ui

**Configuration:**
- Style: **radix-nova**
- CSS variables: yes (oklch)
- Base color: slate
- Tailwind v4 mode
- Output: `packages/ui/src/components/`
- Utils: `packages/ui/src/lib/utils.ts`

### 3.3 Component Installation (~35 components)

**Layout & Navigation:**
sidebar, sheet, tabs, separator, breadcrumb, navigation-menu, collapsible

**Data Display:**
table, card, badge, avatar, tooltip, accordion, scroll-area, progress

**Forms & Input:**
button, input, textarea, label, checkbox, radio-group, select, switch, slider, form

**Feedback & Overlay:**
dialog, alert-dialog, dropdown-menu, context-menu, popover, sonner, alert, skeleton

**Specialized:**
command (cmdk), resizable, toggle, toggle-group, chart (recharts)

### 3.4 Theme Configuration

**Geist Fonts:**
- Install `geist` npm package
- Define CSS variables: `--font-sans: "Geist Sans"`, `--font-mono: "Geist Mono"`
- Applied in `apps/web` root layout

**Color System (dark-first):**
- Background/foreground: slate scale
- Primary: slate (buttons, emphasis)
- Accent: blue (links, active states, focus rings)
- Destructive: red
- Success: green (not in shadcn defaults — add as custom token)
- Warning: amber (add as custom token)
- Dark mode default, light mode via class toggle (`next-themes`)

**Design Tokens:**
- `--radius: 0.5rem` (radix-nova default)
- Geist Sans for UI text
- Geist Mono for code, metrics, IDs, timestamps, CLI output

**`packages/ui/src/styles/globals.css`** defines all CSS custom properties for both `:root` (light) and `.dark` (dark) themes.

### 3.5 Shared Hooks

| Hook | Purpose |
|------|---------|
| `use-mobile.ts` | Responsive breakpoint detection (sidebar/sheet responsive patterns) |
| `use-debounce.ts` | Debounced value for search inputs |

---

## File Impact Summary

| Area | Files Created | Files Modified | Files Deleted |
|------|--------------|----------------|---------------|
| `packages/config` | ~6 | 1 (package.json) | 0 |
| `packages/env` | 0 | 2 (server.ts, web.ts) | 0 |
| `packages/db` | 5 | 1 (schema/index.ts) | 0 |
| `packages/api` | ~14 | 3 (context.ts, index.ts, routers/index.ts) | 0 |
| `packages/inference` | 8 | 0 | 0 |
| `packages/llama-provider` | 6 | 0 | 0 |
| `packages/ui` | ~37 | 2 (globals.css, utils.ts) | 8 (old components) |
| `apps/web` | 0 | 1 (root layout — fonts) | 0 |
| Root | 0 | 2 (tsconfig.json, package.json) | 0 |
| **Total** | **~76** | **~12** | **8** |

## Success Criteria

- [ ] `bun install` succeeds with no errors
- [ ] `bun run check-types` passes across all packages
- [ ] `bun run db:push` creates all 10 tables in SQLite
- [ ] All oRPC router stubs are importable and type-check
- [ ] `packages/inference` and `packages/llama-provider` export all type stubs
- [ ] shadcn/ui components render in radix-nova style with dark theme
- [ ] Geist Sans and Geist Mono load correctly in `apps/web`
- [ ] `bun run dev:web` starts without errors and shows themed UI
- [ ] `bun run dev:server` starts without errors

---

*Spec version: 1.0 | Approved: 2026-03-20*
