import { Hono } from "hono";

const hfFiles = new Hono();

// GET /api/models/hf/files?repo=unsloth/Qwen3-4B-GGUF
hfFiles.get("/", async (c) => {
  const repo = c.req.query("repo");
  if (!repo) return c.json({ error: "repo param required" }, 400);

  try {
    // Fetch model metadata from HuggingFace API
    const res = await fetch(`https://huggingface.co/api/models/${repo}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return c.json({ error: "Repo not found" }, 404);

    const data = (await res.json()) as any;

    // Auto-detect type from pipeline_tag
    const pipelineTag = (data.pipeline_tag as string) || "";
    let detectedType = "llm";
    if (
      pipelineTag.includes("speech-recognition") ||
      pipelineTag.includes("asr")
    ) {
      detectedType = "stt";
    } else if (
      pipelineTag.includes("text-to-speech") ||
      pipelineTag.includes("tts")
    ) {
      detectedType = "tts";
    } else if (
      pipelineTag.includes("feature-extraction") ||
      pipelineTag.includes("embedding") ||
      pipelineTag.includes("sentence-similarity")
    ) {
      detectedType = "embedding";
    } else if (
      pipelineTag.includes("text-generation") ||
      pipelineTag.includes("text2text")
    ) {
      detectedType = "llm";
    }

    // Also check tags for better detection
    const tags = (data.tags || []) as string[];
    if (tags.includes("tts") || tags.includes("text-to-speech"))
      detectedType = "tts";
    if (tags.includes("asr") || tags.includes("automatic-speech-recognition"))
      detectedType = "stt";
    if (
      tags.includes("sentence-transformers") ||
      tags.includes("sentence-similarity")
    )
      detectedType = "embedding";

    // Get siblings (files) — filter to downloadable model files
    const siblings = (data.siblings || []) as Array<{
      rfilename: string;
      size?: number;
    }>;
    const modelFiles = siblings
      .filter((f) => {
        const name = f.rfilename.toLowerCase();
        return (
          name.endsWith(".gguf") ||
          name.endsWith(".safetensors") ||
          name.endsWith(".bin") ||
          name.endsWith(".pt")
        );
      })
      .map((f) => ({
        filename: f.rfilename,
        size: f.size || null,
      }));

    return c.json({
      repo,
      name: data.modelId || repo,
      detectedType,
      pipelineTag,
      tags: data.tags || [],
      files: modelFiles,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export { hfFiles };
