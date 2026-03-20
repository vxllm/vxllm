import { publicProcedure } from "../index";
import { MetricsPeriodInput } from "../schemas/dashboard";

export const dashboardRouter = {
  // Query: get aggregated metrics summary for a time period
  getMetricsSummary: publicProcedure
    .input(MetricsPeriodInput)
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: get usage breakdown by request type for a time period
  getUsageBreakdown: publicProcedure
    .input(MetricsPeriodInput)
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: get current hardware status (CPU, RAM, GPU, active model)
  getHardwareStatus: publicProcedure.handler(async () => {
    throw new Error("Not implemented");
  }),
};
