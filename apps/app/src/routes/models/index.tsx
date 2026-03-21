import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@vxllm/ui/components/card";
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
import { Download, ExternalLink, Search } from "lucide-react";
import { useState } from "react";

import { DownloadProgress } from "@/components/models/download-progress";
import { DownloadedModelRow } from "@/components/models/downloaded-model-row";
import { ModelCard } from "@/components/models/model-card";
import { orpc } from "@/utils/orpc";

const SERVER_URL =
  (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:11500";

interface HfModel {
  id: string;
  name: string;
  downloads: number;
  likes: number;
  tags: string[];
  lastModified: string;
  source: string;
}

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export const Route = createFileRoute("/models/")({
  component: ModelsPage,
});

type ModelType = "llm" | "stt" | "tts" | "embedding";

const TYPE_LABELS: Record<ModelType | "all", string> = {
  all: "All Types",
  llm: "LLM",
  stt: "STT",
  tts: "TTS",
  embedding: "Embedding",
};

const VALUE_TO_TYPE: Record<string, ModelType | "all"> = Object.fromEntries(
  Object.entries(TYPE_LABELS).map(([key, label]) => [label, key as ModelType | "all"]),
);

function ModelsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<ModelType | "all">("all");
  const debouncedSearch = useDebounce(searchValue, 300);

  // HuggingFace search state
  const [hfSearchValue, setHfSearchValue] = useState("");

  const [hfSubmittedQuery, setHfSubmittedQuery] = useState("");
  const debouncedHfType = "llm";

  // Default popular models query (runs on mount)
  const hfPopularQuery = useQuery<{ models: HfModel[]; total: number }>({
    queryKey: ["hf-popular", debouncedHfType],
    queryFn: async () => {
      const url = new URL(`${SERVER_URL}/api/models/search/hf`);
      url.searchParams.set("q", "gguf");
      url.searchParams.set("type", debouncedHfType);
      url.searchParams.set("limit", "6");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch popular models");
      return res.json();
    },
  });

  const hfSearchQuery = useQuery<{ models: HfModel[]; total: number }>({
    queryKey: ["hf-search", hfSubmittedQuery, debouncedHfType],
    queryFn: async () => {
      const url = new URL(`${SERVER_URL}/api/models/search/hf`);
      url.searchParams.set("q", hfSubmittedQuery);
      url.searchParams.set("type", debouncedHfType);
      url.searchParams.set("limit", "20");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to search HuggingFace");
      return res.json();
    },
    enabled: !!hfSubmittedQuery,
  });

  const hasSearched = !!hfSubmittedQuery;
  const activeHfQuery = hasSearched ? hfSearchQuery : hfPopularQuery;
  const hfModels = activeHfQuery.data?.models ?? [];

  // Downloaded models (from database)
  const downloadedQuery = useQuery(
    orpc.models.list.queryOptions({
      input: {
        status: "downloaded",
        type: typeFilter !== "all" ? typeFilter : undefined,
        search: debouncedSearch || undefined,
      },
    }),
  );

  // Available models from curated registry (models.json)
  const registryQuery = useQuery(
    orpc.models.search.queryOptions({
      input: { query: debouncedSearch || " " },
    }),
  );

  const downloadedModels = downloadedQuery.data ?? [];
  const registryModels = registryQuery.data ?? [];

  // Filter registry models by type (client-side since search doesn't accept type)
  const filteredRegistry = typeFilter === "all"
    ? registryModels
    : registryModels.filter((m: any) => m.type === typeFilter);

  // Exclude already-downloaded models from available list
  const downloadedNames = new Set(downloadedModels.map((m) => m.name));
  const availableModels = filteredRegistry.filter((m: any) => !downloadedNames.has(m.name));

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
          value={TYPE_LABELS[typeFilter]}
          onValueChange={(val) => setTypeFilter(val ? (VALUE_TO_TYPE[val] ?? "all") : "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Types">All Types</SelectItem>
            <SelectItem value="LLM">LLM</SelectItem>
            <SelectItem value="STT">STT</SelectItem>
            <SelectItem value="TTS">TTS</SelectItem>
            <SelectItem value="Embedding">Embedding</SelectItem>
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
        {registryQuery.isLoading ? (
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
                key={model.name}
                name={model.name}
                displayName={model.displayName ?? model.name}
                description={model.description ?? ""}
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

      {/* HuggingFace Search */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Search HuggingFace</h2>
          <p className="text-sm text-muted-foreground">
            Find any GGUF model on HuggingFace.
          </p>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            setHfSubmittedQuery(hfSearchValue.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search HuggingFace models..."
              value={hfSearchValue}
              onChange={(e) => setHfSearchValue(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" disabled={!hfSearchValue.trim()}>
            <Search className="mr-1 size-4" />
            Search
          </Button>
        </form>

        {activeHfQuery.isLoading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        )}

        {activeHfQuery.isError && (
          <p className="py-4 text-sm text-destructive">
            Failed to search HuggingFace. Please try again.
          </p>
        )}

        {hasSearched && !activeHfQuery.isLoading && hfModels.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No models found for "{hfSubmittedQuery}".
          </p>
        )}

        {!activeHfQuery.isLoading && hfModels.length > 0 && !hasSearched && (
          <p className="text-sm text-muted-foreground">Popular GGUF models</p>
        )}

        {hfModels.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hfModels.map((model) => (
              <Card key={model.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="truncate text-sm">{model.name}</span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-3">
                    <span>{formatDownloads(model.downloads)} downloads</span>
                    <span>{model.likes} likes</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {model.tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://huggingface.co/${model.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-all hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      View
                    </a>
                    <a
                      href={`https://huggingface.co/${model.name}/tree/main`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-all hover:bg-muted hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                      Download
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
