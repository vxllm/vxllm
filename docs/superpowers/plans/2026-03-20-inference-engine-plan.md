# Inference Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete inference pipeline — hardware detection, GGUF model loading, AI SDK provider with tool calling + structured output, model downloads from HuggingFace, and OpenAI-compatible API routes with streaming and DB persistence.

**Architecture:** 4-layer bottom-up build. Layer 1 installs node-llama-cpp and implements hardware detection + ModelManager. Layer 2 forks the TS layer from ai-sdk-llama-cpp (LanguageModelV3 interface, tool calling, grammar conversion, message conversion) but replaces the native C++ binding with node-llama-cpp. Layer 3 adds model registry + HuggingFace downloads. Layer 4 wires OpenAI-compatible Hono routes with DB persistence.

**Tech Stack:** node-llama-cpp v3 (replaces ai-sdk-llama-cpp's native C++ binding), @ai-sdk/provider v3 (LanguageModelV3/EmbeddingModelV3 interfaces), @huggingface/hub, Hono, Drizzle ORM + SQLite

**Spec:** `docs/superpowers/specs/2026-03-20-inference-engine-design.md` (v2)

**Key research findings:**
- `ai-sdk-llama-cpp` does NOT use `node-llama-cpp` — it has its own native C++ binding via cmake-js + node-addon-api (macOS only)
- It implements `LanguageModelV3` and `EmbeddingModelV3` from `@ai-sdk/provider` v3
- Tool calling works via: prompt injection (`buildToolSystemPrompt`) → GBNF grammar constraints (`generateToolCallGrammar`) → response parsing (`parseToolCalls`)
- JSON schema → GBNF grammar converter is a ~600 line TS port of llama.cpp's converter
- **Our fork strategy:** Keep the TS layer (provider, tool calling, grammar, message conversion), replace native-binding.ts with node-llama-cpp calls. This gives us cross-platform (Metal + CUDA + CPU) for free.

**Source reference:** https://github.com/lgrammel/ai-sdk-llama-cpp (v0.7.0)

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
└── index.ts              # MODIFY: re-export new additions (countTokens)

packages/llama-provider/src/
├── types.ts                    # MODIFY: update LlamaProviderSettings
├── llama-cpp-binding.ts        # CREATE: node-llama-cpp adapter (replaces native-binding.ts)
├── llama-cpp-language-model.ts # CREATE: forked from ai-sdk-llama-cpp, uses our binding
├── llama-cpp-embedding-model.ts# CREATE: forked from ai-sdk-llama-cpp, uses our binding
├── json-schema-to-grammar.ts   # CREATE: copy from ai-sdk-llama-cpp (600 line GBNF converter)
├── llama-cpp-provider.ts       # CREATE: forked provider factory, uses ModelManager
└── index.ts                    # MODIFY: update exports

apps/server/src/
├── index.ts                    # MODIFY: mount routes, add lifecycle
├── routes/
│   ├── v1/
│   │   ├── chat.ts             # CREATE: POST /v1/chat/completions
│   │   ├── completions.ts      # CREATE: POST /v1/completions
│   │   ├── embeddings.ts       # CREATE: POST /v1/embeddings
│   │   └── models.ts           # CREATE: GET /v1/models
│   ├── api/
│   │   └── models.ts           # CREATE: POST /api/models/pull, GET /api/models/status
│   └── health.ts               # CREATE: GET /health
└── middleware/
    └── error-handler.ts        # CREATE: OpenAI-format errors

models.json                     # CREATE: 5 seed models at project root
packages/api/src/schemas/openai.ts  # MODIFY: add tools, tool_choice, response_format, completions
```

---

## Layer 1: node-llama-cpp Core

### Task 1: Install node-llama-cpp and implement hardware detection

**Files:**
- Modify: `packages/inference/package.json` (add node-llama-cpp, @huggingface/hub)
- Modify: `packages/inference/src/hardware.ts`
- Modify: `packages/inference/src/types.ts` (add description to ModelInfo)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/packages/inference
bun add node-llama-cpp @huggingface/hub
```

node-llama-cpp's postinstall downloads pre-built llama.cpp binaries for the current platform (Metal on macOS, CUDA on Linux if available, CPU fallback).

- [ ] **Step 2: Add `description` to ModelInfo in types.ts**

Add `description: string | null;` to the `ModelInfo` interface (it's in the DB schema and models.json but was missing).

- [ ] **Step 3: Implement `detectHardware()` in hardware.ts**

Use node-llama-cpp's `getLlama()` API for GPU detection, and Node.js `os` module for CPU/RAM:

```typescript
import { getLlama } from "node-llama-cpp";
import os from "node:os";
import type { HardwareProfile } from "./types";

export async function detectHardware(): Promise<HardwareProfile> {
  const platform = os.platform() as "darwin" | "linux" | "win32";
  const arch = os.arch() as "arm64" | "x64";
  const isAppleSilicon = platform === "darwin" && arch === "arm64";

  // node-llama-cpp's getLlama() initializes the runtime and detects GPU
  const llama = await getLlama();

  // Inspect llama instance for GPU info — check available properties
  // The exact API needs to be discovered from node-llama-cpp's TypeScript types
  // Common patterns: llama.gpu, llama.deviceInfo, llama.supportsGpu, etc.

  return {
    platform,
    arch,
    isAppleSilicon,
    gpu: {
      available: /* from llama GPU detection */,
      vendor: isAppleSilicon ? "apple" : /* detect nvidia/amd/none */,
      name: /* GPU name string */,
      vramBytes: /* VRAM in bytes */,
    },
    cpu: {
      model: os.cpus()[0]?.model ?? "unknown",
      physicalCores: os.cpus().length, // Logical cores; physical needs platform-specific detection
      logicalCores: os.cpus().length,
    },
    ram: {
      totalBytes: os.totalmem(),
      availableBytes: os.freemem(),
    },
  };
}
```

**Implementation note:** The exact node-llama-cpp GPU detection API must be discovered by inspecting the TypeScript types of the `getLlama()` return value. Run `bun -e "import { getLlama } from 'node-llama-cpp'; const l = await getLlama(); console.log(Object.keys(l));"` to explore.

- [ ] **Step 4: Implement `calculateGpuLayers()` in hardware.ts**

```typescript
import { QUANTIZATION_TIERS } from "./constants";

export function calculateGpuLayers(
  modelSizeBytes: number,
  vramBytes: number,
  quantTier: string
): number {
  if (vramBytes === 0) return 0;

  const tier = QUANTIZATION_TIERS[quantTier as keyof typeof QUANTIZATION_TIERS];
  const bitsPerWeight = tier?.bitsPerWeight ?? 4.8;

  // Estimate total layers from model size and quantization
  const bytesPerLayer = modelSizeBytes / 32; // rough: 32 layers typical for 7B models
  const kvCacheOverhead = 500 * 1024 * 1024; // 500MB
  const osOverhead = 500 * 1024 * 1024; // 500MB
  const availableVram = vramBytes - kvCacheOverhead - osOverhead;

  if (availableVram <= 0) return 0;

  const maxLayers = Math.floor(availableVram / bytesPerLayer);
  return Math.min(maxLayers, 99); // Cap at 99 (all layers)
}
```

- [ ] **Step 5: Test hardware detection**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm
bun -e "import { detectHardware } from '@vxllm/inference'; const hw = await detectHardware(); console.log(JSON.stringify(hw, null, 2));"
```

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(inference): install node-llama-cpp and implement hardware detection"
```

---

### Task 2: Implement ModelManager with node-llama-cpp

**Files:**
- Modify: `packages/inference/src/model-manager.ts`
- Modify: `packages/inference/src/index.ts` (export countTokens)

- [ ] **Step 1: Implement ModelManager class**

Replace the stub with a real implementation. The key is wrapping node-llama-cpp's model lifecycle:

```typescript
import { getLlama, type Llama, type LlamaModel, type LlamaContext } from "node-llama-cpp";
import { nanoid } from "nanoid"; // or crypto.randomUUID
import { env } from "@vxllm/env/server";
import { detectHardware, calculateGpuLayers } from "./hardware";
import type { ModelInfo, LoadedModel } from "./types";

export class ModelManager {
  private llama: Llama | null = null;
  private loaded = new Map<string, {
    model: LlamaModel;
    context: LlamaContext;
    info: LoadedModel;
  }>();

  async initialize(): Promise<Llama> {
    if (!this.llama) {
      this.llama = await getLlama();
    }
    return this.llama;
  }

  getLlama(): Llama | null { return this.llama; }

  async load(modelInfo: ModelInfo): Promise<LoadedModel> {
    const llama = await this.initialize();
    if (!modelInfo.localPath) throw new Error("Model has no local path");

    const hardware = await detectHardware();
    const gpuLayers = env.GPU_LAYERS_OVERRIDE
      ?? calculateGpuLayers(modelInfo.sizeBytes, hardware.gpu.vramBytes, modelInfo.variant ?? "Q4_K_M");

    const model = await llama.loadModel({
      modelPath: modelInfo.localPath,
      gpuLayers,
    });

    const maxContext = /* get from model metadata if available */ 8192;
    const contextSize = Math.min(env.MAX_CONTEXT_SIZE, maxContext);
    const context = await model.createContext({ contextSize });

    const sessionId = nanoid();
    const loaded: LoadedModel = {
      modelInfo,
      sessionId,
      memoryUsageBytes: modelInfo.sizeBytes, // approximate
      gpuLayersLoaded: gpuLayers,
      contextSize,
      createdAt: Date.now(),
    };

    this.loaded.set(sessionId, { model, context, info: loaded });
    return loaded;
  }

  async unload(sessionId: string): Promise<void> {
    const entry = this.loaded.get(sessionId);
    if (!entry) return;
    // Dispose context and model via node-llama-cpp
    // Check exact dispose API: entry.context.dispose() and/or entry.model.dispose()
    this.loaded.delete(sessionId);
  }

  getLoaded(): LoadedModel[] {
    return Array.from(this.loaded.values()).map(e => e.info);
  }

  getActive(): LoadedModel | null {
    // Return the first loaded LLM model
    for (const entry of this.loaded.values()) {
      if (entry.info.modelInfo.type === "llm") return entry.info;
    }
    return null;
  }

  /** Get raw node-llama-cpp objects for provider integration */
  getModelEntry(sessionId: string) {
    return this.loaded.get(sessionId) ?? null;
  }

  /** Count tokens using the model's native tokenizer */
  countTokens(sessionId: string, text: string): number {
    const entry = this.loaded.get(sessionId);
    if (!entry) return 0;
    return entry.model.tokenize(text).length;
  }

  /** Dispose all models (for shutdown) */
  async disposeAll(): Promise<void> {
    for (const sessionId of this.loaded.keys()) {
      await this.unload(sessionId);
    }
  }
}
```

**Note:** The exact node-llama-cpp v3 API (method names for `loadModel`, `createContext`, dispose, tokenize) must be verified against the installed package types. The above follows the documented API but may need adjustments.

- [ ] **Step 2: Update exports in index.ts if needed**

The existing barrel export should pick up the changes. Verify `countTokens` is accessible.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(inference): implement ModelManager with node-llama-cpp model loading"
```

---

## Layer 2: AI SDK Provider (Fork)

### Task 3: Create node-llama-cpp binding adapter

**Files:**
- Create: `packages/llama-provider/src/llama-cpp-binding.ts`
- Modify: `packages/llama-provider/package.json` (add deps)

This file replaces ai-sdk-llama-cpp's `native-binding.ts`. Instead of calling C++ bindings directly, it calls node-llama-cpp via our `ModelManager`.

- [ ] **Step 1: Add dependencies**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/packages/llama-provider
bun add @ai-sdk/provider @ai-sdk/provider-utils node-llama-cpp
bun add @vxllm/inference@workspace:* @vxllm/db@workspace:*
```

- [ ] **Step 2: Create `llama-cpp-binding.ts`**

This adapter provides the same interface as ai-sdk-llama-cpp's native-binding.ts but routes through node-llama-cpp:

```typescript
import type { ModelManager } from "@vxllm/inference";
import { LlamaChatSession } from "node-llama-cpp";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  grammar?: string; // GBNF grammar string
}

export interface GenerateResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: "stop" | "length" | "error";
}

export interface EmbedResult {
  embeddings: Float32Array[];
  totalTokens: number;
}

/**
 * Adapter that bridges ai-sdk-llama-cpp's interface to node-llama-cpp.
 * This replaces the native C++ binding with node-llama-cpp's cross-platform runtime.
 */
export class LlamaCppBinding {
  constructor(private modelManager: ModelManager) {}

  async generate(sessionId: string, options: GenerateOptions): Promise<GenerateResult> {
    const entry = this.modelManager.getModelEntry(sessionId);
    if (!entry) throw new Error("Model not loaded");

    // Create a LlamaChatSession from the context
    const session = new LlamaChatSession({
      contextSequence: entry.context.getSequence(),
    });

    // Build grammar if provided
    let grammar;
    if (options.grammar) {
      const llama = this.modelManager.getLlama();
      // Use llama.createGrammar() or similar API with the GBNF string
      // Exact API TBD from node-llama-cpp types
    }

    // Call session.prompt() with options
    const response = await session.prompt(
      // Convert messages to prompt format
      // node-llama-cpp's LlamaChatSession handles chat templates
      options.messages.map(m => m.content).join("\n"),
      {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK,
        grammar,
      }
    );

    // Extract token counts
    return {
      text: response,
      promptTokens: /* from session/context stats */,
      completionTokens: /* from session/context stats */,
      finishReason: "stop",
    };
  }

  async generateStream(
    sessionId: string,
    options: GenerateOptions,
    onToken: (token: string) => void
  ): Promise<GenerateResult> {
    // Similar to generate but with token callback
    // Use node-llama-cpp's streaming API
    // Exact pattern TBD from node-llama-cpp types
  }

  async embed(sessionId: string, texts: string[]): Promise<EmbedResult> {
    const entry = this.modelManager.getModelEntry(sessionId);
    if (!entry) throw new Error("Model not loaded");

    // Create embedding context
    const embeddingContext = await entry.model.createEmbeddingContext();
    const embeddings: Float32Array[] = [];
    let totalTokens = 0;

    for (const text of texts) {
      const result = await embeddingContext.getEmbeddingFor(text);
      embeddings.push(new Float32Array(result.vector));
      totalTokens += entry.model.tokenize(text).length;
    }

    return { embeddings, totalTokens };
  }
}
```

**Implementation note:** The exact node-llama-cpp APIs for chat sessions, streaming, grammar, and token counting must be verified during implementation. The above is a structural guide — adapt to the actual API.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(llama-provider): create node-llama-cpp binding adapter"
```

---

### Task 4: Fork provider TS layer from ai-sdk-llama-cpp

**Files:**
- Create: `packages/llama-provider/src/json-schema-to-grammar.ts` (copy from source)
- Create: `packages/llama-provider/src/llama-cpp-language-model.ts` (fork + adapt)
- Create: `packages/llama-provider/src/llama-cpp-embedding-model.ts` (fork + adapt)
- Create: `packages/llama-provider/src/llama-cpp-provider.ts` (fork + adapt)
- Modify: `packages/llama-provider/src/index.ts` (update exports)
- Modify: `packages/llama-provider/src/types.ts`
- Delete: `packages/llama-provider/src/llama-chat-model.ts` (replaced by forked file)
- Delete: `packages/llama-provider/src/llama-embedding-model.ts` (replaced by forked file)

- [ ] **Step 1: Copy `json-schema-to-grammar.ts` from source**

Fetch from GitHub and save to our package:

```bash
gh api "repos/lgrammel/ai-sdk-llama-cpp/contents/packages/ai-sdk-llama-cpp/src/json-schema-to-grammar.ts" --jq '.content' | base64 -d > /Users/rahulretnan/Projects/DataHase/vxllm/packages/llama-provider/src/json-schema-to-grammar.ts
```

This file is a self-contained ~600 line JSON Schema → GBNF converter. It only depends on `@ai-sdk/provider` for the `JSONSchema7` type.

- [ ] **Step 2: Fork `llama-cpp-language-model.ts`**

Fetch the source and adapt it:

```bash
gh api "repos/lgrammel/ai-sdk-llama-cpp/contents/packages/ai-sdk-llama-cpp/src/llama-cpp-language-model.ts" --jq '.content' | base64 -d > /Users/rahulretnan/Projects/DataHase/vxllm/packages/llama-provider/src/llama-cpp-language-model.ts
```

Then modify:
1. Replace all `import { ... } from "./native-binding.js"` with `import { LlamaCppBinding, ... } from "./llama-cpp-binding"`
2. Replace `loadModel()` / `unloadModel()` / `isModelLoaded()` calls with `this.binding.generate()` and `this.binding.generateStream()`
3. The constructor should take `(sessionId: string, binding: LlamaCppBinding, config?)` instead of `(config: LlamaCppModelConfig)`
4. Remove `ensureModelLoaded()` — models are loaded externally via ModelManager
5. Keep ALL tool calling logic: `convertMessages`, `buildToolSystemPrompt`, `generateToolCallGrammar`, `parseToolCalls`
6. Keep ALL grammar/structured output logic: `convertJsonSchemaToGrammar`
7. Keep `convertFinishReason`, `convertUsage` helpers

- [ ] **Step 3: Fork `llama-cpp-embedding-model.ts`**

Same approach — fetch and adapt to use `LlamaCppBinding` instead of native binding:

```bash
gh api "repos/lgrammel/ai-sdk-llama-cpp/contents/packages/ai-sdk-llama-cpp/src/llama-cpp-embedding-model.ts" --jq '.content' | base64 -d > /Users/rahulretnan/Projects/DataHase/vxllm/packages/llama-provider/src/llama-cpp-embedding-model.ts
```

Modify to use `this.binding.embed(sessionId, texts)` instead of the native embed function.

- [ ] **Step 4: Create `llama-cpp-provider.ts`**

Fork the provider factory to use our ModelManager:

```typescript
import type { ModelManager } from "@vxllm/inference";
import { LlamaCppBinding } from "./llama-cpp-binding";
import { LlamaCppLanguageModel } from "./llama-cpp-language-model";
import { LlamaCppEmbeddingModel } from "./llama-cpp-embedding-model";

export interface LlamaCppProviderSettings {
  modelManager: ModelManager;
}

export function createLlamaProvider(settings: LlamaCppProviderSettings) {
  const binding = new LlamaCppBinding(settings.modelManager);

  return {
    chat: (sessionId: string) => new LlamaCppLanguageModel(sessionId, binding),
    embedding: (sessionId: string) => new LlamaCppEmbeddingModel(sessionId, binding),
  };
}
```

- [ ] **Step 5: Delete old stubs and update index.ts**

Remove `llama-chat-model.ts` and `llama-embedding-model.ts` (the old stubs). Update `index.ts`:

```typescript
export { createLlamaProvider, type LlamaCppProviderSettings } from "./llama-cpp-provider";
export { LlamaCppLanguageModel } from "./llama-cpp-language-model";
export { LlamaCppEmbeddingModel } from "./llama-cpp-embedding-model";
export { convertJsonSchemaToGrammar, SchemaConverter } from "./json-schema-to-grammar";
export { parseToolCalls, buildToolSystemPrompt, type ParsedToolCall } from "./llama-cpp-language-model";
```

- [ ] **Step 6: Verify types compile**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types
```

Fix any type errors from the fork adaptation. Common issues:
- Import path changes (`.js` → no extension for Bun)
- Different `@ai-sdk/provider` version than source expects
- Missing types that were implicit in the source

- [ ] **Step 7: Commit**

```bash
git add . && git commit -m "feat(llama-provider): fork ai-sdk-llama-cpp TS layer with node-llama-cpp binding"
```

---

### Task 5: Integration test — generateText, streamText, structured output

**Files:** No new files — manual integration tests

- [ ] **Step 1: Download a test model**

You need a small GGUF model to test. Download manually or write a quick script:

```bash
mkdir -p ~/.vxllm/models
# Download Phi-4 Mini Q4_K_M (~2.5GB) — adjust URL to actual HuggingFace repo
cd /Users/rahulretnan/Projects/DataHase/vxllm
bun -e "
import { DownloadManager, Registry } from '@vxllm/inference';
// If DownloadManager isn't ready yet, use @huggingface/hub directly:
import { downloadFile } from '@huggingface/hub';
const response = await downloadFile({
  repo: 'microsoft/Phi-4-mini-instruct-GGUF',
  path: 'Phi-4-mini-instruct-Q4_K_M.gguf',
});
// Save to disk...
"
```

Alternatively, if you already have a GGUF model on disk, use that.

- [ ] **Step 2: Test generateText**

Write and run a test script that:
1. Creates ModelManager, loads the model
2. Creates provider via `createLlamaProvider`
3. Calls `generateText({ model: provider.chat(sessionId), prompt: "What is 2+2?" })`
4. Prints response text and usage

- [ ] **Step 3: Test streamText**

Same setup but use `streamText` and iterate `textStream`.

- [ ] **Step 4: Test structured output**

Use `generateText` with `Output.object({ schema: z.object({ answer: z.number() }) })`.

- [ ] **Step 5: Fix any issues and commit**

```bash
git add . && git commit -m "fix(llama-provider): fixes from integration testing"
```

---

## Layer 3: Model Management

### Task 6: Create models.json and implement Registry

**Files:**
- Create: `models.json` (project root)
- Modify: `packages/inference/src/registry.ts`

- [ ] **Step 1: Create `models.json`**

Create the file at the project root with 5 seed models. Structure per the spec:

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
      "variants": [{
        "variant": "q4_k_m",
        "repo": "Qwen/Qwen2.5-7B-Instruct-GGUF",
        "fileName": "qwen2.5-7b-instruct-q4_k_m.gguf",
        "sizeBytes": 5040000000,
        "minRamGb": 5,
        "recommendedVramGb": 6
      }]
    },
    {
      "name": "phi-4-mini",
      "displayName": "Phi-4 Mini Instruct",
      "type": "llm",
      "format": "gguf",
      "description": "Low-resource fallback, compact and fast",
      "tags": ["chat", "code", "compact"],
      "variants": [{
        "variant": "q4_k_m",
        "repo": "microsoft/Phi-4-mini-instruct-GGUF",
        "fileName": "Phi-4-mini-instruct-Q4_K_M.gguf",
        "sizeBytes": 2500000000,
        "minRamGb": 3,
        "recommendedVramGb": 4
      }]
    },
    {
      "name": "whisper:large-v3-turbo",
      "displayName": "Whisper Large v3 Turbo",
      "type": "stt",
      "format": "whisper",
      "description": "Real-time transcription, best speed/accuracy balance",
      "tags": ["stt", "transcription"],
      "variants": [{
        "variant": "default",
        "repo": "Systran/faster-whisper-large-v3-turbo",
        "fileName": null,
        "sizeBytes": 800000000,
        "minRamGb": 2,
        "recommendedVramGb": null
      }]
    },
    {
      "name": "kokoro:v1.0",
      "displayName": "Kokoro v1.0 (82M)",
      "type": "tts",
      "format": "kokoro",
      "description": "Voice synthesis, CPU-friendly, high quality",
      "tags": ["tts", "voice"],
      "variants": [{
        "variant": "default",
        "repo": "hexgrad/Kokoro-82M",
        "fileName": null,
        "sizeBytes": 330000000,
        "minRamGb": 1,
        "recommendedVramGb": null
      }]
    },
    {
      "name": "nomic-embed:v1.5",
      "displayName": "Nomic Embed Text v1.5",
      "type": "embedding",
      "format": "gguf",
      "description": "RAG, semantic search, high-quality embeddings",
      "tags": ["embedding", "rag", "search"],
      "variants": [{
        "variant": "q4_k_m",
        "repo": "nomic-ai/nomic-embed-text-v1.5-GGUF",
        "fileName": "nomic-embed-text-v1.5.Q4_K_M.gguf",
        "sizeBytes": 80000000,
        "minRamGb": 0.5,
        "recommendedVramGb": null
      }]
    }
  ]
}
```

**Note:** Verify exact HuggingFace repo names and file names during implementation.

- [ ] **Step 2: Implement Registry class**

Replace the stub in `registry.ts` with a working implementation that reads `models.json`, supports `resolve("name:variant")` parsing, fuzzy search, and hardware-aware variant selection.

- [ ] **Step 3: Test**

```bash
bun -e "
import { Registry } from '@vxllm/inference';
const reg = new Registry();
await reg.load();
console.log(await reg.resolve('qwen2.5:7b'));
console.log(await reg.search('embed'));
"
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(inference): add models.json with 5 seed models and implement Registry"
```

---

### Task 7: Implement DownloadManager

**Files:**
- Modify: `packages/inference/src/download.ts`
- Modify: `packages/inference/package.json` (add @vxllm/db)

- [ ] **Step 1: Add @vxllm/db dependency**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/packages/inference && bun add @vxllm/db@workspace:*
```

