# API: Chat

**Status:** Draft
**Version:** 1.0
**Owner:** Rahul
**Last Updated:** 2026-03-20

## Overview

The Chat API provides type-safe procedures for managing conversations and messages via oRPC. All operations are validated using Zod schemas. Conversations are stored in the SQLite database (conversations, messages tables) and support cursor-based pagination for efficient message retrieval.

**Router:** `chatRouter`
**Auth:** API key required (localhost exempt)

---

## Procedures Summary

| Type | Procedure | Purpose |
|------|-----------|---------|
| Query | `conversations.list` | List all conversations with pagination |
| Query | `conversations.get` | Get conversation with all messages |
| Mutation | `conversations.create` | Create new conversation |
| Mutation | `conversations.update` | Update conversation metadata |
| Mutation | `conversations.delete` | Delete conversation and its messages |
| Query | `messages.list` | Get messages with cursor pagination |
| Mutation | `messages.create` | Save a message to conversation |

---

## Detailed Procedures

### Query: conversations.list

List all conversations with optional search and pagination.

#### Input Schema

```typescript
interface ConversationsListInput {
  /**
   * Page number (1-indexed).
   * @default 1
   */
  page?: number;

  /**
   * Results per page.
   * @default 20
   */
  limit?: number;

  /**
   * Search query (fuzzy match on conversation title).
   */
  search?: string;
}
```

#### Zod Schema

```typescript
const ConversationsListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
```

#### Output Schema

```typescript
interface ConversationsListOutput {
  /**
   * Array of conversation objects.
   */
  conversations: Array<ConversationPreview>;

  /**
   * Total number of conversations.
   */
  total: number;

  /**
   * Current page number.
   */
  page: number;

  /**
   * Results per page.
   */
  limit: number;

  /**
   * Total number of pages.
   */
  pages: number;
}

interface ConversationPreview {
  /**
   * Unique conversation ID (UUID).
   */
  id: string;

  /**
   * Conversation title.
   */
  title: string;

  /**
   * ID of the model used in this conversation.
   */
  modelId: string;

  /**
   * Model name (denormalized).
   */
  modelName: string;

  /**
   * Preview of the last message (first 80 characters).
   */
  lastMessagePreview: string;

  /**
   * Unix timestamp of last message.
   */
  lastMessageAt: number;

  /**
   * Total number of messages in conversation.
   */
  messageCount: number;

  /**
   * Unix timestamp of creation.
   */
  createdAt: number;

  /**
   * Unix timestamp of last update.
   */
  updatedAt: number;
}
```

#### Zod Output Schema

```typescript
const ConversationPreviewSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  modelId: z.string(),
  modelName: z.string(),
  lastMessagePreview: z.string(),
  lastMessageAt: z.number(),
  messageCount: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const ConversationsListOutputSchema = z.object({
  conversations: z.array(ConversationPreviewSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/conversations.list \
  -H "Content-Type: application/json" \
  -d '{
    "page": 1,
    "limit": 10,
    "search": "mistral"
  }'
```

#### Example Response

```json
{
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Quantum Computing Discussion",
      "modelId": "mistral-7b-instruct",
      "modelName": "Mistral 7B Instruct",
      "lastMessagePreview": "Quantum entanglement is a key principle...",
      "lastMessageAt": 1710946800,
      "messageCount": 12,
      "createdAt": 1710946700,
      "updatedAt": 1710946800
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "pages": 1
}
```

---

### Query: conversations.get

Retrieve a single conversation with all its messages.

#### Input Schema

```typescript
interface ConversationsGetInput {
  /**
   * Conversation ID (UUID).
   */
  id: string;
}
```

#### Zod Schema

```typescript
const ConversationsGetInputSchema = z.object({
  id: z.string().uuid(),
});
```

#### Output Schema

