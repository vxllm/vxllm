import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
import { Progress } from "@vxllm/ui/components/progress";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import { Cpu, MemoryStick, Monitor } from "lucide-react";

import { orpc } from "@/utils/orpc";

function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export function HardwareGauges() {
  const { data, isLoading } = useQuery(
    orpc.dashboard.getHardwareStatus.queryOptions({
      input: {},
      refetchInterval: 3000,
    }),
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-2 w-full" />
              <Skeleton className="mt-2 h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cpuPercent = data?.cpuPercent ?? 0;
  const ramPercent = data?.ramPercent ?? 0;
  const gpuPercent = data?.gpuPercent;
  const usedMb = data?.memoryUsage?.usedMb ?? 0;
  const totalMb = data?.memoryUsage?.totalMb ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* CPU */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Cpu className="size-4 text-muted-foreground" />
            CPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={cpuPercent} />
          <p className="mt-2 text-sm font-medium tabular-nums">
            {cpuPercent.toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      {/* RAM */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MemoryStick className="size-4 text-muted-foreground" />
            RAM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={ramPercent} />
          <p className="mt-2 text-sm font-medium tabular-nums">
            {ramPercent.toFixed(1)}%{" "}
            <span className="text-muted-foreground">
              ({formatMb(usedMb)} / {formatMb(totalMb)})
            </span>
          </p>
        </CardContent>
      </Card>

      {/* GPU */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Monitor className="size-4 text-muted-foreground" />
            GPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gpuPercent != null ? (
            <>
              <Progress value={gpuPercent} />
              <p className="mt-2 text-sm font-medium tabular-nums">
                {gpuPercent.toFixed(1)}%
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">N/A</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
