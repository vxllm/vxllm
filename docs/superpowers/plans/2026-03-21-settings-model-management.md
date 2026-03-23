# Settings-Based Multi-Model Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move model loading/unloading to Settings, support one model per type (LLM, Embedding, STT, TTS) simultaneously, and auto-load on restart.

**Architecture:** Extend ModelManager with type-based lookups (`getByType`). Unified `loadModel`/`unloadModel` mutations branch internally for LLM/Embedding (node-llama-cpp) vs STT/TTS (Python voice service). Persist loaded model IDs to the settings table; read them on startup for auto-load.

**Tech Stack:** TypeScript, Hono, oRPC, Drizzle ORM, React 19, TanStack Router/Query, shadcn/ui, Python FastAPI

---

## File Structure

### Created Files
| File | Responsibility |
|------|----------------|
| `apps/app/src/components/settings/loaded-models.tsx` | Settings tab: queries loaded models, renders Language/Voice sections |
| `apps/app/src/components/settings/model-slot.tsx` | Single model slot: loaded/empty/loading states, inline select |
| `apps/app/src/hooks/use-loaded-models.ts` | Hook: queries `getLoadedModels`, exposes `loadModel`/`unloadModel` mutations |
| `apps/voice/app/routes/models.py` | FastAPI routes: `/models/load`, `/models/unload`, `/models/status` |

### Modified Files
| File | Change |
|------|--------|
| `packages/inference/src/model-manager.ts` | Add `getByType()`, `getLoadedByType()`, update `getActive()` |
| `packages/api/src/schemas/models.ts` | Update `LoadModelInput` (add type), `UnloadModelInput` (type instead of sessionId), add `LoadedModelsOutput` |
| `packages/api/src/routers/model.router.ts` | Rewrite `loadModel`/`unloadModel`, add `getLoadedModels`, add settings persistence |
| `apps/server/src/index.ts` | Replace `DEFAULT_MODEL` auto-load with settings-based auto-load |
| `apps/app/src/routes/settings/index.tsx` | Add "Models" tab as first/default tab |
| `apps/app/src/components/chat/chat-header.tsx` | Replace `ModelSelector` with read-only badge + `SlidersHorizontal` link |
| `apps/app/src/components/chat/chat-empty-state.tsx` | Replace model selector/unload with "No model" message + Settings link |
| `apps/app/src/components/chat/chat-input.tsx` | Update import from `use-active-model` to `use-loaded-models` |
| `apps/app/src/components/chat/chat-sidebar.tsx` | Update import from `use-active-model` to `use-loaded-models` |
| `apps/voice/app/engines/stt.py` | Add `unload()` method, accept `model_path` param in `load()` |
| `apps/voice/app/engines/tts.py` | Add `unload()` method, accept `model_path` param in `load()` |
| `apps/voice/app/main.py` | Register new `/models/*` routes |

### Deleted Files
| File | Reason |
|------|--------|
| `apps/app/src/hooks/use-active-model.ts` | Replaced by `use-loaded-models.ts` |
| `apps/app/src/components/chat/model-selector.tsx` | Replaced by read-only badge in chat + inline Select in Settings |

---

## Task 1: ModelManager — Add Type-Based Lookups

**Files:**
- Modify: `packages/inference/src/model-manager.ts:142-160`

- [ ] **Step 1: Add `getByType()` method**

Add after `getLoaded()` (line 144) in `packages/inference/src/model-manager.ts`:

```typescript
/**
 * Get the loaded model for a specific type (node-llama-cpp models only).
 * STT/TTS models run in the Python voice service and are never tracked here.
 * @param type - "llm" or "embedding"
 * @returns The loaded model of that type, or null
 */
getByType(type: "llm" | "embedding"): LoadedModel | null {
  for (const entry of this._models.values()) {
    if (entry.info.modelInfo.type === type) {
      return entry.info;
    }
  }
  return null;
}
```

- [ ] **Step 2: Add `getLoadedByType()` method**

Add after `getByType()`:

```typescript
/**
 * Get all loaded node-llama-cpp models grouped by type.
 * Used by the Settings UI to display all slots.
 */
getLoadedByType(): { llm: LoadedModel | null; embedding: LoadedModel | null } {
  return {
    llm: this.getByType("llm"),
    embedding: this.getByType("embedding"),
  };
}
```

- [ ] **Step 3: Simplify `getActive()` to use `getByType()`**

Replace the existing `getActive()` method (lines 151-160) with:

```typescript
/**
 * Get the currently active LLM model.
 * Alias for getByType("llm") — maintained for backward compat with chat endpoint.
 */
getActive(): LoadedModel | null {
  return this.getByType("llm");
}
```

Note: The old fallback to "any loaded model" is removed. `getActive()` now strictly returns the LLM or null. This is correct because the chat completions endpoint should only use the LLM slot.

- [ ] **Step 4: Verify build**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types`
Expected: No type errors in `packages/inference/`

- [ ] **Step 5: Commit**

```bash
git add packages/inference/src/model-manager.ts
git commit -m "feat(inference): add getByType and getLoadedByType to ModelManager"
```

---

## Task 2: Update API Schemas

**Files:**
- Modify: `packages/api/src/schemas/models.ts:61-97`

- [ ] **Step 1: Update `LoadModelInput` schema**

Replace the existing `LoadModelInput` (lines 62-65) in `packages/api/src/schemas/models.ts`:

```typescript
// ── Load Model Input ───────────────────────────────────────────────────────
export const LoadModelInput = z.object({
  id: z.string().min(1),
  type: z.enum(["llm", "embedding", "stt", "tts"]),
});
export type LoadModelInput = z.infer<typeof LoadModelInput>;
```

- [ ] **Step 2: Update `UnloadModelInput` schema**

Replace the existing `UnloadModelInput` (lines 68-71):

```typescript
// ── Unload Model Input ─────────────────────────────────────────────────────
export const UnloadModelInput = z.object({
  type: z.enum(["llm", "embedding", "stt", "tts"]),
});
export type UnloadModelInput = z.infer<typeof UnloadModelInput>;
```

- [ ] **Step 3: Add `LoadedModelsOutput` schema**

Add after `LoadedModelOutput` (after line 97):

```typescript
// ── Loaded Models Output (all slots) ──────────────────────────────────────
export const VoiceModelInfo = z.object({
  modelId: z.string(),
  modelName: z.string(),
}).nullable();

