import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

/**
 * Hook to query and manage the active (loaded) model.
 * Provides the current active model, loading state, and a mutation to load a new model.
 */
export function useActiveModel() {
  const queryClient = useQueryClient();

  const activeModelQuery = useQuery({
    ...orpc.models.getActiveModel.queryOptions({}),
    refetchInterval: 5000,
  });

  const loadModelMutation = useMutation(
    orpc.models.loadModel.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.models.getActiveModel.queryOptions({}).queryKey,
        });
        toast.success("Model loaded successfully");
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
          queryKey: orpc.models.getActiveModel.queryOptions({}).queryKey,
        });
        toast.success("Model unloaded");
      },
      onError: (error) => {
        toast.error(`Failed to unload model: ${error.message}`);
      },
    }),
  );

  return {
    activeModel: activeModelQuery.data ?? null,
    isLoadingQuery: activeModelQuery.isLoading,
    loadModel: loadModelMutation.mutate,
    isLoadingModel: loadModelMutation.isPending,
    unloadModel: unloadModelMutation.mutate,
    isUnloading: unloadModelMutation.isPending,
  };
}
