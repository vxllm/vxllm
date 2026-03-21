import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Models table — tracks all known models (downloaded + available from registry)
export const models = sqliteTable(
  "models",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    type: text("type", { enum: ["llm", "stt", "tts", "embedding"] }).notNull(),
    format: text("format", { enum: ["gguf", "whisper", "kokoro", "nemo"] }),
    backend: text("backend", {
      enum: ["llama-cpp", "faster-whisper", "nemo", "kokoro", "whisper-cpp"],
    }),
    variant: text("variant"),
    repo: text("repo"),
    fileName: text("file_name"),
    localPath: text("local_path"),
    sizeBytes: integer("size_bytes"),
    status: text("status", {
      enum: ["available", "downloading", "downloaded", "error"],
    })
      .notNull()
      .default("available"),
    minRamGb: real("min_ram_gb"),
    recommendedVramGb: real("recommended_vram_gb"),
    downloadedAt: integer("downloaded_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    idxModelsName: uniqueIndex("idx_models_name").on(table.name),
    idxModelsType: index("idx_models_type").on(table.type),
    idxModelsStatus: index("idx_models_status").on(table.status),
  }),
);

// Tags table — model tags for categorization and discovery
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

// Model-Tags junction table — many-to-many link between models and tags
export const modelTags = sqliteTable(
  "model_tags",
  {
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.modelId, table.tagId] }),
  }),
);

// Download queue table — tracks active and queued downloads
export const downloadQueue = sqliteTable(
  "download_queue",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
    progressPct: real("progress_pct").notNull().default(0),
    downloadedBytes: integer("downloaded_bytes").notNull().default(0),
    totalBytes: integer("total_bytes"),
    speedBps: integer("speed_bps"),
    status: text("status", {
      enum: ["queued", "active", "paused", "completed", "failed"],
    })
      .notNull()
      .default("queued"),
    error: text("error"),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    idxDownloadModel: index("idx_download_queue_model").on(table.modelId),
    idxDownloadStatus: index("idx_download_queue_status").on(table.status),
  }),
);
