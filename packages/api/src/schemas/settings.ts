import { z } from "zod";

// ── Setting Output ──────────────────────────────────────────────────────────
// Mirrors the DB settings columns from packages/db/src/schema/settings.ts
export const SettingOutput = z.object({
  key: z.string(),
  value: z.string(),
  updatedAt: z.number().int(),
});
export type SettingOutput = z.infer<typeof SettingOutput>;

// ── Create API Key Input ────────────────────────────────────────────────────
export const CreateApiKeyInput = z.object({
  label: z.string().min(1),
  permissions: z.string().default("*"),
  rateLimit: z.number().int().positive().optional(),
  expiresAt: z.number().int().optional(),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInput>;

// ── API Key Output ──────────────────────────────────────────────────────────
// Mirrors the DB api_keys columns EXCEPT keyHash (never exposed)
export const ApiKeyOutput = z.object({
  id: z.string(),
  keyPrefix: z.string(),
  label: z.string(),
  permissions: z.string(),
  rateLimit: z.number().int().nullable(),
  lastUsedAt: z.number().int().nullable(),
  expiresAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type ApiKeyOutput = z.infer<typeof ApiKeyOutput>;
