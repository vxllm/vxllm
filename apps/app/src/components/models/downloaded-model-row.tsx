import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vxllm/ui/components/alert-dialog";
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import { TableCell, TableRow } from "@vxllm/ui/components/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

interface DownloadedModelRowProps {
  id: string;
  displayName: string;
  variant: string | null;
  sizeBytes: number | null;
  type: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function DownloadedModelRow({
  id,
  displayName,
  variant,
  sizeBytes,
  type,
}: DownloadedModelRowProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    orpc.models.delete.mutationOptions({
      onSuccess: () => {
        toast.success(`Deleted model: ${displayName}`);
        queryClient.invalidateQueries({
          queryKey: orpc.models.list.queryOptions({ input: {} }).queryKey,
        });
      },
    }),
  );

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{displayName}</span>
          {variant && <Badge variant="outline">{variant}</Badge>}
          <Badge variant="secondary">{type.toUpperCase()}</Badge>
        </div>
      </TableCell>
      <TableCell>
        {sizeBytes != null && sizeBytes > 0 ? formatBytes(sizeBytes) : "--"}
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="icon-sm" />
            }
          >
            <Trash2 className="size-3.5" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete model?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove &quot;{displayName}&quot; and its
                files from disk. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => deleteMutation.mutate({ id, deleteFiles: true })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
