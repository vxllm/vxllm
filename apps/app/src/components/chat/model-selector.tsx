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
import { BotIcon, Loader2Icon, CircleIcon } from "lucide-react";

import { useActiveModel } from "@/hooks/use-active-model";
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

  const { activeModel, isLoadingModel, loadModel } = useActiveModel();

  const models = modelsQuery.data ?? [];

  const llmModels = models.filter((m) => m.type === "llm");
  const embeddingModels = models.filter((m) => m.type === "embedding");

  const hasModels = models.length > 0;

  // Determine the displayed value: prefer the prop value, fall back to active model's DB id
  const activeModelDbId = activeModel
    ? models.find((m) => m.name === activeModel.modelInfo.name)?.id
    : undefined;
  const displayValue = value ?? activeModelDbId ?? "";

  const handleValueChange = (val: string | null) => {
    if (!val) return;

    // Notify parent
    onValueChange?.(val);

    // Find the selected model and load it on the server
    const selectedModel = models.find((m) => m.id === val);
    if (selectedModel) {
      // Don't reload if it's already the active model
      const isAlreadyActive =
        activeModel?.modelInfo.name === selectedModel.name;
      if (!isAlreadyActive) {
        loadModel({ id: val });
      }
    }
  };

  return (
    <Select
      value={displayValue}
      onValueChange={handleValueChange}
      disabled={isLoadingModel}
    >
      <SelectTrigger size="sm" className="max-w-[220px]">
        {isLoadingModel ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
            <span className="truncate">Loading model...</span>
          </span>
        ) : (
          <SelectValue
            placeholder={hasModels ? "Select model..." : "No models"}
          >
            {displayValue ? (
              <span className="flex items-center gap-1.5 truncate">
                {activeModel &&
                activeModel.modelInfo.name ===
                  models.find((m) => m.id === displayValue)?.name ? (
                  <CircleIcon className="size-2.5 shrink-0 fill-green-500 text-green-500" />
                ) : (
                  <BotIcon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">
                  {models.find((m) => m.id === displayValue)?.displayName ??
                    displayValue}
                </span>
              </span>
            ) : null}
          </SelectValue>
        )}
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
                      {activeModel?.modelInfo.name === model.name ? (
                        <CircleIcon className="size-2 shrink-0 fill-green-500 text-green-500" />
                      ) : null}
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
                      {activeModel?.modelInfo.name === model.name ? (
                        <CircleIcon className="size-2 shrink-0 fill-green-500 text-green-500" />
                      ) : null}
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
