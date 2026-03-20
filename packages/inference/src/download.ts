import { fileDownloadInfo } from "@huggingface/hub";
import { db } from "@vxllm/db";
import { downloadQueue, models } from "@vxllm/db/schema/models";
import { env } from "@vxllm/env/server";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import type { DownloadProgress, ModelInfo } from "./types";
import type { Registry } from "./registry";

/**
 * Manages model downloads from HuggingFace.
 *
 * Supports concurrent downloads with priority queuing, pause/resume,
 * and progress tracking. Uses @huggingface/hub for authenticated downloads.
 */
export class DownloadManager {
  private activeDownloads = new Map<string, AbortController>();
  private progressMap = new Map<string, DownloadProgress>();
  private registry: Registry;

  constructor(registry: Registry) {
    this.registry = registry;
  }

  /**
   * Resolve the models directory, expanding ~ to HOME.
   */
  private getModelsDir(): string {
    return env.MODELS_DIR.replace("~", process.env.HOME ?? "~");
  }

  /**
   * Create or get an in-memory DownloadProgress entry.
   */
  private initProgress(
    modelId: string,
    totalBytes: number,
    priority: number,
    status: DownloadProgress["status"] = "queued",
  ): DownloadProgress {
    const progress: DownloadProgress = {
      modelId,
      priority,
      status,
      progressPct: 0,
      downloadedBytes: 0,
      totalBytes,
      speedBps: 0,
      eta: null,
      error: null,
    };
    this.progressMap.set(modelId, progress);
    return progress;
  }

  /**
   * Start downloading a model from HuggingFace.
   *
   * Resolves the model from the registry, creates DB entries,
   * and starts the download with progress tracking.
   *
   * @param name - Model name to download (resolved via Registry)
   * @param options - Optional download configuration
   * @param options.variant - Preferred quantization variant
   * @param options.priority - Download priority (lower = higher priority)
   */
  async pull(
    name: string,
    options?: { variant?: string; priority?: number },
  ): Promise<DownloadProgress> {
    const priority = options?.priority ?? 0;

    // 1. Resolve model from registry
    const resolveKey = options?.variant ? `${name}:${options.variant}` : name;
    const modelInfo = await this.registry.resolve(resolveKey);
    if (!modelInfo) {
      throw new Error(`Model not found in registry: ${resolveKey}`);
    }

    // 2. Ensure MODELS_DIR exists
    const modelsDir = this.getModelsDir();
    fs.mkdirSync(modelsDir, { recursive: true });

    // 3. Check if already downloaded
    const existing = await db
      .select()
      .from(models)
      .where(eq(models.name, modelInfo.name))
      .limit(1);

    if (existing.length > 0 && existing[0]!.status === "downloaded") {
      const progress = this.initProgress(
        existing[0]!.id,
        modelInfo.sizeBytes,
        priority,
        "completed",
      );
      progress.downloadedBytes = modelInfo.sizeBytes;
      progress.progressPct = 100;
      return progress;
    }

    // 4. Check concurrency limit
    if (this.activeDownloads.size >= env.MAX_CONCURRENT_DOWNLOADS) {
      // Queue it — create DB entries but don't start
      const modelId = await this.ensureDbEntries(modelInfo, priority, "queued");
      return this.initProgress(modelId, modelInfo.sizeBytes, priority, "queued");
    }

    // 5. Create/update DB entries
    const modelId = existing.length > 0
      ? existing[0]!.id
      : await this.ensureDbEntries(modelInfo, priority, "active");

    if (existing.length > 0) {
      // Update existing model to downloading status
      await db
        .update(models)
        .set({ status: "downloading", updatedAt: Date.now() })
        .where(eq(models.id, modelId));

      // Update or create download queue entry
      await db.insert(downloadQueue).values({
        id: crypto.randomUUID(),
        modelId,
        priority,
        status: "active",
        totalBytes: modelInfo.sizeBytes,
        startedAt: Date.now(),
      }).onConflictDoNothing();
    }

    // 6. Start the actual download
    const progress = this.initProgress(
      modelId,
      modelInfo.sizeBytes,
      priority,
      "active",
    );

    // Fire-and-forget the download, but track the promise internally
    this.startDownload(modelId, modelInfo, progress).catch((err) => {
      progress.status = "failed";
      progress.error = err instanceof Error ? err.message : String(err);
    });

    return progress;
  }

