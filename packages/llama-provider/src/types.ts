import type { ModelManager } from "@vxllm/inference";

/** Configuration for the llama-cpp AI SDK provider */
export interface LlamaProviderSettings {
  /** ModelManager instance for accessing loaded models */
  modelManager: ModelManager;
}
