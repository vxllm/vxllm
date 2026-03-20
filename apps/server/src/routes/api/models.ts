import { Hono } from "hono";
import type { DownloadManager } from "@vxllm/inference";
import { z } from "zod";

// ── Request Validation Schemas ────────────────────────────────────────────────
const PullRequestSchema = z.object({
  name: z.string().min(1),
  variant: z.string().optional(),
  priority: z.number().int().min(0).optional(),
});

/**
 * Model management API routes.
 *
 * POST /api/models/pull — Start downloading a model from HuggingFace
 * GET  /api/models/status — Get all active download statuses
 */
export function createModelManagementRoute(deps: {
  downloadManager: DownloadManager;
}) {
  const route = new Hono();

  // POST /api/models/pull — Start a model download
  route.post("/pull", async (c) => {
    const body = await c.req.json();

    const parsed = PullRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: `Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
            type: "invalid_request_error",
            code: null,
            param: null,
          },
        },
        400,
      );
    }

    const { name, variant, priority } = parsed.data;

    try {
      const progress = await deps.downloadManager.pull(name, {
        variant,
        priority,
      });

      return c.json(
        {
          status: progress.status,
          model_id: progress.modelId,
          progress_pct: progress.progressPct,
          total_bytes: progress.totalBytes,
        },
        progress.status === "completed" ? 200 : 202,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error during pull";
      return c.json(
        {
          error: {
            message,
            type: "server_error",
            code: "pull_failed",
            param: null,
          },
        },
        500,
      );
    }
  });

  // GET /api/models/status — Get all active downloads
  route.get("/status", (c) => {
    const active = deps.downloadManager.getActive();

    return c.json({
      downloads: active.map((d) => ({
        model_id: d.modelId,
        status: d.status,
        progress_pct: d.progressPct,
        downloaded_bytes: d.downloadedBytes,
        total_bytes: d.totalBytes,
        speed_bps: d.speedBps,
        eta: d.eta,
        error: d.error,
      })),
    });
  });

  return route;
}
