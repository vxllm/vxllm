import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chat/$conversationId")({
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = Route.useParams();

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground text-sm">
        Conversation: {conversationId}
      </p>
    </div>
  );
}
