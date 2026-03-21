import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@vxllm/ui/components/button";
import { Card, CardContent } from "@vxllm/ui/components/card";
import { DownloadIcon, MenuIcon } from "lucide-react";

import { useActiveModel } from "@/hooks/use-active-model";
import { ModelSelector } from "@/components/chat/model-selector";
import { useChatLayout } from "@/routes/chat/route";
import { orpc } from "@/utils/orpc";

const EXAMPLE_PROMPTS = [
  {
    title: "Explain quantum computing",
    prompt: "Explain quantum computing in simple terms",
  },
  {
    title: "Python sort function",
    prompt: "Write a Python function to sort a list",
  },
  {
    title: "Debug React component",
    prompt: "Help me debug this React component",
  },
  {
    title: "REST API best practices",
    prompt: "What are best practices for REST API design?",
  },
] as const;

export function ChatEmptyState() {
  const navigate = useNavigate();
  const { isMobile, openMobileSidebar } = useChatLayout();

  const downloadedModelsQuery = useQuery(
    orpc.models.list.queryOptions({
      input: { status: "downloaded" },
    }),
  );

  const { activeModel } = useActiveModel();

  const downloadedModels = downloadedModelsQuery.data ?? [];
  const hasDownloadedModels = downloadedModels.length > 0;
  const hasActiveModel = activeModel !== null;

  const handlePromptClick = (prompt: string) => {
    navigate({
      to: "/chat",
      search: { prompt },
    });
  };

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 p-8">
      {isMobile && (
        <div className="absolute top-2 left-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openMobileSidebar}
          >
            <MenuIcon className="size-4" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </div>
      )}

      {/* No models downloaded -- show download CTA */}
      {!hasDownloadedModels && !downloadedModelsQuery.isLoading ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-muted">
            <DownloadIcon className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Download a model to get started
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              VxLLM runs AI models locally on your machine. Download your first
              model to start chatting.
            </p>
          </div>
          <Button size="lg" render={<Link to="/models" />}>
            Browse Models
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <img src="/logo-no-bg.png" alt="VxLLM" className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Start a new conversation
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasActiveModel
                  ? "Choose a prompt below or type your own message to get started."
                  : "Select a model from the dropdown above, then start chatting."}
              </p>
            </div>

            {/* Model selector — shown when models are downloaded but none active */}
            {hasDownloadedModels && !hasActiveModel && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Select a model to load:
                </p>
                <ModelSelector />
              </div>
            )}
          </div>

          <div className="grid w-full max-w-lg grid-cols-2 gap-3">
            {EXAMPLE_PROMPTS.map((item) => (
              <Card
                key={item.title}
                size="sm"
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => handlePromptClick(item.prompt)}
              >
                <CardContent>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.prompt}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
