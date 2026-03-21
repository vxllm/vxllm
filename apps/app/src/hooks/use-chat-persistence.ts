import { useChat } from "@ai-sdk/react";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";

const SERVER_URL =
  (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:11500";

const chatTransportCache = new Map<string, DefaultChatTransport<UIMessage>>();

function getChatTransport(conversationId: string): DefaultChatTransport<UIMessage> {
  const existing = chatTransportCache.get(conversationId);
  if (existing) return existing;

  const transport = new DefaultChatTransport({
    api: `${SERVER_URL}/v1/chat/completions`,
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

  return chat;
}
