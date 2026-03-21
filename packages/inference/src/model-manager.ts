import { getLlama } from "node-llama-cpp";
import type { Llama, LlamaModel, LlamaContext } from "node-llama-cpp";
import { env } from "@vxllm/env/server";
import { detectHardware, calculateGpuLayers } from "./hardware";
import { DEFAULT_CONTEXT_SIZE } from "./constants";
import type { LoadedModel, ModelInfo } from "./types";

/** Internal entry tracking the raw node-llama-cpp objects alongside our metadata */
interface ModelEntry {
  model: LlamaModel;
  context: LlamaContext;
  info: LoadedModel;
}

/**
 * Manages loaded models in memory.
 *
 * Handles loading GGUF models via node-llama-cpp, tracking memory usage,
 * and providing access to active model sessions for inference.
 */
export class ModelManager {
  private _llama: Llama | null = null;
  private _models: Map<string, ModelEntry> = new Map();

  /**
   * Initialize the node-llama-cpp runtime.
   * Calls getLlama() once and caches the instance.
   * Must be called before loading any models.
   */
  async initialize(): Promise<Llama> {
    if (this._llama) {
      return this._llama;
    }
    this._llama = await getLlama();
    return this._llama;
  }

  /**
   * Return the cached Llama instance, or null if not yet initialized.
   * Useful for provider integration that needs direct access.
   */
  getLlama(): Llama | null {
    return this._llama;
  }

  /**
   * Load a model into memory.
   * Automatically determines optimal GPU layer count and context size
   * based on available hardware.
   */
  async load(modelInfo: ModelInfo): Promise<LoadedModel> {
    if (!modelInfo.localPath) {
      throw new Error(
        `Model "${modelInfo.name}" has no local path. Download it first.`,
      );
    }

    // Ensure llama runtime is initialized
    const llama = await this.initialize();

    // Detect hardware to calculate GPU layers
    const hardware = await detectHardware();

    // Determine GPU layers: env override takes precedence, then auto-calculate
    let gpuLayers: number;
    if (env.GPU_LAYERS_OVERRIDE != null) {
      gpuLayers = env.GPU_LAYERS_OVERRIDE;
    } else if (hardware.gpu.available) {
      gpuLayers = calculateGpuLayers(
        modelInfo.sizeBytes,
        hardware.gpu.vramBytes,
        modelInfo.variant ?? "Q4_K_M",
      );
    } else {
      gpuLayers = 0;
    }

    // Load the model with node-llama-cpp
    const model = await llama.loadModel({
      modelPath: modelInfo.localPath,
      gpuLayers,
    });

    // Determine context size:
    // Use the minimum of env.MAX_CONTEXT_SIZE, the model's train context size,
    // and our default. This prevents allocating more context than the model supports
    // or more than the user configured.
    const modelTrainContextSize = model.trainContextSize;
    const envContextSize = env.MAX_CONTEXT_SIZE ?? DEFAULT_CONTEXT_SIZE;
    const contextSize = Math.min(
      envContextSize,
      modelTrainContextSize > 0 ? modelTrainContextSize : envContextSize,
    );

    // Create context for inference
    const context = await model.createContext({
      contextSize,
    });

    // Generate session ID
    const sessionId = crypto.randomUUID();

    const loadedModel: LoadedModel = {
      modelInfo,
      sessionId,
      memoryUsageBytes: model.size,
      gpuLayersLoaded: model.gpuLayers,
      contextSize: context.contextSize,
      createdAt: Date.now(),
    };

    this._models.set(sessionId, {
      model,
      context,
      info: loadedModel,
    });

    return loadedModel;
  }

  /**
   * Unload a model from memory and free associated resources.
   * @param sessionId - The session ID of the loaded model to unload
   */
  async unload(sessionId: string): Promise<void> {
    const entry = this._models.get(sessionId);
    if (!entry) {
      throw new Error(`No model loaded with session ID "${sessionId}"`);
    }

    // Dispose context first, then model
    await entry.context.dispose();
    await entry.model.dispose();

    this._models.delete(sessionId);
  }

  /**
   * Get all currently loaded models.
   * @returns Array of loaded model instances
   */
  getLoaded(): LoadedModel[] {
    return Array.from(this._models.values()).map((entry) => entry.info);
  }

  /**
   * Get the loaded model for a specific type (node-llama-cpp models only).
   * STT/TTS models run in the Python voice service and are never tracked here.
   * @param type - "llm" or "embedding"
   * @returns The loaded model of that type, or null
   */
  getByType(type: "llm" | "embedding"): LoadedModel | null {
    for (const entry of this._models.values()) {
      if (entry.info.modelInfo.type === type) {
        return entry.info;
      }
    }
    return null;
  }

  /**
   * Get all loaded node-llama-cpp models grouped by type.
   * Used by the Settings UI to display all slots.
   */
  getLoadedByType(): { llm: LoadedModel | null; embedding: LoadedModel | null } {
    return {
      llm: this.getByType("llm"),
      embedding: this.getByType("embedding"),
    };
  }

  /**
   * Get the currently active LLM model.
   * Alias for getByType("llm") — maintained for backward compat with chat endpoint.
   */
  getActive(): LoadedModel | null {
    return this.getByType("llm");
  }

  /**
   * Get the raw model entry (model, context, info) for provider integration.
   * @param sessionId - The session ID of the loaded model
   * @returns The internal model entry, or undefined if not found
   */
  getModelEntry(
    sessionId: string,
  ): { model: LlamaModel; context: LlamaContext; info: LoadedModel } | undefined {
    return this._models.get(sessionId);
  }

  /**
   * Count the number of tokens in a text string using the model's tokenizer.
   * @param sessionId - The session ID of the loaded model to use for tokenization
   * @param text - The text to tokenize and count
   * @returns The number of tokens
   */
  countTokens(sessionId: string, text: string): number {
    const entry = this._models.get(sessionId);
    if (!entry) {
      throw new Error(`No model loaded with session ID "${sessionId}"`);
    }
    return entry.model.tokenize(text).length;
  }

  /**
   * Dispose all loaded models and free all resources.
   * Should be called during server shutdown.
   */
  async disposeAll(): Promise<void> {
    const sessionIds = Array.from(this._models.keys());
    for (const sessionId of sessionIds) {
      await this.unload(sessionId);
    }
  }
}
