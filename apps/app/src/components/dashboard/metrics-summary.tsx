import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@vxllm/ui/components/toggle-group";
import { Activity, Clock, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

type Period = "1h" | "6h" | "24h";

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toFixed(0);
}

export function MetricsSummary() {
  const [period, setPeriod] = useState<Period>("1h");

  const { data, isLoading } = useQuery(
    orpc.dashboard.getMetricsSummary.queryOptions({
      input: { period },
    }),
  );

  const stats = [
    {
      label: "Total Requests",
      value: data ? formatNumber(data.totalRequests) : "--",
      icon: Activity,
    },
    {
      label: "Avg Latency",
      value: data ? `${Math.round(data.avgLatency)} ms` : "--",
      icon: Clock,
    },
    {
      label: "Tokens In",
      value: data ? formatNumber(data.totalTokensIn) : "--",
      icon: ArrowDownToLine,
    },
    {
      label: "Tokens Out",
      value: data ? formatNumber(data.totalTokensOut) : "--",
      icon: ArrowUpFromLine,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Metrics</h2>
        <ToggleGroup
          value={[period]}
          onValueChange={(values) => {
            if (values.length > 0) {
              setPeriod(values[0] as Period);
            }
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="1h">1h</ToggleGroupItem>
          <ToggleGroupItem value="6h">6h</ToggleGroupItem>
          <ToggleGroupItem value="24h">24h</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <stat.icon className="size-4 text-muted-foreground" />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
