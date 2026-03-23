# Settings-Based Multi-Model Management

## Goal

Move model loading/unloading from the chat UI to the Settings page. Support loading one model per type (LLM, Embedding, STT, TTS) simultaneously. Persist loaded model configuration so models auto-load on server restart.

## Decisions

| Question | Decision |
|----------|----------|
| STT/TTS handling | Unified UI with visual separation — "Language Models" (LLM + Embedding) and "Voice Models" (STT + TTS) sections, reflecting the different backends |
| Models per type | One per type. Selecting a new model auto-unloads the previous one of that type |
| Chat UI model selector | Read-only badge showing active LLM name + gear icon linking to Settings |
| Settings layout | Sectioned vertical list (not grid) |
| Load/Change action | Inline dropdown listing downloaded models of matching type |
| Auto-load on restart | Persist loaded model IDs to settings table, auto-load on server startup |
| Backend approach | Type-keyed slots in existing ModelManager (not separate managers or generic pool) |

## Architecture

### Backend — ModelManager Changes

**File:** `packages/inference/src/model-manager.ts`

The `ModelManager` class already stores multiple loaded models in a `Map<sessionId, ModelEntry>`. Changes:

- **`getByType(type: "llm" | "embedding"): LoadedModel | null`** — Scans `_models` map, returns first entry where `modelInfo.type` matches. Primary lookup method going forward. Intentionally restricted to node-llama-cpp model types only — STT/TTS models run in the Python voice service and are never loaded into ModelManager.
- **`getActive()`** — Becomes an alias for `getByType("llm")`. Maintains backward compatibility for the chat completions endpoint.
- **`getLoadedByType(): Record<string, LoadedModel | null>`** — Returns `{ llm, embedding }` for all node-llama-cpp slots. Used by the Settings UI query.
- **No changes** to `load()`, `unload()`, `getLoaded()`, `getModelEntry()`, `countTokens()`, or `disposeAll()`. They already work with multiple models.

### Backend — Router Changes

**File:** `packages/api/src/routers/model.router.ts`

- **`loadModel` mutation** — Input gains `type: "llm" | "embedding" | "stt" | "tts"` field. This is the **single unified mutation** for all model types. Before loading:
  1. For LLM/Embedding: calls `modelManager.getByType(type)`. If a model of that type is already loaded, auto-unloads it first. Then loads the new model via `modelManager.load()`.
  2. For STT/TTS: sends a load request to the Python voice service (`POST {VOICE_URL}/models/load`). If a model of that type is already loaded, sends an unload first.
  3. Persists the model DB ID to the settings table (`loaded_llm_id`, `loaded_embedding_id`, `loaded_stt_id`, `loaded_tts_id`).

- **`unloadModel` mutation** — Input gains `type: "llm" | "embedding" | "stt" | "tts"` field. This is the **single unified mutation** for all unloads. The mutation branches internally:
  - For LLM/Embedding: looks up the loaded model via `modelManager.getByType(type)`, calls `modelManager.unload(sessionId)`.
  - For STT/TTS: sends `POST {VOICE_URL}/models/unload` with `{ type }`.
  - Clears the corresponding setting key by **deleting the row** from the settings table (since the `value` column has a `NOT NULL` constraint).

- **New `getLoadedModels` query** — Returns all loaded models grouped by type:
  ```typescript
  {
    llm: LoadedModel | null,
    embedding: LoadedModel | null,
    stt: { modelId: string, modelName: string } | null,
    tts: { modelId: string, modelName: string } | null,
    voiceServiceStatus: "running" | "stopped" | "unavailable"
  }
  ```
  For LLM/Embedding: reads from `ModelManager`. For STT/TTS: queries the voice service `GET /models/status` endpoint (with 2s timeout; cached for 5s to avoid hammering a down service). Voice service overall status comes from `VOICE_URL/health`.

### Backend — Voice Service Integration

**File:** `apps/voice/app/main.py` (Python FastAPI sidecar, entrypoint)

The voice service currently auto-loads STT/TTS/VAD engines on startup via its lifespan handler with hardcoded model paths. The engine classes (`stt_engine`, `tts_engine` singletons) need to be refactored to support dynamic `load(model_path)` and `unload()` methods instead of only loading in the lifespan.

New FastAPI route endpoints:

- **`POST /models/load`** — Body: `{ type: "stt" | "tts", model_path: string }`. Calls `engine.unload()` if already loaded, then `engine.load(model_path)`.
- **`POST /models/unload`** — Body: `{ type: "stt" | "tts" }`. Calls `engine.unload()` for the given type.
- **`GET /models/status`** — Returns `{ stt: { loaded: bool, model_name: string | null }, tts: { loaded: bool, model_name: string | null } }`.

