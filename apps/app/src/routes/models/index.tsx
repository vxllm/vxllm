import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@vxllm/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vxllm/ui/components/select";
import { Skeleton } from "@vxllm/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@vxllm/ui/components/table";
import { useDebounce } from "@vxllm/ui/hooks/use-debounce";
import { Search } from "lucide-react";
import { useState } from "react";

import { DownloadProgress } from "@/components/models/download-progress";
import { DownloadedModelRow } from "@/components/models/downloaded-model-row";
import { ModelCard } from "@/components/models/model-card";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/models/")({
  component: ModelsPage,
});

type ModelType = "llm" | "stt" | "tts" | "embedding";

function ModelsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<ModelType | "all">("all");
  const debouncedSearch = useDebounce(searchValue, 300);

  // Downloaded models
  const downloadedQuery = useQuery(
    orpc.models.list.queryOptions({
      input: {
        status: "downloaded",
        type: typeFilter !== "all" ? typeFilter : undefined,
        search: debouncedSearch || undefined,
      },
    }),
  );

  // All models from registry (available + downloaded)
  const allModelsQuery = useQuery(
    orpc.models.list.queryOptions({
      input: {
        type: typeFilter !== "all" ? typeFilter : undefined,
        search: debouncedSearch || undefined,
      },
    }),
  );

  const downloadedModels = downloadedQuery.data ?? [];
  const allModels = allModelsQuery.data ?? [];
  const downloadedIds = new Set(downloadedModels.map((m) => m.id));
  const availableModels = allModels.filter((m) => !downloadedIds.has(m.id));

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Models</h1>

      {/* Search and filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(val) => setTypeFilter(val as ModelType | "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="llm">LLM</SelectItem>
            <SelectItem value="stt">STT</SelectItem>
            <SelectItem value="tts">TTS</SelectItem>
            <SelectItem value="embedding">Embedding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active downloads */}
      <DownloadProgress />

      {/* Downloaded models */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Downloaded Models</h2>
        {downloadedQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : downloadedModels.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No downloaded models yet. Download one from the list below.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {downloadedModels.map((model) => (
                <DownloadedModelRow
                  key={model.id}
                  id={model.id}
                  displayName={model.displayName}
                  variant={model.variant}
                  sizeBytes={model.sizeBytes}
                  type={model.type}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Available models */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Available Models</h2>
        {allModelsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : availableModels.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {debouncedSearch
              ? "No models match your search."
              : "All available models are already downloaded."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableModels.map((model) => (
              <ModelCard
                key={model.id}
                name={model.name}
                displayName={model.displayName}
                description={model.description}
                type={model.type}
                sizeBytes={model.sizeBytes}
                minRamGb={model.minRamGb}
                status={model.status}
                format={model.format}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
