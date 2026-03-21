import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vxllm/ui/components/select";
import { CircleIcon, Loader2 } from "lucide-react";
import { useState } from "react";

interface ModelSlotProps {
  type: "llm" | "embedding" | "stt" | "tts";
  label: string;
  loaded: {
    name: string;
    variant?: string | null;
    sizeBytes?: number;
    contextSize?: number;
  } | null;
  downloadedModels: Array<{ id: string; displayName: string; variant: string | null; sizeBytes: number | null }>;
  onLoad: (modelId: string) => void;
  onUnload: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  accentColor: string; // "green" or "blue"
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function ModelSlot({
  type,
  label,
  loaded,
  downloadedModels,
  onLoad,
  onUnload,
  isLoading,
  disabled,
  accentColor,
}: ModelSlotProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const isGreen = accentColor === "green";
  const dotColor = loaded
    ? isGreen ? "fill-[#2EFAA0] text-[#2EFAA0]" : "fill-blue-500 text-blue-500"
    : "fill-muted-foreground/30 text-muted-foreground/30";
  const borderClass = loaded
    ? isGreen ? "border-[#2EFAA0]/40" : "border-blue-500/40"
    : "border-dashed border-muted-foreground/20";

  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${borderClass}`}>
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : (
          <CircleIcon className={`size-2.5 ${dotColor}`} />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {loaded && (
              <>
                <span className="text-sm font-medium">{loaded.name}</span>
                {loaded.variant && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {loaded.variant}
                  </Badge>
                )}
              </>
            )}
          </div>
          {loaded ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {loaded.sizeBytes ? formatSize(loaded.sizeBytes) : ""}
              {loaded.contextSize ? ` · ${loaded.contextSize} ctx` : ""}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Not loaded</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {loaded ? (
          <>
            <Select
              open={selectOpen}
              onOpenChange={setSelectOpen}
              onValueChange={(id) => {
                onLoad(id);
                setSelectOpen(false);
              }}
            >
              <SelectTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={disabled || isLoading}
                >
                  Change
                </Button>
              </SelectTrigger>
              <SelectContent>
                {downloadedModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName}
                    {m.variant ? ` (${m.variant})` : ""}
                  </SelectItem>
                ))}
                {downloadedModels.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No downloaded models
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive"
              onClick={onUnload}
              disabled={disabled || isLoading}
            >
              Unload
            </Button>
          </>
        ) : (
          <Select
            open={selectOpen}
            onOpenChange={setSelectOpen}
            onValueChange={(id) => {
              onLoad(id);
              setSelectOpen(false);
            }}
          >
            <SelectTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-dashed text-xs"
                disabled={disabled || isLoading}
              >
                + Load Model
              </Button>
            </SelectTrigger>
            <SelectContent>
              {downloadedModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.displayName}
                  {m.variant ? ` (${m.variant})` : ""}
                </SelectItem>
              ))}
              {downloadedModels.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No downloaded models of this type
                </div>
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
