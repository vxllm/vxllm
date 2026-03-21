import type { Context as HonoContext } from "hono";
import type { ModelManager, DownloadManager, Registry } from "@vxllm/inference";

import { db } from "@vxllm/db";

export interface VoiceProcess {
  readonly running: boolean;
  readonly url: string;
  ensureRunning(): Promise<void>;
  kill(): Promise<void>;
  scheduleDelayedKill(): void;
  cancelDelayedKill(): void;
  getStatus(): Promise<Record<string, any> | null>;
  request(path: string, method?: "GET" | "POST", body?: Record<string, unknown>): Promise<any | null>;
}

export type CreateContextOptions = {
  context: HonoContext;
  modelManager?: ModelManager;
  downloadManager?: DownloadManager;
  registry?: Registry;
  voiceProcess?: VoiceProcess;
};

export async function createContext({
  context: _honoCtx,
  modelManager,
  downloadManager,
  registry,
  voiceProcess,
}: CreateContextOptions) {
  return {
    db,
    auth: null,
    session: null,
    modelManager: modelManager ?? null,
    downloadManager: downloadManager ?? null,
    registry: registry ?? null,
    voiceProcess: voiceProcess ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
