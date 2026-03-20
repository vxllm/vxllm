import { z } from "zod";

import { publicProcedure } from "../index";
import { CreateConversationInput, AddMessageInput } from "../schemas/chat";

export const chatRouter = {
  // Mutation: create a new conversation
  createConversation: publicProcedure
    .input(CreateConversationInput)
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Query: get a single conversation by ID
  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("Not implemented");
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
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Mutation: delete a conversation and all its messages
  deleteConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Mutation: add a message to a conversation
  addMessage: publicProcedure
    .input(AddMessageInput)
    .handler(async () => {
      throw new Error("Not implemented");
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
    .handler(async () => {
      throw new Error("Not implemented");
    }),

  // Mutation: regenerate the last assistant message in a conversation
  regenerateLastMessage: publicProcedure
    .input(z.object({ conversationId: z.string() }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),
};
