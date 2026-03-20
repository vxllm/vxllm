/** Detected system hardware capabilities */
export interface HardwareProfile {
  /** Operating system platform */
  platform: "darwin" | "linux" | "win32";
  /** CPU architecture */
  arch: "arm64" | "x64";
  /** Whether the system has Apple Silicon (M-series) */
  isAppleSilicon: boolean;
  /** GPU information */
  gpu: {
    /** Whether a compatible GPU is available */
    available: boolean;
    /** GPU vendor */
    vendor: "apple" | "nvidia" | "amd" | "none";
    /** GPU model name */
    name: string;
    /** Total GPU VRAM in bytes */
    vramBytes: number;
  };
  /** CPU information */
  cpu: {
    /** CPU model name */
    model: string;
    /** Number of physical CPU cores */
    physicalCores: number;
    /** Number of logical CPU cores (including hyperthreading) */
    logicalCores: number;
  };
  /** System memory information */
  ram: {
    /** Total system RAM in bytes */
    totalBytes: number;
    /** Currently available RAM in bytes */
    availableBytes: number;
  };
}

/** Information about a model in the registry or on disk */
export interface ModelInfo {
  /** Unique model identifier (e.g. "llama-3.2-1b") */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Short description of the model */
  description: string | null;
  /** Model type */
  type: "llm" | "stt" | "tts" | "embedding";
  /** Model file format */
  format: "gguf" | "whisper" | "kokoro";
  /** Quantization variant (e.g. "Q4_K_M") or null */
  variant: string | null;
  /** HuggingFace repository (e.g. "TheBloke/Llama-2-7B-GGUF") */
  repo: string | null;
  /** Specific file name in the repository */
  fileName: string | null;
  /** Local file system path if downloaded */
  localPath: string | null;
  /** Model file size in bytes */
  sizeBytes: number;
  /** Minimum RAM required in GB, or null if unknown */
  minRamGb: number | null;
  /** Recommended VRAM in GB for GPU offloading, or null if unknown */
  recommendedVramGb: number | null;
  /** Current model status */
  status: "available" | "downloading" | "downloaded" | "error";
}

/** Options for LLM inference */
export interface InferenceOptions {
  /** Sampling temperature (0.0 = deterministic, higher = more random) */
  temperature: number;
  /** Maximum number of tokens to generate */
  maxTokens: number;
  /** Top-p (nucleus) sampling threshold */
  topP: number;
  /** Top-k sampling: only consider the k most likely tokens */
  topK: number;
  /** Penalty for repeating tokens */
  repeatPenalty: number;
  /** Stop sequences that halt generation */
  stop: string[];
  /** Whether to stream the response token by token */
  stream: boolean;
}

/** A model currently loaded in memory and ready for inference */
export interface LoadedModel {
  /** The model's registry information */
  modelInfo: ModelInfo;
  /** Unique session identifier for this loaded instance */
  sessionId: string;
  /** Memory used by this model in bytes */
  memoryUsageBytes: number;
  /** Number of layers offloaded to GPU */
  gpuLayersLoaded: number;
  /** Context window size in tokens */
  contextSize: number;
  /** Unix timestamp (ms) when the model was loaded */
  createdAt: number;
}

/** Progress information for an ongoing model download */
export interface DownloadProgress {
  /** Model identifier being downloaded */
  modelId: string;
  /** Download priority (lower = higher priority) */
  priority: number;
  /** Current download status */
  status: "queued" | "active" | "paused" | "completed" | "failed";
  /** Download progress as a percentage (0-100) */
  progressPct: number;
  /** Bytes downloaded so far */
  downloadedBytes: number;
  /** Total file size in bytes */
  totalBytes: number;
  /** Current download speed in bytes per second */
  speedBps: number;
  /** Estimated time remaining in seconds, or null if unknown */
  eta: number | null;
  /** Error message if status is "failed", otherwise null */
  error: string | null;
}
