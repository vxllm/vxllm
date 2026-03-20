import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { generateText, streamText } from "ai";
import { db } from "@vxllm/db";
import { usageMetrics } from "@vxllm/db/schema/metrics";
import type { ModelManager } from "@vxllm/inference";
import { createLlamaProvider } from "@vxllm/llama-provider";
import { CompletionRequestSchema } from "@vxllm/api/schemas/openai";

/**
 * POST /v1/completions
 *
 * OpenAI-compatible text completion endpoint (legacy).
 * Takes a prompt string and returns generated text.
 * Supports both streaming (SSE) and non-streaming JSON responses.
 */
export function createCompletionsRoute(deps: { modelManager: ModelManager }) {
  const completions = new Hono();

  completions.post("/completions", async (c) => {
    const startTime = Date.now();
    const body = await c.req.json();

    // Validate request body
    const parsed = CompletionRequestSchema.safeParse(body);
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

    // Resolve active model
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

    // Normalize prompt to a single string
    const promptText = Array.isArray(request.prompt)
      ? request.prompt.join("")
      : request.prompt;

    // Build a single user message for the AI SDK
    const aiMessages = [{ role: "user" as const, content: promptText }];

    const requestId = `cmpl-${crypto.randomUUID().slice(0, 8)}`;

    if (request.stream) {
      // ── Streaming SSE response ──────────────────────────────────────────
      return streamSSE(c, async (stream) => {
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
          await stream.writeSSE({
            data: JSON.stringify({
              id: requestId,
              object: "text_completion",
              created: Math.floor(Date.now() / 1000),
              model: request.model,
              choices: [
                {
                  text: chunk,
                  index: 0,
                  logprobs: null,
                  finish_reason: null,
                },
              ],
            }),
          });
        }

        // Final chunk with usage
        const usage = await result.usage;
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;
        const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

        await stream.writeSSE({
          data: JSON.stringify({
            id: requestId,
            object: "text_completion",
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [
              {
                text: "",
                index: 0,
                logprobs: null,
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

        // Persist usage metric (fire-and-forget)
        const latencyMs = Date.now() - startTime;
        db.insert(usageMetrics)
          .values({
            id: crypto.randomUUID(),
            modelId: null,
            type: "completion",
            tokensIn: inputTokens,
            tokensOut: outputTokens,
            latencyMs,
            createdAt: Date.now(),
          })
          .catch((err) => {
            console.error("[completions] DB persistence failed:", err);
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

      // Persist usage metric (fire-and-forget)
      db.insert(usageMetrics)
        .values({
          id: crypto.randomUUID(),
          modelId: null,
          type: "completion",
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          latencyMs,
          createdAt: Date.now(),
        })
        .catch((err) => {
          console.error("[completions] DB persistence failed:", err);
        });

      return c.json({
        id: requestId,
        object: "text_completion",
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            text: result.text,
            index: 0,
            logprobs: null,
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

  return completions;
}
