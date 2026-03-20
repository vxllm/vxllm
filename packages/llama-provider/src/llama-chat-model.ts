import type { LlamaProviderSettings } from "./types";

/**
 * AI SDK custom language model for node-llama-cpp.
 * Implements LanguageModel interface (exact version TBD from AI SDK).
 * This is a stub -- implementation comes in Sub-project #2.
 */
export class LlamaChatLanguageModel {
  readonly modelId: string;
  readonly provider = "llama-cpp";
  /** @internal Stored for use in Sub-project #2 implementation */
  protected readonly settings: LlamaProviderSettings;

  constructor(modelId: string, settings: LlamaProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
  }

  /** Generate a complete response */
  async doGenerate(_options: unknown): Promise<unknown> {
    throw new Error("Not implemented — requires node-llama-cpp integration");
  }

  /** Stream a response token by token */
  async doStream(_options: unknown): Promise<unknown> {
    throw new Error("Not implemented — requires node-llama-cpp integration");
  }
}
