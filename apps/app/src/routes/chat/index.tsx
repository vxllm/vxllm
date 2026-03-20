import { createFileRoute } from "@tanstack/react-router";
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
  return <ChatEmptyState />;
}
