import { z } from "zod";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import { publicProcedure } from "../index";
import { CreateApiKeyInput } from "../schemas/settings";
import { settings, apiKeys } from "@vxllm/db/schema/settings";
import { detectHardware } from "@vxllm/inference";

export const settingsRouter = {
  // Query: get a single setting by key
  get: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const [row] = await context.db
        .select()
        .from(settings)
        .where(eq(settings.key, input.key))
        .limit(1);

      if (!row) {
        throw new Error(`Setting not found: ${input.key}`);
      }

      return row;
    }),

  // Mutation: set a setting value by key
  set: publicProcedure
    .input(z.object({ key: z.string().min(1), value: z.string() }))
    .handler(async ({ input, context }) => {
      const now = Date.now();

      await context.db
        .insert(settings)
        .values({
          key: input.key,
          value: input.value,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: input.value, updatedAt: now },
        });

      const [row] = await context.db
        .select()
        .from(settings)
        .where(eq(settings.key, input.key))
        .limit(1);

      return row!;
    }),

  // Query: get all settings
  getAll: publicProcedure.handler(async ({ context }) => {
    const rows = await context.db.select().from(settings);
    return rows;
  }),

  // Mutation: create a new API key
  createApiKey: publicProcedure
    .input(CreateApiKeyInput)
    .handler(async ({ input, context }) => {
      const id = crypto.randomUUID();
      const now = Date.now();

      // Generate the raw API key
      const raw = crypto.randomUUID().replace(/-/g, "");
      const fullKey = `vx_sk_${raw}`;
      const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
      const keyPrefix = fullKey.slice(0, 10);

      await context.db.insert(apiKeys).values({
        id,
        keyHash,
        keyPrefix,
        label: input.label,
        permissions: input.permissions,
        rateLimit: input.rateLimit ?? null,
        expiresAt: input.expiresAt ?? null,
        createdAt: now,
      });

      return {
        id,
        keyPrefix,
        label: input.label,
        permissions: input.permissions,
        rateLimit: input.rateLimit ?? null,
        lastUsedAt: null,
        expiresAt: input.expiresAt ?? null,
        createdAt: now,
        fullKey, // Shown once, never stored
      };
    }),

  // Query: list all API keys (without hashes)
  listApiKeys: publicProcedure.handler(async ({ context }) => {
    const rows = await context.db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        label: apiKeys.label,
        permissions: apiKeys.permissions,
        rateLimit: apiKeys.rateLimit,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys);

    return rows;
  }),

  // Mutation: delete an API key by ID
  deleteApiKey: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      await context.db
        .delete(apiKeys)
        .where(eq(apiKeys.id, input.id));

      return { success: true };
    }),

  // Query: get current hardware info (CPU, RAM, GPU)
  getHardwareInfo: publicProcedure.handler(async () => {
    const hardware = await detectHardware();
    return hardware;
  }),
};
