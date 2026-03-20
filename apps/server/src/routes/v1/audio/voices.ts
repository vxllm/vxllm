import { Hono } from "hono";
import { env } from "@vxllm/env/server";

/**
 * GET /v1/audio/voices
 *
 * Lists available TTS voices from the voice sidecar.
 */
export function createVoicesRoute() {
  const app = new Hono();

  app.get("/voices", async (c) => {
    const sidecarUrl = env.VOICE_SIDECAR_URL;

    try {
      const res = await fetch(`${sidecarUrl}/voices`);

      if (!res.ok) {
        const error = await res.text();
        console.error("[audio/voices] Sidecar error:", error);
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

      const data = await res.json();
      return c.json(data);
    } catch (err) {
      console.error("[audio/voices] Failed to reach voice sidecar:", err);
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
