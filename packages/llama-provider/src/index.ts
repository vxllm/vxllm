import type { ModelManager } from "@vxllm/inference";
import { NodeLlamaCppLanguageModel } from "./language-model";
import { NodeLlamaCppEmbeddingModel } from "./embedding-model";

export type { LlamaProviderSettings } from "./types";
export { NodeLlamaCppLanguageModel } from "./language-model";
export { NodeLlamaCppEmbeddingModel } from "./embedding-model";

/**
 * Create a llama-cpp provider for AI SDK.
 *
 * Returns factory functions that create LanguageModel and EmbeddingModel
 * instances backed by node-llama-cpp for local inference.
 *
 * @param modelManager - The ModelManager instance managing loaded models
 * @returns Provider object with chat() and embedding() factory methods
 *
 * @example
 * ```ts
 * const provider = createLlamaProvider(modelManager);
 * const model = provider.chat(sessionId);
 * const result = await generateText({ model, prompt: "Hello!" });
 * ```
 */
export function createLlamaProvider(modelManager: ModelManager) {
  return {
    chat: (sessionId: string) =>
      new NodeLlamaCppLanguageModel(sessionId, modelManager),
    embedding: (sessionId: string) =>
      new NodeLlamaCppEmbeddingModel(sessionId, modelManager),
  };
}
