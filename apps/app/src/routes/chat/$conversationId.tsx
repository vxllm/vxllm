import { createFileRoute } from "@tanstack/react-router";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { useChatWithPersistence } from "@/hooks/use-chat-persistence";

export const Route = createFileRoute("/chat/$conversationId")({
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const chat = useChatWithPersistence(conversationId);

  return (
    <div className="flex h-full flex-col">
      {/* Header placeholder — Task 7 */}
      <div className="border-b p-3 text-sm font-medium">Chat</div>

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
