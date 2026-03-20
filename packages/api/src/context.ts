import type { Context as HonoContext } from "hono";

import { db } from "@vxllm/db";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context: _honoCtx }: CreateContextOptions) {
  return {
    db,
    auth: null,
    session: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