export const LoadedModelsOutput = z.object({
  llm: LoadedModelOutput.nullable(),
  embedding: LoadedModelOutput.nullable(),
  stt: VoiceModelInfo,
  tts: VoiceModelInfo,
  voiceServiceStatus: z.enum(["running", "stopped", "unavailable"]),
});
export type LoadedModelsOutput = z.infer<typeof LoadedModelsOutput>;
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types`
Expected: Type errors in `model.router.ts` (expected — we'll fix those in Task 3)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/schemas/models.ts
git commit -m "feat(api): update load/unload schemas for multi-model support"
```

---

## Task 3: Rewrite Model Router — loadModel, unloadModel, getLoadedModels

**Files:**
- Modify: `packages/api/src/routers/model.router.ts:153-232`

This is the largest task. We rewrite 3 procedures and add settings persistence.

- [ ] **Step 1: Add settings persistence helpers at the top of the file**

Add these imports and helpers near the top of `packages/api/src/routers/model.router.ts` (after existing imports):

```typescript
import { settings } from "@vxllm/db/schema/settings";

// Settings keys for persisted model slots
const SETTINGS_KEYS = {
  llm: "loaded_llm_id",
  embedding: "loaded_embedding_id",
  stt: "loaded_stt_id",
  tts: "loaded_tts_id",
} as const;

type ModelType = "llm" | "embedding" | "stt" | "tts";

/** Persist a loaded model ID to the settings table. */
async function persistModelSetting(
  db: any,
  type: ModelType,
  modelId: string,
): Promise<void> {
  const key = SETTINGS_KEYS[type];
  const now = Date.now();
  await db
    .insert(settings)
    .values({ key, value: modelId, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: modelId, updatedAt: now } });
}

/** Clear a loaded model setting by deleting the row. */
async function clearModelSetting(db: any, type: ModelType): Promise<void> {
  const key = SETTINGS_KEYS[type];
  await db.delete(settings).where(eq(settings.key, key));
}

/** Read a model setting. Returns the model DB ID or null. */
async function readModelSetting(db: any, type: ModelType): Promise<string | null> {
  const key = SETTINGS_KEYS[type];
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? null;
}
```

- [ ] **Step 2: Add voice service helper**

Add a helper to proxy requests to the voice service:

```typescript
import { env } from "@vxllm/env/server";

/** Send a request to the Python voice service. Returns null on failure. */
async function voiceServiceRequest(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<any | null> {
  try {
    const url = `${env.VOICE_URL}${path}`;
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Rewrite `loadModel` mutation**

Replace the existing `loadModel` procedure (lines 153-210):

```typescript
  // Mutation: load a model by ID and type — unified for all model types
  loadModel: publicProcedure
    .input(LoadModelInput)
    .handler(async ({ input, context }) => {
      if (!context.modelManager) {
        throw new Error("ModelManager not available");
      }

      // Get model from DB
      const [row] = await context.db
        .select()
        .from(models)
        .where(eq(models.id, input.id))
        .limit(1);

      if (!row) {
        throw new Error(`Model not found: ${input.id}`);
      }

      if (row.status !== "downloaded") {
        throw new Error(
          `Model "${row.displayName}" is not downloaded. Download it first.`,
        );
      }

      if (!row.localPath) {
        throw new Error(
          `Model "${row.displayName}" has no local path. Re-download it.`,
        );
      }

      if (input.type === "stt" || input.type === "tts") {
        // ── Voice model: proxy to Python voice service ──
        const result = await voiceServiceRequest("/models/load", "POST", {
          type: input.type,
          model_path: row.localPath,
        });
        if (!result) {
          throw new Error("Voice service is unavailable. Start the voice service first.");
        }
        await persistModelSetting(context.db, input.type, input.id);
        return { success: true, modelId: input.id, type: input.type };
      }

      // ── LLM/Embedding: use ModelManager ──
      // Auto-unload existing model of the same type
      const existing = context.modelManager.getByType(input.type as "llm" | "embedding");
      if (existing) {
        await context.modelManager.unload(existing.sessionId);
      }

      // Convert DB row to ModelInfo
      const modelInfo: ModelInfo = {
        name: row.name,
        displayName: row.displayName,
        description: row.description ?? null,
        type: row.type as ModelInfo["type"],
        format: (row.format ?? "gguf") as ModelInfo["format"],
        variant: row.variant ?? null,
        repo: row.repo ?? null,
        fileName: row.fileName ?? null,
        downloadMethod: row.format === "gguf" ? "file" : "repo",
        localPath: row.localPath,
        sizeBytes: row.sizeBytes ?? 0,
        minRamGb: row.minRamGb ?? null,
        recommendedVramGb: row.recommendedVramGb ?? null,
        status: row.status as ModelInfo["status"],
      };

      const loadedModel = await context.modelManager.load(modelInfo);
      await persistModelSetting(context.db, input.type, input.id);
      return loadedModel;
    }),
