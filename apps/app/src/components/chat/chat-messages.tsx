import type { UIMessage } from "ai";
import type { ChatStatus } from "ai";
import { BotIcon, CopyIcon, RefreshCwIcon, UserIcon } from "lucide-react";
import { useCallback } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageActions,
  MessageAction,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

export function ChatMessages({
  messages,
  status,
  onRegenerate,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  onRegenerate?: () => void;
}) {
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const getMessageText = (message: UIMessage): string =>
    message.parts
      .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("");

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <Conversation>
      <ConversationContent>
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === "assistant" && index === messages.length - 1;
          const isAnimating = isLastAssistant && status === "streaming";

          return (
            <Message key={message.id} from={message.role}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  {message.role === "user" ? (
                    <UserIcon className="size-4 text-muted-foreground" />
                  ) : (
                    <BotIcon className="size-4 text-muted-foreground" />
                  )}
                </div>
                <MessageContent>
                  {message.parts.map((part, partIndex) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse
                          key={partIndex}
                          isAnimating={isAnimating}
                        >
                          {part.text}
                        </MessageResponse>
                      );
                    }
                    if (part.type === "reasoning") {
                      return (
                        <div
                          key={partIndex}
                          className="border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground italic"
                        >
                          {part.text}
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </div>

              {message.role === "assistant" && !isStreaming && (
                <MessageActions className="ml-10">
                  <MessageAction
                    tooltip="Copy"
                    onClick={() => handleCopy(getMessageText(message))}
                  >
                    <CopyIcon />
                  </MessageAction>
                  {isLastAssistant && onRegenerate && (
                    <MessageAction tooltip="Regenerate" onClick={onRegenerate}>
                      <RefreshCwIcon />
                    </MessageAction>
                  )}
                </MessageActions>
              )}
            </Message>
          );
        })}

        {status === "submitted" && messages.at(-1)?.role !== "assistant" && (
          <Message from="assistant">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <BotIcon className="size-4 text-muted-foreground" />
              </div>
              <MessageContent>
                <div className="text-muted-foreground text-sm animate-pulse">
                  Thinking...
                </div>
              </MessageContent>
            </div>
          </Message>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
