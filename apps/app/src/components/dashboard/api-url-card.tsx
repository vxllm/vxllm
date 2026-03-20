import { Button } from "@vxllm/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
import { Copy, Globe } from "lucide-react";
import { toast } from "sonner";

import { env } from "@vxllm/env/web";

export function ApiUrlCard() {
  const apiUrl = `${env.VITE_SERVER_URL}/v1`;

  function handleCopy() {
    navigator.clipboard.writeText(apiUrl).then(
      () => toast.success("API URL copied to clipboard"),
      () => toast.error("Failed to copy to clipboard"),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="size-4 text-muted-foreground" />
          API Base URL
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm">
            {apiUrl}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy}>
            <Copy className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
