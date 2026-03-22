import { Hono } from "hono";
import { env } from "@vxllm/env/server";

/**
 * GET /v1/audio/voices
 *
 * Lists available TTS voices from the voice service.
 */
export function createVoicesRoute() {
  const app = new Hono();

  app.get("/voices", async (c) => {
    const voiceUrl = `http://127.0.0.1:${env.VOICE_PORT}`;

    try {
      const res = await fetch(`${voiceUrl}/voices`);

      if (!res.ok) {
        const error = await res.text();
        console.error("[audio/voices] Voice service error:", error);
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

      const data = await res.json();
      return c.json(data);
    } catch (err) {
      console.error("[audio/voices] Failed to reach voice service:", err);
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
