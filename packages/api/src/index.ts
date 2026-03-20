import { os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

// ── Schema re-exports ───────────────────────────────────────────────────────
export * from "./schemas/common";
export * from "./schemas/openai";
export * from "./schemas/models";
export * from "./schemas/chat";
export * from "./schemas/voice";
export * from "./schemas/settings";
export * from "./schemas/dashboard";