```

- [ ] **Step 4: Rewrite `unloadModel` mutation**

Replace the existing `unloadModel` procedure (lines 212-222):

```typescript
  // Mutation: unload a model by type — unified for all model types
  unloadModel: publicProcedure
    .input(UnloadModelInput)
    .handler(async ({ input, context }) => {
      if (!context.modelManager) {
        throw new Error("ModelManager not available");
      }

      if (input.type === "stt" || input.type === "tts") {
        // ── Voice model: proxy to Python voice service ──
        await voiceServiceRequest("/models/unload", "POST", {
          type: input.type,
        });
        await clearModelSetting(context.db, input.type);
        return { success: true };
      }

      // ── LLM/Embedding: use ModelManager ──
      const loaded = context.modelManager.getByType(input.type as "llm" | "embedding");
      if (!loaded) {
        throw new Error(`No ${input.type} model is currently loaded`);
      }

      await context.modelManager.unload(loaded.sessionId);
      await clearModelSetting(context.db, input.type);
      return { success: true };
    }),
```

- [ ] **Step 5: Replace `getActiveModel` with `getLoadedModels`**

Replace the existing `getActiveModel` procedure (lines 224-231):

```typescript
  // Query: get all loaded models grouped by type
  getLoadedModels: publicProcedure.handler(async ({ context }) => {
    const mm = context.modelManager;
    const llamaModels = mm ? mm.getLoadedByType() : { llm: null, embedding: null };

    // Query voice service for STT/TTS status (with timeout + cache)
    let stt: { modelId: string; modelName: string } | null = null;
    let tts: { modelId: string; modelName: string } | null = null;
    let voiceServiceStatus: "running" | "stopped" | "unavailable" = "unavailable";

    const voiceHealth = await voiceServiceRequest("/health");
    if (voiceHealth) {
      voiceServiceStatus = "running";
      const modelsStatus = await voiceServiceRequest("/models/status");
      if (modelsStatus) {
        if (modelsStatus.stt?.loaded) {
          // Read the persisted model ID from settings to include in the response
          const sttId = await readModelSetting(context.db, "stt");
          stt = {
            modelId: sttId ?? "",
            modelName: modelsStatus.stt.model_name ?? "Unknown STT",
          };
        }
        if (modelsStatus.tts?.loaded) {
          const ttsId = await readModelSetting(context.db, "tts");
          tts = {
            modelId: ttsId ?? "",
            modelName: modelsStatus.tts.model_name ?? "Unknown TTS",
          };
        }
      }
    }

    return {
      llm: llamaModels.llm,
      embedding: llamaModels.embedding,
      stt,
      tts,
      voiceServiceStatus,
    };
  }),

  // Backward compat: getActiveModel still works for callers that only need the LLM
  getActiveModel: publicProcedure.handler(async ({ context }) => {
    if (!context.modelManager) return null;
    return context.modelManager.getActive();
  }),
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types`
Expected: No errors in `packages/api/` and `apps/server/`

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/routers/model.router.ts
git commit -m "feat(api): rewrite loadModel/unloadModel for multi-model with settings persistence"
```

---

## Task 4: Server Startup — Settings-Based Auto-Load

**Files:**
- Modify: `apps/server/src/index.ts:166-182`

- [ ] **Step 1: Replace DEFAULT_MODEL auto-load with settings-based auto-load**

Replace the `DEFAULT_MODEL` block (lines 166-182) in `apps/server/src/index.ts`:

