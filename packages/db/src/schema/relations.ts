import { relations } from "drizzle-orm";

import { conversations, messages } from "./conversations";
import { usageMetrics } from "./metrics";
import { downloadQueue, modelTags, models, tags } from "./models";

// --- Models domain relations ---

export const modelsRelations = relations(models, ({ many }) => ({
  tags: many(modelTags),
  downloadQueue: many(downloadQueue),
  conversations: many(conversations),
  usageMetrics: many(usageMetrics),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  models: many(modelTags),
}));

export const modelTagsRelations = relations(modelTags, ({ one }) => ({
  model: one(models, {
    fields: [modelTags.modelId],
    references: [models.id],
  }),
  tag: one(tags, {
    fields: [modelTags.tagId],
    references: [tags.id],
  }),
}));

export const downloadQueueRelations = relations(downloadQueue, ({ one }) => ({
  model: one(models, {
    fields: [downloadQueue.modelId],
    references: [models.id],
  }),
}));

// --- Conversations domain relations ---

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    model: one(models, {
      fields: [conversations.modelId],
      references: [models.id],
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// --- Metrics domain relations ---

export const usageMetricsRelations = relations(usageMetrics, ({ one }) => ({
  model: one(models, {
    fields: [usageMetrics.modelId],
    references: [models.id],
  }),
}));
