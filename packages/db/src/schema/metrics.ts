import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { models } from "./models";

// Usage metrics table — per-request telemetry for dashboard and analytics
export const usageMetrics = sqliteTable(
  "usage_metrics",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id").references(() => models.id, {
      onDelete: "set null",
    }),
    type: text("type", {
      enum: ["chat", "completion", "embedding", "stt", "tts"],
    }).notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    idxMetricsModel: index("idx_metrics_model").on(table.modelId),
    idxMetricsCreated: index("idx_metrics_created").on(table.createdAt),
    idxMetricsType: index("idx_metrics_type").on(table.type),
  }),
);

// Voice profiles table — user-configurable voice presets for STT/TTS
export const voiceProfiles = sqliteTable(
  "voice_profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sttModel: text("stt_model"),
    ttsModel: text("tts_model"),
    ttsVoice: text("tts_voice"),
    language: text("language").notNull().default("en"),
    isDefault: integer("is_default").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    idxVoiceProfilesDefault: index("idx_voice_profiles_default").on(
      table.isDefault,
    ),
  }),
);
