import { Hono } from "hono";
import { embed } from "ai";
import { db } from "@vxllm/db";
import { usageMetrics } from "@vxllm/db/schema/metrics";
import { EmbeddingRequestSchema } from "@vxllm/api/schemas/openai";
import type { ModelManager } from "@vxllm/inference";
import { createLlamaProvider } from "@vxllm/llama-provider";

/**
 * POST /v1/embeddings
 *
 * OpenAI-compatible embeddings endpoint.
 * Takes text input(s) and returns embedding vectors.
 */
export function createEmbeddingsRoute(deps: { modelManager: ModelManager }) {
  const embeddings = new Hono();

  embeddings.post("/embeddings", async (c) => {
    const startTime = Date.now();
    const body = await c.req.json();

    // Validate request body
    const parsed = EmbeddingRequestSchema.safeParse(body);
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

    // Find an embedding-capable model, or fall back to the active model
    const loaded = deps.modelManager.getLoaded();
    const embeddingModel = loaded.find(
      (m) => m.modelInfo.type === "embedding",
    );
    const active = embeddingModel ?? deps.modelManager.getActive();

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
    const embeddingModelInstance = provider.embedding(active.sessionId);

    // Normalize input to array
    const inputs = Array.isArray(request.input)
      ? request.input
      : [request.input];

    // Generate embeddings
    const data: Array<{
      embedding: number[];
      index: number;
      object: "embedding";
    }> = [];
    let totalTokens = 0;

    if (inputs.length === 1) {
      // Single embedding
      const result = await embed({
        model: embeddingModelInstance,
        value: inputs[0]!,
      });

      data.push({
        embedding: result.embedding,
        index: 0,
        object: "embedding",
      });
      totalTokens = result.usage?.tokens ?? 0;
    } else {
      // Multiple embeddings -- process one at a time since our provider
      // has maxEmbeddingsPerCall = 1
      for (let i = 0; i < inputs.length; i++) {
        const result = await embed({
          model: embeddingModelInstance,
          value: inputs[i]!,
        });

        data.push({
          embedding: result.embedding,
          index: i,
          object: "embedding",
        });
        totalTokens += result.usage?.tokens ?? 0;
      }
    }

    const latencyMs = Date.now() - startTime;

    // Persist usage metric (fire-and-forget)
    db.insert(usageMetrics)
      .values({
        id: crypto.randomUUID(),
        modelId: null,
        type: "embedding",
        tokensIn: totalTokens,
        tokensOut: 0,
        latencyMs,
        createdAt: Date.now(),
      })
      .catch((err) => {
        console.error("[embeddings] DB persistence failed:", err);
      });

    return c.json({
      object: "list",
      data,
      model: request.model,
      usage: {
        prompt_tokens: totalTokens,
        total_tokens: totalTokens,
      },
    });
  });

  return embeddings;
}
