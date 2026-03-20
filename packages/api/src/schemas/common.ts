import { z } from "zod";

// ── Pagination ──────────────────────────────────────────────────────────────
export const PaginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof PaginationInput>;

// ── Sort ────────────────────────────────────────────────────────────────────
export const SortInput = z.object({
  field: z.string(),
  direction: z.enum(["asc", "desc"]),
});
export type SortInput = z.infer<typeof SortInput>;

// ── API Error ───────────────────────────────────────────────────────────────
export const ApiErrorResponse = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;