The Hono server proxies these requests, similar to how it already proxies `/v1/audio/*`.

### Backend — Auto-Load on Startup

**File:** `apps/server/src/index.ts`

On server boot, after ModelManager initialization:

1. Read `loaded_llm_id`, `loaded_embedding_id`, `loaded_stt_id`, `loaded_tts_id` from the `settings` table.
2. For each non-null ID:
   - Look up the model in the `models` DB table.
   - Validate `status === "downloaded"` and `localPath` exists on disk.
   - Load: call `modelManager.load()` for LLM/Embedding, or voice service `/models/load` for STT/TTS.
3. If a model fails to load (file deleted, model removed from DB), clear that setting key and log a warning. Do not crash.
4. Load sequentially: LLM first, then Embedding, then STT, then TTS.
5. Voice models only attempt to load if `VOICE_URL` health check passes.

**`DEFAULT_MODEL` env var deprecation**: The existing `DEFAULT_MODEL` environment variable (used in `apps/server/src/index.ts` to auto-load a model via registry resolution on first boot) is superseded by the settings-table approach. On first boot (no settings rows exist), `DEFAULT_MODEL` is still honored as a fallback: resolve via registry, load, and persist to settings. On subsequent boots, settings take precedence. This gives a smooth first-run experience while the settings-based approach handles all future restarts.

### Backend — Settings Persistence

**Table:** Existing `settings` (key-value)

| Key | Value | Purpose |
|-----|-------|---------|
| `loaded_llm_id` | model DB id | Which LLM to auto-load on startup |
| `loaded_embedding_id` | model DB id | Which embedding model to auto-load |
| `loaded_stt_id` | model DB id | Which STT model to auto-load |
| `loaded_tts_id` | model DB id | Which TTS model to auto-load |

The `settings.value` column has a `NOT NULL` constraint. To "clear" a loaded model setting, **delete the row** rather than setting the value to null. On read, a missing row means no model configured for that type.

Written by `loadModel`/`unloadModel` mutations after each successful operation. Read by the startup auto-load sequence.

## Frontend

### Settings Page

**File:** `apps/app/src/routes/settings/index.tsx`

Currently uses a `<Tabs>` component with three tabs: Server, API Keys, and Hardware. Add a new "Models" tab as the **first tab** (default active):

- **Models** (new, first tab, default) — The `LoadedModels` component.
- **Server** (existing) — `ServerConfigForm`, unchanged.
- **API Keys** (existing) — `ApiKeysTable` + `CreateApiKeyDialog`, unchanged.
- **Hardware** (existing) — `HardwareInfo`, unchanged.

The existing tab structure is preserved. Models becomes the default tab since it's the most frequently used action.

### LoadedModels Component

**New file:** `apps/app/src/components/settings/loaded-models.tsx`

- Queries `getLoadedModels` with 5s polling interval.
- Renders two sections:
  - **"Language Models"** — Green (`#2EFAA0`) section header. LLM slot + Embedding slot.
  - **"Voice Models"** — Blue (`#3b82f6`) section header. STT slot + TTS slot. Shows voice service status indicator.
- Each slot is a `ModelSlot` component.

### ModelSlot Component

**New file:** `apps/app/src/components/settings/model-slot.tsx`

Props: `type`, `label`, `loadedModel | null`, `downloadedModels[]`, `onLoad(id)`, `onUnload(sessionId)`, `disabled?`.

Three visual states:

1. **Loaded** — Colored border (green for Language, blue for Voice). Colored dot. Model name, variant badge, size, context size (LLM only). "Change" button (opens inline Select) + "Unload" button (red text).
2. **Empty** — Dashed grey border. Grey dot. "Not loaded" text. "+ Load Model" button (opens inline Select).
3. **Loading** — Same as loaded/empty but dot replaced with spinner. Buttons disabled.

The inline `<Select>` dropdown lists downloaded models of the matching type, queried from `models.list({ status: "downloaded", type })`. Selecting a model triggers `loadModel({ id, type })`.

### Voice Models Section — Additional Behavior

- Voice service status indicator next to section header: green "Running" / red "Stopped" / grey "Not installed".
- If voice service is not running, STT/TTS slots show "Voice service not running" with disabled Load/Change controls.
- Status derived from the `voiceServiceStatus` field in the `getLoadedModels` response.

### Chat UI Changes

**Modified files:**
- `apps/app/src/components/chat/chat-empty-state.tsx`
- `apps/app/src/components/chat/chat-header.tsx`

