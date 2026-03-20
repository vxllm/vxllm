import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import { BrainCircuit } from "lucide-react";

import { orpc } from "@/utils/orpc";

export function ActiveModelCard() {
  const { data, isLoading } = useQuery(
    orpc.dashboard.getHardwareStatus.queryOptions({
      input: {},
      refetchInterval: 3000,
    }),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-48" />
        </CardContent>
      </Card>
    );
  }

  const activeModel = data?.activeModel;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BrainCircuit className="size-4 text-muted-foreground" />
          Active Model
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeModel ? (
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{activeModel}</Badge>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              No model is currently loaded.
            </p>
            <Button
              variant="outline"
              size="sm"
              render={<Link to="/models" />}
            >
              Browse Models
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
