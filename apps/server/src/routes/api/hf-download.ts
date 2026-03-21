import { eq } from "drizzle-orm";
import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";

import { db } from "@vxllm/db";
import { models } from "@vxllm/db/schema/models";
import { downloadQueue } from "@vxllm/db/schema/models";
import { env } from "@vxllm/env/server";

const hfDownload = new Hono();

// POST /api/models/hf/download
// Body: { repo: string, filename: string, type: "llm"|"stt"|"tts"|"embedding", displayName?: string }
hfDownload.post("/", async (c) => {
  const body = (await c.req.json()) as {
    repo: string;
    filename: string;
    type: string;
    displayName?: string;
    backend?: string;
  };

  if (!body.repo || !body.filename) {
    return c.json({ error: "repo and filename required" }, 400);
  }

  // Auto-detect backend if not provided
  let backend = body.backend ?? null;
  if (!backend) {
    if (body.type === "llm" || body.type === "embedding") backend = "llama-cpp";
    else if (body.type === "stt") backend = "faster-whisper";
    else if (body.type === "tts") backend = "kokoro";
  }

  // Detect format properly
  let format: string;
  if (body.filename.endsWith(".gguf")) format = "gguf";
  else if (body.type === "tts") format = "kokoro";
  else if (body.type === "stt" && backend === "nemo") format = "nemo";
  else format = "whisper";

  const modelsDir = env.MODELS_DIR.replace("~", process.env.HOME ?? "~");
  const modelId = crypto.randomUUID();
  const downloadId = crypto.randomUUID();
  const modelName =
    body.displayName || `${body.repo.split("/").pop()}`;

  // Create model subfolder: ~/.vxllm/models/<type>/<model-name>/
  const modelDir = path.join(modelsDir, body.type, modelName.replace(/[/:]/g, "-"));
  fs.mkdirSync(modelDir, { recursive: true });

  const destPath = path.join(modelDir, body.filename);
  const downloadUrl = `https://huggingface.co/${body.repo}/resolve/main/${body.filename}`;

  const now = Date.now();

  await db.insert(models).values({
    id: modelId,
    name: `${body.repo}:${body.filename}`,
    displayName: modelName,
    type: body.type as "llm" | "stt" | "tts" | "embedding",
    format: format as any,
    backend: backend as any,
    variant: null,
    repo: body.repo,
    fileName: body.filename,
    localPath: destPath,
    sizeBytes: null,
    status: "downloading",
    createdAt: now,
    updatedAt: now,
  });

  // Create download_queue entry for progress tracking
  await db.insert(downloadQueue).values({
    id: downloadId,
    modelId,
    priority: 0,
    status: "active",
    totalBytes: null,
    startedAt: now,
    createdAt: now,
  });

  // Start download in background
  (async () => {
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok || !res.body)
        throw new Error(`Download failed: ${res.status}`);

      const totalBytes = Number(res.headers.get("content-length") || 0);
      let downloadedBytes = 0;
      let lastDbUpdate = Date.now();

      // Update total bytes in download_queue
      if (totalBytes > 0) {
        await db
          .update(downloadQueue)
          .set({ totalBytes })
          .where(eq(downloadQueue.id, downloadId));
      }

      const tempPath = destPath + ".download";
      const writer = Bun.file(tempPath).writer();

      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
        downloadedBytes += value.length;

        // Update progress in DB every 2 seconds
        const now = Date.now();
        if (now - lastDbUpdate >= 2000) {
          const progressPct = totalBytes > 0
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : 0;
          const elapsed = (now - (lastDbUpdate || now)) / 1000;
          const speedBps = elapsed > 0
            ? Math.round(downloadedBytes / ((now - (await getStartTime(downloadId))) / 1000))
            : 0;

          await db
            .update(downloadQueue)
            .set({
              progressPct,
              downloadedBytes,
              speedBps,
            })
            .where(eq(downloadQueue.id, downloadId))
            .catch(() => {});

          lastDbUpdate = now;
        }
      }
      await writer.end();

      // Rename temp to final
      fs.renameSync(tempPath, destPath);

      // Update DB
      const completedAt = Date.now();
      await db
        .update(models)
        .set({
          status: "downloaded",
          sizeBytes: downloadedBytes || totalBytes,
          localPath: destPath,
          downloadedAt: completedAt,
          updatedAt: completedAt,
        })
        .where(eq(models.id, modelId));

      await db
        .update(downloadQueue)
        .set({
          status: "completed",
          progressPct: 100,
          downloadedBytes: downloadedBytes || totalBytes,
          completedAt,
        })
        .where(eq(downloadQueue.id, downloadId));
    } catch (err: any) {
      console.error(`[hf-download] Error downloading ${body.repo}/${body.filename}:`, err);
      await db
        .update(models)
        .set({
          status: "error",
          updatedAt: Date.now(),
        })
        .where(eq(models.id, modelId));

      await db
        .update(downloadQueue)
        .set({
          status: "failed",
          error: err?.message ?? "Unknown error",
        })
        .where(eq(downloadQueue.id, downloadId));
    }
  })();

  return c.json({ modelId, name: modelName, status: "downloading" }, 202);
});

async function getStartTime(downloadId: string): Promise<number> {
  const [row] = await db
    .select({ startedAt: downloadQueue.startedAt })
    .from(downloadQueue)
    .where(eq(downloadQueue.id, downloadId))
    .limit(1);
  return row?.startedAt ?? Date.now();
}

export { hfDownload };
