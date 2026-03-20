# Inference Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete inference pipeline — hardware detection, GGUF model loading, AI SDK provider (fresh adapter on node-llama-cpp), model downloads from HuggingFace, and OpenAI-compatible API routes with streaming and DB persistence.

**Architecture:** 4-layer bottom-up build. Layer 1 installs node-llama-cpp and implements hardware detection + ModelManager. Layer 2 writes a fresh ~300 line AI SDK adapter directly on node-llama-cpp (NOT forking ai-sdk-llama-cpp). Layer 3 adds model registry + HuggingFace downloads. Layer 4 wires OpenAI-compatible Hono routes with DB persistence.

**Tech Stack:** node-llama-cpp v3 (Metal/CUDA/CPU, pre-built binaries), @ai-sdk/provider (LanguageModel interface), @huggingface/hub, Hono, Drizzle ORM + SQLite

**Spec:** `docs/superpowers/specs/2026-03-20-inference-engine-design.md` (v2)

**Key decision:** We write the AI SDK adapter fresh (~300 lines) instead of forking ai-sdk-llama-cpp because:
- ai-sdk-llama-cpp has its own native C++ binding (cmake-js) — NOT node-llama-cpp
- node-llama-cpp already provides native tool calling (`defineChatSessionFunction`), GBNF grammar enforcement, embeddings, and cross-platform builds
- Forking means adapting someone else's shim to a different native layer — more work than writing fresh
- We own 100% of adapter code, no upstream sync burden

**node-llama-cpp key APIs:**
- `getLlama()` → `llama.loadModel({ modelPath })` → model
- `model.createContext()` → context, `context.getSequence()` → contextSequence
- `new LlamaChatSession({ contextSequence })` → session
- `session.prompt(text, { functions?, grammar? })` → response
- `defineChatSessionFunction({ description, params, handler })` → native tool calling
- `llama.createGrammarForJsonSchema(schema)` → grammar for structured output
- `model.tokenize(text)` → token array
- `model.createEmbeddingContext()` → `embeddingContext.getEmbeddingFor(text)`
- Streaming: `for await (const token of sequence.evaluate(tokens))`

---

## File Structure

```
packages/inference/src/
├── types.ts              # MODIFY: add description to ModelInfo
├── constants.ts          # EXISTING: no changes
├── hardware.ts           # MODIFY: implement detectHardware + calculateGpuLayers
├── model-manager.ts      # MODIFY: implement with node-llama-cpp v3
├── download.ts           # MODIFY: implement with @huggingface/hub
├── registry.ts           # MODIFY: implement models.json reader
└── index.ts              # EXISTING: no changes needed

packages/llama-provider/src/
├── types.ts              # MODIFY: update LlamaCppOptions
├── language-model.ts     # CREATE: LanguageModel adapter (~200 lines)
├── embedding-model.ts    # CREATE: EmbeddingModel adapter (~80 lines)
└── index.ts              # MODIFY: new exports + factory

apps/server/src/
├── index.ts              # MODIFY: mount routes, add lifecycle
├── routes/
│   ├── v1/
│   │   ├── chat.ts       # CREATE: POST /v1/chat/completions
│   │   ├── completions.ts# CREATE: POST /v1/completions
│   │   ├── embeddings.ts # CREATE: POST /v1/embeddings
│   │   └── models.ts     # CREATE: GET /v1/models
│   ├── api/
│   │   └── models.ts     # CREATE: POST /api/models/pull, GET /api/models/status
│   └── health.ts         # CREATE: GET /health
└── middleware/
    └── error-handler.ts  # CREATE: OpenAI-format errors

models.json               # CREATE: 5 seed models at project root
packages/api/src/schemas/openai.ts  # MODIFY: add tools, response_format, completions
```

---

## Layer 1: node-llama-cpp Core

### Task 1: Install node-llama-cpp and implement hardware detection

**Files:**
- Modify: `packages/inference/package.json`
- Modify: `packages/inference/src/hardware.ts`
- Modify: `packages/inference/src/types.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/packages/inference
bun add node-llama-cpp @huggingface/hub
```

