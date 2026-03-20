import { z } from "zod";
import { eq, and, like } from "drizzle-orm";
import fs from "node:fs";

import { publicProcedure } from "../index";
import { ModelFilterInput, ModelDownloadInput } from "../schemas/models";
import { models } from "@vxllm/db/schema/models";

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
        variant: input.format,
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
};