Remove the `ModelSelector` dropdown from both components. Replace with:

- **Read-only badge**: Pill/badge showing the active LLM name (e.g., "Qwen3 4B · Q4_K_M") or "No model loaded".
- **Settings link icon**: Small `SlidersHorizontal` icon (not gear — the chat header already has a gear icon for `SystemPromptEditor`) next to the badge, navigates to `/settings`.
- **Empty state message**: When no LLM is loaded, show "No model loaded" with a "Go to Settings" link button instead of the inline model selector and example prompts.

### Hook Changes

**Modified file:** `apps/app/src/hooks/use-active-model.ts` → renamed to `use-loaded-models.ts`

All files that currently import from `use-active-model` must update their import paths: `chat-empty-state.tsx`, `chat-header.tsx`, and any others.

- `useLoadedModels()` hook returns:
  ```typescript
  {
    llm: LoadedModel | null,
    embedding: LoadedModel | null,
    stt: { modelId: string, modelName: string } | null,
    tts: { modelId: string, modelName: string } | null,
    voiceServiceStatus: "running" | "stopped" | "unavailable",
    isLoading: boolean,
    loadModel: (id: string, type: ModelType) => void,
    isLoadingModel: boolean,
    unloadModel: (type: ModelType) => void,
    isUnloading: boolean,
  }
  ```
- Chat components use `loadedModels.llm` to check if an LLM is available.

### Deleted Files

- `apps/app/src/components/chat/model-selector.tsx` — No longer needed. Replaced by read-only badge in chat and inline Select in Settings.

## Data Flow

### Load Model Flow

1. User clicks "+ Load" or "Change" on a model slot in Settings.
2. Inline Select dropdown appears with downloaded models of that type.
3. User selects a model.
4. Frontend calls `loadModel({ id, type })` mutation.
5. Router: if type is LLM/Embedding, checks `modelManager.getByType(type)` — unloads existing if present.
6. Router: calls `modelManager.load(modelInfo)` (LLM/Embedding) or voice service `/models/load` (STT/TTS).
7. Router: persists model ID to settings table (`loaded_{type}_id = id`).
8. Router: returns result to frontend.
9. Frontend: `getLoadedModels` query invalidates, UI updates to show loaded model.

### Unload Model Flow

1. User clicks "Unload" on a loaded model slot.
2. Frontend calls `unloadModel({ type })` — single unified mutation for all types.
3. Router: for LLM/Embedding, looks up loaded model via `modelManager.getByType(type)` and calls `modelManager.unload(sessionId)`. For STT/TTS, sends `POST {VOICE_URL}/models/unload`.
4. Router: deletes the `loaded_{type}_id` row from the settings table.
5. Frontend: `getLoadedModels` query invalidates, slot shows empty state.

### Server Startup Flow

1. Server boots, initializes ModelManager (`modelManager.initialize()`).
2. Reads `loaded_llm_id`, `loaded_embedding_id`, `loaded_stt_id`, `loaded_tts_id` from settings.
3. For each non-null ID: validates model exists in DB, status is "downloaded", localPath exists on disk.
4. Loads valid models sequentially: LLM → Embedding → STT → TTS.
5. If any model fails to load: clears that setting key, logs warning, continues with remaining models.
6. STT/TTS only attempted if `VOICE_URL` health check passes first.

## Error Handling

- **Model file deleted between sessions**: Auto-load skips it, clears the setting. Logs a warning. Does not crash or block other models from loading.
- **Voice service down**: STT/TTS slots show "Voice service unavailable" with disabled controls. LLM/Embedding operations are unaffected.
- **Load timeout**: Frontend shows loading spinner with no hard timeout. Large models (7B+) can take 30-60s on CPU. No artificial cutoff.
- **Concurrent load attempts**: Router mutations are not concurrent-safe by design (single-user local app). If needed later, add a mutex.
- **Model download deleted while loaded**: `unloadModel` handles gracefully (model is in memory, unload disposes it regardless of disk state).

## Testing

- **ModelManager**: Unit tests for `getByType()`, `getLoadedByType()` — verify type-based filtering and one-per-type enforcement when router calls unload-then-load.
- **Router**: Integration tests for `loadModel` with type, verify auto-unload of same type, verify settings persistence.
- **Settings UI**: Verify slot states (empty, loaded, loading), dropdown filtering by type, unload flow.
- **Auto-load**: Test startup with valid settings, with stale settings (deleted model), with missing voice service.
- **Chat UI**: Verify read-only badge shows LLM name, gear icon navigates to settings, empty state message when no LLM loaded.
