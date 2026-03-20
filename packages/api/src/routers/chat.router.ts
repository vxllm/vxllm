import { z } from "zod";
import { eq, like, desc, and, lt, sql } from "drizzle-orm";
import { generateText } from "ai";

import { publicProcedure } from "../index";
import { CreateConversationInput, UpdateConversationInput, AddMessageInput } from "../schemas/chat";
import { conversations, messages } from "@vxllm/db/schema/conversations";
import { createLlamaProvider } from "@vxllm/llama-provider";
import { persistChat } from "../services/chat.service";

export const chatRouter = {
  // Mutation: create a new conversation
  createConversation: publicProcedure
    .input(CreateConversationInput)
    .handler(async ({ input, context }) => {
      const id = crypto.randomUUID();
      const now = Date.now();

      await context.db
        .insert(conversations)
        .values({
          id,
          title: input.title ?? null,
          modelId: input.modelId ?? null,
          systemPrompt: input.systemPrompt ?? null,
          createdAt: now,
          updatedAt: now,
        });

      const [row] = await context.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1);

      return row!;
    }),

  // Query: get a single conversation by ID
  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const [row] = await context.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.id))
        .limit(1);

      if (!row) {
        throw new Error(`Conversation not found: ${input.id}`);
      }

      return row;
    }),

  // Query: list conversations with pagination
  listConversations: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const offset = (input.page - 1) * input.limit;

      const whereClause = input.search
        ? like(conversations.title, `%${input.search}%`)
        : undefined;

      const items = await context.db
        .select()
        .from(conversations)
        .where(whereClause)
        .orderBy(desc(conversations.updatedAt))
        .limit(input.limit)
        .offset(offset);

      const [countResult] = await context.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(conversations)
        .where(whereClause);

      return {
        items,
        total: countResult?.total ?? 0,
      };
    }),

  // Mutation: update a conversation (title, model, system prompt)
  updateConversation: publicProcedure
    .input(UpdateConversationInput)
    .handler(async ({ input, context }) => {
      const [existing] = await context.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.id))
        .limit(1);

      if (!existing) {
        throw new Error(`Conversation not found: ${input.id}`);
      }

      const updates: Record<string, unknown> = { updatedAt: Date.now() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.modelId !== undefined) updates.modelId = input.modelId;
      if (input.systemPrompt !== undefined) updates.systemPrompt = input.systemPrompt;

      await context.db
        .update(conversations)
        .set(updates)
        .where(eq(conversations.id, input.id));

      const [row] = await context.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.id))
        .limit(1);

      return row!;
    }),

  // Mutation: delete a conversation and all its messages
  deleteConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      await context.db
        .delete(conversations)
        .where(eq(conversations.id, input.id));

      return { success: true };
    }),

  // Mutation: add a message to a conversation
  addMessage: publicProcedure
    .input(AddMessageInput)
    .handler(async ({ input, context }) => {
      const id = crypto.randomUUID();
      const now = Date.now();

      await context.db.insert(messages).values({
        id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        audioPath: input.audioPath ?? null,
        createdAt: now,
      });

      // Update conversation's updatedAt timestamp
      await context.db
        .update(conversations)
        .set({ updatedAt: now })
        .where(eq(conversations.id, input.conversationId));

      const [row] = await context.db
        .select()
        .from(messages)
        .where(eq(messages.id, id))
        .limit(1);

      return row!;
    }),

  // Query: get messages for a conversation with cursor pagination
  getMessages: publicProcedure
    .input(
      z.object({
        conversationId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(50),
      }),
    )
    .handler(async ({ input, context }) => {
      const conditions = [eq(messages.conversationId, input.conversationId)];

      if (input.cursor) {
        const cursorTimestamp = parseInt(input.cursor, 10);
        conditions.push(lt(messages.createdAt, cursorTimestamp));
      }

      // Fetch one extra to determine if there's a next page
      const rows = await context.db
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(input.limit + 1);

      let nextCursor: string | null = null;
      if (rows.length > input.limit) {
        const lastItem = rows.pop()!;
        nextCursor = String(lastItem.createdAt);
      }

      return {
        items: rows,
        nextCursor,
      };
    }),

  // Mutation: regenerate the last assistant message in a conversation
  regenerateLastMessage: publicProcedure
    .input(z.object({ conversationId: z.string() }))
    .handler(async ({ input, context }) => {
      if (!context.modelManager) {
        throw new Error("ModelManager not available");
      }

      const active = context.modelManager.getActive();
      if (!active) {
        throw new Error("No model is currently loaded");
      }

      // Find the last assistant message
      const [lastAssistant] = await context.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, input.conversationId),
            eq(messages.role, "assistant"),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (!lastAssistant) {
        throw new Error("No assistant message found to regenerate");
      }

      // Delete the last assistant message
      await context.db
        .delete(messages)
        .where(eq(messages.id, lastAssistant.id));

      // Fetch remaining conversation messages in chronological order
      const conversationMessages = await context.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(messages.createdAt);

      // Get the conversation for system prompt
      const [conversation] = await context.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);

      // Build AI SDK messages
      const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

      if (conversation?.systemPrompt) {
        aiMessages.push({ role: "system", content: conversation.systemPrompt });
      }

      for (const msg of conversationMessages) {
        aiMessages.push({
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        });
      }

      // Generate new response
      const provider = createLlamaProvider(context.modelManager);
      const startTime = Date.now();

      const result = await generateText({
        model: provider.chat(active.sessionId),
        messages: aiMessages,
      });

      const latencyMs = Date.now() - startTime;
      const assistantContent = result.text;
      const tokensIn = result.usage?.inputTokens ?? 0;
      const tokensOut = result.usage?.outputTokens ?? 0;

      // Find the last user message content for persistChat
      const lastUserMsg = conversationMessages.findLast((m) => m.role === "user");

      // Persist the new assistant message via shared service
      await persistChat({
        conversationId: input.conversationId,
        modelId: active.modelInfo.name,
        userContent: lastUserMsg?.content ?? "",
        assistantContent,
        tokensIn,
        tokensOut,
        latencyMs,
      });

      // Fetch and return the newly created assistant message
      const [newMessage] = await context.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, input.conversationId),
            eq(messages.role, "assistant"),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return newMessage!;
    }),
};
