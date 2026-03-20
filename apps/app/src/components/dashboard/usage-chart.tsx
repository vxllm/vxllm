import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@vxllm/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@vxllm/ui/components/chart";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { orpc } from "@/utils/orpc";

const chartConfig = {
  count: {
    label: "Requests",
    color: "var(--color-primary)",
  },
  avgLatency: {
    label: "Avg Latency (ms)",
    color: "var(--color-secondary)",
  },
  totalTokens: {
    label: "Total Tokens",
    color: "var(--color-accent)",
  },
} satisfies ChartConfig;

export function UsageChart() {
  const { data, isLoading } = useQuery(
    orpc.dashboard.getUsageBreakdown.queryOptions({
      input: { period: "24h" },
    }),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="size-4 text-muted-foreground" />
            Usage Breakdown (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="size-4 text-muted-foreground" />
            Usage Breakdown (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No usage data yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="size-4 text-muted-foreground" />
          Usage Breakdown (24h)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={rows} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="type" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
