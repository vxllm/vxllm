import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { ChatEmptyState } from "@/components/chat/chat-empty-state";

const chatSearchSchema = z.object({
  prompt: z.string().optional(),
});

export const Route = createFileRoute("/chat/")({
  component: ChatIndexPage,
  validateSearch: chatSearchSchema,
});

function ChatIndexPage() {
  const { prompt } = Route.useSearch();
  const navigate = useNavigate();

  // When a prompt search param is present (e.g. from example prompt cards),
  // generate a fresh conversation ID and redirect to the conversation route
  // which handles auto-sending the prompt.
  useEffect(() => {
    if (prompt) {
      const conversationId = crypto.randomUUID();
      navigate({
        to: "/chat/$conversationId",
        params: { conversationId },
        search: { prompt },
        replace: true,
      });
    }
  }, [prompt, navigate]);

  // While redirecting, don't flash the empty state
  if (prompt) {
    return null;
  }

  return <ChatEmptyState />;
}
