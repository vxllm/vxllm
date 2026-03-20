import { createFileRoute } from "@tanstack/react-router";

import { ChatEmptyState } from "@/components/chat/chat-empty-state";

export const Route = createFileRoute("/chat/")({
  component: ChatIndexPage,
});

function ChatIndexPage() {
  return <ChatEmptyState />;
}