- [ ] **Step 2: Implement DownloadManager**

Replace the stub. Use `@huggingface/hub` for downloads, track progress, persist to DB:

Key implementation points:
- `pull()`: resolve from Registry, create `download_queue` DB entry, stream download via `@huggingface/hub`, update progress in memory, update `models` table on completion
- `pause()`/`resume()`: AbortController + HTTP Range headers
- `cancel()`: abort + delete partial file + update DB
- Concurrency: check active count against `MAX_CONCURRENT_DOWNLOADS` before starting
- Progress tracking: read `Content-Length` header, count bytes from response body stream

- [ ] **Step 3: Test with a small model**

```bash
bun -e "
import { DownloadManager, Registry } from '@vxllm/inference';
const reg = new Registry(); await reg.load();
const dm = new DownloadManager(reg);
const progress = await dm.pull('nomic-embed:v1.5');
console.log(progress);
"
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(inference): implement DownloadManager with HuggingFace downloads"
```

---

## Layer 4: API Routes + DB Persistence

### Task 8: OpenAI error handler and route structure

**Files:**
- Create: `apps/server/src/middleware/error-handler.ts`
- Create: `apps/server/src/routes/health.ts`

- [ ] **Step 1: Create error handler middleware**

Catches errors, formats as OpenAI-compatible JSON with appropriate HTTP status codes (400, 401, 429, 500, 503).

