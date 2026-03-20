import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { generateText, streamText } from "ai";
import { db } from "@vxllm/db";
import { conversations, messages } from "@vxllm/db/schema/conversations";
import { usageMetrics } from "@vxllm/db/schema/metrics";
import { ChatCompletionRequestSchema } from "@vxllm/api/schemas/openai";
import type { ModelManager, Registry } from "@vxllm/inference";
import { createLlamaProvider } from "@vxllm/llama-provider";
import { eq } from "drizzle-orm";

/**
 * POST /v1/chat/completions
 *
 * OpenAI-compatible chat completion endpoint.
 * Supports both streaming (SSE) and non-streaming JSON responses.
 * Persists conversations, messages, and usage metrics to the database.
 */
export function createChatRoute(deps: {
  modelManager: ModelManager;
  registry: Registry;
}) {
  const chat = new Hono();

  chat.post("/completions", async (c) => {
    const startTime = Date.now();
    const body = await c.req.json();

    // Validate request body
    const parsed = ChatCompletionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: `Invalid request: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
            type: "invalid_request_error",
            code: null,
            param: null,
          },
        },
        400,
      );
    }

    const request = parsed.data;

    // Resolve model -- check if any model is loaded
    const active = deps.modelManager.getActive();
    if (!active) {
      return c.json(
        {
          error: {
            message: "No model loaded. Load a model first via POST /api/models/pull or the CLI.",
            type: "server_error",
            code: "model_not_loaded",
            param: null,
          },
        },
        503,
      );
    }

    const provider = createLlamaProvider(deps.modelManager);
    const model = provider.chat(active.sessionId);

    // Convert OpenAI messages format to AI SDK format
    const aiMessages = request.messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    // Resolve conversation ID from header or generate a new one
    const conversationId =
      c.req.header("X-Conversation-Id") ?? crypto.randomUUID();

    const requestId = `chatcmpl-${crypto.randomUUID().slice(0, 8)}`;

    if (request.stream) {
      // ── Streaming SSE response ──────────────────────────────────────────
      return streamSSE(c, async (stream) => {
        let fullText = "";

        const result = streamText({
          model,
          messages: aiMessages,
          maxOutputTokens: request.max_tokens ?? undefined,
          temperature: request.temperature ?? undefined,
          topP: request.top_p ?? undefined,
          stopSequences: request.stop ?? undefined,
          frequencyPenalty: request.frequency_penalty ?? undefined,
          presencePenalty: request.presence_penalty ?? undefined,
        });

        for await (const chunk of result.textStream) {
          fullText += chunk;
          await stream.writeSSE({
            data: JSON.stringify({
              id: requestId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: request.model,
              choices: [
                {
                  index: 0,
                  delta: { content: chunk },
                  finish_reason: null,
                },
              ],
            }),
          });
        }

        // Final chunk with finish_reason and usage
        const usage = await result.usage;
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;
        const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

        await stream.writeSSE({
          data: JSON.stringify({
            id: requestId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: inputTokens,
              completion_tokens: outputTokens,
              total_tokens: totalTokens,
            },
          }),
        });

        await stream.writeSSE({ data: "[DONE]" });

        // Persist to DB after streaming completes (fire-and-forget)
        const latencyMs = Date.now() - startTime;
        persistChatToDb({
          conversationId,
          userContent:
            request.messages[request.messages.length - 1]?.content ?? "",
          assistantContent: fullText,
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          latencyMs,
          firstMessageContent: request.messages[0]?.content,
        }).catch((err) => {
          console.error("[chat] DB persistence failed:", err);
        });
      });
    } else {
      // ── Non-streaming JSON response ─────────────────────────────────────
      const result = await generateText({
        model,
        messages: aiMessages,
        maxOutputTokens: request.max_tokens ?? undefined,
        temperature: request.temperature ?? undefined,
        topP: request.top_p ?? undefined,
        stopSequences: request.stop ?? undefined,
        frequencyPenalty: request.frequency_penalty ?? undefined,
        presencePenalty: request.presence_penalty ?? undefined,
      });

      const latencyMs = Date.now() - startTime;
      const inputTokens = result.usage.inputTokens ?? 0;
      const outputTokens = result.usage.outputTokens ?? 0;
      const totalTokens =
        result.usage.totalTokens ?? inputTokens + outputTokens;

      // Persist to DB (fire-and-forget)
      persistChatToDb({
        conversationId,
        userContent:
          request.messages[request.messages.length - 1]?.content ?? "",
        assistantContent: result.text,
        tokensIn: inputTokens,
        tokensOut: outputTokens,
        latencyMs,
        firstMessageContent: request.messages[0]?.content,
      }).catch((err) => {
        console.error("[chat] DB persistence failed:", err);
      });

      return c.json({
        id: requestId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.text },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
        },
      });
    }
  });

  return chat;
}

// ── DB Persistence Helper ─────────────────────────────────────────────────────

interface PersistChatParams {
  conversationId: string;
  userContent: string;
  assistantContent: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  firstMessageContent?: string;
}

/**
 * Persist a chat exchange to the database.
 *
 * Creates the conversation if it doesn't exist, inserts user and assistant
 * messages, and records a usage metric entry.
 */
async function persistChatToDb(params: PersistChatParams): Promise<void> {
  const {
    conversationId,
    userContent,
    assistantContent,
    tokensIn,
    tokensOut,
    latencyMs,
    firstMessageContent,
  } = params;

  const now = Date.now();

  // Check if conversation exists, create if not
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!existing.length) {
    await db.insert(conversations).values({
      id: conversationId,
      title: firstMessageContent?.slice(0, 50) ?? "New conversation",
      modelId: null, // modelId in conversations references models.id (DB UUID), not the name
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // Update the conversation's updatedAt timestamp
    await db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, conversationId));
  }

  // Insert user message
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    conversationId,
    role: "user",
    content: userContent,
    createdAt: now,
  });

  // Insert assistant message
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    conversationId,
    role: "assistant",
    content: assistantContent,
    tokensIn,
    tokensOut,
    latencyMs,
    createdAt: now,
  });

  // Insert usage metric
  await db.insert(usageMetrics).values({
    id: crypto.randomUUID(),
    modelId: null, // Would need the DB model UUID, not the name string
    type: "chat",
    tokensIn,
    tokensOut,
    latencyMs,
    createdAt: now,
  });
}
