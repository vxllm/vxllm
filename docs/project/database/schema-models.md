---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Database Schema: Models

## Overview

The models schema tracks all known models across the VxLLM system, including downloaded models and those available from registries. It supports discovery, version management, resource tracking, and download queue operations. Models are categorized by type (LLM, STT, TTS, embedding) and format (GGUF, Whisper, Kokoro), with support for variants (quantization levels) and resource requirements.

---

## Tables

### `models`

Tracks all known models (downloaded + available from registry).

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid; unique identifier |
| `name` | `text` | NOT NULL, UNIQUE | Canonical name (e.g., "llama3.1:8b") |
| `displayName` | `text` | NOT NULL | Human-readable name (e.g., "Llama 3.1 8B Instruct") |
| `description` | `text` | | Model description/details |
| `type` | `text` | NOT NULL, CHECK | Values: "llm", "stt", "tts", "embedding" |
| `format` | `text` | CHECK | Values: "gguf", "whisper", "kokoro", null for others |
| `variant` | `text` | | Quantization/variant (e.g., "q4_k_m", "q8_0", "large-v3-turbo") |
| `repo` | `text` | | HuggingFace repo (e.g., "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF") |
| `fileName` | `text` | | Specific file in repo (e.g., "model.gguf") |
| `localPath` | `text` | | Absolute path to downloaded file |
| `sizeBytes` | `integer` | | File size in bytes |
| `status` | `text` | NOT NULL, DEFAULT 'available', CHECK | Values: "available", "downloading", "downloaded", "error" |
| `minRamGb` | `real` | | Minimum RAM requirement (GB) |
| `recommendedVramGb` | `real` | | Recommended VRAM (GB) |
| `downloadedAt` | `integer` | | Epoch milliseconds when downloaded |
| `createdAt` | `integer` | NOT NULL, DEFAULT | Epoch milliseconds (unixepoch() \* 1000) |
| `updatedAt` | `integer` | NOT NULL, DEFAULT | Epoch milliseconds (unixepoch() \* 1000) |

**Indexes:**
- `idx_models_name`: UNIQUE on `name`
- `idx_models_type`: non-unique on `type`
- `idx_models_status`: non-unique on `status`

---

### `tags`

Model tags for categorization and discovery.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid |
| `name` | `text` | NOT NULL | Display name (e.g., "instruct", "chat") |
| `slug` | `text` | NOT NULL, UNIQUE | URL-safe slug (e.g., "instruct") |

---

### `model_tags`

Junction table linking models to tags (many-to-many).

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `modelId` | `text` | NOT NULL, FK | → models.id ON DELETE CASCADE |
| `tagId` | `text` | NOT NULL, FK | → tags.id ON DELETE CASCADE |
| **Primary Key** | | `(modelId, tagId)` | Composite PK |

---

### `download_queue`

Tracks active and queued downloads with progress and error handling.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid |
| `modelId` | `text` | NOT NULL, FK | → models.id ON DELETE CASCADE |
| `priority` | `integer` | NOT NULL, DEFAULT 0 | Higher priority = lower execution order |
| `progressPct` | `real` | NOT NULL, DEFAULT 0 | 0.0–100.0 |
| `downloadedBytes` | `integer` | NOT NULL, DEFAULT 0 | Bytes downloaded so far |
| `totalBytes` | `integer` | | Total file size in bytes |
| `speedBps` | `integer` | | Current download speed (bytes/second) |
| `status` | `text` | NOT NULL, DEFAULT 'queued', CHECK | Values: "queued", "active", "paused", "completed", "failed" |
| `error` | `text` | | Error message if status = "failed" |
| `startedAt` | `integer` | | Epoch ms when download started |
| `completedAt` | `integer` | | Epoch ms when download completed |
| `createdAt` | `integer` | NOT NULL, DEFAULT | Epoch milliseconds |

**Indexes:**
- `idx_download_queue_model`: non-unique on `modelId`
- `idx_download_queue_status`: non-unique on `status`

---

## ER Diagram

```
┌─────────────────────┐
│      models         │
├─────────────────────┤
│ id (PK)             │
│ name (UNIQUE)       │
│ displayName         │
│ description         │
│ type (CHECK)        │
│ format              │
│ variant             │
│ repo                │
│ fileName            │
│ localPath           │
│ sizeBytes           │
│ status (CHECK)      │
│ minRamGb            │
│ recommendedVramGb   │
│ downloadedAt        │
│ createdAt           │
│ updatedAt           │
└─────────────────────┘
        │
        │ 1:N
        ├─────────────────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌─────────────────┐
│ model_tags   │      │ download_queue  │
├──────────────┤      ├─────────────────┤
│ modelId (FK) │      │ id (PK)         │
│ tagId (FK)   │      │ modelId (FK)    │
│ (PK: both)   │      │ priority        │
└──────────────┘      │ progressPct     │
        │              │ downloadedBytes │
        │              │ totalBytes      │
        │              │ speedBps        │
        │              │ status (CHECK)  │
        │              │ error           │
        │              │ startedAt       │
        │              │ completedAt     │
        │              │ createdAt       │
        │              └─────────────────┘
        │
        ▼
┌─────────────┐
│    tags     │
├─────────────┤
│ id (PK)     │
│ name        │
│ slug (UNI)  │
└─────────────┘
```

---

## Drizzle Schema Code

