import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import { HardDrive } from "lucide-react";

import { orpc } from "@/utils/orpc";

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(0)} MB`;
  }
  return `${bytes} bytes`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function HardwareInfo() {
  const { data, isLoading } = useQuery(
    orpc.settings.getHardwareInfo.queryOptions({
      input: {},
    }),
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Hardware information unavailable.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2 lg:grid-cols-3">
      {/* System */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <HardDrive className="size-4 text-muted-foreground" />
            System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Platform" value={data.platform} />
          <InfoRow label="Architecture" value={data.arch} />
          <InfoRow
            label="Apple Silicon"
            value={data.isAppleSilicon ? "Yes" : "No"}
          />
        </CardContent>
      </Card>

      {/* GPU */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <HardDrive className="size-4 text-muted-foreground" />
            GPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow
            label="Available"
            value={data.gpu.available ? "Yes" : "No"}
          />
          <InfoRow label="Vendor" value={data.gpu.vendor} />
          <InfoRow label="Name" value={data.gpu.name || "N/A"} />
          <InfoRow
            label="VRAM"
            value={
              data.gpu.vramBytes > 0
                ? formatBytes(data.gpu.vramBytes)
                : "N/A"
            }
          />
        </CardContent>
      </Card>

      {/* CPU */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <HardDrive className="size-4 text-muted-foreground" />
            CPU
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Model" value={data.cpu.model} />
          <InfoRow
            label="Physical Cores"
            value={String(data.cpu.physicalCores)}
          />
          <InfoRow
            label="Logical Cores"
            value={String(data.cpu.logicalCores)}
          />
        </CardContent>
      </Card>

      {/* RAM */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <HardDrive className="size-4 text-muted-foreground" />
            Memory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Total" value={formatBytes(data.ram.totalBytes)} />
          <InfoRow
            label="Available"
            value={formatBytes(data.ram.availableBytes)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
