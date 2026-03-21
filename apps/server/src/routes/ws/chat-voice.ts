import { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { streamText } from "ai";
import { env } from "@vxllm/env/server";
import type { ModelManager } from "@vxllm/inference";
import { createLlamaProvider } from "@vxllm/llama-provider";

const { upgradeWebSocket } = createBunWebSocket();

/**
 * Server -> Client JSON message types (new protocol):
 *
 *   { type: "vad", is_speech: boolean }
 *   { type: "transcript", text: string, language: string }
 *   { type: "response_start" }
 *   { type: "response_delta", text: string }
 *   { type: "response_end", text: string }
 *   { type: "audio", data: string }          // base64 WAV chunk
 *   { type: "error", message: string }
 *
 * Client -> Server:
 *   Binary PCM audio frames (16-bit LE, 16kHz mono, ~30ms = 1920 bytes)
 */

/**
 * WS /ws/chat
 *
 * Full voice chat loop: audio -> STT (via voice service) -> LLM -> TTS (via voice service) -> audio.
 *
 * Flow:
 * 1. Client connects; server opens a WebSocket to the voice service `/stream`.
 * 2. Client streams binary PCM audio frames.
 * 3. Audio is forwarded to the voice service STT WebSocket.
 * 4. When voice service returns a transcription, we:
 *    a. Send { type: "transcript", text, language } to the client.
 *    b. Run LLM inference, streaming deltas as { type: "response_delta", text }.
 *    c. Send { type: "response_end", text: fullText } when generation finishes.
 *    d. Call TTS voice service with the full response, stream base64 audio back.
 * 5. VAD status from voice service is forwarded as { type: "vad", is_speech }.
 * 6. Errors are sent as { type: "error", message } without closing the connection.
 * 7. On client disconnect, close voice service WebSocket and clean up.
 */
export function createVoiceChatRoute(deps: { modelManager: ModelManager }) {
  return upgradeWebSocket(() => {
    let voiceWs: WebSocket | null = null;
    let conversationHistory: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];
    let isProcessing = false;

    return {
      onOpen(_evt, ws) {
        console.log("[ws/chat-voice] Client connected");

        // Connect to the voice service STT WebSocket
        const voicePort = env.VOICE_PORT;
        voiceWs = new WebSocket(`ws://127.0.0.1:${voicePort}/stream`);
        voiceWs.binaryType = "arraybuffer";

        voiceWs.onopen = () => {
          console.log(
            "[ws/chat-voice] Connected to voice service for STT",
          );
        };

        voiceWs.onmessage = async (event: MessageEvent) => {
          try {
            if (typeof event.data !== "string") return;

            const msg = JSON.parse(event.data);

            if (msg.type === "vad") {
              // Forward VAD events to client with new protocol shape
              sendJson(ws, { type: "vad", is_speech: msg.is_speech });
              return;
            }

            if (msg.type === "transcription" && msg.text && !isProcessing) {
              isProcessing = true;
              const userText = msg.text.trim();

              // Send transcript to client
              sendJson(ws, {
                type: "transcript",
                text: userText,
                language: msg.language ?? "en",
              });

              // Run LLM inference
              try {
                const fullResponse = await runLlmAndStream(
                  ws,
                  deps.modelManager,
                  userText,
                  conversationHistory,
                );

                // Update conversation history
                conversationHistory.push(
                  { role: "user", content: userText },
                  { role: "assistant", content: fullResponse },
                );

                // Trim history to last 20 messages to avoid context overflow
                if (conversationHistory.length > 20) {
                  conversationHistory = conversationHistory.slice(-20);
                }

                // Call TTS and stream audio back
                await runTtsAndStream(ws, fullResponse);
              } catch (err) {
                console.error("[ws/chat-voice] Pipeline error:", err);
                sendJsonSafe(ws, {
                  type: "error",
                  message:
                    err instanceof Error ? err.message : "Pipeline error",
                });
              } finally {
                isProcessing = false;
              }
            }

            if (msg.type === "error") {
              sendJson(ws, {
                type: "error",
                message: msg.message ?? msg.detail ?? "Voice service error",
              });
            }
          } catch (err) {
            console.error(
              "[ws/chat-voice] Error processing voice service message:",
              err,
            );
          }
        };

        voiceWs.onerror = () => {
          console.error("[ws/chat-voice] Voice service WebSocket error");
          sendJsonSafe(ws, {
            type: "error",
            message: "Voice service connection error",
          });
        };

        voiceWs.onclose = () => {
          console.log("[ws/chat-voice] Voice service WebSocket closed");
        };
      },

      onMessage(evt, _ws) {
        const data = evt.data;

        // Only accept binary audio frames — no JSON config messages in new protocol
        if (typeof data === "string") {
          // Ignore text messages; protocol is binary-only from client
          return;
        }

        // Binary audio data -> forward to voice service STT
        if (voiceWs && voiceWs.readyState === WebSocket.OPEN) {
          if (data instanceof ArrayBuffer) {
            voiceWs.send(data);
          } else if (data instanceof Blob) {
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
        conversationHistory = [];
        console.log("[ws/chat-voice] Client disconnected");
      },

      onError(evt) {
        console.error("[ws/chat-voice] WebSocket error:", evt);
        if (voiceWs) {
          voiceWs.close();
          voiceWs = null;
        }
      },
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Send a JSON message to the client WebSocket. */
function sendJson(ws: WSContext, data: Record<string, unknown>): void {
  ws.send(JSON.stringify(data));
}

/** Send a JSON message, swallowing errors if the client has disconnected. */
function sendJsonSafe(ws: WSContext, data: Record<string, unknown>): void {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Client gone
  }
}

/**
 * Run LLM inference and stream response deltas back to the WebSocket client.
 * Returns the full response text.
 */
async function runLlmAndStream(
  ws: WSContext,
  modelManager: ModelManager,
  userText: string,
  history: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string> {
  const active = modelManager.getActive();
  if (!active) {
    throw new Error("No model loaded");
  }

  const provider = createLlamaProvider(modelManager);
  const model = provider.chat(active.sessionId);

  const messages = [
    ...history,
    { role: "user" as const, content: userText },
  ];

  sendJson(ws, { type: "response_start" });

  const result = streamText({
    model,
    messages,
  });

  let fullText = "";

  for await (const chunk of result.textStream) {
    fullText += chunk;
    sendJson(ws, { type: "response_delta", text: chunk });
  }

  sendJson(ws, { type: "response_end", text: fullText });

  return fullText;
}

/**
 * Call the TTS voice service and stream the resulting audio back over WebSocket
 * as base64-encoded chunks.
 */
async function runTtsAndStream(
  ws: WSContext,
  text: string,
): Promise<void> {
  const voicePort = env.VOICE_PORT;

  try {
    const res = await fetch(`http://127.0.0.1:${voicePort}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: "af_sky",
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[ws/chat-voice] TTS error:", errorText);
      sendJsonSafe(ws, {
        type: "error",
        message: `TTS failed: ${errorText}`,
      });
      return;
    }

    // Stream audio chunks back as base64-encoded JSON messages
    const reader = res.body?.getReader();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const base64 = Buffer.from(value).toString("base64");
      sendJson(ws, { type: "audio", data: base64 });
    }
  } catch (err) {
    console.error("[ws/chat-voice] TTS voice service error:", err);
    sendJsonSafe(ws, {
      type: "error",
      message: "TTS unavailable",
    });
  }
}
