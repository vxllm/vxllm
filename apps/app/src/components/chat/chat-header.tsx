import { Button } from "@vxllm/ui/components/button";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";

import { ModelSelector } from "@/components/chat/model-selector";
import { SystemPromptEditor } from "@/components/chat/system-prompt-editor";

export function ChatHeader({
  conversationId,
  title,
  selectedModelId,
  onModelChange,
}: {
  conversationId: string;
  title?: string | null;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
        {title || "New conversation"}
      </h2>

      <div className="flex shrink-0 items-center gap-2">
        <ModelSelector value={selectedModelId} onValueChange={onModelChange} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSystemPromptOpen(true)}
        >
          <SettingsIcon className="size-4" />
          <span className="sr-only">System prompt</span>
        </Button>
        <SystemPromptEditor
          open={systemPromptOpen}
          onOpenChange={setSystemPromptOpen}
          conversationId={conversationId}
        />
      </div>
    </div>
  );
}
