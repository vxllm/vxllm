import { Hono } from "hono";
import { env } from "@vxllm/env/server";

/**
 * POST /v1/audio/speech
 *
 * OpenAI-compatible text-to-speech endpoint.
 * Proxies to the Python voice service's /speak endpoint.
 * Returns streaming audio/wav.
 */
export function createSpeechRoute() {
  const app = new Hono();

  app.post("/speech", async (c) => {
    const voiceUrl = `http://127.0.0.1:${env.VOICE_PORT}`;

    try {
      const body = await c.req.json();

      const res = await fetch(`${voiceUrl}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: body.input,
          voice: body.voice ?? "af_sky",
          speed: body.speed ?? 1.0,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("[audio/speech] Voice service error:", error);
        return c.json(
          {
            error: {
              message: "TTS failed: " + error,
              type: "server_error",
              code: "voice_service_error",
              param: null,
            },
          },
          500,
        );
      }

      // Stream audio through to the client
      return new Response(res.body, {
        headers: {
          "Content-Type": "audio/wav",
          "Transfer-Encoding": "chunked",
        },
      });
    } catch (err) {
      console.error("[audio/speech] Failed to reach voice service:", err);
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
