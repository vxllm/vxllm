import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@vxllm/api/context";
import { appRouter } from "@vxllm/api/routers/index";
import { db } from "@vxllm/db";
import { models } from "@vxllm/db/schema/models";
import { settings } from "@vxllm/db/schema/settings";
import { env } from "@vxllm/env/server";
import {
  ModelManager,
  Registry,
  DownloadManager,
  detectHardware,
  type ModelInfo,
} from "@vxllm/inference";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { createHealthRoute } from "./routes/health";
import { metricsRoute } from "./routes/metrics";
import { createChatRoute } from "./routes/v1/chat";
import { createCompletionsRoute } from "./routes/v1/completions";
import { createEmbeddingsRoute } from "./routes/v1/embeddings";
import { createModelsRoute } from "./routes/v1/models";
import { createModelManagementRoute } from "./routes/api/models";
import { hfSearch } from "./routes/api/hf-search";
import { hfFiles } from "./routes/api/hf-files";
import { hfDownload } from "./routes/api/hf-download";
import { createAudioRoutes } from "./routes/v1/audio";
import { createApiChatRoute } from "./routes/api/chat";
import { wsRoutes, websocket } from "./routes/ws/audio-stream";
import { createVoiceChatRoute } from "./routes/ws/chat-voice";

// ── Global Instances ──────────────────────────────────────────────────────────
const modelManager = new ModelManager();
const registry = new Registry();
const downloadManager = new DownloadManager(registry);
// Tracks whether startup() has completed (registry loaded, models initialized)
export let startupComplete = false;
const startTime = Date.now();

// ── App Setup ─────────────────────────────────────────────────────────────────
const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin:
      env.CORS_ORIGINS === "*"
        ? "*"
        : env.CORS_ORIGINS.split(",").map((o: string) => o.trim()),
    allowMethods: ["GET", "POST", "OPTIONS", "DELETE", "PUT", "PATCH"],
  }),
);

// ── Auth Middleware (after CORS, before routes) ──────────────────────────────
app.use("/*", authMiddleware);

// ── Error Handler (must be before routes) ─────────────────────────────────────
app.use("/*", errorHandler);

// ── Health Check ──────────────────────────────────────────────────────────────
app.route("", createHealthRoute({ modelManager, startTime }));

// ── Prometheus Metrics (skips auth — see auth middleware) ─────────────────────
app.route("/metrics", metricsRoute);

// ── WebSocket Routes ─────────────────────────────────────────────────────────
app.route("/ws", wsRoutes);
app.get("/ws/chat", createVoiceChatRoute({ modelManager }));

// ── OpenAI-Compatible API Routes ──────────────────────────────────────────────
app.route("/v1/chat", createChatRoute({ modelManager, registry }));
app.route("/v1", createCompletionsRoute({ modelManager }));
app.route("/v1", createEmbeddingsRoute({ modelManager }));
app.route("/v1", createModelsRoute());

// ── Audio / Voice API (proxied to Python voice service) ────────────────────────
app.route("/v1/audio", createAudioRoutes());

// ── Frontend Chat API (AI SDK v6 UIMessage protocol) ──────────────────────────
app.route("/api/chat", createApiChatRoute({ modelManager }));

// ── Model Management API ──────────────────────────────────────────────────────
app.route("/api/models/search/hf", hfSearch);
app.route("/api/models/hf/files", hfFiles);
app.route("/api/models/hf/download", hfDownload);
app.route("/api/models", createModelManagementRoute({ downloadManager }));

// ── oRPC Handlers (catch-all, must be AFTER specific routes) ──────────────────
export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({
    context: c,
    modelManager,
    downloadManager,
    registry,
  });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body as ReadableStream, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body as ReadableStream, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

// ── Server Lifecycle ──────────────────────────────────────────────────────────

/**
 * Initialize server dependencies on startup.
 * Detects hardware, loads registry, and optionally auto-loads a default model.
 */
