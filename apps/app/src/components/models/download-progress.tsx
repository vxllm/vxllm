import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@vxllm/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
import { Progress } from "@vxllm/ui/components/progress";
import { Download, X } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

function formatSpeed(bps: number | null): string {
  if (bps == null || bps <= 0) return "--";
  if (bps >= 1_073_741_824) return `${(bps / 1_073_741_824).toFixed(1)} GB/s`;
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function formatEta(speedBps: number | null, downloadedBytes: number, totalBytes: number | null): string {
  if (!speedBps || speedBps <= 0 || !totalBytes) return "--";
  const remaining = totalBytes - downloadedBytes;
  const seconds = Math.ceil(remaining / speedBps);
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  return `${seconds}s`;
}

export function DownloadProgress() {
  const queryClient = useQueryClient();

  const { data: downloads } = useQuery(
    orpc.models.getDownloadStatus.queryOptions({
      input: {},
      refetchInterval: 2000,
    }),
  );

  const cancelMutation = useMutation(
    orpc.models.cancelDownload.mutationOptions({
      onSuccess: () => {
        toast.success("Download cancelled");
        queryClient.invalidateQueries({
          queryKey: orpc.models.getDownloadStatus.queryOptions({ input: {} }).queryKey,
        });
      },
    }),
  );

  const activeDownloads = downloads?.filter(
    (d) => d.status === "active" || d.status === "queued",
  );

  if (!activeDownloads || activeDownloads.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Download className="size-4 text-muted-foreground" />
          Active Downloads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeDownloads.map((dl) => (
          <div key={dl.modelId} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{dl.modelName || dl.modelId}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatSpeed(dl.speedBps)} | ETA: {formatEta(dl.speedBps, dl.downloadedBytes, dl.totalBytes)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => cancelMutation.mutate({ downloadId: dl.modelId })}
                  disabled={cancelMutation.isPending}
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
            <Progress value={dl.progressPct} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {dl.progressPct.toFixed(1)}%
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
