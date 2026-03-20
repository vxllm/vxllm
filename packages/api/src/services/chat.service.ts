import { eq } from "drizzle-orm";
import { db } from "@vxllm/db";
import { conversations, messages } from "@vxllm/db/schema/conversations";
import { usageMetrics } from "@vxllm/db/schema/metrics";

export interface PersistChatParams {
  conversationId: string;
  modelId: string | null;
  userContent: string;
  assistantContent: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  /** Used as the conversation title (truncated) when creating a new conversation */
  firstMessageContent?: string;
}

/**
 * Persist a chat exchange to the database.
 *
 * Creates the conversation if it doesn't exist, inserts user and assistant
 * messages, and records a usage metric entry.
 *
 * This is extracted as a shared service so both the OpenAI-compatible chat
 * route and the oRPC chat router can reuse the same persistence logic.
 */
export async function persistChat(params: PersistChatParams): Promise<void> {
  const {
    conversationId,
    modelId,
    userContent,
    assistantContent,
    tokensIn,
    tokensOut,
    latencyMs,
    firstMessageContent,
  } = params;

  const now = Date.now();

  // Check if conversation exists, create if not
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!existing.length) {
    await db.insert(conversations).values({
      id: conversationId,
      title: firstMessageContent?.slice(0, 50) ?? "New conversation",
      modelId,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // Update the conversation's updatedAt timestamp
    await db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, conversationId));
  }

  // Insert user message
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    conversationId,
    role: "user",
    content: userContent,
    createdAt: now,
  });

  // Insert assistant message
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    conversationId,
    role: "assistant",
    content: assistantContent,
    tokensIn,
    tokensOut,
    latencyMs,
    createdAt: now,
  });

  // Insert usage metric
  await db.insert(usageMetrics).values({
    id: crypto.randomUUID(),
    modelId,
    type: "chat",
    tokensIn,
    tokensOut,
    latencyMs,
    createdAt: now,
  });
}