async function startup() {
  try {
    // Detect and log hardware profile
    const hardware = await detectHardware();
    console.log("[startup] Hardware detected:");
    console.log(`  Platform: ${hardware.platform} (${hardware.arch})`);
    console.log(`  CPU: ${hardware.cpu.model} (${hardware.cpu.physicalCores}P/${hardware.cpu.logicalCores}L cores)`);
    console.log(`  RAM: ${(hardware.ram.totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB total, ${(hardware.ram.availableBytes / 1024 / 1024 / 1024).toFixed(1)} GB available`);
    console.log(`  GPU: ${hardware.gpu.available ? `${hardware.gpu.name} (${hardware.gpu.vendor}, ${(hardware.gpu.vramBytes / 1024 / 1024 / 1024).toFixed(1)} GB VRAM)` : "None"}`);

    // Load the model registry
    await registry.load();
    console.log("[startup] Model registry loaded");

    // Initialize the llama runtime
    await modelManager.initialize();
    console.log("[startup] Llama runtime initialized");

    // ── Auto-load persisted models from settings ─────────────────────────
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
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (!setting) continue;
      hasPersistedModels = true;

      const modelId = setting.value;
      const [model] = await db
        .select()
        .from(models)
        .where(eq(models.id, modelId))
        .limit(1);

      if (!model || model.status !== "downloaded" || !model.localPath) {
        console.warn(`[startup] Persisted ${type} model "${modelId}" no longer valid — clearing setting`);
        await db.delete(settings).where(eq(settings.key, key));
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
            backend: (model.backend ?? null) as ModelInfo["backend"],
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
          await db.delete(settings).where(eq(settings.key, key));
        }
      }
    }

    // Fallback: if no persisted models exist and DEFAULT_MODEL is set, use it for first boot
    if (!hasPersistedModels && env.DEFAULT_MODEL) {
      console.log(`[startup] No persisted models — falling back to DEFAULT_MODEL: ${env.DEFAULT_MODEL}`);

      // Look up the model from DB by name (registry doesn't know local paths)
      const [dbModel] = await db
        .select()
        .from(models)
        .where(eq(models.name, env.DEFAULT_MODEL))
        .limit(1);

      if (dbModel && dbModel.status === "downloaded" && dbModel.localPath) {
        try {
          const modelInfo: ModelInfo = {
            name: dbModel.name,
            displayName: dbModel.displayName,
            description: dbModel.description ?? null,
            type: dbModel.type as ModelInfo["type"],
            format: (dbModel.format ?? "gguf") as ModelInfo["format"],
            backend: (dbModel.backend ?? null) as ModelInfo["backend"],
            variant: dbModel.variant ?? null,
            repo: dbModel.repo ?? null,
            fileName: dbModel.fileName ?? null,
            downloadMethod: dbModel.format === "gguf" ? "file" : "repo",
            localPath: dbModel.localPath,
            sizeBytes: dbModel.sizeBytes ?? 0,
            minRamGb: dbModel.minRamGb ?? null,
            recommendedVramGb: dbModel.recommendedVramGb ?? null,
            status: dbModel.status as ModelInfo["status"],
          };
          const loaded = await modelManager.load(modelInfo);
          console.log(`[startup] Model loaded: ${loaded.modelInfo.name} (session: ${loaded.sessionId})`);
          // Persist so next boot uses settings
          const now = Date.now();
          await db
            .insert(settings)
            .values({ key: "loaded_llm_id", value: dbModel.id, updatedAt: now })
            .onConflictDoUpdate({ target: settings.key, set: { value: dbModel.id, updatedAt: now } });
        } catch (err) {
          console.warn(`[startup] Failed to load DEFAULT_MODEL:`, err);
        }
      } else {
        console.log(`[startup] DEFAULT_MODEL "${env.DEFAULT_MODEL}" not found or not downloaded`);
      }
    }

    startupComplete = true;
    console.log(`[startup] VxLLM server ready on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    console.error("[startup] Initialization error:", err);
    startupComplete = true; // Allow serving even on partial failure
  }
}

// Run startup initialization
startup();

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown() {
  console.log("[shutdown] Shutting down gracefully...");
  downloadManager.cancelAll();
  await modelManager.disposeAll();
  console.log("[shutdown] Cleanup complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default {
  port: env.PORT,
  hostname: env.HOST,
  fetch: app.fetch,
  websocket,
};
