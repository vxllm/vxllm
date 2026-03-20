import os from "node:os";
import { getLlama } from "node-llama-cpp";
import type { HardwareProfile } from "./types";
import { QUANTIZATION_TIERS } from "./constants";

/**
 * Detect system hardware capabilities (GPU, CPU, RAM).
 *
 * Inspects the current system to determine available compute resources,
 * including GPU vendor and VRAM, CPU cores, and available memory.
 * Used to decide optimal model loading parameters (GPU layers, context size, etc.).
 */
export async function detectHardware(): Promise<HardwareProfile> {
  const llama = await getLlama();

  const platform = os.platform() as HardwareProfile["platform"];
  const arch = os.arch() as HardwareProfile["arch"];
  const isAppleSilicon = platform === "darwin" && arch === "arm64";

  // GPU detection via node-llama-cpp
  const gpuBackend = llama.gpu; // "metal" | "cuda" | "vulkan" | false
  const supportsGpu = llama.supportsGpuOffloading;
  const vramState = await llama.getVramState();
  const gpuDeviceNames = await llama.getGpuDeviceNames();

  let vendor: HardwareProfile["gpu"]["vendor"] = "none";
  if (gpuBackend === "metal") {
    vendor = "apple";
  } else if (gpuBackend === "cuda") {
    vendor = "nvidia";
  } else if (gpuBackend === "vulkan") {
    // Vulkan could be AMD or NVIDIA; check device name heuristics
    const deviceName = gpuDeviceNames[0] ?? "";
    if (deviceName.toLowerCase().includes("nvidia")) {
      vendor = "nvidia";
    } else if (
      deviceName.toLowerCase().includes("amd") ||
      deviceName.toLowerCase().includes("radeon")
    ) {
      vendor = "amd";
    }
  }

  // CPU detection via Node.js os module
  const cpus = os.cpus();
  const logicalCores = cpus.length;
  // Estimate physical cores: on Apple Silicon / ARM, logical == physical (no HT)
  // On x86, typically logical = physical * 2 (with hyperthreading)
  const physicalCores =
    arch === "arm64" ? logicalCores : Math.ceil(logicalCores / 2);
  const cpuModel = cpus[0]?.model ?? "Unknown";

  // RAM detection
  const totalBytes = os.totalmem();
  const availableBytes = os.freemem();

  return {
    platform,
    arch,
    isAppleSilicon,
    gpu: {
      available: supportsGpu,
      vendor,
      name: gpuDeviceNames[0] ?? "None",
      vramBytes: vramState.total,
    },
    cpu: {
      model: cpuModel,
      physicalCores,
      logicalCores,
    },
    ram: {
      totalBytes,
      availableBytes,
    },
  };
}

/**
 * Calculate the optimal number of GPU layers to offload for a given model.
 *
 * Uses model size, available VRAM, and quantization tier to estimate how many
 * layers can fit in GPU memory after reserving space for KV cache and OS overhead.
 *
 * @param modelSizeBytes - Total model file size in bytes
 * @param vramBytes - Available GPU VRAM in bytes
 * @param quantTier - Quantization tier key (e.g. "Q4_K_M", "Q8_0")
 * @returns Number of GPU layers to offload (0 = CPU only, max 99 = all layers)
 */
export function calculateGpuLayers(
  modelSizeBytes: number,
  vramBytes: number,
  quantTier: string,
): number {
  if (vramBytes === 0) {
    return 0;
  }

  // Look up bits per weight for this quantization tier
  // Currently unused because modelSizeBytes already reflects quantization,
  // but kept for potential future per-layer VRAM estimation improvements.
  const tier =
    QUANTIZATION_TIERS[quantTier as keyof typeof QUANTIZATION_TIERS];
  void tier;

  // Reserve 500MB for KV cache + 500MB for OS/framework overhead
  const KV_CACHE_RESERVE = 500 * 1024 * 1024;
  const OS_OVERHEAD_RESERVE = 500 * 1024 * 1024;
  const availableVram = vramBytes - KV_CACHE_RESERVE - OS_OVERHEAD_RESERVE;

  if (availableVram <= 0) {
    return 0;
  }

  // Estimate bytes per layer:
  // A typical GGUF model has ~32-80 layers. The model file size already reflects
  // quantization, so we can estimate bytes per layer directly from model size.
  // Assume ~40 layers as a reasonable default for estimation.
  const estimatedLayers = 40;
  const bytesPerLayer = modelSizeBytes / estimatedLayers;

  // Adjust for actual quantization efficiency relative to the model's own quantization.
  // Since modelSizeBytes already reflects the quantization, bytesPerLayer is accurate.
  // We scale by (bitsPerWeight / bitsPerWeight) = 1, so no adjustment needed.
  // bytesPerLayer already accounts for quantization.

  const maxLayers = Math.floor(availableVram / bytesPerLayer);

  // Cap at 99 (represents "all layers")
  return Math.min(maxLayers, 99);
}
