# Voice & Model Architecture Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify model management under the Bun server as single source of truth, refactor the Python voice service into a stateless executor, and add a VoiceProcessManager for lazy lifecycle control.

**Architecture:** Bun server owns all model downloads, DB, and lifecycle. Python voice service is spawned on-demand and loads models from paths it's told. A new `VoiceProcessManager` handles spawn/kill. The existing WebSocket voice-chat route is refactored to use a cleaner protocol.

**Tech Stack:** Bun, Hono, node-llama-cpp, oRPC, Drizzle/SQLite, Python/FastAPI, faster-whisper, Kokoro TTS, silero-vad

**Spec:** `docs/superpowers/specs/2026-03-22-voice-model-architecture-design.md`

---

## Task 1: Schema — Add `backend` column to models table

**Files:**
- Modify: `packages/db/src/schema/models.ts`
- Modify: `packages/inference/src/types.ts`
- Modify: `packages/api/src/schemas/models.ts`

- [ ] **Step 1: Add `backend` column to the models table**

In `packages/db/src/schema/models.ts`, add after the `format` column (line 21):

```ts
backend: text("backend", {
  enum: ["llama-cpp", "faster-whisper", "nemo", "kokoro", "whisper-cpp"],
}),
```

Also update the `format` enum to include `"nemo"`:

```ts
format: text("format", { enum: ["gguf", "whisper", "kokoro", "nemo"] }),
```

- [ ] **Step 2: Add `backend` to `ModelInfo` interface**

In `packages/inference/src/types.ts`, add to the `ModelInfo` interface after the `format` field (line 49):

```ts
/** Which inference backend loads this model */
backend: "llama-cpp" | "faster-whisper" | "nemo" | "kokoro" | "whisper-cpp" | null;
```

Also update the `format` type to include `"nemo"`:

```ts
format: "gguf" | "whisper" | "kokoro" | "nemo";
```

- [ ] **Step 3: Add `backend` to all Zod schemas**

In `packages/api/src/schemas/models.ts`:

Add `backend` to `ModelFilterInput` (line 8):
```ts
backend: z.enum(["llama-cpp", "faster-whisper", "nemo", "kokoro", "whisper-cpp"]).optional(),
```

Update `format` enums everywhere to include `"nemo"`:
```ts
z.enum(["gguf", "whisper", "kokoro", "nemo"])
```

Add `backend` to `ModelOutput` (after `format`, line 28):
```ts
backend: z.enum(["llama-cpp", "faster-whisper", "nemo", "kokoro", "whisper-cpp"]).nullable(),
```

Add `backend` to `LoadModelInput` (line 64):
```ts
backend: z.enum(["llama-cpp", "faster-whisper", "nemo", "kokoro", "whisper-cpp"]).optional(),
```

Add `backend` to `LoadedModelOutput.modelInfo` (after `format`, line 81):
```ts
backend: z.enum(["llama-cpp", "faster-whisper", "nemo", "kokoro", "whisper-cpp"]).nullable(),
```

- [ ] **Step 4: Update `ModelDownloadInput` format enum**

In `packages/api/src/schemas/models.ts`, update `ModelDownloadInput.format` to include `"nemo"`:
```ts
format: z.enum(["gguf", "whisper", "kokoro", "nemo"]).optional(),
```

- [ ] **Step 5: Update `RegistryModel` and `RegistryVariant` types in registry.ts**

In `packages/inference/src/registry.ts`, add `backend` to the `RegistryModel` and `RegistryVariant` interfaces:
```ts
// Add to RegistryModel:
backend?: string;

// Add to RegistryVariant:
backend?: string;
```

Update `toModelInfo()` to include:
```ts
backend: variant.backend ?? model.backend ?? null,
```

- [ ] **Step 6: Fix all `ModelInfo` construction sites**

Search for all places that construct a `ModelInfo` object and add `backend` field. Key `ModelInfo` construction sites:
- `packages/inference/src/registry.ts` → `toModelInfo()` — add `backend: variant.backend ?? model.backend ?? null`
- `packages/api/src/routers/model.router.ts` → `loadModel` handler (~line 279) — add `backend: (row.backend ?? null) as ModelInfo["backend"]`
- `apps/server/src/index.ts` → startup auto-load (~line 231, ~line 275) — add `backend: (model.backend ?? null) as ModelInfo["backend"]`