```typescript
    // ── Auto-load persisted models from settings ─────────────────────────
    const { settings: settingsTable } = await import("@vxllm/db/schema/settings");
    const { models: modelsTable } = await import("@vxllm/db/schema/models");

    const LOAD_KEYS = [
      { key: "loaded_llm_id", type: "llm" as const },
      { key: "loaded_embedding_id", type: "embedding" as const },
      { key: "loaded_stt_id", type: "stt" as const },
      { key: "loaded_tts_id", type: "tts" as const },
    ];

    let hasPersistedModels = false;

    for (const { key, type } of LOAD_KEYS) {
      const [setting] = await db
        .select()
        .from(settingsTable)
        .where(eq(settingsTable.key, key))
        .limit(1);

      if (!setting) continue;
      hasPersistedModels = true;

      const modelId = setting.value;
      const [model] = await db
        .select()
        .from(modelsTable)
        .where(eq(modelsTable.id, modelId))
        .limit(1);

      if (!model || model.status !== "downloaded" || !model.localPath) {
        console.warn(`[startup] Persisted ${type} model "${modelId}" no longer valid — clearing setting`);
        await db.delete(settingsTable).where(eq(settingsTable.key, key));
        continue;
      }

      if (type === "stt" || type === "tts") {
        // Voice models: proxy to voice service (only if running)
        try {
          const healthRes = await fetch(`${env.VOICE_URL}/health`, {
            signal: AbortSignal.timeout(2000),
          });
          if (healthRes.ok) {
            const loadRes = await fetch(`${env.VOICE_URL}/models/load`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type, model_path: model.localPath }),
              signal: AbortSignal.timeout(10000),
            });
            if (loadRes.ok) {
              console.log(`[startup] Auto-loaded ${type}: ${model.displayName}`);
            } else {
              console.warn(`[startup] Failed to auto-load ${type} model "${model.displayName}" via voice service`);
            }
          } else {
            console.log(`[startup] Voice service not running — skipping ${type} auto-load`);
          }
        } catch {
          console.log(`[startup] Voice service unavailable — skipping ${type} auto-load`);
        }
      } else {
        // LLM/Embedding: load via ModelManager
        try {
          const modelInfo: ModelInfo = {
            name: model.name,
            displayName: model.displayName,
            description: model.description ?? null,
            type: model.type as ModelInfo["type"],
            format: (model.format ?? "gguf") as ModelInfo["format"],
            variant: model.variant ?? null,
            repo: model.repo ?? null,
            fileName: model.fileName ?? null,
            downloadMethod: model.format === "gguf" ? "file" : "repo",
            localPath: model.localPath,
            sizeBytes: model.sizeBytes ?? 0,
            minRamGb: model.minRamGb ?? null,
            recommendedVramGb: model.recommendedVramGb ?? null,
            status: model.status as ModelInfo["status"],
          };
          const loaded = await modelManager.load(modelInfo);
          console.log(`[startup] Auto-loaded ${type}: ${loaded.modelInfo.displayName} (session: ${loaded.sessionId})`);
        } catch (err) {
          console.warn(`[startup] Failed to auto-load ${type} model "${model.displayName}":`, err);
          await db.delete(settingsTable).where(eq(settingsTable.key, key));
        }
      }
    }

    // Fallback: if no persisted models exist and DEFAULT_MODEL is set, use it for first boot
    if (!hasPersistedModels && env.DEFAULT_MODEL) {
      console.log(`[startup] No persisted models — falling back to DEFAULT_MODEL: ${env.DEFAULT_MODEL}`);
      const modelInfo = await registry.resolve(env.DEFAULT_MODEL);
      if (modelInfo?.localPath) {
        try {
          const loaded = await modelManager.load(modelInfo);
          console.log(`[startup] Model loaded: ${loaded.modelInfo.name} (session: ${loaded.sessionId})`);
          // Persist so next boot uses settings
          const now = Date.now();
          await db
            .insert(settingsTable)
            .values({ key: "loaded_llm_id", value: loaded.modelInfo.name, updatedAt: now })
            .onConflictDoUpdate({ target: settingsTable.key, set: { value: loaded.modelInfo.name, updatedAt: now } });
        } catch (err) {
          console.warn(`[startup] Failed to load DEFAULT_MODEL:`, err);
        }
      }
    }
```

You'll need to add these imports at the top of `apps/server/src/index.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "@vxllm/db";
import { settings } from "@vxllm/db/schema/settings";
import { models } from "@vxllm/db/schema/models";
import type { ModelInfo } from "@vxllm/inference";
```

The `db` instance is exported from `@vxllm/db` (the same one used by `createContext` in `packages/api/src/context.ts`). The `settings` and `models` tables are needed for the auto-load queries.

- [ ] **Step 2: Verify build**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): settings-based auto-load on startup with DEFAULT_MODEL fallback"
```

---

## Task 5: Voice Service — Dynamic Model Load/Unload Endpoints

**Files:**
- Modify: `apps/voice/app/engines/stt.py:36-103`
- Modify: `apps/voice/app/engines/tts.py:42-88`
- Create: `apps/voice/app/routes/models.py`
- Modify: `apps/voice/app/main.py:69-73`

- [ ] **Step 1: Add `unload()` method and `model_path` param to STTEngine**

In `apps/voice/app/engines/stt.py`, modify the `load()` method to accept an optional `model_path` parameter, and add an `unload()` method:

Replace the `load` method signature (line 36) with:

```python
async def load(self, model_path: str | None = None) -> None:
```

Inside `load()`, add at the beginning (after `if self._loaded: return`):

```python
        # If a specific path is provided, use it directly
        if model_path is not None:
            from faster_whisper import WhisperModel
            from pathlib import Path

            # If path points to a directory with model.bin, use it
            p = Path(model_path)
            if p.is_dir() and (p / "model.bin").exists():
                logger.info("Loading STT model from path: %s", model_path)
                self._model = WhisperModel(
                    str(p), device="cpu", compute_type="int8",
                )
            else:
                logger.info("Loading STT model: %s", model_path)
                self._model = WhisperModel(
                    model_path, device="cpu", compute_type="int8",
                )
            self._model_name = p.name if p.is_dir() else model_path
            self._loaded = True
            logger.info("STT model '%s' loaded successfully.", self._model_name)
            return
```

Add the `unload()` method after `load()`:

```python
async def unload(self) -> None:
    """Unload the current STT model and free resources."""
    if not self._loaded:
        return
    self._model = None
    self._loaded = False
    logger.info("STT model '%s' unloaded.", self._model_name)
```

- [ ] **Step 2: Add `unload()` method and `model_path` param to TTSEngine**

In `apps/voice/app/engines/tts.py`, change the `load` method signature (line 42) to:

```python
def load(self, lang_code: str = "a", model_path: str | None = None) -> None:
```

Inside `load()`, add after `if self._loaded: return` (line 51), before the try block:

```python
        # If a specific model path is provided, use it directly
        if model_path is not None:
            try:
                from kokoro import KPipeline
                logger.info("Loading TTS model from path: %s", model_path)
                self.pipeline = KPipeline(lang_code=lang_code, model=model_path)
                self._loaded = True
                self._backend = "kokoro"
                logger.info("Kokoro TTS loaded from %s", model_path)
            except Exception as e:
                logger.warning(f"Failed to load Kokoro from {model_path}: {e}. Using placeholder.")
                self._loaded = True
                self._backend = "placeholder"
            return
```

Add the `unload()` method after `load()`:

```python
def unload(self) -> None:
    """Unload the current TTS model and free resources."""
    if not self._loaded:
        return
    self.pipeline = None
    self._loaded = False
    self._backend = "none"
    logger.info("TTS model unloaded.")
```

