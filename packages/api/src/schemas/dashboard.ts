import { z } from "zod";

// ── Metrics Period Input ────────────────────────────────────────────────────
export const MetricsPeriodInput = z.object({
  period: z.enum(["1h", "6h", "24h"]),
});
export type MetricsPeriodInput = z.infer<typeof MetricsPeriodInput>;

// ── Metrics Summary Output ──────────────────────────────────────────────────
export const MetricsSummaryOutput = z.object({
  totalRequests: z.number().int(),
  avgLatency: z.number(),
  totalTokensIn: z.number().int(),
  totalTokensOut: z.number().int(),
  requestsByType: z.record(z.string(), z.number().int()),
});
export type MetricsSummaryOutput = z.infer<typeof MetricsSummaryOutput>;

// ── Usage Breakdown Output ──────────────────────────────────────────────────
export const UsageBreakdownOutput = z.array(
  z.object({
    type: z.string(),
    count: z.number().int(),
    avgLatency: z.number(),
    totalTokens: z.number().int(),
  }),
);
export type UsageBreakdownOutput = z.infer<typeof UsageBreakdownOutput>;

// ── Hardware Status Output ──────────────────────────────────────────────────
export const HardwareStatusOutput = z.object({
  cpuPercent: z.number(),
  ramPercent: z.number(),
  gpuPercent: z.number().nullable(),
  activeModel: z.string().nullable(),
  memoryUsage: z.object({
    usedMb: z.number(),
    totalMb: z.number(),
  }),
});
export type HardwareStatusOutput = z.infer<typeof HardwareStatusOutput>;
