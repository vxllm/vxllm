import { Hono } from "hono";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { persistChat } from "@vxllm/api/services/chat.service";
import type { ModelManager } from "@vxllm/inference";
import { createLlamaProvider } from "@vxllm/llama-provider";

/**
 * POST /api/chat
 *
 * AI SDK v6 chat endpoint for the frontend.
 * Accepts UIMessage format from DefaultChatTransport and returns
 * a UIMessageStream response that useChat can parse.
 */
export function createApiChatRoute(deps: { modelManager: ModelManager }) {
  const chat = new Hono();

  chat.post("/", async (c) => {
    const startTime = Date.now();

    const active = deps.modelManager.getActive();
    if (!active) {
      return c.json(
        {
          error: {
            message:
              "No model loaded. Load a model first via the Settings page.",
            type: "server_error",
            code: "model_not_loaded",
          },
        },
        503,
      );
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch (err) {
      console.error("[api/chat] Failed to parse request body:", err);
      return c.json({ error: { message: "Invalid JSON body" } }, 400);
    }

    // DefaultChatTransport sends { id, messages } where messages are UIMessages
    const uiMessages: UIMessage[] = body.messages ?? [];

    if (uiMessages.length === 0) {
      return c.json({ error: { message: "No messages provided" } }, 400);
    }

    // Convert UIMessages to ModelMessages for the AI SDK (async in v6)
    let modelMessages;
    try {
      modelMessages = await convertToModelMessages(uiMessages);
    } catch (err) {
      console.error("[api/chat] Failed to convert messages:", err);
      console.error("[api/chat] Input messages:", JSON.stringify(uiMessages, null, 2));
      return c.json({ error: { message: "Failed to convert messages" } }, 400);
    }

    // Get conversation ID from header (set by DefaultChatTransport headers config)
    const conversationId =
      c.req.header("X-Conversation-Id") ?? crypto.randomUUID();

    const provider = createLlamaProvider(deps.modelManager);
    const model = provider.chat(active.sessionId);

    // Extract user content for persistence
    const lastUserMsg = uiMessages.findLast((m) => m.role === "user");
    const userContent = lastUserMsg?.parts
      ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";

    const firstMsg = uiMessages[0];
    const firstMessageContent = firstMsg?.parts
      ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("") ?? undefined;

    const result = streamText({
      model,
      messages: modelMessages,
      onError: ({ error }) => {
        console.error("[api/chat] streamText error:", error);
      },
      onFinish: async ({ text, usage }) => {
        const latencyMs = Date.now() - startTime;
        const tokensIn = usage.inputTokens ?? 0;
        const tokensOut = usage.outputTokens ?? 0;

        persistChat({
          conversationId,
          modelId: null,
          userContent,
          assistantContent: text,
          tokensIn,
          tokensOut,
          latencyMs,
          firstMessageContent,
        }).catch((err) => {
          console.error("[api/chat] DB persistence failed:", err);
        });
      },
    });

    // Return the AI SDK UIMessageStream response directly
    return result.toUIMessageStreamResponse();
  });

  return chat;
}