```typescript
interface ConversationsGetOutput {
  /**
   * Conversation object with full details.
   */
  conversation: Conversation;

  /**
   * Array of all messages in the conversation.
   */
  messages: Array<Message>;
}

interface Conversation {
  /**
   * Unique conversation ID (UUID).
   */
  id: string;

  /**
   * Conversation title.
   */
  title: string;

  /**
   * Model ID used for this conversation.
   */
  modelId: string;

  /**
   * System prompt (if customized).
   */
  systemPrompt?: string;

  /**
   * Unix timestamp of creation.
   */
  createdAt: number;

  /**
   * Unix timestamp of last update.
   */
  updatedAt: number;
}

interface Message {
  /**
   * Unique message ID (UUID).
   */
  id: string;

  /**
   * Conversation ID.
   */
  conversationId: string;

  /**
   * Message role: "user" | "assistant" | "system".
   */
  role: "user" | "assistant" | "system";

  /**
   * Message content.
   */
  content: string;

  /**
   * Number of tokens in this message (optional).
   */
  tokens?: number;

  /**
   * Latency in milliseconds (for assistant messages).
   */
  latencyMs?: number;

  /**
   * Unix timestamp of creation.
   */
  createdAt: number;
}
```

#### Zod Output Schema

```typescript
const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  modelId: z.string(),
  systemPrompt: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  tokens: z.number().optional(),
  latencyMs: z.number().optional(),
  createdAt: z.number(),
});

const ConversationsGetOutputSchema = z.object({
  conversation: ConversationSchema,
  messages: z.array(MessageSchema),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/conversations.get \
  -H "Content-Type: application/json" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

#### Example Response

```json
{
  "conversation": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Quantum Computing Discussion",
    "modelId": "mistral-7b-instruct",
    "systemPrompt": "You are an expert physicist.",
    "createdAt": 1710946700,
    "updatedAt": 1710946800
  },
  "messages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "conversationId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "Explain quantum entanglement.",
      "tokens": 5,
      "createdAt": 1710946700
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "conversationId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "assistant",
      "content": "Quantum entanglement is a phenomenon where two or more particles...",
      "tokens": 64,
      "latencyMs": 1250,
      "createdAt": 1710946701
    }
  ]
}
```

---

### Mutation: conversations.create

Create a new conversation.

#### Input Schema

```typescript
interface ConversationsCreateInput {
  /**
   * Conversation title.
   * Auto-generated from first user message if omitted.
   */
  title?: string;

  /**
   * Model ID to use for this conversation.
   * Defaults to the currently active model.
   */
  modelId?: string;

  /**
   * Custom system prompt for this conversation.
   */
  systemPrompt?: string;
}
```

#### Zod Schema

```typescript
const ConversationsCreateInputSchema = z.object({
  title: z.string().optional(),
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
});
```

#### Output Schema

Same as `Conversation` (see `conversations.get` output).

#### Zod Output Schema

```typescript
const ConversationsCreateOutputSchema = ConversationSchema;
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/conversations.create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Physics Q&A",
    "modelId": "mistral-7b-instruct",
    "systemPrompt": "You are a physics tutor."
  }'
```

#### Example Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Physics Q&A",
  "modelId": "mistral-7b-instruct",
  "systemPrompt": "You are a physics tutor.",
  "createdAt": 1710946800,
  "updatedAt": 1710946800
}
```

---

### Mutation: conversations.update

Update conversation title, model, or system prompt.

#### Input Schema

```typescript
interface ConversationsUpdateInput {
  /**
   * Conversation ID.
   */
  id: string;

  /**
   * New title (if updating).
   */
  title?: string;

  /**
   * New model ID (if updating).
   */
  modelId?: string;

  /**
   * New system prompt (if updating).
   */
  systemPrompt?: string;
}
```

#### Zod Schema

```typescript
const ConversationsUpdateInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  modelId: z.string().optional(),
  systemPrompt: z.string().optional(),
});
```

#### Output Schema

Same as `Conversation`.

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/conversations.update \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Advanced Physics Discussion"
  }'
```

#### Example Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Advanced Physics Discussion",
  "modelId": "mistral-7b-instruct",
  "systemPrompt": "You are a physics tutor.",
  "createdAt": 1710946800,
  "updatedAt": 1710946805
}
```

---

### Mutation: conversations.delete

Delete a conversation and all its messages.

#### Input Schema

```typescript
interface ConversationsDeleteInput {
  /**
   * Conversation ID to delete.
   */
  id: string;
}
```

#### Zod Schema

```typescript
const ConversationsDeleteInputSchema = z.object({
  id: z.string().uuid(),
});
```

#### Output Schema

