# Sub-project #1: Foundation — Design Spec

> **Project:** VxLLM
> **Sub-project:** 1 of 14 — Foundation
> **Date:** 2026-03-20
> **Status:** Approved (v2 — post-review + structural changes)
> **Approach:** Layered Foundation (3 layers, bottom-up)

---

## Context

VxLLM is decomposed into 14 sub-projects built sequentially. This is the first — it establishes the database schemas, environment configuration, shared TypeScript configs, API contracts, package scaffolds, and UI component platform that all downstream sub-projects depend on.

### Structural Changes (v2)

The following app renames and additions apply to this spec and all downstream sub-projects:

| Old Name | New Name | Description |
|----------|----------|-------------|
| `apps/web` | `apps/app` | Tauri 2 desktop + web UI (React + Vite + TanStack Router) |
| `apps/fumadocs` | `apps/docs` | Documentation site (Next.js + Fumadocs) |
| — (new) | `apps/www` | Marketing website for VxLLM open-source project (Next.js) |

The `apps/www` marketing site is a new Next.js app for the VxLLM open-source project landing page, feature showcase, installation guide, and community links. It is scaffolded in the foundation but content/implementation is deferred to Sub-project #14.

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
13. Docs Content (Fumadocs)
14. Marketing Website (`apps/www`)

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| Rename `apps/web` → `apps/app`, `apps/fumadocs` → `apps/docs` | Actual inference logic |
| Scaffold `apps/www` (Next.js, package.json, basic config) | Marketing site content/pages |
| All 10 database tables + relations + indexes + migrations | Business logic in API routes |
| Full environment variable schema | Node-llama-cpp integration |
| Shared config package (tsconfig, tailwind, eslint) | Voice sidecar (Python) |
| Zod schemas for all API contracts | CLI app scaffolding |
| oRPC router stubs (signatures only) | Tauri Rust backend |
| Inference + llama-provider package scaffolds | Page/feature implementations |
| UI teardown + radix-nova reinstall + full component set | — |
| Geist font + dark theme + color tokens (oklch) | — |

---

## Layer 0 — Structural Renames & Scaffolding

### 0.1 App Renames

Rename directories and update all references:

- `apps/web/` → `apps/app/`
- `apps/fumadocs/` → `apps/docs/`

**Files to update after rename:**
- `apps/app/package.json` — update `name` field
- `apps/docs/package.json` — update `name` field
- Root `package.json` — update any workspace references
- `turbo.json` — update any filter references (`-F web` → `-F app`, `-F fumadocs` → `-F docs`)
- Root scripts in `package.json` — `dev:web` → `dev:app`

### 0.2 Scaffold `apps/www`

Create a new Next.js marketing website app:

```
apps/www/
├── src/
│   └── app/
│       ├── layout.tsx     # Root layout with Geist fonts, dark theme
│       └── page.tsx       # Placeholder landing page
├── public/
├── next.config.ts
├── tailwind.config.ts     # Imports shared preset from @vxllm/config
├── tsconfig.json          # Extends @vxllm/config/tsconfig/react.json
└── package.json           # @vxllm/www
```

**Dependencies:** `next`, `react`, `react-dom`, `@vxllm/ui`, `@vxllm/config`, `geist`