- [ ] **Step 3: Create the models route file**

Create `apps/voice/app/routes/models.py`:

```python
"""Model management routes for dynamic load/unload."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.engines.stt import stt_engine
from app.engines.tts import tts_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/models", tags=["models"])


class LoadModelRequest(BaseModel):
    type: str  # "stt" or "tts"
    model_path: str


class UnloadModelRequest(BaseModel):
    type: str  # "stt" or "tts"


@router.post("/load")
async def load_model(req: LoadModelRequest) -> dict:
    """Load a model by type. Unloads existing model of same type first."""
    if req.type == "stt":
        if stt_engine.is_loaded:
            await stt_engine.unload()
        await stt_engine.load(model_path=req.model_path)
        return {"success": True, "type": "stt", "model_name": stt_engine.model_name}
    elif req.type == "tts":
        if tts_engine.is_loaded():
            tts_engine.unload()
        tts_engine.load(model_path=req.model_path)
        return {"success": True, "type": "tts", "backend": tts_engine.get_backend()}
    else:
        return {"success": False, "error": f"Unknown type: {req.type}"}


@router.post("/unload")
async def unload_model(req: UnloadModelRequest) -> dict:
    """Unload a model by type."""
    if req.type == "stt":
        await stt_engine.unload()
        return {"success": True, "type": "stt"}
    elif req.type == "tts":
        tts_engine.unload()
        return {"success": True, "type": "tts"}
    else:
        return {"success": False, "error": f"Unknown type: {req.type}"}


@router.get("/status")
async def models_status() -> dict:
    """Return the load status of STT and TTS models."""
    return {
        "stt": {
            "loaded": stt_engine.is_loaded,
            "model_name": stt_engine.model_name if stt_engine.is_loaded else None,
        },
        "tts": {
            "loaded": tts_engine.is_loaded(),
            "model_name": tts_engine.get_backend() if tts_engine.is_loaded() else None,
        },
    }
```

- [ ] **Step 4: Register the models routes in main.py**

In `apps/voice/app/main.py`, add the import and route registration. After the existing route imports (around line 69), add:

```python
from app.routes.models import router as models_router
```

And register it alongside existing routes:

```python
app.include_router(models_router)
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice/app/engines/stt.py apps/voice/app/engines/tts.py apps/voice/app/routes/models.py apps/voice/app/main.py
git commit -m "feat(voice): add dynamic model load/unload endpoints"
```

---

## Task 6: Frontend — `useLoadedModels` Hook

**Files:**
- Create: `apps/app/src/hooks/use-loaded-models.ts`
- Delete: `apps/app/src/hooks/use-active-model.ts`

- [ ] **Step 1: Create the new hook**

Create `apps/app/src/hooks/use-loaded-models.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

type ModelType = "llm" | "embedding" | "stt" | "tts";

export function useLoadedModels() {
  const queryClient = useQueryClient();

  const loadedModelsQuery = useQuery({
    ...orpc.models.getLoadedModels.queryOptions({}),
    refetchInterval: 5000,
  });

  const loadModelMutation = useMutation(
    orpc.models.loadModel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.models.getLoadedModels.queryOptions({}).queryKey,
        });
        toast.success("Model loaded");
      },
      onError: (error) => {
        toast.error(`Failed to load model: ${error.message}`);
      },
    }),
  );

  const unloadModelMutation = useMutation(
    orpc.models.unloadModel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.models.getLoadedModels.queryOptions({}).queryKey,
        });
        toast.success("Model unloaded");
      },
      onError: (error) => {
        toast.error(`Failed to unload model: ${error.message}`);
      },
    }),
  );

  return {
    llm: loadedModelsQuery.data?.llm ?? null,
    embedding: loadedModelsQuery.data?.embedding ?? null,
    stt: loadedModelsQuery.data?.stt ?? null,
    tts: loadedModelsQuery.data?.tts ?? null,
    voiceServiceStatus: loadedModelsQuery.data?.voiceServiceStatus ?? "unavailable",
    isLoading: loadedModelsQuery.isLoading,
    loadModel: (id: string, type: ModelType) =>
      loadModelMutation.mutate({ id, type }),
    isLoadingModel: loadModelMutation.isPending,
    unloadModel: (type: ModelType) =>
      unloadModelMutation.mutate({ type }),
    isUnloading: unloadModelMutation.isPending,
  };
}
```

- [ ] **Step 2: Delete the old hook**

Delete `apps/app/src/hooks/use-active-model.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/app/src/hooks/use-loaded-models.ts
git rm apps/app/src/hooks/use-active-model.ts
git commit -m "feat(app): create useLoadedModels hook, delete useActiveModel"
```

---

## Task 7: Frontend — Settings Page with Loaded Models Tab

**Files:**
- Create: `apps/app/src/components/settings/loaded-models.tsx`
- Create: `apps/app/src/components/settings/model-slot.tsx`
- Modify: `apps/app/src/routes/settings/index.tsx`

- [ ] **Step 1: Create ModelSlot component**

Create `apps/app/src/components/settings/model-slot.tsx`:

