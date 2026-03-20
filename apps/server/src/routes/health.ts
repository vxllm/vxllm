import { Hono } from "hono";
import type { ModelManager } from "@vxllm/inference";

/**
 * Health check endpoint.
 *
 * Returns server status, currently loaded model (if any), and uptime.
 * Used by load balancers, Docker health checks, and monitoring systems.
 */
export function createHealthRoute(deps: {
  modelManager: ModelManager;
  startTime: number;
}) {
  const health = new Hono();

  health.get("/health", (c) => {
    const active = deps.modelManager.getActive();
    const loaded = deps.modelManager.getLoaded();

    return c.json({
      status: "ok",
      model: active?.modelInfo.name ?? null,
      models_loaded: loaded.length,
      uptime_seconds: Math.floor((Date.now() - deps.startTime) / 1000),
    });
  });

  return health;
}
