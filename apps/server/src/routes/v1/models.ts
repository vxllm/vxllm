import { Hono } from "hono";
import { db } from "@vxllm/db";
import { models } from "@vxllm/db/schema/models";
import { eq } from "drizzle-orm";

/**
 * GET /v1/models
 *
 * OpenAI-compatible model listing endpoint.
 * Returns all downloaded models in the standard OpenAI model list format.
 */
export function createModelsRoute() {
  const route = new Hono();

  route.get("/models", async (c) => {
    const downloaded = await db
      .select()
      .from(models)
      .where(eq(models.status, "downloaded"));

    const data = downloaded.map((m) => ({
      id: m.name,
      object: "model" as const,
      created: m.downloadedAt
        ? Math.floor(m.downloadedAt / 1000)
        : Math.floor(m.createdAt / 1000),
      owned_by: "local",
    }));

    return c.json({
      object: "list",
      data,
    });
  });

  // GET /v1/models/:model — retrieve a single model
  route.get("/models/:model", async (c) => {
    const modelName = c.req.param("model");

    const rows = await db
      .select()
      .from(models)
      .where(eq(models.name, modelName))
      .limit(1);

    if (!rows.length || rows[0]!.status !== "downloaded") {
      return c.json(
        {
          error: {
            message: `The model '${modelName}' does not exist or is not downloaded`,
            type: "invalid_request_error",
            code: "model_not_found",
            param: "model",
          },
        },
        404,
      );
    }

    const m = rows[0]!;
    return c.json({
      id: m.name,
      object: "model",
      created: m.downloadedAt
        ? Math.floor(m.downloadedAt / 1000)
        : Math.floor(m.createdAt / 1000),
      owned_by: "local",
    });
  });

  return route;
}
