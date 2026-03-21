import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1).default("file:./local.db"),
    DATABASE_AUTH_TOKEN: z.string().min(1).optional(),
    PORT: z.coerce.number().min(1024).max(65535).default(11500),
    HOST: z.string().default("127.0.0.1"),
    MODELS_DIR: z.string().default("~/.vxllm/models"),
    /** @deprecated Use VOICE_PORT instead. Bun constructs the URL from HOST + VOICE_PORT. */
    VOICE_URL: z.string().url().default("http://localhost:11501"),
    VOICE_PORT: z.coerce.number().min(1024).max(65535).default(11501),
    API_KEY: z.string().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DEFAULT_MODEL: z.string().optional(),
    CORS_ORIGINS: z.string().default("*"),
    MAX_CONTEXT_SIZE: z.coerce.number().default(8192),
    GPU_LAYERS_OVERRIDE: z.coerce.number().optional(),
    MAX_CONCURRENT_DOWNLOADS: z.coerce.number().min(1).max(5).default(2),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
