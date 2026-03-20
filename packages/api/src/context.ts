import type { Context as HonoContext } from "hono";
import type { ModelManager, DownloadManager, Registry } from "@vxllm/inference";

import { db } from "@vxllm/db";

export type CreateContextOptions = {
  context: HonoContext;
  modelManager?: ModelManager;
  downloadManager?: DownloadManager;
  registry?: Registry;
};

export async function createContext({
  context: _honoCtx,
  modelManager,
  downloadManager,
  registry,
}: CreateContextOptions) {
  return {
    db,
    auth: null,
    session: null,
    modelManager: modelManager ?? null,
    downloadManager: downloadManager ?? null,
    registry: registry ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