node-llama-cpp's postinstall downloads pre-built binaries (Metal on macOS, CUDA on Linux if available, CPU fallback). No cmake needed.

- [ ] **Step 2: Verify install**

```bash
bun -e "const { getLlama } = require('node-llama-cpp'); console.log('loaded')"
```

- [ ] **Step 3: Add `description` to ModelInfo in types.ts**

Add `description: string | null;` to the `ModelInfo` interface.

- [ ] **Step 4: Implement `detectHardware()` in hardware.ts**

Use `getLlama()` for GPU detection + `os` module for system info. Explore the `llama` instance properties to find GPU vendor, VRAM, etc. Run `Object.keys(llama)` and check TypeScript types to discover the API.

Also implement `calculateGpuLayers(modelSizeBytes, vramBytes, quantTier)` as a pure function using `QUANTIZATION_TIERS` constants.

- [ ] **Step 5: Test**

```bash
bun -e "import { detectHardware } from '@vxllm/inference'; const hw = await detectHardware(); console.log(JSON.stringify(hw, null, 2));"
```

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(inference): install node-llama-cpp and implement hardware detection"
```

---

### Task 2: Implement ModelManager

**Files:**
- Modify: `packages/inference/src/model-manager.ts`

- [ ] **Step 1: Implement ModelManager class**

Replace the stub. Key methods using node-llama-cpp v3:

```typescript
import { getLlama, type Llama, type LlamaModel, type LlamaContext } from "node-llama-cpp";

export class ModelManager {
  private llama: Llama | null = null;
  private loaded = new Map<string, {
    model: LlamaModel;
    context: LlamaContext;
    info: LoadedModel;
  }>();

  async initialize(): Promise<Llama> {
    if (!this.llama) this.llama = await getLlama();
    return this.llama;
  }

  getLlama(): Llama | null { return this.llama; }

  async load(modelInfo: ModelInfo): Promise<LoadedModel> {
    const llama = await this.initialize();
    const hardware = await detectHardware();
    const gpuLayers = env.GPU_LAYERS_OVERRIDE
      ?? calculateGpuLayers(modelInfo.sizeBytes, hardware.gpu.vramBytes, modelInfo.variant ?? "Q4_K_M");

    const model = await llama.loadModel({ modelPath: modelInfo.localPath!, gpuLayers });
    const contextSize = Math.min(env.MAX_CONTEXT_SIZE, /* model max context */);
    const context = await model.createContext({ contextSize });

    const sessionId = nanoid();
    const loaded: LoadedModel = { modelInfo, sessionId, memoryUsageBytes: modelInfo.sizeBytes,
      gpuLayersLoaded: gpuLayers, contextSize, createdAt: Date.now() };
    this.loaded.set(sessionId, { model, context, info: loaded });
    return loaded;
  }

  async unload(sessionId: string): Promise<void> { /* dispose context + model */ }
  getLoaded(): LoadedModel[] { /* from map */ }
  getActive(): LoadedModel | null { /* first LLM */ }
  getModelEntry(sessionId: string) { return this.loaded.get(sessionId) ?? null; }
  countTokens(sessionId: string, text: string): number { /* model.tokenize(text).length */ }
  async disposeAll(): Promise<void> { /* unload all */ }
}
```

Discover exact API by checking node-llama-cpp TypeScript types during implementation.

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "feat(inference): implement ModelManager with node-llama-cpp"
```

---

## Layer 2: Fresh AI SDK Adapter

### Task 3: Write LanguageModel adapter

**Files:**
- Modify: `packages/llama-provider/package.json`
- Modify: `packages/llama-provider/src/types.ts`
- Create: `packages/llama-provider/src/language-model.ts`
- Delete: `packages/llama-provider/src/llama-chat-model.ts` (old stub)

