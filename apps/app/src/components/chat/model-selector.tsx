import { useQuery } from "@tanstack/react-query";
import { Badge } from "@vxllm/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@vxllm/ui/components/select";
import { BotIcon } from "lucide-react";

import { orpc } from "@/utils/orpc";

export function ModelSelector({
  value,
  onValueChange,
}: {
  value?: string;
  onValueChange?: (modelId: string) => void;
}) {
  const modelsQuery = useQuery(
    orpc.models.list.queryOptions({
      input: { status: "downloaded" },
    }),
  );

  const models = modelsQuery.data ?? [];

  const llmModels = models.filter((m) => m.type === "llm");
  const embeddingModels = models.filter((m) => m.type === "embedding");

  const hasModels = models.length > 0;

  return (
    <Select
      value={value ?? ""}
      onValueChange={(val) => {
        if (val && onValueChange) {
          onValueChange(val as string);
        }
      }}
    >
      <SelectTrigger size="sm" className="max-w-[220px]">
        <SelectValue placeholder={hasModels ? "Select model..." : "No models"}>
          {value ? (
            <span className="flex items-center gap-1.5 truncate">
              <BotIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {models.find((m) => m.id === value)?.displayName ?? value}
              </span>
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        {modelsQuery.isLoading ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            Loading models...
          </div>
        ) : !hasModels ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            No downloaded models
          </div>
        ) : (
          <>
            {llmModels.length > 0 && (
              <SelectGroup>
                <SelectLabel>LLM Models</SelectLabel>
                {llmModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex items-center gap-2">
                      <span className="truncate">{model.displayName}</span>
                      {model.variant && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 px-1 py-0 text-[10px]"
                        >
                          {model.variant}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {llmModels.length > 0 && embeddingModels.length > 0 && (
              <SelectSeparator />
            )}
            {embeddingModels.length > 0 && (
              <SelectGroup>
                <SelectLabel>Embedding Models</SelectLabel>
                {embeddingModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex items-center gap-2">
                      <span className="truncate">{model.displayName}</span>
                      {model.variant && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 px-1 py-0 text-[10px]"
                        >
                          {model.variant}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