Also add `backend` to DB insert sites (not `ModelInfo` but same column):
- `packages/inference/src/download.ts` → `ensureDbEntries` — add `backend: null` to the `db.insert(models)` call
- `apps/server/src/routes/api/hf-download.ts` → `db.insert(models)` — add `backend` (auto-detected, see Task 5)

- [ ] **Step 5: Run DB migration**

```bash
bun run db:push
```

- [ ] **Step 6: Type check**

```bash
bunx tsc --noEmit -p packages/db/tsconfig.json
bunx tsc --noEmit -p packages/inference/tsconfig.json
bunx tsc --noEmit -p packages/api/tsconfig.json
bunx tsc --noEmit -p apps/server/tsconfig.json
bunx tsc --noEmit -p apps/app/tsconfig.json
```

Expected: all pass with no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db packages/inference packages/api apps/server apps/app
git commit -m "feat(db): add backend column to models table for engine dispatch"
```

---

## Task 2: Voice Process Manager

**Files:**
- Create: `apps/server/src/voice/voice-process-manager.ts`
- Modify: `packages/env/src/server.ts`

- [ ] **Step 1: Deprecate VOICE_URL in env config**

In `packages/env/src/server.ts`, `VOICE_PORT` already exists (line 13). Add a deprecation comment to `VOICE_URL` (line 12):

```ts
/** @deprecated Use VOICE_PORT instead. Bun constructs the URL from HOST + VOICE_PORT. */
VOICE_URL: z.string().url().default("http://localhost:11501"),
```

- [ ] **Step 2: Create VoiceProcessManager**

Create `apps/server/src/voice/voice-process-manager.ts`:

```ts
import path from "node:path";
import { env } from "@vxllm/env/server";
import type { Subprocess } from "bun";

export class VoiceProcessManager {
  private process: Subprocess | null = null;
  private port: number;
  private healthFailures = 0;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private killTimeout: ReturnType<typeof setTimeout> | null = null;
  private restarting = false;

  constructor() {
    this.port = env.VOICE_PORT;
  }

