import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { env } from "@vxllm/env/server";

const { upgradeWebSocket, websocket } = createBunWebSocket();

/**
 * WS /ws/audio/stream
 *
 * Bidirectional WebSocket proxy between the browser and the Python voice
 * sidecar's /stream endpoint. The client sends raw 16-bit LE PCM audio frames
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
    let sidecarWs: WebSocket | null = null;

    return {
      onOpen(_evt, ws) {
        const sidecarUrl = env.VOICE_SIDECAR_URL.replace(/^http/, "ws");
        sidecarWs = new WebSocket(`${sidecarUrl}/stream`);

        sidecarWs.binaryType = "arraybuffer";

        sidecarWs.onopen = () => {
          console.log("[ws/audio-stream] Connected to voice sidecar");
        };

        sidecarWs.onmessage = (event: MessageEvent) => {
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

        sidecarWs.onerror = (event) => {
          console.error("[ws/audio-stream] Sidecar WebSocket error:", event);
          try {
            ws.send(
              JSON.stringify({
                type: "error",
                detail: "Voice sidecar connection error",
              }),
            );
          } catch {
            // Ignore if client is gone
          }
        };

        sidecarWs.onclose = () => {
          console.log("[ws/audio-stream] Sidecar WebSocket closed");
          try {
            ws.close();
          } catch {
            // Already closed
          }
        };
      },

      onMessage(evt, _ws) {
        if (sidecarWs && sidecarWs.readyState === WebSocket.OPEN) {
          const data = evt.data;
          if (typeof data === "string") {
            sidecarWs.send(data);
          } else if (data instanceof ArrayBuffer) {
            sidecarWs.send(data);
          } else if (data instanceof Blob) {
            // Convert Blob to ArrayBuffer before forwarding
            data.arrayBuffer().then((buf) => {
              sidecarWs?.send(buf);
            });
          }
        }
      },

      onClose() {
        if (sidecarWs) {
          sidecarWs.close();
          sidecarWs = null;
        }
        console.log("[ws/audio-stream] Client disconnected");
      },

      onError(evt) {
        console.error("[ws/audio-stream] WebSocket error:", evt);
        if (sidecarWs) {
          sidecarWs.close();
          sidecarWs = null;
        }
      },
    };
  }),
);

export { wsRoutes, websocket };
