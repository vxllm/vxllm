import { sql, gte } from "drizzle-orm";
import os from "node:os";

import { publicProcedure } from "../index";
import { MetricsPeriodInput } from "../schemas/dashboard";
import { usageMetrics } from "@vxllm/db/schema/metrics";

const PERIOD_MS: Record<string, number> = {
  "1h": 3_600_000,
  "6h": 21_600_000,
  "24h": 86_400_000,
};

export const dashboardRouter = {
  // Query: get aggregated metrics summary for a time period
  getMetricsSummary: publicProcedure
    .input(MetricsPeriodInput)
    .handler(async ({ input, context }) => {
      const periodMs = PERIOD_MS[input.period]!;
      const since = Date.now() - periodMs;

      // Total aggregates
      const [summary] = await context.db
        .select({
          totalRequests: sql<number>`COUNT(*)`,
          avgLatency: sql<number>`COALESCE(AVG(${usageMetrics.latencyMs}), 0)`,
          totalTokensIn: sql<number>`COALESCE(SUM(${usageMetrics.tokensIn}), 0)`,
          totalTokensOut: sql<number>`COALESCE(SUM(${usageMetrics.tokensOut}), 0)`,
        })
        .from(usageMetrics)
        .where(gte(usageMetrics.createdAt, since));

      // Breakdown by type
      const byType = await context.db
        .select({
          type: usageMetrics.type,
          count: sql<number>`COUNT(*)`,
        })
        .from(usageMetrics)
        .where(gte(usageMetrics.createdAt, since))
        .groupBy(usageMetrics.type);

      const requestsByType: Record<string, number> = {};
      for (const row of byType) {
        requestsByType[row.type] = row.count;
      }

      return {
        totalRequests: summary?.totalRequests ?? 0,
        avgLatency: summary?.avgLatency ?? 0,
        totalTokensIn: summary?.totalTokensIn ?? 0,
        totalTokensOut: summary?.totalTokensOut ?? 0,
        requestsByType,
      };
    }),

  // Query: get usage breakdown by request type for a time period
  getUsageBreakdown: publicProcedure
    .input(MetricsPeriodInput)
    .handler(async ({ input, context }) => {
      const periodMs = PERIOD_MS[input.period]!;
      const since = Date.now() - periodMs;

      const rows = await context.db
        .select({
          type: usageMetrics.type,
          count: sql<number>`COUNT(*)`,
          avgLatency: sql<number>`COALESCE(AVG(${usageMetrics.latencyMs}), 0)`,
          totalTokens: sql<number>`COALESCE(SUM(COALESCE(${usageMetrics.tokensIn}, 0) + COALESCE(${usageMetrics.tokensOut}, 0)), 0)`,
        })
        .from(usageMetrics)
        .where(gte(usageMetrics.createdAt, since))
        .groupBy(usageMetrics.type);

      return rows;
    }),

  // Query: get current hardware status (CPU, RAM, GPU, active model)
  getHardwareStatus: publicProcedure.handler(async ({ context }) => {
    const cpus = os.cpus();
    const loadAvg = os.loadavg()[0]!;
    const cpuPercent = Math.min(
      100,
      Math.round((loadAvg / cpus.length) * 1000) / 10,
    );

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramPercent =
      Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10;

    const active = context.modelManager?.getActive() ?? null;

    // GPU VRAM utilization via ModelManager's llama instance
    let gpuPercent: number | null = null;
    try {
      const llama = context.modelManager?.getLlama();
      if (llama && llama.supportsGpuOffloading) {
        const vramState = await llama.getVramState();
        if (vramState.total > 0) {
          gpuPercent =
            Math.round((vramState.used / vramState.total) * 1000) / 10;
        }
      }
    } catch {
      // GPU detection may fail on systems without a compatible GPU — leave as null
    }

    return {
      cpuPercent,
      ramPercent,
      gpuPercent,
      activeModel: active?.modelInfo.name ?? null,
      memoryUsage: {
        usedMb: Math.round((totalMem - freeMem) / 1024 / 1024),
        totalMb: Math.round(totalMem / 1024 / 1024),
      },
    };
  }),
};
