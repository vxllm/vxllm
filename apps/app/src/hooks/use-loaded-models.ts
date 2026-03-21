import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

type ModelType = "llm" | "embedding" | "stt" | "tts";

// Stable query key for invalidation — avoids recreating on every render
const loadedModelsQueryKey = orpc.models.getLoadedModels.queryOptions().queryKey;

export function useLoadedModels() {
  const queryClient = useQueryClient();

  const loadedModelsQuery = useQuery({
    ...orpc.models.getLoadedModels.queryOptions(),
    refetchInterval: 5000,
  });

  const onLoadSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: loadedModelsQueryKey });
    toast.success("Model loaded");
  }, [queryClient]);

  const onLoadError = useCallback((error: Error) => {
    toast.error(`Failed to load model: ${error.message}`);
  }, []);

  const onUnloadSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: loadedModelsQueryKey });
    toast.success("Model unloaded");
  }, [queryClient]);

  const onUnloadError = useCallback((error: Error) => {
    toast.error(`Failed to unload model: ${error.message}`);
  }, []);

  const loadMutationOptions = useMemo(
    () =>
      orpc.models.loadModel.mutationOptions({
        onSuccess: onLoadSuccess,
        onError: onLoadError,
      }),
    [onLoadSuccess, onLoadError],
  );

  const unloadMutationOptions = useMemo(
    () =>
      orpc.models.unloadModel.mutationOptions({
        onSuccess: onUnloadSuccess,
        onError: onUnloadError,
      }),
    [onUnloadSuccess, onUnloadError],
  );

  const loadModelMutation = useMutation(loadMutationOptions);
  const unloadModelMutation = useMutation(unloadMutationOptions);

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
