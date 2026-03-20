import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { models } from "./models";

// Conversations table — top-level conversation/chat session container
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    title: text("title"),
    modelId: text("model_id").references(() => models.id, {
      onDelete: "set null",
    }),
    systemPrompt: text("system_prompt"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    idxConversationsUpdated: index("idx_conversations_updated").on(
      table.updatedAt,
    ),
  }),
);

// Messages table — individual messages within a conversation
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["system", "user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    audioPath: text("audio_path"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    latencyMs: integer("latency_ms"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    idxMessagesConversation: index("idx_messages_conversation").on(
      table.conversationId,
    ),
    idxMessagesCreated: index("idx_messages_created").on(table.createdAt),
  }),
);