```typescript
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vxllm/ui/components/select";
import { CircleIcon, Loader2 } from "lucide-react";
import { useState } from "react";

interface ModelSlotProps {
  type: "llm" | "embedding" | "stt" | "tts";
  label: string;
  loaded: {
    name: string;
    variant?: string | null;
    sizeBytes?: number;
    contextSize?: number;
  } | null;
  downloadedModels: Array<{ id: string; displayName: string; variant: string | null; sizeBytes: number | null }>;
  onLoad: (modelId: string) => void;
  onUnload: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  accentColor: string; // "green" or "blue"
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function ModelSlot({
  type,
  label,
  loaded,
  downloadedModels,
  onLoad,
  onUnload,
  isLoading,
  disabled,
  accentColor,
}: ModelSlotProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const isGreen = accentColor === "green";
  const dotColor = loaded
    ? isGreen ? "fill-[#2EFAA0] text-[#2EFAA0]" : "fill-blue-500 text-blue-500"
    : "fill-muted-foreground/30 text-muted-foreground/30";
  const borderClass = loaded
    ? isGreen ? "border-[#2EFAA0]/40" : "border-blue-500/40"
    : "border-dashed border-muted-foreground/20";

  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${borderClass}`}>
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : (
          <CircleIcon className={`size-2.5 ${dotColor}`} />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {loaded && (
              <>
                <span className="text-sm font-medium">{loaded.name}</span>
                {loaded.variant && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {loaded.variant}
                  </Badge>
                )}
              </>
            )}
          </div>
          {loaded ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {loaded.sizeBytes ? formatSize(loaded.sizeBytes) : ""}
              {loaded.contextSize ? ` · ${loaded.contextSize} ctx` : ""}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Not loaded</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {loaded ? (
          <>
            <Select
              open={selectOpen}
              onOpenChange={setSelectOpen}
              onValueChange={(id) => {
                onLoad(id);
                setSelectOpen(false);
              }}
            >
              <SelectTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={disabled || isLoading}
                >
                  Change
                </Button>
              </SelectTrigger>
              <SelectContent>
                {downloadedModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName}
                    {m.variant ? ` (${m.variant})` : ""}
                  </SelectItem>
                ))}
                {downloadedModels.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No downloaded models
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive"
              onClick={onUnload}
              disabled={disabled || isLoading}
            >
              Unload
            </Button>
          </>
        ) : (
          <Select
            open={selectOpen}
            onOpenChange={setSelectOpen}
            onValueChange={(id) => {
              onLoad(id);
              setSelectOpen(false);
            }}
          >
            <SelectTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-dashed text-xs"
                disabled={disabled || isLoading}
              >
                + Load Model
              </Button>
            </SelectTrigger>
            <SelectContent>
              {downloadedModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.displayName}
                  {m.variant ? ` (${m.variant})` : ""}
                </SelectItem>
              ))}
              {downloadedModels.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No downloaded models of this type
                </div>
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create LoadedModels component**

Create `apps/app/src/components/settings/loaded-models.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@vxllm/ui/components/badge";
import { CircleIcon } from "lucide-react";

import { ModelSlot } from "@/components/settings/model-slot";
import { useLoadedModels } from "@/hooks/use-loaded-models";
import { orpc } from "@/utils/orpc";

export function LoadedModels() {
  const {
    llm,
    embedding,
    stt,
    tts,
    voiceServiceStatus,
    loadModel,
    isLoadingModel,
    unloadModel,
    isUnloading,
  } = useLoadedModels();

  // Fetch downloaded models for each type
  const llmModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "llm" } }),
  );
  const embeddingModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "embedding" } }),
  );
  const sttModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "stt" } }),
  );
  const ttsModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "tts" } }),
  );

  const isActing = isLoadingModel || isUnloading;

  return (
    <div className="space-y-6 py-4">
      {/* Language Models Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#2EFAA0]">
            Language Models
          </span>
        </div>
        <ModelSlot
          type="llm"
          label="LLM"
          loaded={llm ? {
            name: llm.modelInfo.displayName,
            variant: llm.modelInfo.variant,
            sizeBytes: llm.memoryUsageBytes,
            contextSize: llm.contextSize,
          } : null}
          downloadedModels={(llmModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "llm")}
          onUnload={() => unloadModel("llm")}
          isLoading={isActing}
          accentColor="green"
        />
        <ModelSlot
          type="embedding"
          label="Embedding"
          loaded={embedding ? {
            name: embedding.modelInfo.displayName,
            variant: embedding.modelInfo.variant,
            sizeBytes: embedding.memoryUsageBytes,
          } : null}
          downloadedModels={(embeddingModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "embedding")}
          onUnload={() => unloadModel("embedding")}
          isLoading={isActing}
          accentColor="green"
        />
      </div>

      {/* Voice Models Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">
            Voice Models
          </span>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <CircleIcon
              className={`size-1.5 ${
                voiceServiceStatus === "running"
                  ? "fill-green-500 text-green-500"
                  : voiceServiceStatus === "stopped"
                    ? "fill-red-500 text-red-500"
                    : "fill-muted-foreground text-muted-foreground"
              }`}
            />
            {voiceServiceStatus === "running"
              ? "Running"
              : voiceServiceStatus === "stopped"
                ? "Stopped"
                : "Unavailable"}
          </Badge>
        </div>
        <ModelSlot
          type="stt"
          label="STT"
          loaded={stt ? { name: stt.modelName } : null}
          downloadedModels={(sttModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "stt")}
          onUnload={() => unloadModel("stt")}
          isLoading={isActing}
          disabled={voiceServiceStatus !== "running"}
          accentColor="blue"
        />
        <ModelSlot
          type="tts"
          label="TTS"
          loaded={tts ? { name: tts.modelName } : null}
          downloadedModels={(ttsModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "tts")}
          onUnload={() => unloadModel("tts")}
          isLoading={isActing}
          disabled={voiceServiceStatus !== "running"}
          accentColor="blue"
        />
        {voiceServiceStatus !== "running" && (
          <p className="text-xs text-muted-foreground">
            Voice service is not running. Start it to manage STT/TTS models.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add Models tab to Settings page**

In `apps/app/src/routes/settings/index.tsx`, add the import:

```typescript
import { LoadedModels } from "@/components/settings/loaded-models";
```

Change the `Tabs` `defaultValue` from `"server"` to `"models"`, and add the Models tab before the Server tab:

```typescript
<Tabs defaultValue="models">
  <TabsList>
    <TabsTrigger value="models">Models</TabsTrigger>
    <TabsTrigger value="server">Server</TabsTrigger>
    <TabsTrigger value="api-keys">API Keys</TabsTrigger>
    <TabsTrigger value="hardware">Hardware</TabsTrigger>
  </TabsList>
  <TabsContent value="models">
    <LoadedModels />
  </TabsContent>
  <TabsContent value="server">
    <ServerConfigForm />
  </TabsContent>
  {/* ... rest unchanged */}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types`
Expected: Errors in chat components (still using old `useActiveModel`) — fixed in next task

- [ ] **Step 5: Commit**

```bash
git add apps/app/src/components/settings/loaded-models.tsx apps/app/src/components/settings/model-slot.tsx apps/app/src/routes/settings/index.tsx
git commit -m "feat(app): add Models tab to Settings with loaded-models UI"
```

---

## Task 8: Frontend — Update Chat UI (Remove ModelSelector, Add Badge)

**Files:**
- Modify: `apps/app/src/components/chat/chat-header.tsx`
- Modify: `apps/app/src/components/chat/chat-empty-state.tsx`
- Modify: `apps/app/src/components/chat/chat-input.tsx`
- Modify: `apps/app/src/components/chat/chat-sidebar.tsx`
- Delete: `apps/app/src/components/chat/model-selector.tsx`

- [ ] **Step 1: Rewrite `chat-header.tsx`**

Replace the full content of `apps/app/src/components/chat/chat-header.tsx`:

```typescript
import { Link } from "@tanstack/react-router";
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import { CircleIcon, MenuIcon, SettingsIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";

import { SystemPromptEditor } from "@/components/chat/system-prompt-editor";
import { VoiceToggle } from "@/components/chat/voice-toggle";
import { useLoadedModels } from "@/hooks/use-loaded-models";
import { useChatLayout } from "@/routes/chat/route";

export function ChatHeader({
  conversationId,
  title,
  voiceOutput,
  onVoiceOutputChange,
}: {
  conversationId: string;
  title?: string | null;
  voiceOutput?: boolean;
  onVoiceOutputChange?: (enabled: boolean) => void;
}) {
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const { isMobile, openMobileSidebar } = useChatLayout();
  const { llm } = useLoadedModels();

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openMobileSidebar}
          >
            <MenuIcon className="size-4" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {title || "New conversation"}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Read-only model badge */}
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <CircleIcon
            className={`size-2 ${llm ? "fill-[#2EFAA0] text-[#2EFAA0]" : "fill-muted-foreground/30 text-muted-foreground/30"}`}
          />
          {llm ? `${llm.modelInfo.displayName}${llm.modelInfo.variant ? ` · ${llm.modelInfo.variant}` : ""}` : "No model"}
        </Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link to="/settings" />}
        >
          <SlidersHorizontalIcon className="size-4" />
          <span className="sr-only">Model settings</span>
        </Button>

        {onVoiceOutputChange && (
          <VoiceToggle
            enabled={voiceOutput ?? false}
            onToggle={onVoiceOutputChange}
          />
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSystemPromptOpen(true)}
        >
          <SettingsIcon className="size-4" />
          <span className="sr-only">System prompt</span>
        </Button>
        <SystemPromptEditor
          open={systemPromptOpen}
          onOpenChange={setSystemPromptOpen}
          conversationId={conversationId}
        />
      </div>
    </div>
  );
}
```

Note: removed `selectedModelId` and `onModelChange` props since there's no model selector.

- [ ] **Step 2: Rewrite `chat-empty-state.tsx`**

Replace the full content of `apps/app/src/components/chat/chat-empty-state.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@vxllm/ui/components/button";
import { Card, CardContent } from "@vxllm/ui/components/card";
import { Textarea } from "@vxllm/ui/components/textarea";
import { ArrowUp, DownloadIcon, MenuIcon, SlidersHorizontalIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useLoadedModels } from "@/hooks/use-loaded-models";
import { useChatLayout } from "@/routes/chat/route";
import { orpc } from "@/utils/orpc";

