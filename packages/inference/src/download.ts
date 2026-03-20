import type { DownloadProgress } from "./types";

/**
 * Manages model downloads from HuggingFace.
 *
 * Supports concurrent downloads with priority queuing, pause/resume,
 * and progress tracking. Uses @huggingface/hub for authenticated downloads.
 */
export class DownloadManager {
  /**
   * Start downloading a model from HuggingFace.
   * @param name - Model name to download (resolved via Registry)
   * @param options - Optional download configuration
   * @param options.format - Preferred quantization format
   * @param options.priority - Download priority (lower = higher priority)
   */
  async pull(
    _name: string,
    _options?: { format?: string; priority?: number },
  ): Promise<DownloadProgress> {
    throw new Error("Not implemented");
  }

  /**
   * Pause an active download.
   * @param modelId - The model ID to pause
   */
  async pause(_modelId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  /**
   * Resume a paused download.
   * @param modelId - The model ID to resume
   */
  async resume(_modelId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  /**
   * Cancel and remove a download.
   * @param modelId - The model ID to cancel
   */
  async cancel(_modelId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  /**
   * Get the current progress of a download.
   * @param modelId - The model ID to check
   * @returns Download progress, or null if not found
   */
  getProgress(_modelId: string): DownloadProgress | null {
    throw new Error("Not implemented");
  }

  /**
   * Get all active (queued, downloading, paused) downloads.
   * @returns Array of download progress entries
   */
  getActive(): DownloadProgress[] {
    throw new Error("Not implemented");
  }
}
