import { z } from "zod";

import { publicProcedure } from "../index";
import { CreateApiKeyInput } from "../schemas/settings";

export const settingsRouter = {
  // Query: get a single setting by key
  get: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Mutation: set a setting value by key
  set: publicProcedure
    .input(z.object({ key: z.string().min(1), value: z.string() }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: get all settings
  getAll: publicProcedure.handler(async () => {
    throw new Error("Not implemented");
  }),

  // Mutation: create a new API key
  createApiKey: publicProcedure
    .input(CreateApiKeyInput)
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: list all API keys (without hashes)
  listApiKeys: publicProcedure.handler(async () => {
    throw new Error("Not implemented");
  }),

  // Mutation: delete an API key by ID
  deleteApiKey: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: get current hardware info (CPU, RAM, GPU)
  getHardwareInfo: publicProcedure.handler(async () => {
    throw new Error("Not implemented");
  }),
};
