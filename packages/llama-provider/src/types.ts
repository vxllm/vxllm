import type { ModelManager } from "@vxllm/inference";

/** Configuration settings for the llama-cpp AI SDK provider */
export interface LlamaProviderSettings {
  /** ModelManager instance for accessing loaded models */
  modelManager: ModelManager;
  /** Default sampling temperature (optional, defaults determined at inference time) */
  defaultTemperature?: number;
  /** Default maximum tokens to generate (optional) */
  defaultMaxTokens?: number;
}
