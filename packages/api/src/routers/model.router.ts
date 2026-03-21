import { z } from "zod";
import { eq, and, like, inArray } from "drizzle-orm";
import fs from "node:fs";

import { publicProcedure } from "../index";
import {
  ModelFilterInput,
  ModelDownloadInput,
  LoadModelInput,
  UnloadModelInput,
} from "../schemas/models";
import { models, downloadQueue } from "@vxllm/db/schema/models";
import { settings } from "@vxllm/db/schema/settings";
import type { ModelInfo } from "@vxllm/inference";

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
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: modelId, updatedAt: now },
    });
}

/** Clear a loaded model setting by deleting the row. */
async function clearModelSetting(db: any, type: ModelType): Promise<void> {
  const key = SETTINGS_KEYS[type];
  await db.delete(settings).where(eq(settings.key, key));
}

/** Read a model setting. Returns the model DB ID or null. */
async function readModelSetting(
  db: any,
  type: ModelType,
): Promise<string | null> {
  const key = SETTINGS_KEYS[type];
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return row?.value ?? null;
}


export const modelRouter = {
  // Query: list all models with optional filters
  list: publicProcedure
    .input(ModelFilterInput)
    .handler(async ({ input, context }) => {
      const conditions = [];

      if (input.type) {
        conditions.push(eq(models.type, input.type));
      }
      if (input.status) {
        conditions.push(eq(models.status, input.status));
      }
      if (input.format) {
        conditions.push(eq(models.format, input.format));
      }
      if (input.backend) {
        conditions.push(eq(models.backend, input.backend));
      }
      if (input.search) {
        conditions.push(like(models.name, `%${input.search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await context.db
        .select()
        .from(models)
        .where(whereClause);

      return rows;
    }),

  // Query: get a single model by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const [row] = await context.db
        .select()
        .from(models)
        .where(eq(models.id, input.id))
        .limit(1);

      if (!row) {
        throw new Error(`Model not found: ${input.id}`);
      }

      return row;
    }),

  // Mutation: start downloading a model
  download: publicProcedure
    .input(ModelDownloadInput)
    .handler(async ({ input, context }) => {
      if (!context.downloadManager) {
        throw new Error("DownloadManager not available");
      }

      const progress = await context.downloadManager.pull(input.name, {
        priority: input.priority,
      });

      return progress;
    }),

  // Mutation: cancel an in-progress download
  cancelDownload: publicProcedure
    .input(z.object({ modelId: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      if (!context.downloadManager) {
        throw new Error("DownloadManager not available");
      }

      await context.downloadManager.cancel(input.modelId);

      return { success: true };
    }),

  // Mutation: delete an installed model
  delete: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        deleteFiles: z.boolean().default(true),
      }),
    )
    .handler(async ({ input, context }) => {
      const [row] = await context.db
        .select()
        .from(models)
        .where(eq(models.id, input.id))
        .limit(1);

      if (!row) {
        throw new Error(`Model not found: ${input.id}`);
      }

      // Optionally delete the model file/directory from disk
      if (input.deleteFiles && row.localPath) {
        try {
          const stat = fs.statSync(row.localPath);
          if (stat.isDirectory()) {
            fs.rmSync(row.localPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(row.localPath);
          }
        } catch {
          // File may already be removed — non-critical
        }
      }

      await context.db
        .delete(models)
        .where(eq(models.id, input.id));

      return { success: true };
    }),

  // Query: get download progress for one or all active downloads
  // Merges in-memory DownloadManager progress with DB-tracked HF downloads
  getDownloadStatus: publicProcedure
    .input(z.object({ downloadId: z.string().optional() }).optional())
    .handler(async ({ input, context }) => {
      // Get in-memory progress from DownloadManager (registry-based downloads)
      const inMemory = context.downloadManager
        ? input?.downloadId
          ? (() => {
              const p = context.downloadManager!.getProgress(input.downloadId!);
              return p ? [p] : [];
            })()
          : context.downloadManager.getActive()
        : [];

      // Get DB-tracked downloads (HF downloads that bypass DownloadManager)
      const inMemoryModelIds = new Set(inMemory.map((p) => p.modelId));

      const dbDownloads = await context.db
        .select({
          modelId: downloadQueue.modelId,
          modelName: models.displayName,
          status: downloadQueue.status,
          progressPct: downloadQueue.progressPct,
          downloadedBytes: downloadQueue.downloadedBytes,
          totalBytes: downloadQueue.totalBytes,
          speedBps: downloadQueue.speedBps,
          error: downloadQueue.error,
        })
        .from(downloadQueue)
        .innerJoin(models, eq(downloadQueue.modelId, models.id))
        .where(
          inArray(downloadQueue.status, ["active", "queued", "completed"]),
        );

      // Merge: DB entries that aren't already tracked in-memory
      const dbProgress = dbDownloads
        .filter((d) => !inMemoryModelIds.has(d.modelId))
        .map((d) => ({
          modelId: d.modelId,
          modelName: d.modelName,
          priority: 0,
          status: d.status as "active" | "queued" | "completed",
          progressPct: d.progressPct ?? 0,
          downloadedBytes: d.downloadedBytes ?? 0,
          totalBytes: d.totalBytes ?? 0,
          speedBps: d.speedBps ?? 0,
          eta: null,
          error: d.error ?? null,
        }));

      return [...inMemory, ...dbProgress];
    }),

  // Query: search models by name or description
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      if (!context.registry) {
        throw new Error("Registry not available");
      }

      const results = await context.registry.search(input.query);
      return results;
    }),

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
        if (!context.voiceProcess) {
          throw new Error("Voice process manager not available");
        }
        // Cancel any pending delayed kill (user is loading a new model)
        context.voiceProcess.cancelDelayedKill();
        await context.voiceProcess.ensureRunning();
        const result = await context.voiceProcess.request("/models/load", "POST", {
          type: input.type,
          model_path: row.localPath,
          backend: row.backend ?? null,
        });
        if (!result) {
          throw new Error(
            "Voice service failed to load model. Check server logs for details.",
          );
        }
        await persistModelSetting(context.db, input.type, input.id);
        return { success: true, modelId: input.id, type: input.type };
      }

      // ── LLM/Embedding: use ModelManager ──
      // Auto-unload existing model of the same type
      const existing = context.modelManager.getByType(
        input.type as "llm" | "embedding",
      );
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
        backend: (row.backend ?? null) as ModelInfo["backend"],
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

  // Mutation: unload a model by type — unified for all model types
  unloadModel: publicProcedure
    .input(UnloadModelInput)
    .handler(async ({ input, context }) => {
      if (!context.modelManager) {
        throw new Error("ModelManager not available");
      }

      if (input.type === "stt" || input.type === "tts") {
        await context.voiceProcess?.request("/models/unload", "POST", {
          type: input.type,
        });
        await clearModelSetting(context.db, input.type);

        // Check if both STT and TTS are now unloaded — schedule delayed kill
        const sttSetting = await readModelSetting(context.db, "stt");
        const ttsSetting = await readModelSetting(context.db, "tts");
        if (!sttSetting && !ttsSetting && context.voiceProcess) {
          context.voiceProcess.scheduleDelayedKill();
        }
        return { success: true };
      }

      // ── LLM/Embedding: use ModelManager ──
      const loaded = context.modelManager.getByType(
        input.type as "llm" | "embedding",
      );
      if (!loaded) {
        throw new Error(`No ${input.type} model is currently loaded`);
      }

      await context.modelManager.unload(loaded.sessionId);
      await clearModelSetting(context.db, input.type);
      return { success: true };
    }),

  // Query: get all loaded models grouped by type
  getLoadedModels: publicProcedure.handler(async ({ context }) => {
    const mm = context.modelManager;
    const llamaModels = mm
      ? mm.getLoadedByType()
      : { llm: null, embedding: null };

    // Query voice service for STT/TTS status
    let stt: { modelId: string; modelName: string } | null = null;
    let tts: { modelId: string; modelName: string } | null = null;
    let voiceServiceStatus: "running" | "stopped" | "unavailable" =
      context.voiceProcess?.running ? "running" : "stopped";

    if (context.voiceProcess?.running) {
      const voiceHealth = await context.voiceProcess.request("/health");
      if (voiceHealth) {
        voiceServiceStatus = "running";
        // Read from new "engines" key (voice service refactored in Task 4)
        // Fall back to old "models" key for backward compat during migration
        const enginesOrModels = voiceHealth.engines ?? voiceHealth.models;
        if (enginesOrModels) {
          if (enginesOrModels.stt?.loaded) {
            const sttId = await readModelSetting(context.db, "stt");
            stt = {
              modelId: sttId ?? "",
              modelName: enginesOrModels.stt.model ?? enginesOrModels.stt.model_name ?? "Unknown STT",
            };
          }
          if (enginesOrModels.tts?.loaded) {
            const ttsId = await readModelSetting(context.db, "tts");
            tts = {
              modelId: ttsId ?? "",
              modelName: enginesOrModels.tts.backend ?? enginesOrModels.tts.model_name ?? "Unknown TTS",
            };
          }
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
};
