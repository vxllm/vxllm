import { createBunWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { streamText } from "ai";
import { env } from "@vxllm/env/server";
import type { ModelManager } from "@vxllm/inference";
import { createLlamaProvider } from "@vxllm/llama-provider";

const { upgradeWebSocket } = createBunWebSocket();

/**
 * Client config message (JSON, sent once after connection opens):
 */
interface VoiceChatConfig {
  /** Optional system prompt for the LLM. */
  systemPrompt?: string;
  /** TTS voice name (e.g. "af_sky"). */
  voice?: string;
}

/**
 * Server -> Client JSON message types:
 *   { type: "stt_result", text, language, confidence }
 *   { type: "llm_token", text }
 *   { type: "llm_done" }
 *   { type: "tts_audio" }  (followed by binary audio chunks)
 *   { type: "turn_end" }
 *   { type: "error", detail }
 *   { type: "config_ack" }
 */

/**
 * WS /ws/chat
 *
 * Full voice chat loop: audio -> STT (via sidecar) -> LLM -> TTS (via sidecar) -> audio.
 *
 * Flow:
 * 1. Client connects, sends a JSON config message.
 * 2. Client streams binary PCM audio frames.
 * 3. Audio is proxied to the sidecar STT WebSocket.
 * 4. When sidecar returns a transcription, we:
 *    a. Send { type: "stt_result", text } to the client.
 *    b. Run LLM inference, streaming tokens as { type: "llm_token", text }.
 *    c. Send { type: "llm_done" } when generation finishes.
 *    d. Call TTS sidecar with the full response, stream audio back.
 *    e. Send { type: "turn_end" }.
 * 5. Client can send more audio for the next turn.
 */
export function createVoiceChatRoute(deps: { modelManager: ModelManager }) {
  return upgradeWebSocket(() => {
    let sidecarWs: WebSocket | null = null;
    let config: VoiceChatConfig = {};
    let conversationHistory: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];
    let isProcessing = false;

    return {
      onOpen(_evt, ws) {
        console.log("[ws/chat-voice] Client connected");

        // Connect to the sidecar STT WebSocket
        const sidecarUrl = env.VOICE_SIDECAR_URL.replace(/^http/, "ws");
        sidecarWs = new WebSocket(`${sidecarUrl}/stream`);
        sidecarWs.binaryType = "arraybuffer";

        sidecarWs.onopen = () => {
          console.log(
            "[ws/chat-voice] Connected to voice sidecar for STT",
          );
        };

        sidecarWs.onmessage = async (event: MessageEvent) => {
          try {
            if (typeof event.data !== "string") return;

            const msg = JSON.parse(event.data);

            if (msg.type === "vad") {
              // Forward VAD events to client
              ws.send(JSON.stringify(msg));
              return;
            }

            if (msg.type === "transcription" && msg.text && !isProcessing) {
              isProcessing = true;
              const userText = msg.text.trim();

              // Send STT result to client
              ws.send(
                JSON.stringify({
                  type: "stt_result",
                  text: userText,
                  language: msg.language,
                  confidence: msg.confidence,
                }),
              );

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
                await runTtsAndStream(ws, fullResponse, config.voice);

                ws.send(JSON.stringify({ type: "turn_end" }));
              } catch (err) {
                console.error("[ws/chat-voice] Pipeline error:", err);
                try {
                  ws.send(
                    JSON.stringify({
                      type: "error",
                      detail:
                        err instanceof Error
                          ? err.message
                          : "Pipeline error",
                    }),
                  );
                } catch {
                  // Client gone
                }
              } finally {
                isProcessing = false;
              }
            }

            if (msg.type === "error") {
              ws.send(JSON.stringify(msg));
            }
          } catch (err) {
            console.error(
              "[ws/chat-voice] Error processing sidecar message:",
              err,
            );
          }
        };

        sidecarWs.onerror = () => {
          console.error("[ws/chat-voice] Sidecar WebSocket error");
          try {
            ws.send(
              JSON.stringify({
                type: "error",
                detail: "Voice sidecar connection error",
              }),
            );
          } catch {
            // Ignore
          }
        };

        sidecarWs.onclose = () => {
          console.log("[ws/chat-voice] Sidecar WebSocket closed");
        };
      },

      onMessage(evt, ws) {
        const data = evt.data;

        if (typeof data === "string") {
          // JSON config message
          try {
            const parsed = JSON.parse(data);
            config = {
              systemPrompt: parsed.systemPrompt,
              voice: parsed.voice,
            };

            // Set system prompt in conversation history
            if (config.systemPrompt) {
              conversationHistory = [
                { role: "system", content: config.systemPrompt },
              ];
            }

            ws.send(JSON.stringify({ type: "config_ack" }));
          } catch {
            ws.send(
              JSON.stringify({
                type: "error",
                detail: "Invalid JSON config message",
              }),
            );
          }
          return;
        }

        // Binary audio data -> forward to sidecar STT
        if (sidecarWs && sidecarWs.readyState === WebSocket.OPEN) {
          if (data instanceof ArrayBuffer) {
            sidecarWs.send(data);
          } else if (data instanceof Blob) {
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
        conversationHistory = [];
        console.log("[ws/chat-voice] Client disconnected");
      },

      onError(evt) {
        console.error("[ws/chat-voice] WebSocket error:", evt);
        if (sidecarWs) {
          sidecarWs.close();
          sidecarWs = null;
        }
      },
    };
  });
}

/**
 * Run LLM inference and stream tokens back to the WebSocket client.
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

  const result = streamText({
    model,
    messages,
  });

  let fullText = "";

  for await (const chunk of result.textStream) {
    fullText += chunk;
    ws.send(JSON.stringify({ type: "llm_token", text: chunk }));
  }

  ws.send(JSON.stringify({ type: "llm_done" }));

  return fullText;
}

/**
 * Call the TTS sidecar and stream the resulting audio back over WebSocket.
 */
async function runTtsAndStream(
  ws: WSContext,
  text: string,
  voice?: string,
): Promise<void> {
  const sidecarUrl = env.VOICE_SIDECAR_URL;

  try {
    const res = await fetch(`${sidecarUrl}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: voice ?? "af_sky",
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[ws/chat-voice] TTS error:", errorText);
      ws.send(
        JSON.stringify({
          type: "error",
          detail: `TTS failed: ${errorText}`,
        }),
      );
      return;
    }

    // Signal that TTS audio is coming
    ws.send(JSON.stringify({ type: "tts_audio" }));

    // Stream audio chunks back as binary
    const reader = res.body?.getReader();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      ws.send(value);
    }
  } catch (err) {
    console.error("[ws/chat-voice] TTS sidecar error:", err);
    ws.send(
      JSON.stringify({
        type: "error",
        detail: "TTS sidecar is not available",
      }),
    );
  }
}