  /**
   * Create model + download_queue DB entries. Returns the model ID.
   */
  private async ensureDbEntries(
    modelInfo: ModelInfo,
    priority: number,
    status: "queued" | "active",
  ): Promise<string> {
    const modelId = crypto.randomUUID();
    const now = Date.now();

    await db.insert(models).values({
      id: modelId,
      name: modelInfo.name,
      displayName: modelInfo.displayName,
      description: modelInfo.description,
      type: modelInfo.type,
      format: modelInfo.format,
      variant: modelInfo.variant,
      repo: modelInfo.repo,
      fileName: modelInfo.fileName,
      sizeBytes: modelInfo.sizeBytes,
      minRamGb: modelInfo.minRamGb,
      recommendedVramGb: modelInfo.recommendedVramGb,
      status: status === "active" ? "downloading" : "available",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(downloadQueue).values({
      id: crypto.randomUUID(),
      modelId,
      priority,
      status,
      totalBytes: modelInfo.sizeBytes,
      startedAt: status === "active" ? now : undefined,
      createdAt: now,
    });

    return modelId;
  }

  /**
   * Perform the actual file download with progress tracking.
   */
  private async startDownload(
    modelId: string,
    modelInfo: ModelInfo,
    progress: DownloadProgress,
  ): Promise<void> {
    const abortController = new AbortController();
    this.activeDownloads.set(modelId, abortController);

    const modelsDir = this.getModelsDir();

    try {
      if (!modelInfo.repo) {
        throw new Error(`No repository specified for model: ${modelInfo.name}`);
      }

      // For GGUF models with a specific file, download just that file
      // For other formats (whisper, kokoro), the repo is the model — no single file
      if (modelInfo.fileName) {
        await this.downloadSingleFile(
          modelId,
          modelInfo,
          progress,
          modelsDir,
          abortController,
        );
      } else {
        // For non-GGUF models (whisper, kokoro), mark as "downloaded" with the repo reference
        // Actual model loading is handled by the Python sidecar, so we just record the intent
        await this.markCompleted(modelId, modelInfo, progress, null);
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        // Download was intentionally paused/cancelled — don't mark as failed
        return;
      }

      progress.status = "failed";
      progress.error = err instanceof Error ? err.message : String(err);

      // Update DB
      await db
        .update(models)
        .set({ status: "error", updatedAt: Date.now() })
        .where(eq(models.id, modelId));

      await db
        .update(downloadQueue)
        .set({
          status: "failed",
          error: progress.error,
        })
        .where(eq(downloadQueue.modelId, modelId));
    } finally {
      this.activeDownloads.delete(modelId);
    }
  }

  /**
   * Download a single file from HuggingFace using streaming for progress tracking.
   */
  private async downloadSingleFile(
    modelId: string,
    modelInfo: ModelInfo,
    progress: DownloadProgress,
    modelsDir: string,
    abortController: AbortController,
  ): Promise<void> {
    // Get download info (URL + size) from HuggingFace
    const info = await fileDownloadInfo({
      repo: modelInfo.repo!,
      path: modelInfo.fileName!,
    });

    if (!info) {
      throw new Error(
        `File not found on HuggingFace: ${modelInfo.repo}/${modelInfo.fileName}`,
      );
    }

    // Update total bytes from the actual file info
    progress.totalBytes = info.size;

    // Use the direct download URL from fileDownloadInfo to get a streaming response
    const response = await fetch(info.url, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Download failed with HTTP ${response.status}: ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error("Response has no body stream");
    }

    // Set up file writing
    const destPath = path.join(modelsDir, modelInfo.fileName!);
    const tempPath = `${destPath}.download`;

    // Ensure we clean up the temp file on errors
    const writer = fs.createWriteStream(tempPath);

    const reader = response.body.getReader();
    let downloadedBytes = 0;
    let lastSpeedUpdate = Date.now();
    let lastSpeedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Write chunk to disk
        writer.write(Buffer.from(value));
        downloadedBytes += value.byteLength;

        // Update progress
        progress.downloadedBytes = downloadedBytes;
        progress.progressPct =
          info.size > 0
            ? Math.min(100, Math.round((downloadedBytes / info.size) * 100))
            : 0;

        // Calculate speed (update every 500ms)
        const now = Date.now();
        const elapsed = now - lastSpeedUpdate;
        if (elapsed >= 500) {
          const bytesDelta = downloadedBytes - lastSpeedBytes;
          progress.speedBps = Math.round((bytesDelta / elapsed) * 1000);
          progress.eta =
            progress.speedBps > 0
              ? Math.round(
                  (info.size - downloadedBytes) / progress.speedBps,
                )
              : null;
          lastSpeedUpdate = now;
          lastSpeedBytes = downloadedBytes;
        }

        // Periodically update download_queue in DB (every ~5% progress)
        if (
          progress.progressPct % 5 === 0 &&
          progress.progressPct > 0
        ) {
          await db
            .update(downloadQueue)
            .set({
              progressPct: progress.progressPct,
              downloadedBytes: progress.downloadedBytes,
              speedBps: progress.speedBps,
            })
            .where(eq(downloadQueue.modelId, modelId))
            .catch(() => {
              /* non-critical — don't fail the download */
            });
        }
      }
    } finally {
      writer.end();
    }

    // Wait for the write stream to finish
    await new Promise<void>((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Rename temp file to final destination
    fs.renameSync(tempPath, destPath);

    // Mark as completed
    await this.markCompleted(modelId, modelInfo, progress, destPath);
  }

  /**
   * Mark a download as completed in memory and DB.
   */
  private async markCompleted(
    modelId: string,
    modelInfo: ModelInfo,
    progress: DownloadProgress,
    localPath: string | null,
  ): Promise<void> {
    const now = Date.now();

    progress.status = "completed";
    progress.progressPct = 100;
    progress.downloadedBytes = progress.totalBytes;
    progress.speedBps = 0;
    progress.eta = null;

    // Update models table
    await db
      .update(models)
      .set({
        status: "downloaded",
        localPath,
        downloadedAt: now,
        updatedAt: now,
      })
      .where(eq(models.id, modelId));

    // Update download_queue
    await db
      .update(downloadQueue)
      .set({
        status: "completed",
        progressPct: 100,
        downloadedBytes: modelInfo.sizeBytes,
        completedAt: now,
      })
      .where(eq(downloadQueue.modelId, modelId));
  }

  /**
   * Pause an active download.
   *
   * Aborts the in-flight HTTP request. The partial file is preserved on disk.
   *
   * @param modelId - The model ID to pause
   */
  async pause(modelId: string): Promise<void> {
    const controller = this.activeDownloads.get(modelId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(modelId);

      // Update in-memory progress
      const progress = this.progressMap.get(modelId);
      if (progress) {
        progress.status = "paused";
        progress.speedBps = 0;
        progress.eta = null;
      }

      // Update DB
      await db
        .update(downloadQueue)
        .set({ status: "paused" })
        .where(eq(downloadQueue.modelId, modelId));

      await db
        .update(models)
        .set({ status: "available", updatedAt: Date.now() })
        .where(eq(models.id, modelId));
    }
  }

  /**
   * Resume a paused download.
   *
   * Currently re-downloads from scratch (range resume not yet supported).
   *
   * @param modelId - The model ID to resume
   */
  async resume(modelId: string): Promise<void> {
    const progress = this.progressMap.get(modelId);
    if (!progress || progress.status !== "paused") {
      return;
    }

    // Look up the model info from the DB
    const modelRows = await db
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);

    if (modelRows.length === 0) {
      throw new Error(`Model not found in database: ${modelId}`);
    }

    const modelRow = modelRows[0]!;

    // Re-resolve from registry to get full info
    const modelInfo = await this.registry.resolve(modelRow.name);
    if (!modelInfo) {
      throw new Error(`Model not found in registry: ${modelRow.name}`);
    }

    // Check concurrency
    if (this.activeDownloads.size >= env.MAX_CONCURRENT_DOWNLOADS) {
      progress.status = "queued";
      await db
        .update(downloadQueue)
        .set({ status: "queued" })
        .where(eq(downloadQueue.modelId, modelId));
      return;
    }

    // Reset progress for re-download
    progress.status = "active";
    progress.downloadedBytes = 0;
    progress.progressPct = 0;
    progress.error = null;

    // Update DB
    await db
      .update(downloadQueue)
      .set({
        status: "active",
        downloadedBytes: 0,
        progressPct: 0,
        startedAt: Date.now(),
      })
      .where(eq(downloadQueue.modelId, modelId));

    await db
      .update(models)
      .set({ status: "downloading", updatedAt: Date.now() })
      .where(eq(models.id, modelId));

    // Re-download
    this.startDownload(modelId, modelInfo, progress).catch((err) => {
      progress.status = "failed";
      progress.error = err instanceof Error ? err.message : String(err);
    });
  }

  /**
   * Cancel and remove a download.
   *
   * Aborts the in-flight request and deletes any partial file on disk.
   *
   * @param modelId - The model ID to cancel
   */
  async cancel(modelId: string): Promise<void> {
    // Abort if active
    const controller = this.activeDownloads.get(modelId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(modelId);
    }

    // Update in-memory progress
    const progress = this.progressMap.get(modelId);
    if (progress) {
      progress.status = "failed";
      progress.error = "Cancelled by user";
      progress.speedBps = 0;
      progress.eta = null;
    }

    // Delete partial file if it exists
    const modelRows = await db
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);

    if (modelRows.length > 0 && modelRows[0]!.fileName) {
      const modelsDir = this.getModelsDir();
      const tempPath = path.join(modelsDir, `${modelRows[0]!.fileName}.download`);
      const finalPath = path.join(modelsDir, modelRows[0]!.fileName);

      // Remove temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      // Remove completed file if it was partially written without rename
      if (fs.existsSync(finalPath) && modelRows[0]!.status !== "downloaded") {
        fs.unlinkSync(finalPath);
      }
    }

    // Update DB
    await db
      .update(downloadQueue)
      .set({ status: "failed", error: "Cancelled by user" })
      .where(eq(downloadQueue.modelId, modelId));

    await db
      .update(models)
      .set({ status: "error", updatedAt: Date.now() })
      .where(eq(models.id, modelId));

    this.progressMap.delete(modelId);
  }

  /**
   * Get the current progress of a download.
   *
   * @param modelId - The model ID to check
   * @returns Download progress, or null if not found
   */
  getProgress(modelId: string): DownloadProgress | null {
    return this.progressMap.get(modelId) ?? null;
  }

  /**
   * Get all active (queued, downloading, paused) downloads.
   *
   * @returns Array of download progress entries
   */
  getActive(): DownloadProgress[] {
    return Array.from(this.progressMap.values()).filter(
      (p) => p.status !== "completed" && p.status !== "failed",
    );
  }

  /**
   * Cancel all active downloads.
   */
  cancelAll(): void {
    for (const [_id, controller] of this.activeDownloads) {
      controller.abort();
    }
    this.activeDownloads.clear();

    // Update all in-memory progress entries
    for (const [_id, progress] of this.progressMap) {
      if (progress.status === "active" || progress.status === "queued") {
        progress.status = "failed";
        progress.error = "Cancelled (shutdown)";
        progress.speedBps = 0;
        progress.eta = null;
      }
    }
  }
}