- [ ] **Step 1: Add dependencies**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/packages/llama-provider
bun add @ai-sdk/provider @ai-sdk/provider-utils node-llama-cpp
```

- [ ] **Step 2: Check the AI SDK LanguageModel interface**

```bash
bun -e "import * as p from '@ai-sdk/provider'; console.log(Object.keys(p))"
```

Determine whether to implement `LanguageModelV1`, `LanguageModelV2`, `LanguageModelV3`, or the versionless `LanguageModel`. Use whatever the installed version exports. The ai-sdk-llama-cpp source uses `LanguageModelV3` from `@ai-sdk/provider` v3.

- [ ] **Step 3: Update types.ts**

```typescript
import type { ModelManager } from "@vxllm/inference";

export interface LlamaCppOptions {
  modelManager: ModelManager;
}
```

- [ ] **Step 4: Create `language-model.ts`**

Write the adapter (~200 lines). Key pattern:

```typescript
import { LlamaChatSession, defineChatSessionFunction } from "node-llama-cpp";
import type { ModelManager } from "@vxllm/inference";

export class NodeLlamaCppLanguageModel implements LanguageModel {
  readonly specificationVersion = "v1"; // or v3 — match installed @ai-sdk/provider
  readonly provider = "node-llama-cpp";
  readonly modelId: string;

  constructor(
    modelId: string, // This is the sessionId from ModelManager
    private modelManager: ModelManager,
  ) { this.modelId = modelId; }

  async doGenerate(options) {
    const entry = this.modelManager.getModelEntry(this.modelId);
    if (!entry) throw new Error("Model not loaded");

    const session = new LlamaChatSession({
      contextSequence: entry.context.getSequence(),
    });

    // Build grammar for structured output if requested
    let grammar;
    if (options.responseFormat?.type === "json" && options.responseFormat.schema) {
      const llama = this.modelManager.getLlama()!;
      grammar = await llama.createGrammarForJsonSchema(options.responseFormat.schema);
    }

    // Build tool functions using node-llama-cpp's native API
    let functions;
    if (options.tools?.length) {
      functions = Object.fromEntries(
        options.tools
          .filter(t => t.type === "function")
          .map(tool => [
            tool.name,
            defineChatSessionFunction({
              description: tool.description ?? "",
              params: tool.inputSchema,
              async handler(params) { return params; }, // AI SDK handles execution
            }),
          ])
      );
    }

    // Convert AI SDK messages to prompt
    const prompt = this.convertMessages(options.prompt);

    const response = await session.prompt(prompt, {
      maxTokens: options.maxOutputTokens,
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
      grammar,
      functions,
      stopSequences: options.stopSequences,
    });

    // Return AI SDK result format
    return {
      content: [{ type: "text", text: response }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: /* count */ },
        outputTokens: { total: /* count */ },
      },
    };
  }

  async doStream(options) {
    // Similar but use streaming API
    // Return ReadableStream of LanguageModelStreamPart
  }

  private convertMessages(messages) {
    // Convert AI SDK messages to a single prompt string
    // or use node-llama-cpp's chat session message handling
  }
}
```

**Key point:** node-llama-cpp's `defineChatSessionFunction` handles tool calling natively — no prompt injection or output parsing needed. The tool call result comes back as a typed object.

- [ ] **Step 5: Delete old stub**

```bash
rm packages/llama-provider/src/llama-chat-model.ts
```

- [ ] **Step 6: Verify types compile**

```bash
bun run check-types
```

- [ ] **Step 7: Commit**

```bash
git add . && git commit -m "feat(llama-provider): write fresh LanguageModel adapter on node-llama-cpp"
```

---

### Task 4: Write EmbeddingModel adapter

**Files:**
- Create: `packages/llama-provider/src/embedding-model.ts`
- Modify: `packages/llama-provider/src/index.ts`
- Delete: `packages/llama-provider/src/llama-embedding-model.ts` (old stub)

- [ ] **Step 1: Create `embedding-model.ts`** (~80 lines)

```typescript
export class NodeLlamaCppEmbeddingModel implements EmbeddingModel {
  readonly specificationVersion = "v1";
  readonly provider = "node-llama-cpp";
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 2048;
  readonly supportsParallelCalls = false;

  constructor(modelId: string, private modelManager: ModelManager) {
    this.modelId = modelId;
  }

