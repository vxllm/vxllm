import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { chatRouter } from "./chat.router";
import { dashboardRouter } from "./dashboard.router";
import { modelRouter } from "./model.router";
import { settingsRouter } from "./settings.router";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  models: modelRouter,
  chat: chatRouter,
  settings: settingsRouter,
  dashboard: dashboardRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
