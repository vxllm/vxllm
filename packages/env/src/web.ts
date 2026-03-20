import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.string().url().default("http://localhost:11500"),
    VITE_WS_URL: z.string().url().default("ws://localhost:11500"),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
