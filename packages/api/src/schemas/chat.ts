import { z } from "zod";

// ── Create Conversation Input ───────────────────────────────────────────────
export const CreateConversationInput = z.object({
  title: z.string().optional(),
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
});
export type CreateConversationInput = z.infer<typeof CreateConversationInput>;

// ── Conversation Output ─────────────────────────────────────────────────────
// Mirrors the DB conversations columns from packages/db/src/schema/conversations.ts
export const ConversationOutput = z.object({
  id: z.string(),
  title: z.string().nullable(),
  modelId: z.string().nullable(),
  systemPrompt: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ConversationOutput = z.infer<typeof ConversationOutput>;

// ── Add Message Input ───────────────────────────────────────────────────────
export const AddMessageInput = z.object({
  conversationId: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
  audioPath: z.string().optional(),
});
export type AddMessageInput = z.infer<typeof AddMessageInput>;

// ── Message Output ──────────────────────────────────────────────────────────
// Mirrors the DB messages columns from packages/db/src/schema/conversations.ts
export const MessageOutput = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  audioPath: z.string().nullable(),
  tokensIn: z.number().int().nullable(),
  tokensOut: z.number().int().nullable(),
  latencyMs: z.number().int().nullable(),
  createdAt: z.number().int(),
});
export type MessageOutput = z.infer<typeof MessageOutput>;