  async doEmbed(options) {
    const entry = this.modelManager.getModelEntry(this.modelId);
    if (!entry) throw new Error("Embedding model not loaded");

    const embeddingContext = await entry.model.createEmbeddingContext();
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const text of options.values) {
      const result = await embeddingContext.getEmbeddingFor(text);
      embeddings.push(Array.from(result.vector));
      totalTokens += entry.model.tokenize(text).length;
    }

    return {
      embeddings,
      usage: { tokens: totalTokens },
    };
  }
}
```

- [ ] **Step 2: Update index.ts with factory**

```typescript
import type { ModelManager } from "@vxllm/inference";
import { NodeLlamaCppLanguageModel } from "./language-model";
import { NodeLlamaCppEmbeddingModel } from "./embedding-model";

export function createLlamaProvider(modelManager: ModelManager) {
  return {
    chat: (sessionId: string) => new NodeLlamaCppLanguageModel(sessionId, modelManager),
    embedding: (sessionId: string) => new NodeLlamaCppEmbeddingModel(sessionId, modelManager),
  };
}

export { NodeLlamaCppLanguageModel } from "./language-model";
export { NodeLlamaCppEmbeddingModel } from "./embedding-model";
export type { LlamaCppOptions } from "./types";
```

- [ ] **Step 3: Delete old stub and verify**

```bash
rm packages/llama-provider/src/llama-embedding-model.ts
bun run check-types
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(llama-provider): add EmbeddingModel adapter and provider factory"
```

---

### Task 5: Integration test — generateText, streamText, structured output

**Files:** No new files — manual tests

- [ ] **Step 1: Download a small test model**

Get a small GGUF model for testing. Either download manually or use @huggingface/hub:

```bash
mkdir -p ~/.vxllm/models
# Use huggingface-cli or write a quick bun script to download
# e.g., Phi-4 Mini Q4_K_M (~2.5GB)
```

- [ ] **Step 2: Test generateText**

```bash
bun -e "
import { ModelManager } from '@vxllm/inference';
import { createLlamaProvider } from '@vxllm/llama-provider';
import { generateText } from 'ai';

