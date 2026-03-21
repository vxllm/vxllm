import { Hono } from "hono";

const hfSearch = new Hono();

hfSearch.get("/", async (c) => {
  const query = c.req.query("q") || "";
  const type = c.req.query("type") || "llm";
  const limit = parseInt(c.req.query("limit") || "20");

  if (!query) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  // Map model type to HuggingFace file format filter
  const filterMap: Record<string, string> = {
    llm: "gguf",
    embedding: "gguf",
    stt: "safetensors",
    tts: "safetensors",
  };

  const filter = filterMap[type] || "gguf";

  try {
    const url = new URL("https://huggingface.co/api/models");
    url.searchParams.set("search", query);
    url.searchParams.set("filter", filter);
    url.searchParams.set("sort", "downloads");
    url.searchParams.set("direction", "-1");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      return c.json({ error: "HuggingFace API error" }, 502);
    }

    const data = await res.json();

    // Map HuggingFace response to our format
    const models = (data as any[]).map((model: any) => ({
      id: model.modelId || model.id,
      name: model.modelId || model.id,
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      tags: model.tags || [],
      lastModified: model.lastModified,
      source: "huggingface",
    }));

    return c.json({ models, total: models.length });
  } catch (err: any) {
    return c.json({ error: `Failed to search HuggingFace: ${err.message}` }, 500);
  }
});

export { hfSearch };
