import type { LoadedModel, ModelInfo } from "./types";

/**
 * Manages loaded models in memory.
 *
 * Handles loading GGUF models via node-llama-cpp, tracking memory usage,
 * and providing access to active model sessions for inference.
 */
export class ModelManager {
  /**
   * Load a model into memory.
   * Automatically determines optimal GPU layer count and context size
   * based on available hardware.
   */
  async load(_modelInfo: ModelInfo): Promise<LoadedModel> {
    throw new Error("Not implemented");
  }

  /**
   * Unload a model from memory and free associated resources.
   * @param sessionId - The session ID of the loaded model to unload
   */
  async unload(_sessionId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  /**
   * Get all currently loaded models.
   * @returns Array of loaded model instances
   */
  getLoaded(): LoadedModel[] {
    throw new Error("Not implemented");
  }

  /**
   * Get the currently active (primary) model, if any.
   * @returns The active loaded model, or null if no model is loaded
   */
  getActive(): LoadedModel | null {
    throw new Error("Not implemented");
  }
}
