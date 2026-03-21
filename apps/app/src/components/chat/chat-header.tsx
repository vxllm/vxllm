import { Link } from "@tanstack/react-router";
import { Badge } from "@vxllm/ui/components/badge";
import { Button } from "@vxllm/ui/components/button";
import { CircleIcon, MenuIcon, SettingsIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";

import { SystemPromptEditor } from "@/components/chat/system-prompt-editor";
import { VoiceToggle } from "@/components/chat/voice-toggle";
import { useLoadedModels } from "@/hooks/use-loaded-models";
import { useChatLayout } from "@/routes/chat/route";

export function ChatHeader({
  conversationId,
  title,
  voiceOutput,
  onVoiceOutputChange,
}: {
  conversationId: string;
  title?: string | null;
  voiceOutput?: boolean;
  onVoiceOutputChange?: (enabled: boolean) => void;
}) {
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const { isMobile, openMobileSidebar } = useChatLayout();
  const { llm } = useLoadedModels();

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openMobileSidebar}
          >
            <MenuIcon className="size-4" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
          {title || "New conversation"}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Read-only model badge */}
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <CircleIcon
            className={`size-2 ${llm ? "fill-[#2EFAA0] text-[#2EFAA0]" : "fill-muted-foreground/30 text-muted-foreground/30"}`}
          />
          {llm ? `${llm.modelInfo.displayName}${llm.modelInfo.variant ? ` · ${llm.modelInfo.variant}` : ""}` : "No model"}
        </Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link to="/settings" />}
        >
          <SlidersHorizontalIcon className="size-4" />
          <span className="sr-only">Model settings</span>
        </Button>

        {onVoiceOutputChange && (
          <VoiceToggle
            enabled={voiceOutput ?? false}
            onToggle={onVoiceOutputChange}
          />
        )}
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
