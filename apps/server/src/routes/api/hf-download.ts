import { eq } from "drizzle-orm";
import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";

import { db } from "@vxllm/db";
import { models } from "@vxllm/db/schema/models";
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
  };

  if (!body.repo || !body.filename) {
    return c.json({ error: "repo and filename required" }, 400);
  }

  const modelsDir = env.MODELS_DIR.replace("~", process.env.HOME ?? "~");
  const typeDir = path.join(modelsDir, body.type);
  fs.mkdirSync(typeDir, { recursive: true });

  const destPath = path.join(typeDir, body.filename);
  const downloadUrl = `https://huggingface.co/${body.repo}/resolve/main/${body.filename}`;

  // Create DB entry
  const modelId = crypto.randomUUID();
  const modelName =
    body.displayName || `${body.repo.split("/").pop()}/${body.filename}`;

  await db.insert(models).values({
    id: modelId,
    name: `${body.repo}:${body.filename}`,
    displayName: modelName,
    type: body.type as "llm" | "stt" | "tts" | "embedding",
    format: body.filename.endsWith(".gguf") ? "gguf" : "whisper",
    variant: null,
    repo: body.repo,
    fileName: body.filename,
    localPath: destPath,
    sizeBytes: null,
    status: "downloading",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Start download in background
  (async () => {
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok || !res.body)
        throw new Error(`Download failed: ${res.status}`);

      const totalBytes = Number(res.headers.get("content-length") || 0);
      let downloadedBytes = 0;

      const tempPath = destPath + ".download";
      const writer = Bun.file(tempPath).writer();

      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
        downloadedBytes += value.length;
      }
      await writer.end();

      // Rename temp to final
      fs.renameSync(tempPath, destPath);

      // Update DB
      await db
        .update(models)
        .set({
          status: "downloaded",
          sizeBytes: downloadedBytes || totalBytes,
          localPath: destPath,
          downloadedAt: Date.now(),
          updatedAt: Date.now(),
        })
        .where(eq(models.id, modelId));
    } catch (err: any) {
      console.error(`[hf-download] Error downloading ${body.repo}/${body.filename}:`, err);
      await db
        .update(models)
        .set({
          status: "error",
          updatedAt: Date.now(),
        })
        .where(eq(models.id, modelId));
    }
  })();

  return c.json({ modelId, name: modelName, status: "downloading" }, 202);
});

export { hfDownload };
