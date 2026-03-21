import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
import { Download, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface ModelCardProps {
  name: string;
  displayName: string;
  description: string | null;
  type: string;
  sizeBytes: number | null;
  minRamGb: number | null;
  status: string;
}

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  llm: "default",
  stt: "secondary",
  tts: "secondary",
  embedding: "outline",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function ModelCard({
  name,
  displayName,
  description,
  type,
  sizeBytes,
  minRamGb,
  status,
}: ModelCardProps) {
  const queryClient = useQueryClient();

  const downloadMutation = useMutation(
    orpc.models.download.mutationOptions({
      onSuccess: () => {
        toast.success(`Download started: ${displayName}`);
        queryClient.invalidateQueries({
          queryKey: orpc.models.list.queryOptions({ input: {} }).queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: orpc.models.getDownloadStatus.queryOptions({ input: {} }).queryKey,
        });
      },
      onError: (err) => {
        toast.error(`Failed to download ${displayName}: ${err.message}`);
      },
    }),
  );

  const isDownloaded = status === "downloaded";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="truncate">{displayName}</span>
          <Badge variant={typeBadgeVariant[type] ?? "outline"}>
            {type.toUpperCase()}
          </Badge>
          {isDownloaded && (
            <Badge variant="secondary">
              <Check className="mr-1 size-3" />
              Downloaded
            </Badge>
          )}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-sm text-muted-foreground">
            {sizeBytes != null && sizeBytes > 0 && (
              <span>Size: {formatBytes(sizeBytes)}</span>
            )}
            {minRamGb != null && <span>RAM: {minRamGb} GB+</span>}
          </div>
          {!isDownloaded && (
            <Button
              variant="outline"
              size="sm"
              disabled={downloadMutation.isPending || status === "downloading"}
              onClick={() => downloadMutation.mutate({ name })}
            >
              {downloadMutation.isPending || status === "downloading" ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Download className="mr-1 size-4" />
              )}
              {status === "downloading" ? "Downloading..." : "Download"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
