import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

type ModelType = "llm" | "embedding" | "stt" | "tts";

export function useLoadedModels() {
  const queryClient = useQueryClient();

  const loadedModelsQuery = useQuery({
    ...orpc.models.getLoadedModels.queryOptions({}),
    refetchInterval: 5000,
  });

  const loadModelMutation = useMutation(
    orpc.models.loadModel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.models.getLoadedModels.queryOptions({}).queryKey,
        });
        toast.success("Model loaded");
      },
      onError: (error) => {
        toast.error(`Failed to load model: ${error.message}`);
      },
    }),
  );

  const unloadModelMutation = useMutation(
    orpc.models.unloadModel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.models.getLoadedModels.queryOptions({}).queryKey,
        });
        toast.success("Model unloaded");
      },
      onError: (error) => {
        toast.error(`Failed to unload model: ${error.message}`);
      },
    }),
  );

  return {
    llm: loadedModelsQuery.data?.llm ?? null,
    embedding: loadedModelsQuery.data?.embedding ?? null,
    stt: loadedModelsQuery.data?.stt ?? null,
    tts: loadedModelsQuery.data?.tts ?? null,
    voiceServiceStatus: (loadedModelsQuery.data?.voiceServiceStatus ?? "unavailable") as "running" | "stopped" | "unavailable",
    isLoading: loadedModelsQuery.isLoading,
    loadModel: (id: string, type: ModelType) =>
      loadModelMutation.mutate({ id, type }),
    isLoadingModel: loadModelMutation.isPending,
    unloadModel: (type: ModelType) =>
      unloadModelMutation.mutate({ type }),
    isUnloading: unloadModelMutation.isPending,
  };
}
