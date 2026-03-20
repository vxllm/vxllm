import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { useChatWithPersistence } from "@/hooks/use-chat-persistence";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/chat/$conversationId")({
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const chat = useChatWithPersistence(conversationId);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>();

  const conversationQuery = useQuery(
    orpc.chat.getConversation.queryOptions({
      input: { id: conversationId },
    }),
  );

  const title = conversationQuery.data?.title;

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        conversationId={conversationId}
        title={title}
        selectedModelId={selectedModelId}
        onModelChange={setSelectedModelId}
      />

      <ChatMessages
        messages={chat.messages}
        status={chat.status}
        onRegenerate={() => chat.regenerate()}
      />

      <ChatInput
        onSend={(text) => chat.sendMessage({ text })}
        status={chat.status}
        onStop={chat.stop}
      />
    </div>
  );
}
