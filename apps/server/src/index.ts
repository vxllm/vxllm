import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@vxllm/api/context";
import { appRouter } from "@vxllm/api/routers/index";
import { env } from "@vxllm/env/server";
import {
  ModelManager,
  Registry,
  DownloadManager,
  detectHardware,
} from "@vxllm/inference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { errorHandler } from "./middleware/error-handler";
import { createHealthRoute } from "./routes/health";
import { createChatRoute } from "./routes/v1/chat";
import { createCompletionsRoute } from "./routes/v1/completions";
import { createEmbeddingsRoute } from "./routes/v1/embeddings";
import { createModelsRoute } from "./routes/v1/models";
import { createModelManagementRoute } from "./routes/api/models";

// ── Global Instances ──────────────────────────────────────────────────────────
const modelManager = new ModelManager();
const registry = new Registry();
const downloadManager = new DownloadManager(registry);
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

// ── Error Handler (must be before routes) ─────────────────────────────────────
app.use("/*", errorHandler);

// ── Health Check ──────────────────────────────────────────────────────────────
app.route("", createHealthRoute({ modelManager, startTime }));

// ── OpenAI-Compatible API Routes ──────────────────────────────────────────────
app.route("/v1/chat", createChatRoute({ modelManager, registry }));
app.route("/v1", createCompletionsRoute({ modelManager }));
app.route("/v1", createEmbeddingsRoute({ modelManager }));
app.route("/v1", createModelsRoute());

// ── Model Management API ──────────────────────────────────────────────────────
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
  const context = await createContext({ context: c });

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

    // Auto-load default model if configured
    if (env.DEFAULT_MODEL) {
      console.log(`[startup] Auto-loading default model: ${env.DEFAULT_MODEL}`);
      const modelInfo = await registry.resolve(env.DEFAULT_MODEL);
      if (modelInfo) {
        // Check if it has a local path (i.e., it's been downloaded)
        // In practice, the model needs to be downloaded first
        if (modelInfo.localPath) {
          const loaded = await modelManager.load(modelInfo);
          console.log(`[startup] Model loaded: ${loaded.modelInfo.name} (session: ${loaded.sessionId})`);
        } else {
          console.log(`[startup] Default model "${env.DEFAULT_MODEL}" found in registry but not downloaded yet`);
        }
      } else {
        console.warn(`[startup] Default model "${env.DEFAULT_MODEL}" not found in registry`);
      }
    }

    console.log(`[startup] VxLLM server ready on ${env.HOST}:${env.PORT}`);
  } catch (err) {
    console.error("[startup] Initialization error:", err);
    // Don't crash — the server can still serve API requests
    // (they'll return 503 if no model is loaded)
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
};
