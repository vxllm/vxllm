import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@vxllm/ui/components/button";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vxllm/ui/components/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";
import { formatRelativeDate } from "@/lib/chat";

export function ApiKeysTable() {
  const queryClient = useQueryClient();

  const { data: keys, isLoading } = useQuery(
    orpc.settings.listApiKeys.queryOptions({
      input: {},
    }),
  );

  const deleteMutation = useMutation(
    orpc.settings.deleteApiKey.mutationOptions({
      onSuccess: () => {
        toast.success("API key deleted");
        queryClient.invalidateQueries({
          queryKey: orpc.settings.listApiKeys.queryOptions({ input: {} }).queryKey,
        });
      },
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const apiKeys = keys ?? [];

  if (apiKeys.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No API keys created yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key Prefix</TableHead>
          <TableHead>Label</TableHead>
          <TableHead>Permissions</TableHead>
          <TableHead>Rate Limit</TableHead>
          <TableHead>Last Used</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {apiKeys.map((key) => (
          <TableRow key={key.id}>
            <TableCell>
              <code className="font-mono text-xs">{key.keyPrefix}...</code>
            </TableCell>
            <TableCell>{key.label}</TableCell>
            <TableCell>{key.permissions}</TableCell>
            <TableCell>
              {key.rateLimit != null ? `${key.rateLimit}/min` : "Unlimited"}
            </TableCell>
            <TableCell>
              {key.lastUsedAt != null
                ? formatRelativeDate(key.lastUsedAt)
                : "Never"}
            </TableCell>
            <TableCell>{formatRelativeDate(key.createdAt)}</TableCell>
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
                    <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently revoke the API key &quot;{key.label}&quot;.
                      Any applications using this key will lose access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => deleteMutation.mutate({ id: key.id })}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