const mm = new ModelManager();
const loaded = await mm.load({
  name: 'test', displayName: 'Test', type: 'llm', format: 'gguf',
  variant: 'q4_k_m', repo: null, fileName: null, description: null,
  localPath: '$HOME/.vxllm/models/YOUR_MODEL.gguf',
  sizeBytes: 0, minRamGb: null, recommendedVramGb: null, status: 'downloaded'
});
const provider = createLlamaProvider(mm);
const { text, usage } = await generateText({
  model: provider.chat(loaded.sessionId),
  prompt: 'What is 2+2? Answer in one word.',
});
console.log('Response:', text);
console.log('Usage:', usage);
await mm.disposeAll();
"
```

- [ ] **Step 3: Test streamText**

Same setup, use `streamText` and iterate `textStream`.

- [ ] **Step 4: Test structured output**

```bash
bun -e "
import { generateText, Output } from 'ai';
import { z } from 'zod';
// ... setup ...
const { output } = await generateText({
  model: provider.chat(loaded.sessionId),
  output: Output.object({ schema: z.object({ answer: z.number() }) }),
  prompt: 'What is 2+2?',
});
console.log('Structured:', output);
"
```

- [ ] **Step 5: Fix and commit if needed**

```bash
git add . && git commit -m "fix(llama-provider): fixes from integration testing"
```

---

## Layer 3: Model Management

### Task 6: Create models.json and implement Registry

**Files:**
- Create: `models.json` (project root)
- Modify: `packages/inference/src/registry.ts`

- [ ] **Step 1: Create `models.json` with 5 seed models**

```json
{
  "version": 1,
  "models": [
    {
      "name": "qwen2.5:7b",
      "displayName": "Qwen 2.5 7B Instruct",
      "type": "llm", "format": "gguf",
      "description": "Default chat, code, multilingual",
      "tags": ["chat", "code", "multilingual"],
      "variants": [{ "variant": "q4_k_m", "repo": "Qwen/Qwen2.5-7B-Instruct-GGUF", "fileName": "qwen2.5-7b-instruct-q4_k_m.gguf", "sizeBytes": 5040000000, "minRamGb": 5, "recommendedVramGb": 6 }]
    },
    {
      "name": "phi-4-mini",
      "displayName": "Phi-4 Mini Instruct",
      "type": "llm", "format": "gguf",
      "description": "Low-resource fallback, compact and fast",
      "tags": ["chat", "code", "compact"],
      "variants": [{ "variant": "q4_k_m", "repo": "microsoft/Phi-4-mini-instruct-GGUF", "fileName": "Phi-4-mini-instruct-Q4_K_M.gguf", "sizeBytes": 2500000000, "minRamGb": 3, "recommendedVramGb": 4 }]
    },
    {
      "name": "whisper:large-v3-turbo",
      "displayName": "Whisper Large v3 Turbo",
      "type": "stt", "format": "whisper",
      "description": "Real-time transcription",
      "tags": ["stt", "transcription"],
      "variants": [{ "variant": "default", "repo": "Systran/faster-whisper-large-v3-turbo", "fileName": null, "sizeBytes": 800000000, "minRamGb": 2, "recommendedVramGb": null }]
    },
    {
      "name": "kokoro:v1.0",
      "displayName": "Kokoro v1.0 (82M)",
      "type": "tts", "format": "kokoro",
      "description": "Voice synthesis, CPU-friendly",
      "tags": ["tts", "voice"],
      "variants": [{ "variant": "default", "repo": "hexgrad/Kokoro-82M", "fileName": null, "sizeBytes": 330000000, "minRamGb": 1, "recommendedVramGb": null }]
    },
    {
      "name": "nomic-embed:v1.5",
      "displayName": "Nomic Embed Text v1.5",
      "type": "embedding", "format": "gguf",
      "description": "RAG, semantic search",
      "tags": ["embedding", "rag", "search"],
      "variants": [{ "variant": "q4_k_m", "repo": "nomic-ai/nomic-embed-text-v1.5-GGUF", "fileName": "nomic-embed-text-v1.5.Q4_K_M.gguf", "sizeBytes": 80000000, "minRamGb": 0.5, "recommendedVramGb": null }]
    }
  ]
}
```

Verify exact HuggingFace repo names during implementation.

- [ ] **Step 2: Implement Registry class** — `resolve("name:variant")`, `search(query, type?)`, `getVariants(name)`

- [ ] **Step 3: Test and commit**

```bash
git add . && git commit -m "feat(inference): add models.json with 5 seed models and implement Registry"
```

---

### Task 7: Implement DownloadManager

**Files:**
- Modify: `packages/inference/package.json` (add @vxllm/db)
- Modify: `packages/inference/src/download.ts`

- [ ] **Step 1: Add @vxllm/db dependency**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/packages/inference && bun add @vxllm/db@workspace:*
```

- [ ] **Step 2: Implement DownloadManager**

Use `@huggingface/hub` for downloads. Key: `pull()` resolves from Registry, creates `download_queue` DB entry, streams download, tracks progress, updates `models` table on completion. Resume via HTTP Range headers. Concurrency limited to `MAX_CONCURRENT_DOWNLOADS`.

- [ ] **Step 3: Test with small model and commit**

```bash
git add . && git commit -m "feat(inference): implement DownloadManager with HuggingFace downloads"
```

---

## Layer 4: API Routes + DB Persistence

### Task 8: Error handler + health endpoint

**Files:**
- Create: `apps/server/src/middleware/error-handler.ts`
- Create: `apps/server/src/routes/health.ts`

- [ ] **Step 1: Create OpenAI-format error handler** — catches errors, returns `{ error: { message, type, code, param } }` with correct HTTP status

