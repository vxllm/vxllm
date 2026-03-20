import { z } from "zod";

// ── Voice Profile Input ─────────────────────────────────────────────────────
export const VoiceProfileInput = z.object({
  name: z.string().min(1),
  sttModel: z.string().optional(),
  ttsModel: z.string().optional(),
  ttsVoice: z.string().optional(),
  language: z.string().default("en"),
});
export type VoiceProfileInput = z.infer<typeof VoiceProfileInput>;

// ── Voice Profile Output ────────────────────────────────────────────────────
// Mirrors the DB voice_profiles columns from packages/db/src/schema/metrics.ts
export const VoiceProfileOutput = z.object({
  id: z.string(),
  name: z.string(),
  sttModel: z.string().nullable(),
  ttsModel: z.string().nullable(),
  ttsVoice: z.string().nullable(),
  language: z.string(),
  isDefault: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type VoiceProfileOutput = z.infer<typeof VoiceProfileOutput>;

// ── Voice Config Input ──────────────────────────────────────────────────────
export const VoiceConfigInput = z.object({
  sttModel: z.string(),
  llmModel: z.string(),
  ttsModel: z.string(),
  voice: z.string(),
  language: z.string(),
});
export type VoiceConfigInput = z.infer<typeof VoiceConfigInput>;
