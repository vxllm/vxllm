import { Link } from "@tanstack/react-router";
import { Button } from "@vxllm/ui/components/button";
import { Textarea } from "@vxllm/ui/components/textarea";
import type { ChatStatus } from "ai";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { VoiceRecorder } from "@/components/chat/voice-recorder";
import { useLoadedModels } from "@/hooks/use-loaded-models";

export function ChatInput({
  onSend,
  status,
  onStop,
}: {
  onSend: (text: string) => void;
  status: ChatStatus;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  const { llm, isLoadingModel } = useLoadedModels();
  const hasModel = llm !== null;
  const isDisabled = !hasModel || isLoadingModel;

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isDisabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, isDisabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape" && isStreaming) {
        onStop();
      }
    },
    [handleSend, isStreaming, onStop],
  );

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="border-t p-4">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isDisabled
              ? "Load a model to start chatting..."
              : "Type a message..."
          }
          className="min-h-[40px] max-h-[200px] resize-none"
          rows={1}
          disabled={isDisabled}
        />
        <VoiceRecorder
          onTranscription={(text) => onSend(text)}
          disabled={isStreaming || isDisabled}
        />
        {isStreaming ? (
          <Button variant="outline" size="icon" onClick={onStop} type="button">
            <SquareIcon className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isDisabled}
            type="button"
          >
            <ArrowUpIcon className="size-4" />
          </Button>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {isDisabled ? (
          <span>
            No model loaded.{" "}
            <Link
              to="/settings"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Go to Settings
            </Link>
          </span>
        ) : (
          <span>Cmd+Enter to send</span>
        )}
      </div>
    </div>
  );
}
