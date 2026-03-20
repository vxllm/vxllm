import { Hono } from "hono";
import { env } from "@vxllm/env/server";

/**
 * POST /v1/audio/transcriptions
 *
 * OpenAI-compatible audio transcription endpoint.
 * Proxies multipart form data to the Python voice sidecar's /transcribe endpoint.
 */
export function createTranscriptionsRoute() {
  const app = new Hono();

  app.post("/transcriptions", async (c) => {
    const sidecarUrl = env.VOICE_SIDECAR_URL;

    try {
      const res = await fetch(`${sidecarUrl}/transcribe`, {
        method: "POST",
        body: await c.req.raw.arrayBuffer(),
        headers: {
          "Content-Type": c.req.header("Content-Type") || "multipart/form-data",
        },
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("[audio/transcriptions] Sidecar error:", error);
        return c.json(
          {
            error: {
              message: error,
              type: "server_error",
              code: "sidecar_error",
              param: null,
            },
          },
          500,
        );
      }

      const data = (await res.json()) as { text: string };
      // Return in OpenAI-compatible format
      return c.json({ text: data.text });
    } catch (err) {
      console.error("[audio/transcriptions] Failed to reach voice sidecar:", err);
      return c.json(
        {
          error: {
            message: "Voice sidecar is not available. Ensure it is running.",
            type: "server_error",
            code: "sidecar_unavailable",
            param: null,
          },
        },
        503,
      );
    }
  });

  return app;
}