- [ ] **Step 2: Create health endpoint** — `GET /health` returns `{ status, model, uptime_seconds }`

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(server): add error handler and health endpoint"
```

---

### Task 9: POST /v1/chat/completions (streaming + non-streaming + DB)

**Files:**
- Create: `apps/server/src/routes/v1/chat.ts`
- Modify: `apps/server/src/index.ts` (mount routes, lifecycle)

The most complex route:
1. Validate request against `ChatCompletionRequestSchema`
2. Resolve model, load via ModelManager if needed
3. Create/get conversation (via `X-Conversation-Id` header)
4. `stream: true` → `streamText()` + Hono SSE (`data: {...}\n\n` + `data: [DONE]\n\n`)
5. `stream: false` → `generateText()` + full JSON
6. Persist messages + metrics to DB

Also wire up server lifecycle in `index.ts`:
- Startup: `detectHardware()` log, auto-load `DEFAULT_MODEL`
- Shutdown: `disposeAll()`, cancel downloads

- [ ] **Step 1: Create route and mount**
- [ ] **Step 2: Test streaming with curl**
- [ ] **Step 3: Test non-streaming with curl**
- [ ] **Step 4: Verify DB persistence**
- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat(server): implement /v1/chat/completions with streaming and DB persistence"
```

---

### Task 10: POST /v1/completions + POST /v1/embeddings

**Files:**
- Create: `apps/server/src/routes/v1/completions.ts`
- Create: `apps/server/src/routes/v1/embeddings.ts`
- Modify: `packages/api/src/schemas/openai.ts` (add Completion schemas)
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Add Completion schemas to openai.ts**
- [ ] **Step 2: Create /v1/completions route** (simpler than chat — prompt string, not messages)
- [ ] **Step 3: Create /v1/embeddings route**
- [ ] **Step 4: Mount, test, commit**

```bash
git add . && git commit -m "feat(server): implement /v1/completions and /v1/embeddings"
```

---

### Task 11: GET /v1/models + model management API

**Files:**
- Create: `apps/server/src/routes/v1/models.ts`
- Create: `apps/server/src/routes/api/models.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create GET /v1/models** (query downloaded models, OpenAI format)
- [ ] **Step 2: Create POST /api/models/pull + GET /api/models/status**
- [ ] **Step 3: Mount, test, commit**

```bash
git add . && git commit -m "feat(server): implement /v1/models and model management API"
```

---

### Task 12: Extend OpenAI schemas + final verification

**Files:**
- Modify: `packages/api/src/schemas/openai.ts`

- [ ] **Step 1: Add `tools`, `tool_choice`, `response_format` to ChatCompletionRequestSchema**
- [ ] **Step 2: Add `tool_calls` to response/chunk schemas**
- [ ] **Step 3: Full e2e verification**

```bash
bun install && bun run check-types
bun run dev:server
curl http://localhost:11500/health
curl http://localhost:11500/v1/models
# Pull a model, test chat completions (stream + non-stream), test embeddings
# Verify DB entries in conversations, messages, usage_metrics tables
```

- [ ] **Step 4: Test with OpenAI Python SDK** (optional)

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11500/v1", api_key="vxllm")
r = client.chat.completions.create(model="phi-4-mini", messages=[{"role":"user","content":"Hello!"}])
print(r.choices[0].message.content)
```

- [ ] **Step 5: Final commit**

```bash
git add . && git commit -m "feat: complete inference engine with OpenAI-compatible API"
```

---

## Summary

| Task | Layer | Description | Est. Size |
|------|-------|-------------|-----------|
| 1 | 1 | Install node-llama-cpp + hardware detection | ~100 lines |
| 2 | 1 | ModelManager (load/unload/countTokens) | ~120 lines |
| 3 | 2 | LanguageModel adapter (generate + stream + tools + grammar) | ~200 lines |
| 4 | 2 | EmbeddingModel adapter + provider factory | ~100 lines |
| 5 | 2 | Integration tests | manual |
| 6 | 3 | models.json + Registry | ~150 lines |
| 7 | 3 | DownloadManager | ~200 lines |
| 8 | 4 | Error handler + health | ~60 lines |
| 9 | 4 | POST /v1/chat/completions (stream + DB) | ~250 lines |
| 10 | 4 | POST /v1/completions + /v1/embeddings | ~150 lines |
| 11 | 4 | GET /v1/models + model management API | ~100 lines |
| 12 | 4 | Schema extensions + final verification | ~50 lines |
| **Total** | | **12 tasks** | **~1,480 lines** |
