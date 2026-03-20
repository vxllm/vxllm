import { z } from "zod";

// ── Model Filter Input ──────────────────────────────────────────────────────
export const ModelFilterInput = z.object({
  type: z.enum(["llm", "stt", "tts", "embedding"]).optional(),
  status: z.enum(["available", "downloading", "downloaded", "error"]).optional(),
  format: z.enum(["gguf", "whisper", "kokoro"]).optional(),
  search: z.string().optional(),
});
export type ModelFilterInput = z.infer<typeof ModelFilterInput>;

// ── Model Download Input ────────────────────────────────────────────────────
export const ModelDownloadInput = z.object({
  name: z.string().min(1),
  format: z.enum(["gguf", "whisper", "kokoro"]).optional(),
  priority: z.number().int().min(0).default(0),
});
export type ModelDownloadInput = z.infer<typeof ModelDownloadInput>;

// ── Model Output ────────────────────────────────────────────────────────────
// Mirrors the DB model columns from packages/db/src/schema/models.ts
export const ModelOutput = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  type: z.enum(["llm", "stt", "tts", "embedding"]),
  format: z.enum(["gguf", "whisper", "kokoro"]).nullable(),
  variant: z.string().nullable(),
  repo: z.string().nullable(),
  fileName: z.string().nullable(),
  localPath: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  status: z.enum(["available", "downloading", "downloaded", "error"]),
  minRamGb: z.number().nullable(),
  recommendedVramGb: z.number().nullable(),
  downloadedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ModelOutput = z.infer<typeof ModelOutput>;

// ── Download Status Output ──────────────────────────────────────────────────
// Mirrors the DB download_queue columns from packages/db/src/schema/models.ts
export const DownloadStatusOutput = z.object({
  id: z.string(),
  modelId: z.string(),
  priority: z.number().int(),
  progressPct: z.number(),
  downloadedBytes: z.number().int(),
  totalBytes: z.number().int().nullable(),
  speedBps: z.number().int().nullable(),
  status: z.enum(["queued", "active", "paused", "completed", "failed"]),
  error: z.string().nullable(),
  startedAt: z.number().int().nullable(),
  completedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type DownloadStatusOutput = z.infer<typeof DownloadStatusOutput>;
