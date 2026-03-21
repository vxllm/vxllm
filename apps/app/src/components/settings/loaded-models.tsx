import { useQuery } from "@tanstack/react-query";
import { Badge } from "@vxllm/ui/components/badge";
import { CircleIcon } from "lucide-react";

import { ModelSlot } from "@/components/settings/model-slot";
import { useLoadedModels } from "@/hooks/use-loaded-models";
import { orpc } from "@/utils/orpc";

export function LoadedModels() {
  const {
    llm,
    embedding,
    stt,
    tts,
    voiceServiceStatus,
    loadModel,
    isLoadingModel,
    unloadModel,
    isUnloading,
  } = useLoadedModels();

  // Fetch downloaded models for each type
  const llmModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "llm" } }),
  );
  const embeddingModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "embedding" } }),
  );
  const sttModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "stt" } }),
  );
  const ttsModelsQuery = useQuery(
    orpc.models.list.queryOptions({ input: { status: "downloaded", type: "tts" } }),
  );

  const isActing = isLoadingModel || isUnloading;

  return (
    <div className="space-y-6 py-4">
      {/* Language Models Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#2EFAA0]">
            Language Models
          </span>
        </div>
        <ModelSlot
          label="LLM"
          loaded={llm ? {
            name: llm.modelInfo.displayName,
            variant: llm.modelInfo.variant,
            sizeBytes: llm.memoryUsageBytes,
            contextSize: llm.contextSize,
          } : null}
          downloadedModels={(llmModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "llm")}
          onUnload={() => unloadModel("llm")}
          isLoading={isActing}
          accentColor="green"
        />
        <ModelSlot
          label="Embedding"
          loaded={embedding ? {
            name: embedding.modelInfo.displayName,
            variant: embedding.modelInfo.variant,
            sizeBytes: embedding.memoryUsageBytes,
          } : null}
          downloadedModels={(embeddingModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "embedding")}
          onUnload={() => unloadModel("embedding")}
          isLoading={isActing}
          accentColor="green"
        />
      </div>

      {/* Voice Models Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">
            Voice Models
          </span>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <CircleIcon
              className={`size-1.5 ${
                voiceServiceStatus === "running"
                  ? "fill-green-500 text-green-500"
                  : voiceServiceStatus === "stopped"
                    ? "fill-red-500 text-red-500"
                    : "fill-muted-foreground text-muted-foreground"
              }`}
            />
            {voiceServiceStatus === "running"
              ? "Running"
              : voiceServiceStatus === "stopped"
                ? "Stopped"
                : "Unavailable"}
          </Badge>
        </div>
        <ModelSlot
          label="STT"
          loaded={stt ? { name: stt.modelName } : null}
          downloadedModels={(sttModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "stt")}
          onUnload={() => unloadModel("stt")}
          isLoading={isActing}
          disabled={voiceServiceStatus !== "running"}
          accentColor="blue"
        />
        <ModelSlot
          label="TTS"
          loaded={tts ? { name: tts.modelName } : null}
          downloadedModels={(ttsModelsQuery.data ?? []).map((m) => ({
            id: m.id,
            displayName: m.displayName,
            variant: m.variant,
            sizeBytes: m.sizeBytes,
          }))}
          onLoad={(id) => loadModel(id, "tts")}
          onUnload={() => unloadModel("tts")}
          isLoading={isActing}
          disabled={voiceServiceStatus !== "running"}
          accentColor="blue"
        />
        {voiceServiceStatus !== "running" && (
          <p className="text-xs text-muted-foreground">
            Voice service is not running. Start it to manage STT/TTS models.
          </p>
        )}
      </div>
    </div>
  );
}