- [ ] **Step 2: Create health endpoint**

`GET /health` returns `{ status: "ok", model: activeModel?.name ?? null, uptime_seconds: N }`.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(server): add error handler middleware and health endpoint"
```

---

### Task 9: POST /v1/chat/completions (streaming + non-streaming + DB persistence)

**Files:**
- Create: `apps/server/src/routes/v1/chat.ts`
- Modify: `apps/server/src/index.ts` (mount route, add lifecycle)

This is the most complex route. Implementation:

1. Parse and validate request body against `ChatCompletionRequestSchema`
2. Resolve model from DB/ModelManager, load if not loaded
3. Create/get conversation (via `X-Conversation-Id` header or auto-create)
4. If `stream: true`: use `streamText()` → SSE via Hono's `streamSSE`
5. If `stream: false`: use `generateText()` → JSON response
6. After response: persist user message + assistant response to `messages` table, write `usage_metrics`

- [ ] **Step 1: Create the route file with streaming + non-streaming support**

- [ ] **Step 2: Mount in index.ts and add server lifecycle (startup hardware detection, DEFAULT_MODEL auto-load, SIGTERM/SIGINT cleanup)**

- [ ] **Step 3: Test streaming with curl**

- [ ] **Step 4: Test non-streaming with curl**

- [ ] **Step 5: Verify DB persistence (check messages and usage_metrics tables)**

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(server): implement /v1/chat/completions with streaming and DB persistence"
```