This is a minimal scaffold — just enough to run `bun run dev` and see a themed placeholder page. Content and marketing pages are Sub-project #14.

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
│   ├── bun.json           # Extends base, Bun globals, node compat
│   └── nextjs.json        # Extends react, Next.js plugin settings
├── tailwind/
│   └── preset.ts          # Shared Tailwind v4 preset: Geist fonts, slate/blue tokens, dark-first, radius scale
├── eslint/
│   └── base.js            # Flat config, TypeScript-ESLint, import ordering
├── package.json
└── index.ts               # Re-exports for convenience
```

**Consumer pattern:** Each app/package `tsconfig.json` extends the appropriate shared config:
- `apps/app` → `@vxllm/config/tsconfig/react.json`
- `apps/www` → `@vxllm/config/tsconfig/nextjs.json`
- `apps/docs` → `@vxllm/config/tsconfig/nextjs.json`
- `apps/server` → `@vxllm/config/tsconfig/bun.json`
- `packages/*` → `@vxllm/config/tsconfig/base.json`

The root `tsconfig.json` becomes a project references file only.

### 1.2 Environment Variables (`packages/env`)

Replace the current minimal env with the full validated schema. Uses `@t3-oss/env-core` + Zod.

**Note:** `DATABASE_AUTH_TOKEN` changes from required (current code) to optional, since local SQLite doesn't need it. The existing `server.ts` will be updated accordingly.

**`server.ts`** — consumed by `apps/server`:

| Variable | Required | Default | Type | Description |
|----------|----------|---------|------|-------------|
| `DATABASE_URL` | Yes | `file:./local.db` | string | SQLite path or Turso URL |
| `DATABASE_AUTH_TOKEN` | No | — | string | Turso auth token (only for remote) |
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

**`web.ts`** — consumed by `apps/app`:

| Variable | Required | Default | Type | Description |
|----------|----------|---------|------|-------------|
| `VITE_SERVER_URL` | No | `http://localhost:11500` | string (url) | Hono server base URL |
| `VITE_WS_URL` | No | `ws://localhost:11500` | string (url) | WebSocket base URL |

### 1.3 Database Schema (`packages/db`)

All 10 tables using Drizzle ORM + SQLite. Schema files organized by domain. **All table definitions below match the source-of-truth docs in `docs/project/database/`.**

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

**Deviation note:** Separating relations into `relations.ts` is an organizational improvement over the source docs (which embed relations per-file). This avoids circular imports.

**Table Definitions:**

#### `models`
| Column | Type | Constraints | Source |
|--------|------|------------|--------|
| `id` | text | PK, nanoid | schema-models.md |
| `name` | text | NOT NULL, UNIQUE | schema-models.md |
| `display_name` | text | NOT NULL | schema-models.md |
| `description` | text | — | schema-models.md |
| `type` | text | NOT NULL, CHECK (llm/stt/tts/embedding) | schema-models.md |
| `format` | text | CHECK (gguf/whisper/kokoro) | schema-models.md (per ADR-004: no mlx) |
| `variant` | text | — | schema-models.md (e.g. "q4_k_m", "large-v3-turbo") |
| `repo` | text | — | schema-models.md (HuggingFace repo) |
| `file_name` | text | — | schema-models.md (specific file in repo) |
| `local_path` | text | — | schema-models.md |
| `size_bytes` | integer | — | schema-models.md |
| `status` | text | NOT NULL, DEFAULT 'available', CHECK (available/downloading/downloaded/error) | schema-models.md |
| `min_ram_gb` | real | — | schema-models.md |
| `recommended_vram_gb` | real | — | schema-models.md |
| `downloaded_at` | integer | — | schema-models.md (epoch ms) |
| `created_at` | integer | NOT NULL, DEFAULT | schema-models.md (epoch ms) |
| `updated_at` | integer | NOT NULL, DEFAULT | schema-models.md (epoch ms) |

**Indexes:** `idx_models_name` (UNIQUE on name), `idx_models_type` (on type), `idx_models_status` (on status)

#### `tags`
| Column | Type | Constraints |
|--------|------|------------|
| `id` | text | PK, nanoid |
| `name` | text | NOT NULL |
| `slug` | text | NOT NULL, UNIQUE |

#### `model_tags`
| Column | Type | Constraints |
|--------|------|------------|
| `model_id` | text | NOT NULL, FK → models.id, ON DELETE CASCADE |
| `tag_id` | text | NOT NULL, FK → tags.id, ON DELETE CASCADE |
| — | — | PK (model_id, tag_id) |

#### `download_queue`
| Column | Type | Constraints | Source |
|--------|------|------------|--------|
| `id` | text | PK, nanoid | schema-models.md |
| `model_id` | text | NOT NULL, FK → models.id, ON DELETE CASCADE | schema-models.md |
| `priority` | integer | NOT NULL, DEFAULT 0 | schema-models.md (higher = first) |
| `progress_pct` | real | NOT NULL, DEFAULT 0 | schema-models.md (0.0-100.0, real for granularity) |
| `downloaded_bytes` | integer | NOT NULL, DEFAULT 0 | schema-models.md |
| `total_bytes` | integer | — | schema-models.md |
| `speed_bps` | integer | — | schema-models.md |
| `status` | text | NOT NULL, DEFAULT 'queued', CHECK (queued/active/paused/completed/failed) | schema-models.md |
| `error` | text | — | schema-models.md (error message on failure) |
| `started_at` | integer | — | schema-models.md (epoch ms) |
| `completed_at` | integer | — | schema-models.md (epoch ms) |
| `created_at` | integer | NOT NULL, DEFAULT | schema-models.md (epoch ms) |

**Indexes:** `idx_download_queue_model` (on model_id), `idx_download_queue_status` (on status)

#### `conversations`
| Column | Type | Constraints | Source |
|--------|------|------------|--------|
| `id` | text | PK, nanoid | schema-conversations.md |
| `title` | text | — (nullable, auto-generated from first message) | schema-conversations.md |
| `model_id` | text | FK → models.id, ON DELETE SET NULL | schema-conversations.md |
| `system_prompt` | text | — | schema-conversations.md |
| `created_at` | integer | NOT NULL | schema-conversations.md (epoch ms) |
| `updated_at` | integer | NOT NULL | schema-conversations.md (epoch ms) |

**Indexes:** `idx_conversations_updated` (on updated_at)

#### `messages`
| Column | Type | Constraints | Source |
|--------|------|------------|--------|
| `id` | text | PK, nanoid | schema-conversations.md |
| `conversation_id` | text | NOT NULL, FK → conversations.id, ON DELETE CASCADE | schema-conversations.md |
| `role` | text | NOT NULL, CHECK (system/user/assistant) | schema-conversations.md |
| `content` | text | NOT NULL | schema-conversations.md |
| `audio_path` | text | — | schema-conversations.md (voice message file path) |
| `tokens_in` | integer | — | schema-conversations.md |
| `tokens_out` | integer | — | schema-conversations.md |
| `latency_ms` | integer | — | schema-conversations.md |
| `created_at` | integer | NOT NULL | schema-conversations.md (epoch ms) |

**Indexes:** `idx_messages_conversation` (on conversation_id), `idx_messages_created` (on created_at)

#### `settings`
| Column | Type | Constraints |
|--------|------|------------|
| `key` | text | PK |
| `value` | text | NOT NULL, JSON-encoded |
| `updated_at` | integer | NOT NULL, Unix epoch ms |

#### `api_keys`
| Column | Type | Constraints | Source |
|--------|------|------------|--------|
| `id` | text | PK, nanoid | schema-settings.md |
| `key_hash` | text | NOT NULL, UNIQUE, SHA-256 | schema-settings.md |
| `key_prefix` | text | NOT NULL, UNIQUE | schema-settings.md (e.g. "vx_sk_ab") |
| `label` | text | NOT NULL | schema-settings.md |
| `permissions` | text | NOT NULL, DEFAULT '*' | schema-settings.md (JSON array or "*") |
| `rate_limit` | integer | — | schema-settings.md (requests per minute, null=unlimited) |
| `last_used_at` | integer | — | schema-settings.md (epoch ms) |
| `expires_at` | integer | — | schema-settings.md (epoch ms, null=never) |
| `created_at` | integer | NOT NULL | schema-settings.md (epoch ms) |

**Indexes:** `idx_api_keys_hash` (UNIQUE on key_hash), `idx_api_keys_prefix` (UNIQUE on key_prefix)

**Permission values** follow the granular model from schema-settings.md: `models:list`, `models:read`, `models:download`, `conversations:read`, `conversations:write`, `conversations:delete`, `settings:read`, `settings:write`, `*` (wildcard).

#### `usage_metrics`
| Column | Type | Constraints | Source |
|--------|------|------------|--------|
| `id` | text | PK, nanoid | schema-metrics.md |
| `model_id` | text | FK → models.id, ON DELETE SET NULL | schema-metrics.md |
| `type` | text | NOT NULL, CHECK (chat/completion/embedding/stt/tts) | schema-metrics.md |
| `tokens_in` | integer | — | schema-metrics.md |
| `tokens_out` | integer | — | schema-metrics.md |
| `latency_ms` | integer | NOT NULL | schema-metrics.md |
| `created_at` | integer | NOT NULL | schema-metrics.md (epoch ms) |

**Indexes:** `idx_metrics_model` (on model_id), `idx_metrics_created` (on created_at), `idx_metrics_type` (on type)

#### `voice_profiles`
| Column | Type | Constraints | Source |
|--------|------|------------|--------|
| `id` | text | PK, nanoid | schema-metrics.md |
| `name` | text | NOT NULL | schema-metrics.md |
| `stt_model` | text | — | schema-metrics.md |
| `tts_model` | text | — | schema-metrics.md |
| `tts_voice` | text | — | schema-metrics.md |
| `language` | text | NOT NULL, DEFAULT 'en' | schema-metrics.md |
| `is_default` | integer | NOT NULL, DEFAULT 0 | schema-metrics.md (CHECK 0/1) |
| `created_at` | integer | NOT NULL | schema-metrics.md (epoch ms) |
| `updated_at` | integer | NOT NULL | schema-metrics.md (epoch ms) |

**Indexes:** `idx_voice_profiles_default` (on is_default)

**Relations:**
- `models` 1:N `download_queue` (cascade delete)
- `models` N:N `tags` via `model_tags` (cascade delete both sides)
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
| `chat` | `addMessage` | { conversationId, role, content, audioPath? } | Message |
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
  format: "gguf" | "whisper" | "kokoro"  // Matches DB CHECK (per ADR-004: no mlx)
  variant: string | null                  // Matches DB column (e.g. "q4_k_m")
  repo: string | null                     // HuggingFace repo
  fileName: string | null                 // Specific file in repo
  localPath: string | null
  sizeBytes: number
  minRamGb: number | null
  recommendedVramGb: number | null
  status: "available" | "downloading" | "downloaded" | "error"
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
  priority: number
  status: "queued" | "active" | "paused" | "completed" | "failed"
  progressPct: number        // 0.0-100.0 (real)
  downloadedBytes: number
  totalBytes: number
  speedBps: number
  eta: number | null
  error: string | null
}
```

**Class stubs** have constructor + method signatures with JSDoc, throwing `Not implemented`.

### 2.3 LLM Provider Scaffold (`packages/llama-provider`)

AI SDK custom provider. **Note:** The exact interface version (LanguageModelV1/V2/V3) will be verified against the installed `ai` package version during implementation. The CLAUDE.md references "LanguageModelV3" but the AI SDK may use different naming. Stubs will implement whichever interface the installed version exports.

```
packages/llama-provider/
├── src/
│   ├── index.ts               # createLlamaProvider() factory
│   ├── llama-chat-model.ts    # LlamaChatLanguageModel class stub
│   ├── llama-embedding-model.ts # LlamaEmbeddingModel class stub
│   └── types.ts               # LlamaProviderSettings
├── package.json
└── tsconfig.json
```

**`index.ts`** exports:
```typescript
function createLlamaProvider(settings: LlamaProviderSettings): {
  chat: (modelId: string) => LanguageModel   // exact type TBD from AI SDK
  embedding: (modelId: string) => EmbeddingModel
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
- CSS variables: yes (**oklch** color space — this supersedes the hsl() format in `docs/project/design-guidelines.md`; that doc will be updated post-foundation)
- Base color: slate
- Tailwind v4 mode
- Output: `packages/ui/src/components/`
- Utils: `packages/ui/src/lib/utils.ts`

**Note on "radix-nova":** If this is not a recognized shadcn/ui style at install time, fall back to the closest match (likely "new-york") and customize from there. The intent is the radix-nova aesthetic.

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
- Applied in `apps/app` root layout AND `apps/www` root layout

**Note:** This supersedes the system font stack in `docs/project/design-guidelines.md`. That doc will be updated after this sub-project.

**Color System (dark-first, oklch):**
- Background/foreground: slate scale
- Primary: slate (buttons, emphasis)
- Accent: blue (links, active states, focus rings)
- Destructive: red
- Success: green (custom token, not in shadcn defaults)
- Warning: amber (custom token, not in shadcn defaults)
- Dark mode default, light mode via class toggle (`next-themes`)

**Design Tokens:**
- `--radius: 0.5rem` (radix-nova default)
- Geist Sans for UI text
- Geist Mono for code, metrics, IDs, timestamps, CLI output

**`packages/ui/src/styles/globals.css`** defines all CSS custom properties for both `:root` (light) and `.dark` (dark) themes using oklch color functions.

### 3.5 Shared Hooks

| Hook | Purpose |
|------|---------|
| `use-mobile.ts` | Responsive breakpoint detection (sidebar/sheet responsive patterns) |
| `use-debounce.ts` | Debounced value for search inputs |

---

## File Impact Summary

| Area | Files Created | Files Modified | Files Deleted |
|------|--------------|----------------|---------------|
| `apps/` (renames) | 0 | ~6 (package.json, turbo refs, scripts) | 0 |
| `apps/www` (scaffold) | ~6 | 0 | 0 |
| `packages/config` | ~7 | 1 (package.json) | 0 |
| `packages/env` | 0 | 2 (server.ts, web.ts) | 0 |
| `packages/db` | 5 | 1 (schema/index.ts) | 0 |
| `packages/api` | ~14 | 3 (context.ts, index.ts, routers/index.ts) | 0 |
| `packages/inference` | 8 | 0 | 0 |
| `packages/llama-provider` | 6 | 0 | 0 |
| `packages/ui` | ~37 | 2 (globals.css, utils.ts) | 8 (old components) |
| `apps/app` | 0 | 1 (root layout — fonts) | 0 |
| Root | 0 | 3 (tsconfig.json, package.json, turbo.json) | 0 |
| **Total** | **~83** | **~19** | **8** |

## Success Criteria

- [ ] `apps/web` renamed to `apps/app`, `apps/fumadocs` renamed to `apps/docs`
- [ ] `apps/www` scaffolded and runs with `bun run dev`
- [ ] `bun install` succeeds with no errors
- [ ] `bun run check-types` passes across all packages
- [ ] `bun run lint` passes (new ESLint config)
- [ ] `bun run db:push` creates all 10 tables with correct columns, constraints, and indexes in SQLite
- [ ] All oRPC router stubs are importable and type-check
- [ ] `packages/inference` and `packages/llama-provider` export all type stubs
- [ ] shadcn/ui components render in radix-nova style with dark theme (oklch)
- [ ] Geist Sans and Geist Mono load correctly in `apps/app` and `apps/www`
- [ ] `bun run dev:app` starts without errors and shows themed UI
- [ ] `bun run dev:server` starts without errors
- [ ] Database schema matches source-of-truth docs in `docs/project/database/`

## Docs to Update Post-Foundation

These existing docs reference patterns superseded by the foundation:
- `docs/project/design-guidelines.md` — Update font stack (system → Geist) and color format (hsl → oklch)
- `CLAUDE.md` — Update monorepo structure section (app renames, new www app)
- Root `README.md` — Update project structure if it references old app names

---

*Spec version: 2.0 | Approved: 2026-03-20 | Post-review fixes: 18 issues resolved + structural changes*
