import type { HardwareProfile } from "./types";

/**
 * Detect system hardware capabilities (GPU, CPU, RAM).
 *
 * Inspects the current system to determine available compute resources,
 * including GPU vendor and VRAM, CPU cores, and available memory.
 * Used to decide optimal model loading parameters (GPU layers, context size, etc.).
 */
export async function detectHardware(): Promise<HardwareProfile> {
  throw new Error("Not implemented");
}
