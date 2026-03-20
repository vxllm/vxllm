import { z } from "zod";

import { publicProcedure } from "../index";
import { ModelFilterInput, ModelDownloadInput } from "../schemas/models";

export const modelRouter = {
  // Query: list all models with optional filters
  list: publicProcedure
    .input(ModelFilterInput)
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: get a single model by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Mutation: start downloading a model
  download: publicProcedure
    .input(ModelDownloadInput)
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Mutation: cancel an in-progress download
  cancelDownload: publicProcedure
    .input(z.object({ downloadId: z.string().min(1) }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Mutation: delete an installed model
  delete: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        deleteFiles: z.boolean().default(true),
      }),
    )
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: get download progress for one or all active downloads
  getDownloadStatus: publicProcedure
    .input(z.object({ downloadId: z.string().optional() }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: search models by name or description
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),
};
