import type {
  EmbeddingModelV3,
  EmbeddingModelV3CallOptions,
  EmbeddingModelV3Result,
  SharedV3Warning,
} from "@ai-sdk/provider";
import type { ModelManager } from "@vxllm/inference";

/**
 * AI SDK EmbeddingModelV3 adapter for node-llama-cpp.
 *
 * Bridges the Vercel AI SDK embedding interface to local embedding inference
 * via node-llama-cpp's LlamaEmbeddingContext.
 */
export class NodeLlamaCppEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "llama-cpp";
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 1;
  readonly supportsParallelCalls = false;

  private readonly modelManager: ModelManager;

  constructor(sessionId: string, modelManager: ModelManager) {
    this.modelId = sessionId;
    this.modelManager = modelManager;
  }

  async doEmbed(
    options: EmbeddingModelV3CallOptions,
  ): Promise<EmbeddingModelV3Result> {
    const entry = this.modelManager.getModelEntry(this.modelId);
    if (!entry) {
      throw new Error(
        `No model loaded with session ID "${this.modelId}". Load a model first via ModelManager.load().`,
      );
    }

    const warnings: SharedV3Warning[] = [];
    const embeddings: number[][] = [];
    let totalTokens = 0;

    // Create an embedding context from the model
    const embeddingContext = await entry.model.createEmbeddingContext();

    try {
      for (const value of options.values) {
        const embedding = await embeddingContext.getEmbeddingFor(value);
        embeddings.push([...embedding.vector]);
        totalTokens += entry.model.tokenize(value).length;
      }
    } finally {
      await embeddingContext.dispose();
    }

    return {
      embeddings,
      usage: { tokens: totalTokens },
      warnings,
    };
  }
}