  /** URL to reach the voice service */
  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /** Whether the voice process is currently running */
  get running(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /** Spawn the Python voice service. Waits for /health 200. */
  async spawn(): Promise<void> {
    if (this.running) return;

    // Check port is free
    try {
      const check = await fetch(`http://127.0.0.1:${this.port}/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (check.ok) {
        throw new Error(
          `Port ${this.port} is already in use. Set VOICE_PORT to use a different port.`,
        );
      }
    } catch (err: any) {
      if (err.message?.includes("already in use")) throw err;
      // Connection refused = port is free, continue
    }

    // Find the voice service directory (same pattern as CLI serve.ts)
    const voicePath = path.resolve(import.meta.dirname, "..", "..", "..", "..", "apps", "voice");

    this.process = Bun.spawn(
      ["uv", "run", "python", "-m", "uvicorn", "app.main:app",
       "--port", String(this.port), "--host", "127.0.0.1", "--no-access-log"],
      {
        cwd: voicePath,
        stdout: "inherit",
        stderr: "inherit",
        env: {
          ...process.env,
          VOICE_PORT: String(this.port),
          MODELS_DIR: env.MODELS_DIR,
        },
      },
    );

    // Wait for health check (up to 30s for model loading)
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${this.url}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          console.log(`[voice] Voice service ready on port ${this.port}`);
          this.startHealthPolling();
          return;
        }
      } catch {
        // Not ready yet
      }
      await Bun.sleep(500);
    }

    // Timed out
    this.process.kill();
    this.process = null;
    throw new Error(
      "Voice service failed to start within 30 seconds. " +
      "Check that Python 3.11+ and voice dependencies are installed: cd apps/voice && uv sync",
    );
  }

  /** Kill the voice process gracefully. */
  async kill(): Promise<void> {
    this.stopHealthPolling();
    if (this.killTimeout) {
      clearTimeout(this.killTimeout);
      this.killTimeout = null;
    }

    if (!this.process || this.process.killed) {
      this.process = null;
      return;
    }

    this.process.kill("SIGTERM");

    // Force kill after 5s if still alive
    const proc = this.process;
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
    }, 5000);

    this.process = null;
    console.log("[voice] Voice service stopped");
  }

  /** Ensure voice process is running. Spawns if needed. */
  async ensureRunning(): Promise<void> {
    if (this.running) return;
    await this.spawn();
  }

  /** Schedule a delayed kill (10s grace period). Cancel with cancelDelayedKill(). */
  scheduleDelayedKill(): void {
    if (this.killTimeout) return; // Already scheduled
    this.killTimeout = setTimeout(() => {
      this.killTimeout = null;
      this.kill().catch((err) => {
        console.error("[voice] Failed to kill voice service:", err);
      });
    }, 10_000);
  }

  /** Cancel a previously scheduled delayed kill. */
  cancelDelayedKill(): void {
    if (this.killTimeout) {
      clearTimeout(this.killTimeout);
      this.killTimeout = null;
    }
  }

  /** Get voice service health status, or null if not running. */
  async getStatus(): Promise<Record<string, any> | null> {
    if (!this.running) return null;
    try {
      const res = await fetch(`${this.url}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return await res.json();
    } catch {
      // Not reachable
    }
    return null;
  }

  /** Send a request to the voice service. Returns parsed JSON or null on failure. */
  async request(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, unknown>,
  ): Promise<any | null> {
    if (!this.running) return null;
    try {
      const res = await fetch(`${this.url}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private startHealthPolling(): void {
    this.healthFailures = 0;
    this.healthInterval = setInterval(async () => {
      if (!this.running) {
        this.stopHealthPolling();
        return;
      }
      const status = await this.getStatus();
      if (status) {
        this.healthFailures = 0;
      } else {
        this.healthFailures++;
        if (this.healthFailures >= 3) {
          console.error("[voice] Voice service unresponsive (3 failed health checks)");
          if (!this.restarting) {
            this.restarting = true;
            console.log("[voice] Attempting automatic restart...");
            await this.kill();
            try {
              await this.spawn();
              console.log("[voice] Automatic restart succeeded");
            } catch {
              console.error("[voice] Automatic restart failed. Voice features disabled.");
            }
            this.restarting = false;
          }
        }
      }
    }, 30_000);
  }

  private stopHealthPolling(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }
}
```

- [ ] **Step 3: Type check**

```bash
bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/voice/ packages/env/
git commit -m "feat(server): add VoiceProcessManager for lazy voice service lifecycle"
```

---

## Task 3: Integrate VoiceProcessManager into the server

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `packages/api/src/routers/model.router.ts`
- Modify: `packages/api/src/context.ts`

- [ ] **Step 1: Add VoiceProcessManager to the server context**

In `packages/api/src/context.ts`, add the import and context field:

```ts
import type { VoiceProcessManager } from "../../apps/server/src/voice/voice-process-manager";
```

Wait — `@vxllm/api` can't import from `apps/server`. Instead, define a minimal interface in context.ts:

```ts
export interface VoiceProcess {
  readonly running: boolean;
  readonly url: string;
  ensureRunning(): Promise<void>;
  kill(): Promise<void>;
  scheduleDelayedKill(): void;
  cancelDelayedKill(): void;
  getStatus(): Promise<Record<string, any> | null>;
  request(path: string, method?: "GET" | "POST", body?: Record<string, unknown>): Promise<any | null>;
}
```

Add to `CreateContextOptions`:
```ts
voiceProcess?: VoiceProcess;
```

Add to return value:
```ts
voiceProcess: voiceProcess ?? null,
```

- [ ] **Step 2: Wire VoiceProcessManager in server index.ts**

In `apps/server/src/index.ts`:

Import `VoiceProcessManager`:
```ts
import { VoiceProcessManager } from "./voice/voice-process-manager";
```

After global instances:
```ts
const voiceProcess = new VoiceProcessManager();
```

Pass to `createContext`:
```ts
const context = await createContext({
  context: c,
  modelManager,
  downloadManager,
  registry,
  voiceProcess,
});
```

In `shutdown()`:
```ts
await voiceProcess.kill();
```

In startup, replace the existing voice model auto-load code. For persisted STT/TTS models, use VoiceProcessManager instead of direct fetch:
```ts
if (type === "stt" || type === "tts") {
  try {
    await voiceProcess.ensureRunning();
    const loadRes = await voiceProcess.request("/models/load", "POST", {
      type,
      model_path: model.localPath,
      backend: model.backend ?? null,
    });
    if (loadRes) {
      console.log(`[startup] Auto-loaded ${type}: ${model.displayName}`);
    } else {
      console.warn(`[startup] Failed to auto-load ${type} model`);
      await db.delete(settings).where(eq(settings.key, key));
    }
  } catch (err) {
    console.warn(`[startup] Voice service unavailable — skipping ${type} auto-load`);
    await db.delete(settings).where(eq(settings.key, key));
  }
}
```

In `shutdown()`, add voice process kill:
```ts
await voiceProcess.kill();
```

- [ ] **Step 3: Refactor model.router.ts to use VoiceProcessManager**

In `packages/api/src/routers/model.router.ts`:

Remove the standalone `voiceServiceRequest` function. Replace all `voiceServiceRequest(...)` calls with `context.voiceProcess?.request(...)`.

In `loadModel` handler for STT/TTS:
```ts
if (input.type === "stt" || input.type === "tts") {
  if (!context.voiceProcess) {
    throw new Error("Voice process manager not available");
  }
  await context.voiceProcess.ensureRunning();
  const result = await context.voiceProcess.request("/models/load", "POST", {
    type: input.type,
    model_path: row.localPath,
    backend: row.backend ?? null,
  });
  if (!result) {
    throw new Error("Voice service failed to load model. Check server logs.");
  }
  await persistModelSetting(context.db, input.type, input.id);
  return { success: true, modelId: input.id, type: input.type };
}
```

In `unloadModel` handler for STT/TTS:
```ts
if (input.type === "stt" || input.type === "tts") {
  await context.voiceProcess?.request("/models/unload", "POST", { type: input.type });
  await clearModelSetting(context.db, input.type);

  // Check if both STT and TTS are now unloaded — schedule delayed kill
  const sttSetting = await readModelSetting(context.db, "stt");
  const ttsSetting = await readModelSetting(context.db, "tts");
  if (!sttSetting && !ttsSetting && context.voiceProcess) {
    context.voiceProcess.scheduleDelayedKill();
  }
  return { success: true };
}
```

In `getLoadedModels` handler:
Replace `voiceServiceRequest(...)` with `context.voiceProcess?.request(...)` and `context.voiceProcess?.running`.

Update `voiceServiceStatus`:
```ts
let voiceServiceStatus: "running" | "stopped" | "unavailable" =
  context.voiceProcess?.running ? "running" : "stopped";
```

- [ ] **Step 4: Type check all affected packages**

```bash
bunx tsc --noEmit -p packages/api/tsconfig.json
bunx tsc --noEmit -p apps/server/tsconfig.json
bunx tsc --noEmit -p apps/app/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add packages/api apps/server
git commit -m "feat(server): integrate VoiceProcessManager into model router and server lifecycle"
```

---

## Task 4: Refactor Python voice service — remove auto-downloads

**Files:**
- Modify: `apps/voice/app/engines/stt.py`
- Modify: `apps/voice/app/engines/tts.py`
- Modify: `apps/voice/app/main.py`
- Modify: `apps/voice/app/routes/models.py`
- Modify: `apps/voice/app/routes/health.py`

- [ ] **Step 1: Refactor STT engine — remove auto-download, add backend dispatch**

In `apps/voice/app/engines/stt.py`:

Replace the `load()` method. Remove the 3-tier fallback (scan dirs, auto-download). The new signature:

```python
async def load(self, model_path: str | None = None, backend: str | None = None) -> None:
```

Logic:
1. If `model_path` is None, raise `ValueError("model_path is required — VxLLM manages model downloads")`
2. If path doesn't exist, raise `FileNotFoundError(f"Model path does not exist: {model_path}")`
3. Detect backend if not provided:
   - If directory contains `model.bin` → `faster-whisper`
   - If path ends with `.nemo` → raise `NotImplementedError("NeMo backend not yet supported")`
   - Otherwise → try `faster-whisper` as default
4. Load with detected/confirmed backend
5. Store `self._backend = backend` for health reporting

- [ ] **Step 2: Refactor TTS engine — remove auto-download, remove silence fallback**

In `apps/voice/app/engines/tts.py`:

Replace the `load()` method. Remove directory scanning and Kokoro default resolution.

```python
def load(self, lang_code: str = "a", model_path: str | None = None, backend: str | None = None) -> None:
```

Logic:
1. If `model_path` is None, raise `ValueError("model_path is required — VxLLM manages model downloads")`
2. If path doesn't exist, raise `FileNotFoundError(f"Model path does not exist: {model_path}")`
3. Import KPipeline and load with explicit path
4. If KPipeline fails, raise the error (no silence fallback)

Remove `_generate_silence()` method and all references to it.

- [ ] **Step 3: Refactor main.py — remove preload on startup**

In `apps/voice/app/main.py`:

Remove the engine preload calls from the lifespan. The voice service starts with no models loaded — VxLLM sends load requests after spawning.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting VxLLM Voice Service …")
    # VAD is an internal dependency — load it eagerly
    try:
        await vad_engine.load()
    except Exception:
        logger.warning("VAD engine failed to preload — will retry on first request.")
    logger.info("Voice service ready (waiting for model load requests)")
    yield
    logger.info("Voice service shutting down")
```

- [ ] **Step 4: Update models route — accept backend hint**

In `apps/voice/app/routes/models.py`:

Update `LoadModelRequest`:
```python
class LoadModelRequest(BaseModel):
    type: str  # "stt" or "tts"
    model_path: str
    backend: str | None = None
```

Update load handler to pass `backend` to engines:
```python
if req.type == "stt":
    if stt_engine.is_loaded:
        await stt_engine.unload()
    await stt_engine.load(model_path=req.model_path, backend=req.backend)
    return {"success": True, "type": "stt", "model_name": stt_engine.model_name, "backend": stt_engine._backend}
elif req.type == "tts":
    if tts_engine.is_loaded:
        tts_engine.unload()
    tts_engine.load(model_path=req.model_path, backend=req.backend)
    return {"success": True, "type": "tts", "backend": tts_engine.backend}
```

- [ ] **Step 5: Update health route — change `models` key to `engines`**

In `apps/voice/app/routes/health.py`:

```python
@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "engines": {
            "stt": {
                "loaded": stt_engine.is_loaded,
                "model": stt_engine.model_name,
                "backend": stt_engine._backend if hasattr(stt_engine, '_backend') else None,
            },
            "tts": {
                "loaded": tts_engine.is_loaded,
                "backend": tts_engine.backend,
            },
            "vad": {
                "loaded": vad_engine.is_loaded,
            },
        },
    }
```

- [ ] **Step 6: Test manually**

Start the voice service directly:
```bash
cd apps/voice && uv run python -m uvicorn app.main:app --port 11501
```

Verify:
- `GET /health` returns `engines` (not `models`) with all unloaded
- `POST /models/load` without `model_path` returns 422/400
- `POST /models/load` with a valid faster-whisper path loads successfully

- [ ] **Step 7: Commit**

```bash
git add apps/voice/
git commit -m "refactor(voice): remove auto-downloads, accept backend hint, stateless executor"
```

---

## Task 5: Update HF download dialog — add backend selector

**Files:**
- Modify: `apps/app/src/components/models/hf-download-dialog.tsx`
- Modify: `apps/server/src/routes/api/hf-download.ts`

- [ ] **Step 1: Add backend selector to HF download dialog**

In `apps/app/src/components/models/hf-download-dialog.tsx`:

Add a `selectedBackend` state:
```tsx
const [selectedBackend, setSelectedBackend] = useState<string>("auto");
```

After the type selector, add a backend selector that only shows for STT/TTS:
```tsx
{(selectedType === "stt" || selectedType === "tts") && (
  <div className="space-y-1.5">
    <label className="text-sm font-medium">Backend</label>
    <Select value={selectedBackend} onValueChange={(val) => { if (val) setSelectedBackend(val); }}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto-detect</SelectItem>
        {selectedType === "stt" && (
          <>
            <SelectItem value="faster-whisper">faster-whisper</SelectItem>
            <SelectItem value="nemo" disabled>NeMo (coming soon)</SelectItem>
          </>
        )}
        {selectedType === "tts" && (
          <SelectItem value="kokoro">Kokoro</SelectItem>
        )}
      </SelectContent>
    </Select>
  </div>
)}
```

Update the download POST body to include `backend`:
```ts
body: JSON.stringify({
  repo: repoId,
  filename: selectedFile,
  type: selectedType,
  backend: selectedBackend === "auto" ? undefined : selectedBackend,
}),
```

- [ ] **Step 2: Update hf-download.ts to store backend in DB**

In `apps/server/src/routes/api/hf-download.ts`:

Accept `backend` from request body:
```ts
const body = (await c.req.json()) as {
  repo: string;
  filename: string;
  type: string;
  displayName?: string;
  backend?: string;
};
```

Auto-detect backend and format if not provided:
```ts
let backend = body.backend ?? null;
if (!backend) {
  if (body.type === "llm" || body.type === "embedding") backend = "llama-cpp";
  else if (body.type === "stt") backend = "faster-whisper";
  else if (body.type === "tts") backend = "kokoro";
}

// Fix format detection (existing code only handles gguf/whisper)
let format: string;
if (body.filename.endsWith(".gguf")) format = "gguf";
else if (body.type === "tts") format = "kokoro";
else if (body.type === "stt" && backend === "nemo") format = "nemo";
else format = "whisper";
```

Include `backend` and corrected `format` in DB insert:
```ts
await db.insert(models).values({
  ...
  format: format as any,
  backend,
  ...
});
```

- [ ] **Step 3: Type check**

```bash
bunx tsc --noEmit -p apps/app/tsconfig.json
bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/src/components/models/hf-download-dialog.tsx apps/server/src/routes/api/hf-download.ts
git commit -m "feat(app): add backend selector to HF download dialog"
```

---

## Task 6: Add `backend` field to curated registry models

**Files:**
- Modify: `models.json`

**Note:** `models.json` already contains STT/TTS models (whisper, kokoro, etc.) using the `variants` array structure. This task adds the `backend` field to existing entries — NOT creating new flat-format entries.

- [ ] **Step 1: Add `backend` field to all existing model entries**

In `models.json`, add `"backend"` at the model level (applies to all variants):

For LLM/embedding models:
```json
"backend": "llama-cpp",
```

For STT whisper models:
```json
"backend": "faster-whisper",
```

For TTS kokoro models:
```json
"backend": "kokoro",
```

Example of an updated entry (preserving the existing `variants` array structure):
```json
{
  "name": "whisper:large-v3-turbo",
  "displayName": "Whisper Large v3 Turbo",
  "type": "stt",
  "format": "whisper",
  "backend": "faster-whisper",
  "description": "Real-time multilingual transcription...",
  "tags": ["stt", "transcription", "multilingual"],
  "variants": [
    {
      "variant": "default",
      "repo": "Systran/faster-whisper-large-v3-turbo",
      "downloadMethod": "repo",
      "sizeBytes": 1610612736,
      "minRamGb": 2
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add models.json
git commit -m "feat(registry): add backend field to all curated model entries"
```

---

## Task 7: CLI voice commands and output updates

**Files:**
- Create: `apps/cli/src/commands/voice.ts`
- Modify: `apps/cli/src/commands/serve.ts`
- Modify: `apps/cli/src/commands/run.ts`
- Modify: `apps/cli/src/commands/list.ts`
- Modify: `apps/cli/src/commands/ps.ts`
- Modify: `apps/cli/src/index.ts`

- [ ] **Step 1: Create voice subcommand**

Create `apps/cli/src/commands/voice.ts` with subcommands:
- `vxllm voice status` — GET /health from voice service, display engine status
- `vxllm voice load stt <model>` — POST to Bun server to load STT model
- `vxllm voice load tts <model>` — POST to Bun server to load TTS model
- `vxllm voice unload stt` — POST to Bun server to unload STT
- `vxllm voice unload tts` — POST to Bun server to unload TTS
- `vxllm voice transcribe <file>` — POST audio file to `/v1/audio/transcriptions`, display result
- `vxllm voice speak <text>` — POST text to `/v1/audio/speech`, play to speaker

Each command talks to the Bun server's REST API (not directly to the voice service).

- [ ] **Step 2: Add --voice flag to serve and run commands**

In `apps/cli/src/commands/serve.ts`, add `--voice` flag. When set, the server startup includes `voiceProcess.spawn()` immediately.

In `apps/cli/src/commands/run.ts`, add `--voice` flag. When set, auto-loads default STT/TTS models alongside the LLM.

- [ ] **Step 3: Update list command to show BACKEND column**

In `apps/cli/src/commands/list.ts`, add a BACKEND column to the output table:
```
NAME                      TYPE    BACKEND          SIZE     STATUS
llama-3.2-1b-q4_k_m      llm     llama-cpp        0.8 GB   downloaded
whisper-large-v3-turbo    stt     faster-whisper   1.5 GB   downloaded  ✓ loaded
```

- [ ] **Step 4: Update ps command to show voice service status**

In `apps/cli/src/commands/ps.ts`, add voice service status section:
```
VOICE SERVICE: running (port 11501)
  STT: whisper-large-v3-turbo (faster-whisper)
  TTS: kokoro-v1.0 (kokoro)
  VAD: silero-vad (auto)
```

Fetch this from the Bun server's `getLoadedModels` oRPC endpoint.

- [ ] **Step 5: Register voice command in CLI index**

In `apps/cli/src/index.ts`, register the voice subcommand group.

- [ ] **Step 6: Type check**

```bash
bunx tsc --noEmit -p apps/cli/tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add apps/cli/
git commit -m "feat(cli): add voice subcommand group, --voice flags, backend column in list/ps"
```

---

## Task 8: Refactor voice-chat WebSocket protocol

**Files:**
- Modify: `apps/server/src/routes/ws/chat-voice.ts`

- [ ] **Step 1: Update WebSocket message types**

Replace existing types (`stt_result`, `llm_token`, `llm_done`, `tts_audio`, `turn_end`, `config_ack`) with the new protocol:

Outgoing message types:
```ts
type VoiceChatMessage =
  | { type: "vad"; is_speech: boolean }
  | { type: "transcript"; text: string; language: string }
  | { type: "response_start" }
  | { type: "response_delta"; text: string }
  | { type: "response_end"; text: string }
  | { type: "audio"; data: string } // base64 WAV chunk
  | { type: "error"; message: string };
```

- [ ] **Step 2: Update the orchestration loop**

The voice-chat WebSocket handler should:
1. Proxy audio frames to voice service `/ws/stream`
2. When transcription arrives → feed to `streamText` via node-llama-cpp
3. Stream `response_delta` messages as LLM text arrives
4. After LLM finishes → POST accumulated text to voice service `/speak`
5. Stream audio chunks back as `audio` messages
6. Persist conversation to DB via `persistChat`

Use `VoiceProcessManager.request()` for TTS calls instead of raw `fetch`.

- [ ] **Step 3: Type check**

```bash
bunx tsc --noEmit -p apps/server/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/ws/chat-voice.ts
git commit -m "refactor(ws): update voice-chat WebSocket to new protocol"
```

---

## Task 9: Final integration test and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full type check**

```bash
bun run check-types
```

All packages must pass.

- [ ] **Step 2: Manual integration test checklist**

1. Start server: `bun run dev:server` — voice service should NOT start
2. Download an STT model from HF (e.g., faster-whisper-large-v3-turbo) — verify progress shows
3. After download, load the STT model from Settings — verify voice service spawns
4. Check `GET /health` on port 11501 — should show STT loaded with backend info
5. Download and load a TTS model — verify TTS loads on already-running voice service
6. Unload both STT and TTS — verify voice service kills after 10s grace period
7. Restart server — verify persisted models auto-load (voice service auto-spawns)

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final integration fixes for voice model architecture redesign"
```
