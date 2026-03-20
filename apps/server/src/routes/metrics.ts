import { Hono } from "hono";
import { db } from "@vxllm/db";
import { usageMetrics } from "@vxllm/db/schema/metrics";
import { sql } from "drizzle-orm";

/**
 * GET /metrics
 *
 * Prometheus-compatible metrics endpoint.
 * Exposes request counts, latency, and token usage aggregated from the
 * usage_metrics table. Formatted in Prometheus text exposition format
 * (text/plain; version=0.0.4).
 *
 * This endpoint skips auth (like /health) so that Prometheus scrapers
 * can access it without an API key.
 */
const metricsRoute = new Hono();

metricsRoute.get("/", async (c) => {
  const counts = await db
    .select({
      type: usageMetrics.type,
      count: sql<number>`COUNT(*)`,
      totalLatency: sql<number>`COALESCE(SUM(${usageMetrics.latencyMs}), 0)`,
      totalTokensIn: sql<number>`COALESCE(SUM(${usageMetrics.tokensIn}), 0)`,
      totalTokensOut: sql<number>`COALESCE(SUM(${usageMetrics.tokensOut}), 0)`,
    })
    .from(usageMetrics)
    .groupBy(usageMetrics.type);

  let output = "";

  // ── Request counts by type ────────────────────────────────────────────────
  output += "# HELP vxllm_requests_total Total inference requests by type.\n";
  output += "# TYPE vxllm_requests_total counter\n";
  for (const row of counts) {
    output += `vxllm_requests_total{type="${row.type}"} ${row.count}\n`;
  }

  // ── Latency aggregates ────────────────────────────────────────────────────
  output += "\n# HELP vxllm_request_latency_ms_sum Total request latency in milliseconds.\n";
  output += "# TYPE vxllm_request_latency_ms_sum counter\n";
  const totalLatency = counts.reduce((sum, r) => sum + r.totalLatency, 0);
  output += `vxllm_request_latency_ms_sum ${totalLatency}\n`;

  output += "\n# HELP vxllm_request_latency_ms_count Total number of requests (for latency histogram).\n";
  output += "# TYPE vxllm_request_latency_ms_count counter\n";
  const totalCount = counts.reduce((sum, r) => sum + r.count, 0);
  output += `vxllm_request_latency_ms_count ${totalCount}\n`;

  // ── Token counts ──────────────────────────────────────────────────────────
  output += "\n# HELP vxllm_tokens_total Total tokens processed.\n";
  output += "# TYPE vxllm_tokens_total counter\n";
  const totalIn = counts.reduce((sum, r) => sum + r.totalTokensIn, 0);
  const totalOut = counts.reduce((sum, r) => sum + r.totalTokensOut, 0);
  output += `vxllm_tokens_total{direction="in"} ${totalIn}\n`;
  output += `vxllm_tokens_total{direction="out"} ${totalOut}\n`;

  // ── Per-type token breakdown ──────────────────────────────────────────────
  output += "\n# HELP vxllm_tokens_by_type_total Tokens processed per request type.\n";
  output += "# TYPE vxllm_tokens_by_type_total counter\n";
  for (const row of counts) {
    output += `vxllm_tokens_by_type_total{type="${row.type}",direction="in"} ${row.totalTokensIn}\n`;
    output += `vxllm_tokens_by_type_total{type="${row.type}",direction="out"} ${row.totalTokensOut}\n`;
  }

  return c.text(output, 200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  });
});

export { metricsRoute };