```typescript
// /drizzle/schema.ts
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Models table
export const models = sqliteTable(
  'models',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    type: text('type', { enum: ['llm', 'stt', 'tts', 'embedding'] }).notNull(),
    format: text('format', { enum: ['gguf', 'whisper', 'kokoro'] }),
    variant: text('variant'),
    repo: text('repo'),
    fileName: text('file_name'),
    localPath: text('local_path'),
    sizeBytes: integer('size_bytes'),
    status: text('status', { enum: ['available', 'downloading', 'downloaded', 'error'] })
      .notNull()
      .default('available'),
    minRamGb: real('min_ram_gb'),
    recommendedVramGb: real('recommended_vram_gb'),
    downloadedAt: integer('downloaded_at'),
    createdAt: integer('created_at').notNull().default(Math.floor(Date.now())),
    updatedAt: integer('updated_at').notNull().default(Math.floor(Date.now())),
  },
  (table) => ({
    idxModelsName: uniqueIndex('idx_models_name').on(table.name),
    idxModelsType: index('idx_models_type').on(table.type),
    idxModelsStatus: index('idx_models_status').on(table.status),
  })
);

// Tags table
export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
  }
);

// Model-Tags junction table
export const modelTags = sqliteTable(
  'model_tags',
  {
    modelId: text('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.modelId, table.tagId] }),
  })
);

// Download queue table
export const downloadQueue = sqliteTable(
  'download_queue',
  {
    id: text('id').primaryKey(),
    modelId: text('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull().default(0),
    progressPct: real('progress_pct').notNull().default(0),
    downloadedBytes: integer('downloaded_bytes').notNull().default(0),
    totalBytes: integer('total_bytes'),
    speedBps: integer('speed_bps'),
    status: text('status', { enum: ['queued', 'active', 'paused', 'completed', 'failed'] })
      .notNull()
      .default('queued'),
    error: text('error'),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
    createdAt: integer('created_at').notNull().default(Math.floor(Date.now())),
  },
  (table) => ({
    idxDownloadModel: index('idx_download_queue_model').on(table.modelId),
    idxDownloadStatus: index('idx_download_queue_status').on(table.status),
  })
);

// Relations
export const modelsRelations = relations(models, ({ many }) => ({
  tags: many(modelTags),
  downloadQueue: many(downloadQueue),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  models: many(modelTags),
}));

export const modelTagsRelations = relations(modelTags, ({ one }) => ({
  model: one(models, { fields: [modelTags.modelId], references: [models.id] }),
  tag: one(tags, { fields: [modelTags.tagId], references: [tags.id] }),
}));

export const downloadQueueRelations = relations(downloadQueue, ({ one }) => ({
  model: one(models, { fields: [downloadQueue.modelId], references: [models.id] }),
}));
```

---

## Relations

- **models ↔ model_tags**: One model has many tags (many-to-many via junction)
- **tags ↔ model_tags**: One tag applied to many models (many-to-many via junction)
- **models ↔ download_queue**: One model can have multiple download queue entries (1:N)

---

## Common Query Patterns

### Get all downloaded models by type
```typescript
const downloadedLLMs = await db
  .select()
  .from(models)
  .where(and(eq(models.type, 'llm'), eq(models.status, 'downloaded')));
```

### Get model with tags
```typescript
const modelWithTags = await db
  .select()
  .from(models)
  .leftJoin(modelTags, eq(models.id, modelTags.modelId))
  .leftJoin(tags, eq(modelTags.tagId, tags.id))
  .where(eq(models.id, modelId));
```

### Get active downloads with progress
```typescript
const activeDownloads = await db
  .select({
    modelName: models.name,
    progress: downloadQueue.progressPct,
    speed: downloadQueue.speedBps,
    status: downloadQueue.status,
  })
  .from(downloadQueue)
  .innerJoin(models, eq(downloadQueue.modelId, models.id))
  .where(eq(downloadQueue.status, 'active'))
  .orderBy(desc(downloadQueue.priority));
```

### Paginate models with filters
```typescript
const filteredModels = await db
  .select()
  .from(models)
  .where(
    and(
      eq(models.type, filterType),
      or(
        isNull(models.format),
        eq(models.format, filterFormat)
      )
    )
  )
  .orderBy(desc(models.createdAt))
  .limit(pageSize)
  .offset(pageSize * (page - 1));
```

### Update model status after download completion
```typescript
await db
  .update(models)
  .set({
    status: 'downloaded',
    downloadedAt: Math.floor(Date.now()),
    updatedAt: Math.floor(Date.now()),
  })
  .where(eq(models.id, modelId));
```

### Get models by tag slug
```typescript
const modelsByTag = await db
  .select({ model: models })
  .from(models)
  .leftJoin(modelTags, eq(models.id, modelTags.modelId))
  .leftJoin(tags, eq(modelTags.tagId, tags.id))
  .where(eq(tags.slug, 'instruct'));
```

---

## Migration Notes

- **Primary Keys**: All IDs are text (nanoid) to avoid SQLite UUID limitations.
- **Timestamps**: Stored as integer (Unix epoch milliseconds) for SQLite compatibility.
- **Status Enums**: Text columns with CHECK constraints instead of native enums.
- **Resource Tracking**: `sizeBytes`, `minRamGb`, `recommendedVramGb` enable filtering by available system resources.
- **Download Queue**: Separate table allows tracking multiple concurrent/queued downloads per model (e.g., variants).

---

## Related Documentation

- [Schema: Conversations](./schema-conversations.md)
- [Schema: Settings & Auth](./schema-settings.md)
- [Schema: Metrics & Voice](./schema-metrics.md)
- [Database Guide](./database.md)
- [Migration Strategy](./migrations.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-20 | Initial schema definition with models, tags, and download queue tables |
