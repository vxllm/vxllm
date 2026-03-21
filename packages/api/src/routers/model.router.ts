import { z } from "zod";
import { eq, and, like } from "drizzle-orm";
import fs from "node:fs";

import { publicProcedure } from "../index";
import {
  ModelFilterInput,
  ModelDownloadInput,
  LoadModelInput,
  UnloadModelInput,
} from "../schemas/models";
import { models } from "@vxllm/db/schema/models";
import type { ModelInfo } from "@vxllm/inference";

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
    .input(z.object({ downloadId: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      if (!context.downloadManager) {
        throw new Error("DownloadManager not available");
      }

      await context.downloadManager.cancel(input.downloadId);

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

      // Optionally delete the model file from disk
      if (input.deleteFiles && row.localPath) {
        try {
          fs.unlinkSync(row.localPath);
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
  getDownloadStatus: publicProcedure
    .input(z.object({ downloadId: z.string().optional() }))
    .handler(async ({ input, context }) => {
      if (!context.downloadManager) {
        throw new Error("DownloadManager not available");
      }

      if (input.downloadId) {
        const progress = context.downloadManager.getProgress(input.downloadId);
        return progress ? [progress] : [];
      }

      return context.downloadManager.getActive();
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

  // Mutation: load a downloaded model into memory for inference
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

      // Unload any currently active model before loading a new one
      const active = context.modelManager.getActive();
      if (active) {
        await context.modelManager.unload(active.sessionId);
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
      return loadedModel;
    }),

  // Mutation: unload a model from memory
  unloadModel: publicProcedure
    .input(UnloadModelInput)
    .handler(async ({ input, context }) => {
      if (!context.modelManager) {
        throw new Error("ModelManager not available");
      }

      await context.modelManager.unload(input.sessionId);
      return { success: true };
    }),

  // Query: get the currently active (loaded) model
  getActiveModel: publicProcedure.handler(async ({ context }) => {
    if (!context.modelManager) {
      return null;
    }

    return context.modelManager.getActive();
  }),
};
