import type { LlamaProviderSettings } from "./types";

/**
 * AI SDK custom embedding model for node-llama-cpp.
 * This is a stub -- implementation comes in Sub-project #2.
 */
export class LlamaEmbeddingModel {
  readonly modelId: string;
  readonly provider = "llama-cpp";
  /** @internal Stored for use in Sub-project #2 implementation */
  protected readonly settings: LlamaProviderSettings;

  constructor(modelId: string, settings: LlamaProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
  }

  /** Generate embeddings for input text(s) */
  async doEmbed(_options: unknown): Promise<unknown> {
    throw new Error("Not implemented — requires node-llama-cpp integration");
  }
}
