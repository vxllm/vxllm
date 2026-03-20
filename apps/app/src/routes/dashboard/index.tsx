import { createFileRoute } from "@tanstack/react-router";

import { ActiveModelCard } from "@/components/dashboard/active-model-card";
import { ApiUrlCard } from "@/components/dashboard/api-url-card";
import { HardwareGauges } from "@/components/dashboard/hardware-gauges";
import { MetricsSummary } from "@/components/dashboard/metrics-summary";
import { UsageChart } from "@/components/dashboard/usage-chart";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <HardwareGauges />
      <ActiveModelCard />
      <MetricsSummary />
      <UsageChart />
      <ApiUrlCard />
    </div>
  );
}
