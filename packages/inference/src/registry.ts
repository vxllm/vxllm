import type { ModelInfo } from "./types";

/**
 * Reads and queries the models.json registry.
 *
 * Provides search, resolution, and variant listing for models
 * defined in the curated model index.
 */
export class Registry {
  /**
   * Search models by name or query string.
   * @param query - Search query to match against model names and descriptions
   * @param type - Optional filter by model type (llm, stt, tts, embedding)
   * @returns Array of matching model info entries
   */
  async search(_query: string, _type?: string): Promise<ModelInfo[]> {
    throw new Error("Not implemented");
  }

  /**
   * Resolve a model name to its full registry information.
   * @param name - Model name or alias to resolve
   * @returns Full model info, or null if not found
   */
  async resolve(_name: string): Promise<ModelInfo | null> {
    throw new Error("Not implemented");
  }

  /**
   * Get all available quantization variants for a model.
   * @param name - Base model name
   * @returns Array of model info entries for each variant
   */
  async getVariants(_name: string): Promise<ModelInfo[]> {
    throw new Error("Not implemented");
  }
}
