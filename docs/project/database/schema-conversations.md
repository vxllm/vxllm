---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Database Schema: Conversations

## Overview

The conversations schema manages chat sessions and message history. It supports multi-turn conversations with context preservation, voice message storage, token tracking for cost/performance monitoring, and latency metrics. Conversations are associated with specific models and can have custom system prompts for fine-tuning behavior.

---

## Tables

### `conversations`

Top-level conversation/chat session container.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid; unique conversation identifier |
| `title` | `text` | | Auto-generated from first message or user-set |
| `modelId` | `text` | FK, nullable | → models.id ON DELETE SET NULL |
| `systemPrompt` | `text` | | Custom system prompt for this conversation |
| `createdAt` | `integer` | NOT NULL | Epoch milliseconds |
| `updatedAt` | `integer` | NOT NULL | Epoch milliseconds (updated on new message) |

**Indexes:**
- `idx_conversations_updated`: non-unique on `updatedAt` (for sorting by recent)

---

### `messages`

Individual messages within a conversation.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid |
| `conversationId` | `text` | NOT NULL, FK | → conversations.id ON DELETE CASCADE |
| `role` | `text` | NOT NULL, CHECK | Values: "system", "user", "assistant" |
| `content` | `text` | NOT NULL | Message text; can be empty for voice-only |
| `audioPath` | `text` | | Path to audio file if voice message (voice input or TTS output) |
| `tokensIn` | `integer` | | Input tokens (for cost tracking) |
| `tokensOut` | `integer` | | Output tokens (for cost tracking) |
| `latencyMs` | `integer` | | Generation latency in milliseconds |
| `createdAt` | `integer` | NOT NULL | Epoch milliseconds |

**Indexes:**
- `idx_messages_conversation`: non-unique on `conversationId` (fetch conversation messages)
- `idx_messages_created`: non-unique on `createdAt` (sort by creation time)

---

## ER Diagram

```
┌──────────────────────────┐
│   conversations          │
├──────────────────────────┤
│ id (PK)                  │
│ title                    │
│ modelId (FK) → models    │
│ systemPrompt             │
│ createdAt                │
│ updatedAt                │
└──────────────────────────┘
          │
          │ 1:N
          ▼
┌──────────────────────────┐
│      messages            │
├──────────────────────────┤
│ id (PK)                  │
│ conversationId (FK)      │
│ role (CHECK)             │
│ content                  │
│ audioPath                │
│ tokensIn                 │
│ tokensOut                │
│ latencyMs                │
│ createdAt                │
└──────────────────────────┘
```

---

## Drizzle Schema Code

```typescript
// /drizzle/schema.ts (additions to models.ts)
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { models } from './models'; // imported from schema-models.md

// Conversations table
export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    title: text('title'),
    modelId: text('model_id').references(() => models.id, { onDelete: 'set null' }),
    systemPrompt: text('system_prompt'),
    createdAt: integer('created_at').notNull().default(Math.floor(Date.now())),
    updatedAt: integer('updated_at').notNull().default(Math.floor(Date.now())),
  },
  (table) => ({
    idxConversationsUpdated: index('idx_conversations_updated').on(table.updatedAt),
  })
);

// Messages table
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['system', 'user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    audioPath: text('audio_path'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    latencyMs: integer('latency_ms'),
    createdAt: integer('created_at').notNull().default(Math.floor(Date.now())),
  },
  (table) => ({
    idxMessagesConversation: index('idx_messages_conversation').on(table.conversationId),
    idxMessagesCreated: index('idx_messages_created').on(table.createdAt),
  })
);

// Relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  model: one(models, { fields: [conversations.modelId], references: [models.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
```

---

## Relations

- **conversations ↔ messages**: One conversation has many messages (1:N, cascade delete)
- **conversations ↔ models**: One conversation is associated with one model (optional, set null on delete)

---

## Common Query Patterns

### Get conversation with all messages
```typescript
const conversation = await db
  .select()
  .from(conversations)
  .where(eq(conversations.id, conversationId));

const messages = await db
  .select()
  .from(messages)
  .where(eq(messages.conversationId, conversationId))
  .orderBy(asc(messages.createdAt));
```

### Get conversation with last N messages
```typescript
const recentMessages = await db
  .select()
  .from(messages)
  .where(eq(messages.conversationId, conversationId))
  .orderBy(desc(messages.createdAt))
  .limit(50)
  .then((msgs) => msgs.reverse());
```