const EXAMPLE_PROMPTS = [
  {
    title: "Explain quantum computing",
    prompt: "Explain quantum computing in simple terms",
  },
  {
    title: "Python sort function",
    prompt: "Write a Python function to sort a list",
  },
  {
    title: "Debug React component",
    prompt: "Help me debug this React component",
  },
  {
    title: "REST API best practices",
    prompt: "What are best practices for REST API design?",
  },
] as const;

export function ChatEmptyState() {
  const navigate = useNavigate();
  const { isMobile, openMobileSidebar } = useChatLayout();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const downloadedModelsQuery = useQuery(
    orpc.models.list.queryOptions({
      input: { status: "downloaded" },
    }),
  );

  const { llm } = useLoadedModels();

  const downloadedModels = downloadedModelsQuery.data ?? [];
  const hasDownloadedModels = downloadedModels.length > 0;
  const hasActiveModel = llm !== null;

  const handleSend = (text: string) => {
    if (!text.trim() || !hasActiveModel) return;
    navigate({
      to: "/chat",
      search: { prompt: text.trim() },
    });
  };

  const handlePromptClick = (prompt: string) => {
    if (!hasActiveModel) return;
    navigate({
      to: "/chat",
      search: { prompt },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 p-8">
      {isMobile && (
        <div className="absolute top-2 left-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openMobileSidebar}
          >
            <MenuIcon className="size-4" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </div>
      )}

      {/* No models downloaded -- show download CTA */}
      {!hasDownloadedModels && !downloadedModelsQuery.isLoading ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-muted">
            <DownloadIcon className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Download a model to get started
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              VxLLM runs AI models locally on your machine. Download your first
              model to start chatting.
            </p>
          </div>
          <Button size="lg" render={<Link to="/models" />}>
            Browse Models
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <img src="/logo-no-bg.png" alt="VxLLM" className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Start a new conversation
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasActiveModel
                  ? "Choose a prompt below or type your own message to get started."
                  : "Load a model from Settings to start chatting."}
              </p>
            </div>

            {/* No model loaded — show Settings link */}
            {!hasActiveModel && (
              <Button variant="outline" render={<Link to="/settings" />}>
                <SlidersHorizontalIcon className="mr-2 size-4" />
                Go to Settings
              </Button>
            )}
          </div>

          {hasActiveModel && (
            <>
              <div className="grid w-full max-w-lg grid-cols-2 gap-3">
                {EXAMPLE_PROMPTS.map((item) => (
                  <Card
                    key={item.title}
                    size="sm"
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => handlePromptClick(item.prompt)}
                  >
                    <CardContent>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.prompt}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="w-full max-w-lg">
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="min-h-[44px] max-h-[120px] resize-none"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={() => handleSend(input)}
                    disabled={!input.trim()}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-center text-xs text-muted-foreground">
                  Cmd+Enter to send
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `chat-input.tsx`**

In `apps/app/src/components/chat/chat-input.tsx`, change line 9:

```typescript
// Old:
import { useActiveModel } from "@/hooks/use-active-model";

// New:
import { useLoadedModels } from "@/hooks/use-loaded-models";
```

And line 24:

```typescript
// Old:
const { activeModel, isLoadingModel } = useActiveModel();
const hasModel = activeModel !== null;
const isDisabled = !hasModel || isLoadingModel;

// New:
const { llm, isLoadingModel } = useLoadedModels();
const hasModel = llm !== null;
const isDisabled = !hasModel || isLoadingModel;
```

Also update the "Go to Models" link (lines 104-110) to go to Settings:

```typescript
<Link
  to="/settings"
  className="underline underline-offset-2 hover:text-foreground"
>
  Go to Settings
</Link>
```

- [ ] **Step 4: Update `chat-sidebar.tsx`**

In `apps/app/src/components/chat/chat-sidebar.tsx`, change line 23:

```typescript
// Old:
import { useActiveModel } from "@/hooks/use-active-model";

// New:
import { useLoadedModels } from "@/hooks/use-loaded-models";
```

And in the `ActiveModelBadge` function (line 171):

```typescript
// Old:
const { activeModel, isLoadingQuery } = useActiveModel();

// New:
const { llm, isLoading: isLoadingQuery } = useLoadedModels();
```

Update line 181 and 186:

```typescript
// Old:
if (activeModel) {
  ...
  {activeModel.modelInfo.displayName}

// New:
if (llm) {
  ...
  {llm.modelInfo.displayName}
```

- [ ] **Step 5: Update `$conversationId.tsx`**

In `apps/app/src/routes/chat/$conversationId.tsx`, remove the `selectedModelId` and `onModelChange` props from the `ChatHeader` usage (the component no longer accepts them):

Find in the file:

```typescript
<ChatHeader
  conversationId={conversationId}
  title={title}
  selectedModelId={selectedModelId}
  onModelChange={setSelectedModelId}
  voiceOutput={voiceOutput}
  onVoiceOutputChange={setVoiceOutput}
/>
```

Replace with:

```typescript
<ChatHeader
  conversationId={conversationId}
  title={title}
  voiceOutput={voiceOutput}
  onVoiceOutputChange={setVoiceOutput}
/>
```

Also remove the `selectedModelId` state and its setter (no longer needed):

Delete: `const [selectedModelId, setSelectedModelId] = useState<string | undefined>();`

- [ ] **Step 6: Delete `model-selector.tsx`**

Delete `apps/app/src/components/chat/model-selector.tsx`.

- [ ] **Step 7: Verify build**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add apps/app/src/components/chat/chat-header.tsx apps/app/src/components/chat/chat-empty-state.tsx apps/app/src/components/chat/chat-input.tsx apps/app/src/components/chat/chat-sidebar.tsx apps/app/src/routes/chat/\$conversationId.tsx
git rm apps/app/src/components/chat/model-selector.tsx
git commit -m "feat(app): replace model selector with read-only badge, link to Settings"
```

---

## Task 9: Full Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run check-types`
Expected: 0 errors

- [ ] **Step 2: Run build**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run build`
Expected: Build succeeds for all packages

- [ ] **Step 3: Start dev server and verify Settings page**

Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run dev:server &`
Run: `cd /Users/rahulretnan/Projects/DataHase/vxllm && bun run dev:app &`

Open `http://localhost:5173/settings` — verify:
- "Models" tab is the default active tab
- Language Models section shows LLM and Embedding slots
- Voice Models section shows STT and TTS slots with voice service status
- Clicking "+ Load" opens a dropdown listing downloaded models

Open `http://localhost:5173/chat` — verify:
- No ModelSelector dropdown in chat
- Read-only badge shows "No model" or loaded model name
- SlidersHorizontal icon links to /settings

- [ ] **Step 4: Commit any fixes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: address build/UI issues from multi-model integration"
```
