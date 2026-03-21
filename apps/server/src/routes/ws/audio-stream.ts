import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { env } from "@vxllm/env/server";

const { upgradeWebSocket, websocket } = createBunWebSocket();

/**
 * WS /ws/audio/stream
 *
 * Bidirectional WebSocket proxy between the browser and the Python voice
 * voice service's /stream endpoint. The client sends raw 16-bit LE PCM audio frames
 * (mono, 16 kHz, ~30 ms each) and receives JSON messages with VAD events and
 * transcription results.
 *
 * Protocol (relayed transparently):
 *   Client -> Server: binary PCM frames
 *   Server -> Client: JSON { type: "vad" | "transcription" | "error", ... }
 */
const wsRoutes = new Hono();

wsRoutes.get(
  "/audio/stream",
  upgradeWebSocket(() => {
    let voiceWs: WebSocket | null = null;

    return {
      onOpen(_evt, ws) {
        const voiceUrl = env.VOICE_URL.replace(/^http/, "ws");
        voiceWs = new WebSocket(`${voiceUrl}/stream`);

        voiceWs.binaryType = "arraybuffer";

        voiceWs.onopen = () => {
          console.log("[ws/audio-stream] Connected to voice service");
        };

        voiceWs.onmessage = (event: MessageEvent) => {
          try {
            ws.send(
              typeof event.data === "string"
                ? event.data
                : event.data instanceof ArrayBuffer
                  ? new Uint8Array(event.data)
                  : event.data,
            );
          } catch {
            // Client may have already disconnected
          }
        };

        voiceWs.onerror = (event) => {
          console.error("[ws/audio-stream] Voice service WebSocket error:", event);
          try {
            ws.send(
              JSON.stringify({
                type: "error",
                detail: "Voice service connection error",
              }),
            );
          } catch {
            // Ignore if client is gone
          }
        };

        voiceWs.onclose = () => {
          console.log("[ws/audio-stream] Voice service WebSocket closed");
          try {
            ws.close();
          } catch {
            // Already closed
          }
        };
      },

      onMessage(evt, _ws) {
        if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
          const data = evt.data;
          if (typeof data === "string") {
            voiceWs.send(data);
          } else if (data instanceof ArrayBuffer) {
            voiceWs.send(data);
          } else if (data instanceof Blob) {
            // Convert Blob to ArrayBuffer before forwarding
            data.arrayBuffer().then((buf) => {
              voiceWs?.send(buf);
            });
          }
        }
      },

      onClose() {
        if (voiceWs) {
          voiceWs.close();
          voiceWs = null;
        }
        console.log("[ws/audio-stream] Client disconnected");
      },

      onError(evt) {
        console.error("[ws/audio-stream] WebSocket error:", evt);
        if (voiceWs) {
          voiceWs.close();
          voiceWs = null;
        }
      },
    };
  }),
);

export { wsRoutes, websocket };
