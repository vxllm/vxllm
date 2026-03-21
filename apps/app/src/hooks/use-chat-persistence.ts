import { useChat } from "@ai-sdk/react";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useEffect } from "react";

import { env } from "@vxllm/env/web";

const chatTransportCache = new Map<string, DefaultChatTransport<UIMessage>>();

function getChatTransport(conversationId: string): DefaultChatTransport<UIMessage> {
  const existing = chatTransportCache.get(conversationId);
  if (existing) return existing;

  const transport = new DefaultChatTransport({
    api: `${env.VITE_SERVER_URL}/api/chat`,
    headers: {
      "X-Conversation-Id": conversationId,
    },
  });

  chatTransportCache.set(conversationId, transport);
  return transport;
}

export function useChatWithPersistence(
  conversationId: string,
): UseChatHelpers<UIMessage> {
  const chat = useChat({
    id: conversationId,
    transport: getChatTransport(conversationId),
  });

  // Clean up transport cache when the component unmounts
  useEffect(() => {
    return () => {
      chatTransportCache.delete(conversationId);
    };
  }, [conversationId]);

  return chat;
}
