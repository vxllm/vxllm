import type { LlamaProviderSettings } from "./types";
import { LlamaChatLanguageModel } from "./llama-chat-model";
import { LlamaEmbeddingModel } from "./llama-embedding-model";

export type { LlamaProviderSettings } from "./types";
export { LlamaChatLanguageModel } from "./llama-chat-model";
export { LlamaEmbeddingModel } from "./llama-embedding-model";

/**
 * Create a llama-cpp provider for AI SDK.
 * Returns factory functions for chat and embedding models.
 */
export function createLlamaProvider(settings: LlamaProviderSettings) {
  return {
    chat: (modelId: string) => new LlamaChatLanguageModel(modelId, settings),
    embedding: (modelId: string) =>
      new LlamaEmbeddingModel(modelId, settings),
  };
}
