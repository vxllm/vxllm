export const DEFAULT_MODELS_DIR = "~/.vxllm/models";
export const DEFAULT_CONTEXT_SIZE = 8192;
export const MAX_CONCURRENT_DOWNLOADS = 2;
export const DEFAULT_PORT = 11500;

export const MODEL_TYPES = ["llm", "stt", "tts", "embedding"] as const;
export const MODEL_FORMATS = ["gguf", "whisper", "kokoro"] as const;

export const QUANTIZATION_TIERS = {
  Q4_K_S: { bitsPerWeight: 4.5, label: "Small (4-bit)" },
  Q4_K_M: { bitsPerWeight: 4.8, label: "Medium (4-bit)" },
  Q5_K_M: { bitsPerWeight: 5.7, label: "Medium (5-bit)" },
  Q8_0: { bitsPerWeight: 8.5, label: "High (8-bit)" },
  IQ3_M: { bitsPerWeight: 3.4, label: "Tiny (3-bit)" },
} as const;
