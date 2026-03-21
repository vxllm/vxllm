import { Hono } from "hono";
import { env } from "@vxllm/env/server";

/**
 * POST /v1/audio/transcriptions
 *
 * OpenAI-compatible audio transcription endpoint.
 * Proxies multipart form data to the Python voice service's /transcribe endpoint.
 */
export function createTranscriptionsRoute() {
  const app = new Hono();

  app.post("/transcriptions", async (c) => {
    const voiceUrl = env.VOICE_URL;

    try {
      const res = await fetch(`${voiceUrl}/transcribe`, {
        method: "POST",
        body: await c.req.raw.arrayBuffer(),
        headers: {
          "Content-Type": c.req.header("Content-Type") || "multipart/form-data",
        },
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("[audio/transcriptions] Voice service error:", error);
        return c.json(
          {
            error: {
              message: error,
              type: "server_error",
              code: "voice_service_error",
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
      console.error("[audio/transcriptions] Failed to reach voice service:", err);
      return c.json(
        {
          error: {
            message: "Voice service is not available. Ensure it is running.",
            type: "server_error",
            code: "voice_service_unavailable",
            param: null,
          },
        },
        503,
      );
    }
  });

  return app;
}