---

### Task 10: POST /v1/completions + POST /v1/embeddings

**Files:**
- Create: `apps/server/src/routes/v1/completions.ts`
- Create: `apps/server/src/routes/v1/embeddings.ts`
- Modify: `packages/api/src/schemas/openai.ts` (add Completion schemas)
- Modify: `apps/server/src/index.ts` (mount routes)

- [ ] **Step 1: Add Completion request/response schemas to openai.ts**

- [ ] **Step 2: Create /v1/completions route** (simpler than chat — prompt string, not messages)

- [ ] **Step 3: Create /v1/embeddings route**

- [ ] **Step 4: Mount and test both**

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat(server): implement /v1/completions and /v1/embeddings routes"
```

---

### Task 11: GET /v1/models + model management API

**Files:**
- Create: `apps/server/src/routes/v1/models.ts`
- Create: `apps/server/src/routes/api/models.ts`
- Modify: `apps/server/src/index.ts` (mount routes)

- [ ] **Step 1: Create GET /v1/models** (query downloaded models from DB, return OpenAI format)

- [ ] **Step 2: Create POST /api/models/pull and GET /api/models/status**

- [ ] **Step 3: Mount and test**

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(server): implement /v1/models and model management API"
```

---

### Task 12: Extend OpenAI schemas + final verification

