import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@vxllm/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@vxllm/ui/components/dialog";
import { Input } from "@vxllm/ui/components/input";
import { Label } from "@vxllm/ui/components/label";
import { Copy, Key, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export function CreateApiKeyDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [permissions, setPermissions] = useState("*");
  const [rateLimit, setRateLimit] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const createMutation = useMutation(
    orpc.settings.createApiKey.mutationOptions({
      onSuccess: (data) => {
        setCreatedKey(data.fullKey);
        queryClient.invalidateQueries({
          queryKey: orpc.settings.listApiKeys.queryOptions({ input: {} }).queryKey,
        });
      },
    }),
  );

  function handleCreate() {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }

    createMutation.mutate({
      label: label.trim(),
      permissions: permissions.trim() || "*",
      rateLimit: rateLimit ? Number.parseInt(rateLimit, 10) : undefined,
    });
  }

  function handleCopyKey() {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey).then(
        () => toast.success("API key copied to clipboard"),
        () => toast.error("Failed to copy to clipboard"),
      );
    }
  }

  function handleClose() {
    setOpen(false);
    // Reset form after close animation
    setTimeout(() => {
      setLabel("");
      setPermissions("*");
      setRateLimit("");
      setCreatedKey(null);
      createMutation.reset();
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(val) => (val ? setOpen(true) : handleClose())}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="mr-1 size-4" />
        Create API Key
      </DialogTrigger>
      <DialogContent>
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>
                Save this key now. It will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="mb-2 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  Save this key -- it won't be shown again
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-sm">
                    {createdKey}
                  </code>
                  <Button variant="outline" size="icon-sm" onClick={handleCopyKey}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Done
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="size-4" />
                Create API Key
              </DialogTitle>
              <DialogDescription>
                Create a new API key for authenticating with the VxLLM server.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-label">Label *</Label>
                <Input
                  id="key-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. My App"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-permissions">Permissions</Label>
                <Input
                  id="key-permissions"
                  value={permissions}
                  onChange={(e) => setPermissions(e.target.value)}
                  placeholder="* (all)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-rate-limit">Rate Limit (req/min)</Label>
                <Input
                  id="key-rate-limit"
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !label.trim()}
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Key className="mr-1 size-4" />
                )}
                Create
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