```typescript
interface ConversationsDeleteOutput {
  /**
   * True if deletion succeeded.
   */
  success: boolean;
}
```

#### Zod Output Schema

```typescript
const ConversationsDeleteOutputSchema = z.object({
  success: z.boolean(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/conversations.delete \
  -H "Content-Type: application/json" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

#### Example Response

```json
{
  "success": true
}
```

---

### Query: messages.list

Get messages from a conversation using cursor-based pagination.

#### Input Schema

```typescript
interface MessagesListInput {
  /**
   * Conversation ID.
   */
  conversationId: string;

  /**
   * Cursor for pagination (message ID to start after).
   * Omit to start from the beginning.
   */
  cursor?: string;

  /**
   * Number of messages to return.
   * @default 50
   */
  limit?: number;
}
```

#### Zod Schema

```typescript
const MessagesListInputSchema = z.object({
  conversationId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).default(50),
});
```

#### Output Schema

```typescript
interface MessagesListOutput {
  /**
   * Array of messages (ordered chronologically).
   */
  messages: Array<Message>;

  /**
   * Cursor for next page (null if at end).
   */
  nextCursor: string | null;

  /**
   * Total messages in conversation.
   */
  total: number;
}
```

#### Zod Output Schema

```typescript
const MessagesListOutputSchema = z.object({
  messages: z.array(MessageSchema),
  nextCursor: z.string().uuid().nullable(),
  total: z.number(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/messages.list \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "limit": 20
  }'
```

#### Example Response

```json
{
  "messages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "conversationId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "What is gravity?",
      "tokens": 4,
      "createdAt": 1710946700
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "conversationId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "assistant",
      "content": "Gravity is a fundamental force of nature...",
      "tokens": 78,
      "latencyMs": 1100,
      "createdAt": 1710946701
    }
  ],
  "nextCursor": null,
  "total": 2
}
```

---

### Mutation: messages.create

Save a message to a conversation.

#### Input Schema

```typescript
interface MessagesCreateInput {
  /**
   * Conversation ID.
   */
  conversationId: string;

  /**
   * Message role: "user" | "assistant" | "system".
   */
  role: "user" | "assistant" | "system";

  /**
   * Message content.
   */
  content: string;

  /**
   * Optional token count.
   */
  tokens?: number;

  /**
   * Optional latency (ms) for assistant messages.
   */
  latencyMs?: number;
}
```

#### Zod Schema

```typescript
const MessagesCreateInputSchema = z.object({
  conversationId: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  tokens: z.number().optional(),
  latencyMs: z.number().optional(),
});
```

#### Output Schema

Same as `Message` (see `messages.list` output).

#### Zod Output Schema

```typescript
const MessagesCreateOutputSchema = MessageSchema;
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/messages.create \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "content": "What about black holes?",
    "tokens": 5
  }'
```

#### Example Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "content": "What about black holes?",
  "tokens": 5,
  "createdAt": 1710946802
}
```

---

## Error Responses

```typescript
interface ErrorResponse {
  error: {
    message: string;
    code: string;
  };
}
```

### Common Error Codes

| Code | HTTP Status | Message |
|------|-------------|---------|
| `CONVERSATION_NOT_FOUND` | 404 | Conversation with given ID does not exist. |
| `INVALID_INPUT` | 400 | Invalid input parameters. |
| `MODEL_NOT_FOUND` | 404 | Model ID does not exist. |
| `SERVER_ERROR` | 500 | Internal server error. |

#### Example Error Response

```json
{
  "error": {
    "message": "Conversation not found.",
    "code": "CONVERSATION_NOT_FOUND"
  }
}
```

---

## Database Tables

### conversations

Stores conversation metadata.

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  modelId TEXT NOT NULL,
  systemPrompt TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (modelId) REFERENCES models(id)
);
```

### messages

Stores individual messages.

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  tokens INTEGER,
  latencyMs INTEGER,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (conversationId) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conversationId ON messages(conversationId, createdAt);
```

---

## Related Documentation

- [API: Inference](./api-inference.md)
- [API: Voice](./api-voice.md)
- [Architecture Overview](../architecture.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-20 | 1.0 | Initial draft. Full chat management procedures with Zod schemas and cursor pagination. |