**Files:**
- Modify: `packages/api/src/schemas/openai.ts` (add tools, tool_choice, response_format)

- [ ] **Step 1: Add tools, tool_choice, response_format to ChatCompletionRequestSchema**

- [ ] **Step 2: Add tool_calls to response/chunk schemas**

- [ ] **Step 3: Full verification**

Run all these checks:
```bash
bun install
bun run check-types
bun run dev:server  # verify startup
curl http://localhost:11500/health
curl http://localhost:11500/v1/models
# Pull a model, test chat completions, test embeddings
# Verify DB has entries
```

- [ ] **Step 4: Test with OpenAI Python SDK** (optional if Python available)

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11500/v1", api_key="vxllm")
response = client.chat.completions.create(
    model="phi-4-mini", messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

- [ ] **Step 5: Final commit**

```bash
git add . && git commit -m "feat: complete inference engine with OpenAI-compatible API"
```

---

## Summary

| Task | Layer | Description | Key Files |
|------|-------|-------------|-----------|
| 1 | 1 | Install node-llama-cpp + hardware detection | hardware.ts |
| 2 | 1 | ModelManager (load/unload/countTokens) | model-manager.ts |
| 3 | 2 | node-llama-cpp binding adapter | llama-cpp-binding.ts |
| 4 | 2 | Fork ai-sdk-llama-cpp TS layer | language-model.ts, embedding-model.ts, grammar.ts |
| 5 | 2 | Integration tests (generateText, streamText, structured output) | manual |
| 6 | 3 | models.json + Registry | models.json, registry.ts |
| 7 | 3 | DownloadManager (HuggingFace) | download.ts |
| 8 | 4 | Error handler + health endpoint | error-handler.ts, health.ts |
| 9 | 4 | POST /v1/chat/completions (stream + DB) | routes/v1/chat.ts |
| 10 | 4 | POST /v1/completions + /v1/embeddings | routes/v1/completions.ts, embeddings.ts |
| 11 | 4 | GET /v1/models + model management API | routes/v1/models.ts, routes/api/models.ts |
| 12 | 4 | Schema extensions + final verification | openai.ts |
