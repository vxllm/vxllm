# Sub-project #2: Inference Engine — Design Spec

> **Project:** VxLLM
> **Sub-project:** 2 of 14 — Inference Engine (merged with Model Management + OpenAI API Routes)
> **Date:** 2026-03-20
> **Status:** Approved
> **Approach:** Layer cake (4 layers, bottom-up)

---

## Context

This sub-project implements the core inference pipeline end-to-end: from hardware detection and model loading through to OpenAI-compatible API routes with DB persistence. It merges the original Sub-projects #2 (Inference Engine), #3 (Model Management), and #4 (Server API — OpenAI Compatible) into one cohesive build.

### Dependencies

- Sub-project #1 (Foundation) must be complete: DB schemas, env vars, API schemas, package scaffolds

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| node-llama-cpp v3 integration (Metal + CUDA + CPU) | Voice pipeline (STT/TTS/VAD) |
| Hardware detection (GPU, CPU, RAM) | oRPC router implementations (Sub-project #5) |
| Model loading/unloading with GPU layer auto-detection | Chat UI (Sub-project #6) |
| Fork ai-sdk-llama-cpp into packages/llama-provider | CLI (Sub-project #8) |
| Structured output (GBNF grammar constraints) | Docker deployment |
| Tool calling (prompt-based, model-dependent) | Speculative decoding / prompt caching |
| HuggingFace model downloads with resume | Vision/multimodal |
| models.json registry with 5 seed models | |
| OpenAI-compatible routes (/v1/chat/completions, /v1/completions, /v1/embeddings, /v1/models) | |
| Streaming (SSE) + non-streaming responses | |
| DB persistence (messages, usage_metrics, conversations) | |
| Model pull API (/api/models/pull, /api/models/status) | |
| Health endpoint (/health) | |
| Error handling (OpenAI-format errors) | |

---

## Layer 1 — node-llama-cpp Core

### 1.1 Dependencies

Install in `packages/inference`:
- `node-llama-cpp` — Native binding for llama.cpp (auto-detects Metal/CUDA/CPU at build time)
- `@huggingface/hub` — HuggingFace model downloads (used in Layer 3)

### 1.2 Hardware Detection (`hardware.ts`)

Implement `detectHardware(): Promise<HardwareProfile>` using:
- `node-llama-cpp`'s GPU detection API for Metal/CUDA/Vulkan availability and VRAM
- Node.js `os` module for platform, arch, CPU model, core counts, total/available RAM
- Apple Silicon detection: `platform === "darwin" && arch === "arm64"`

Returns the existing `HardwareProfile` type from `types.ts`.

Called once on server startup. Result cached in memory.

### 1.3 GPU Layer Calculator

Pure function in `hardware.ts`:

```typescript
calculateGpuLayers(modelSizeBytes: number, vramBytes: number, quantTier: string): number
```

Uses `QUANTIZATION_TIERS` constants to estimate memory per layer. Reserves ~500MB overhead for KV cache + OS. Returns the maximum number of layers that fit in VRAM. Returns 0 if no GPU available (CPU fallback).

`GPU_LAYERS_OVERRIDE` env var takes precedence when set.

### 1.4 Model Manager (`model-manager.ts`)

Wraps node-llama-cpp v3 model lifecycle:

**`load(modelInfo: ModelInfo): Promise<LoadedModel>`**
- Calls node-llama-cpp to load GGUF from `modelInfo.localPath`
- Auto-calculates GPU layers via `calculateGpuLayers()` using detected hardware
- Creates inference context with `min(env.MAX_CONTEXT_SIZE, modelMaxContext)` window
- Returns `LoadedModel` with session ID, memory usage, GPU layers loaded

**`unload(sessionId: string): Promise<void>`**
- Disposes model via node-llama-cpp, frees VRAM/RAM

**`getLoaded(): LoadedModel[]`** / **`getActive(): LoadedModel | null`**
- Track loaded models in a `Map<string, LoadedModel>`

**`createContext(sessionId: string)`**
- Creates an isolated inference context (context sequence) for concurrent request handling
- Note: This method is not in the existing stub — it will be added during implementation

**`countTokens(text: string): number`**
- Uses node-llama-cpp's native tokenizer to count tokens for a given text
- Essential for context budgeting: before sending messages to inference, count total tokens and truncate oldest messages (keeping system prompt + most recent) if they exceed context window
- Note: Not in existing stub — will be added during implementation

**Design decisions:**
- One LLM model loaded at a time (swap requires unload → load)
- Embedding model can be loaded alongside the LLM (different use case)
- Context size: `min(env.MAX_CONTEXT_SIZE, modelMaxContext)`
- Concurrency: node-llama-cpp v3 supports context sequences for ~4-8 concurrent requests. Requests beyond this limit are queued in-memory with a 30s timeout. If queue is full, return 429 Too Many Requests.
- node-llama-cpp v3 API specifics will be discovered during implementation — the stubs define the contract, the implementation adapts to the actual API

---

## Layer 2 — AI SDK Provider (Fork)

### 2.1 Fork Strategy

Fork `ai-sdk-llama-cpp` source code into `packages/llama-provider`. Do NOT install the npm package — copy the provider logic and rewrite to:
- Use our `ModelManager` instead of its own model loading
- Support cross-platform (Metal + CUDA + CPU) via node-llama-cpp's built-in backend detection
- Add tool calling support
- Maintain structured output (GBNF grammar constraints)

### 2.2 LlamaChatLanguageModel

Implements the current AI SDK `LanguageModel` interface (exact version — V1, V2, or versionless — determined at implementation time by checking the installed `ai` package exports):

**`doGenerate(options): Promise<{ text, usage, finishReason }>`**
- Takes messages + settings from AI SDK
- Applies chat template — primarily auto-detected from GGUF metadata by node-llama-cpp v3; configurable override via `chatTemplate` option. Expected format coverage: `llama3`, `chatml`, `gemma`, `mistral-v1`, `mistral-v3`, `phi3`, `phi4`, `deepseek`
- Runs inference via node-llama-cpp through `ModelManager`
- Returns complete response with token counts

**`doStream(options): Promise<AsyncIterable<TextDelta>>`**
- Same as doGenerate but yields token deltas as they're produced
- Sub-100ms batching for SSE compatibility
- Includes usage stats in final chunk

**Structured output:**
- When `output: Output.object({ schema })` is used with `generateText()`, converts Zod schema to GBNF grammar
- Passes grammar to node-llama-cpp for constrained generation
- Validates output against schema before returning

**Tool calling:**
- Formats tool definitions into the prompt using model-dependent format
- Parses tool call responses from model output (JSON extraction)
- Returns structured tool call objects per AI SDK spec
- Model-dependent: works best with models trained for function calling (Qwen, Llama 3.x)

### 2.3 LlamaEmbeddingModel

Implements the current AI SDK `EmbeddingModel` interface (version determined at implementation time):

**`doEmbed(options): Promise<{ embeddings: number[][] }>`**
- Takes string or string array
- Uses separate embedding model instance (different GGUF)
- Returns float32 vectors

### 2.4 Provider Factory

```typescript
createLlamaProvider(settings: {
  modelManager: ModelManager;
}) → {
  chat: (modelId: string) => LlamaChatLanguageModel,
  embedding: (modelId: string) => LlamaEmbeddingModel,
}
```

Looks up loaded model from `ModelManager` by ID. Models are loaded once and reused across requests.

### 2.5 Resource Management

- `dispose()` on both model classes delegates to `ModelManager.unload()`
- Server shutdown disposes all active models

---

## Layer 3 — Model Management

### 3.1 Registry (`registry.ts`)

Reads `models.json` from project root.

**`models.json` structure:**
```json
{
  "version": 1,
  "models": [
    {
      "name": "qwen2.5:7b",
      "displayName": "Qwen 2.5 7B Instruct",
      "type": "llm",
      "format": "gguf",
      "description": "Default chat, code, multilingual",
      "tags": ["chat", "code", "multilingual"],
      "variants": [
        {
          "variant": "q4_k_m",
          "repo": "Qwen/Qwen2.5-7B-Instruct-GGUF",
          "fileName": "qwen2.5-7b-instruct-q4_k_m.gguf",
          "sizeBytes": 5040000000,
          "minRamGb": 5,
          "recommendedVramGb": 6
        }
      ]
    }
  ]
}
```

**Methods:**
- **`resolve(name)`** — Parses `name:variant` format (e.g. `qwen2.5:7b` or `qwen2.5:7b:q4_k_m`). If variant not specified, selects best variant for user's hardware based on available VRAM/RAM.
- **`search(query, type?)`** — Fuzzy match on name/displayName/description with optional type filter.
- **`getVariants(name)`** — Returns all quantization variants for a model.

### 3.2 Seed Models (5)

| # | Name | Type | Format | Variant | Repo | Size | Min RAM |
|---|------|------|--------|---------|------|------|---------|
| 1 | `qwen2.5:7b` | llm | gguf | q4_k_m | Qwen/Qwen2.5-7B-Instruct-GGUF | 4.7GB | 5GB |
| 2 | `phi-4-mini` | llm | gguf | q4_k_m | microsoft/Phi-4-mini-instruct-GGUF | 2.5GB | 3GB |
| 3 | `whisper:large-v3-turbo` | stt | whisper | — | Systran/faster-whisper-large-v3-turbo | 0.8GB | 2GB |
| 4 | `kokoro:v1.0` | tts | kokoro | — | hexgrad/Kokoro-82M | 0.33GB | 1GB |
| 5 | `nomic-embed:v1.5` | embedding | gguf | q4_k_m | nomic-ai/nomic-embed-text-v1.5-GGUF | 0.08GB | 0.5GB |

Note: STT and TTS models are registry entries only — they're downloaded but consumed by the Python voice sidecar (Sub-project #9), not by node-llama-cpp. The inference engine only loads `gguf` format models (llm + embedding).

### 3.3 Download Manager (`download.ts`)

Uses `@huggingface/hub` for HuggingFace downloads.

**`pull(name, options?: { variant?: string; priority?: number }): Promise<DownloadProgress>`**
- Resolves model via Registry (name can include variant: `qwen2.5:7b:q4_k_m`)
- If `variant` option provided, overrides the auto-selected variant
- Creates `download_queue` DB entry with status `"queued"`
- Starts streaming download to `MODELS_DIR` (default `~/.vxllm/models`)
- Tracks progress: bytes downloaded, speed (bytes/sec), ETA
- Resume support via HTTP Range headers
- On completion: updates `models` table with `status: "downloaded"`, `localPath`, `downloadedAt`
- On failure: updates `download_queue` with `status: "failed"`, `error` message

**`pause(modelId)` / `resume(modelId)`**
- Uses AbortController to pause; resumes from last downloaded byte

**`cancel(modelId)`**
- Abort + delete partial file + update DB status

**`getProgress(modelId)` / `getActive()`**
- In-memory progress map for active downloads, DB query for historical

**Concurrency:** Max 2 active downloads (`MAX_CONCURRENT_DOWNLOADS`). Additional queued with priority ordering from `download_queue.priority`.

### 3.4 Model Storage

Flat directory at `MODELS_DIR`:
```
~/.vxllm/models/
├── qwen2.5-7b-instruct-q4_k_m.gguf
├── phi-4-mini-instruct-q4_k_m.gguf
└── nomic-embed-text-v1.5-q4_k_m.gguf
```

No subdirectories. File name matches `fileName` from registry.

---

## Layer 4 — API Routes + DB Persistence

### 4.1 Route Organization

```
apps/server/src/
├── index.ts                  # Existing — add route mounting + lifecycle
├── routes/
│   ├── v1/
│   │   ├── chat.ts           # POST /v1/chat/completions
│   │   ├── completions.ts    # POST /v1/completions (raw text completion)
│   │   ├── embeddings.ts     # POST /v1/embeddings
│   │   └── models.ts         # GET /v1/models
│   ├── api/
│   │   └── models.ts         # POST /api/models/pull, GET /api/models/status
│   └── health.ts             # GET /health
└── middleware/
    └── error-handler.ts      # OpenAI-format error responses
```

Routes mounted in `index.ts` as Hono sub-apps.

### 4.2 OpenAI-Compatible Routes (Raw Hono)

**`POST /v1/chat/completions`**
- Validate request against `ChatCompletionRequestSchema`
- Resolve model by name, load via `ModelManager` if not loaded
- If `stream: true`: `streamText()` → SSE chunks (`data: {...}\n\n` + `data: [DONE]\n\n`)
- If `stream: false`: `generateText()` → full JSON response
- Supports `response_format: { type: "json_object" }` and `{ type: "json_schema", json_schema: { name, schema } }` for structured output
- Error format: `{ error: { message, type, code, param } }` matching OpenAI spec

**`POST /v1/completions`**
- Raw text completion (non-chat format)
- Takes `{ model, prompt, max_tokens, temperature, stream, ... }`
- If `stream: true`: SSE chunks; if `stream: false`: full JSON
- Returns `{ id, object: "text_completion", choices: [{ text, finish_reason, index }], usage }`
- Simpler than chat — no message array, just a prompt string

**`POST /v1/embeddings`**
- Takes `{ input: string | string[], model: string }`
- Calls `embed()` / `embedMany()` via provider
- Returns OpenAI-format: `{ object: "list", data: [{ embedding, index, object: "embedding" }], model, usage }`

**`GET /v1/models`**
- Queries `models` table for `status = "downloaded"`
- Returns `{ object: "list", data: [{ id, object: "model", created, owned_by: "vxllm" }] }`

**`POST /api/models/pull`**
- Takes `{ name: string, variant?: string }`
- Starts download via `DownloadManager`
- Returns `202 Accepted` with download queue entry

**`GET /api/models/status`**
- Returns all active/queued downloads with progress

**`GET /health`**
- Returns `{ status: "ok", model: "qwen2.5:7b" | null, uptime_seconds: N }`

### 4.3 Error Handler Middleware

Catches all errors and formats as OpenAI-compatible:

```json
{
  "error": {
    "message": "Model not found: llama99:999b",
    "type": "invalid_request_error",
    "code": "model_not_found",
    "param": "model"
  }
}
```

Error types: `invalid_request_error`, `server_error`, `rate_limit_error`, `authentication_error` (for future use).

HTTP status codes:
- 400 — Bad request (invalid params, model not found)
- 401 — Unauthorized (API key invalid, future use)
- 429 — Rate limited (queue full)
- 500 — Internal server error (inference crash, OOM)
- 503 — Model loading (still loading, try again)

### 4.4 DB Persistence

After each `/v1/chat/completions` request:

**`conversations` table:**
- If no `X-Conversation-Id` header provided, create new conversation
- Title auto-generated from first user message (first 50 chars)
- Associate with model ID

**`messages` table:**
- Insert user message(s) from request
- Insert assistant response with `tokensIn`, `tokensOut`, `latencyMs`

**`usage_metrics` table:**
- Insert per-request: `{ modelId, type: "chat"|"embedding", tokensIn, tokensOut, latencyMs }`

### 4.5 Server Lifecycle

**Startup sequence (in `index.ts`):**
1. `detectHardware()` — Log hardware profile to console
2. If `DEFAULT_MODEL` env var set → `ModelManager.load()` automatically
3. Mount all routes
4. Start Hono server

**Shutdown (SIGTERM/SIGINT):**
1. Dispose all loaded models (free VRAM)
2. Cancel active downloads
3. Close DB connection

---

## Schema Extensions Required

The following existing Zod schemas in `packages/api/src/schemas/openai.ts` need to be extended during implementation:

- `ChatCompletionRequestSchema` — Add `response_format` (json_object | json_schema), `tools` (array of tool definitions), `tool_choice` (auto | none | specific function)
- `ChatCompletionChunkSchema` — Add `tool_calls` in the delta object for streaming tool call responses
- `ChatCompletionResponseSchema` — Add `tool_calls` in the message object for non-streaming tool call responses
- Add new `CompletionRequestSchema` and `CompletionResponseSchema` for `/v1/completions`

Additionally, `packages/inference/src/types.ts` needs a `description` field added to `ModelInfo` (present in DB schema and models.json but missing from the type).

## File Impact Summary

| Area | Files Created | Files Modified |
|------|--------------|----------------|
| `packages/inference/src/` | 0 | 5 (hardware.ts, model-manager.ts, download.ts, registry.ts, types.ts) |
| `packages/inference/` | 0 | 1 (package.json — add deps) |
| `packages/llama-provider/src/` | ~6 (fork source) | 4 (replace all stubs) |
| `packages/llama-provider/` | 0 | 1 (package.json — add deps) |
| `packages/api/src/schemas/` | 0 | 1 (openai.ts — add response_format, tools, completions) |
| `apps/server/src/routes/` | 6 (chat.ts, completions.ts, embeddings.ts, models.ts x2, health.ts) | 0 |
| `apps/server/src/middleware/` | 1 (error-handler.ts) | 0 |
| `apps/server/src/` | 0 | 1 (index.ts — mount routes, lifecycle) |
| Root | 1 (models.json) | 0 |
| **Total** | **~14** | **~13** |

## Success Criteria

- [ ] `node-llama-cpp` installs and builds successfully (Metal on macOS, CUDA on Linux)
- [ ] `detectHardware()` returns correct GPU vendor, VRAM, CPU cores, RAM
- [ ] `ModelManager.load()` loads a GGUF model with auto GPU layer calculation
- [ ] `streamText()` via provider streams tokens to console
- [ ] `generateText()` via provider returns complete response
- [ ] `generateText()` with `Output.object()` returns schema-validated JSON
- [ ] Tool calling works with supported models (Qwen 2.5)
- [ ] `embed()` returns float32 vectors
- [ ] `models.json` has 5 seed models and `Registry` can resolve/search them
- [ ] `DownloadManager.pull()` downloads a model from HuggingFace with progress
- [ ] Download resume works after interruption
- [ ] `POST /v1/chat/completions` (stream: true) returns valid SSE
- [ ] `POST /v1/chat/completions` (stream: false) returns valid JSON
- [ ] `POST /v1/completions` returns valid text completion response
- [ ] `POST /v1/embeddings` returns valid embedding response
- [ ] `GET /v1/models` lists downloaded models
- [ ] `POST /api/models/pull` starts a download
- [ ] `GET /health` returns status
- [ ] Messages persisted to `conversations` + `messages` tables after chat
- [ ] Metrics persisted to `usage_metrics` table after each request
- [ ] OpenAI Python SDK (`openai.OpenAI(base_url="http://localhost:11500/v1")`) works with the API
- [ ] Error responses match OpenAI format

## References

- **Feature spec:** `docs/project/features/feature-inference.md`
- **ADR-002:** In-process node-llama-cpp (no subprocess)
- **ADR-004:** Metal over MLX (single runtime)
- **ADR-005:** Dual API (oRPC + raw Hono for OpenAI compat)
- **ADR-007:** AI SDK with custom provider
- **Workflow:** `docs/project/workflows/workflow-inference-chat.md`
- **Community provider docs:** https://ai-sdk.dev/providers/community-providers/llama-cpp

---

*Spec version: 1.0 | Approved: 2026-03-20*