### Get all conversations sorted by recent
```typescript
const userConversations = await db
  .select()
  .from(conversations)
  .orderBy(desc(conversations.updatedAt))
  .limit(20);
```

### Get conversation with associated model details
```typescript
const convWithModel = await db
  .select()
  .from(conversations)
  .leftJoin(models, eq(conversations.modelId, models.id))
  .where(eq(conversations.id, conversationId));
```

### Get last message of conversation
```typescript
const lastMessage = await db
  .select()
  .from(messages)
  .where(eq(messages.conversationId, conversationId))
  .orderBy(desc(messages.createdAt))
  .limit(1);
```

### Paginate messages with offset
```typescript
const page = 2;
const pageSize = 50;

const paginated = await db
  .select()
  .from(messages)
  .where(eq(messages.conversationId, conversationId))
  .orderBy(desc(messages.createdAt))
  .limit(pageSize)
  .offset(pageSize * (page - 1));
```

### Add new message and update conversation timestamp
```typescript
// Insert message
const newMessage = await db.insert(messages).values({
  id: nanoid(),
  conversationId,
  role: 'user',
  content: 'Hello!',
  createdAt: Math.floor(Date.now()),
});

// Update conversation updatedAt
await db
  .update(conversations)
  .set({ updatedAt: Math.floor(Date.now()) })
  .where(eq(conversations.id, conversationId));
```

### Calculate token usage for a conversation
```typescript
const tokenStats = await db
  .select({
    totalTokensIn: sql<number>`COALESCE(SUM(${messages.tokensIn}), 0)`,
    totalTokensOut: sql<number>`COALESCE(SUM(${messages.tokensOut}), 0)`,
    messageCount: sql<number>`COUNT(*)`,
  })
  .from(messages)
  .where(eq(messages.conversationId, conversationId));
```

### Get average latency for a conversation
```typescript
const latencyStats = await db
  .select({
    avgLatency: sql<number>`AVG(${messages.latencyMs})`,
    minLatency: sql<number>`MIN(${messages.latencyMs})`,
    maxLatency: sql<number>`MAX(${messages.latencyMs})`,
  })
  .from(messages)
  .where(eq(messages.conversationId, conversationId));
```

### Search conversations by title
```typescript
const searchResults = await db
  .select()
  .from(conversations)
  .where(
    and(
      like(conversations.title, `%${query}%`),
      // optional: order by relevance / recency
    )
  )
  .orderBy(desc(conversations.updatedAt))
  .limit(20);
```

### Get voice messages in conversation
```typescript
const voiceMessages = await db
  .select()
  .from(messages)
  .where(
    and(
      eq(messages.conversationId, conversationId),
      isNotNull(messages.audioPath)
    )
  )
  .orderBy(asc(messages.createdAt));
```

### Delete conversation and cascade
```typescript
// Cascade handled by DB schema (ON DELETE CASCADE)
await db
  .delete(conversations)
  .where(eq(conversations.id, conversationId));
```

---

## Data Integrity

- **Cascade Delete**: Deleting a conversation automatically deletes all associated messages.
- **Model Reference**: `modelId` is nullable; if the model is deleted, the conversation reference is set to NULL (orphaned messages retain the conversation).
- **Token Tracking**: Optional fields for cost/performance analysis; not required for message validity.
- **Audio Files**: Application responsible for managing actual audio files on disk; database only tracks path references.

---

## Performance Considerations

- **Pagination**: Use `limit` + `offset` with `idx_messages_created` for efficient message streaming.
- **Search**: `idx_conversations_updated` optimizes "recent conversations" queries.
- **Batch Inserts**: When importing long conversations, batch insert messages for performance.
- **Archival**: Consider archiving old conversations to separate table for faster queries on active conversations.

---

## Migration Notes

- **Timestamps**: Stored as integer (Unix epoch milliseconds) for SQLite compatibility.
- **Cascade Behavior**: Deleting a conversation cascades to all messages; use soft deletes if audit trail needed.
- **Audio Path Storage**: Relative or absolute paths; consider storing bucket/key format if using cloud storage (S3, GCS, etc.).
- **Token Fields**: Optional; can populate selectively for models that report token usage.

---

## Related Documentation

- [Schema: Models](./schema-models.md)
- [Schema: Settings & Auth](./schema-settings.md)
- [Schema: Metrics & Voice](./schema-metrics.md)
- [Database Guide](./database.md)
- [API: Conversations Endpoint](../api/conversations.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-20 | Initial schema with conversations and messages tables, token tracking, voice support |
