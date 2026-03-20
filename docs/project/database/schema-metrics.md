---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Database Schema: Metrics & Voice

## Overview

The metrics and voice schema tracks system telemetry, performance data, and user voice preferences. The usage metrics table captures per-request performance data (tokens, latency, type) for dashboard visualization and analysis. The voice profiles table stores user-configurable voice settings for speech-to-text (STT) and text-to-speech (TTS) integration, enabling personalized voice experiences.

---

## Tables

### `usage_metrics`

Per-request telemetry for dashboard and analytics.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid |
| `modelId` | `text` | FK, nullable | → models.id ON DELETE SET NULL |
| `type` | `text` | NOT NULL, CHECK | Values: "chat", "completion", "embedding", "stt", "tts" |
| `tokensIn` | `integer` | | Input tokens (for LLM requests) |
| `tokensOut` | `integer` | | Output tokens (for LLM requests) |
| `latencyMs` | `integer` | NOT NULL | Request latency in milliseconds |
| `createdAt` | `integer` | NOT NULL | Epoch milliseconds |

**Indexes:**
- `idx_metrics_model`: non-unique on `modelId` (filter by model)
- `idx_metrics_created`: non-unique on `createdAt` (time-series queries)
- `idx_metrics_type`: non-unique on `type` (filter by request type)

**Notes:**
- **Token Tracking**: Only relevant for LLM-based requests (chat, completion); null for audio requests.
- **Latency**: Includes model inference + network round-trip time.
- **Lightweight**: Minimal schema for high-volume recording; consider archival strategy for old data.

---

### `voice_profiles`

User-configurable voice presets for STT/TTS integration.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid |
| `name` | `text` | NOT NULL | Human-readable profile name (e.g., "Professional", "Casual") |
| `sttModel` | `text` | | STT model identifier (e.g., "whisper:large-v3-turbo") |
| `ttsModel` | `text` | | TTS model identifier (e.g., "kokoro:v1.1") |
| `ttsVoice` | `text` | | TTS voice identifier (e.g., "af_sky", "am_michael") |
| `language` | `text` | DEFAULT 'en' | ISO 639-1 language code |
| `isDefault` | `integer` | NOT NULL, DEFAULT 0 | Boolean: 1 = default profile, 0 = not default |
| `createdAt` | `integer` | NOT NULL | Epoch milliseconds |
| `updatedAt` | `integer` | NOT NULL | Epoch milliseconds |

**Indexes:**
- `idx_voice_profiles_default`: non-unique on `isDefault` (fetch default profile)

**Notes:**
- **Multiple Profiles**: Users can create multiple voice profiles (casual vs. professional).
- **One Default**: Only one profile should have `isDefault = 1` per user (application enforces).
- **Model Identifiers**: Format: `<model-type>:<variant>` (e.g., "whisper:large-v3-turbo").
- **Voice Identifiers**: TTS voice codes depend on TTS model (Kokoro: "af_sky", "am_michael", etc.).

---

## ER Diagram

```
┌────────────────────────────┐
│   usage_metrics            │
├────────────────────────────┤
│ id (PK)                    │
│ modelId (FK) → models      │
│ type (CHECK)               │
│ tokensIn                   │
│ tokensOut                  │
│ latencyMs                  │
│ createdAt                  │
└────────────────────────────┘

┌────────────────────────────┐
│   voice_profiles           │
├────────────────────────────┤
│ id (PK)                    │
│ name                       │
│ sttModel                   │
│ ttsModel                   │
│ ttsVoice                   │
│ language                   │
│ isDefault                  │
│ createdAt                  │
│ updatedAt                  │
└────────────────────────────┘
```

---

## Drizzle Schema Code

```typescript
// /drizzle/schema.ts (additions)
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { models } from './models'; // imported from schema-models.md

// Usage metrics table
export const usageMetrics = sqliteTable(
  'usage_metrics',
  {
    id: text('id').primaryKey(),
    modelId: text('model_id').references(() => models.id, { onDelete: 'set null' }),
    type: text('type', { enum: ['chat', 'completion', 'embedding', 'stt', 'tts'] })
      .notNull(),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: integer('created_at').notNull().default(Math.floor(Date.now())),
  },
  (table) => ({
    idxMetricsModel: index('idx_metrics_model').on(table.modelId),
    idxMetricsCreated: index('idx_metrics_created').on(table.createdAt),
    idxMetricsType: index('idx_metrics_type').on(table.type),
  })
);

// Voice profiles table
export const voiceProfiles = sqliteTable(
  'voice_profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    sttModel: text('stt_model'),
    ttsModel: text('tts_model'),
    ttsVoice: text('tts_voice'),
    language: text('language').notNull().default('en'),
    isDefault: integer('is_default').notNull().default(0), // 1 or 0
    createdAt: integer('created_at').notNull().default(Math.floor(Date.now())),
    updatedAt: integer('updated_at').notNull().default(Math.floor(Date.now())),
  },
  (table) => ({
    idxVoiceProfilesDefault: index('idx_voice_profiles_default').on(table.isDefault),
  })
);

// Relations
export const usageMetricsRelations = relations(usageMetrics, ({ one }) => ({
  model: one(models, { fields: [usageMetrics.modelId], references: [models.id] }),
}));
```

---

## Common Query Patterns

### Record a metric after request completion
```typescript
await db.insert(usageMetrics).values({
  id: nanoid(),
  modelId: 'model-id-here',
  type: 'chat',
  tokensIn: 50,
  tokensOut: 150,
  latencyMs: 1250,
  createdAt: Math.floor(Date.now()),
});
```

### Get metrics for a specific model
```typescript
const modelMetrics = await db
  .select()
  .from(usageMetrics)
  .where(eq(usageMetrics.modelId, modelId))
  .orderBy(desc(usageMetrics.createdAt))
  .limit(100);
```

### Get metrics by type (e.g., all LLM chat requests)
```typescript
const chatMetrics = await db
  .select()
  .from(usageMetrics)
  .where(eq(usageMetrics.type, 'chat'))
  .orderBy(desc(usageMetrics.createdAt))
  .limit(500);
```

### Calculate average latency by model
```typescript
const latencyStats = await db
  .select({
    modelId: usageMetrics.modelId,
    avgLatency: sql<number>`AVG(${usageMetrics.latencyMs})`,
    minLatency: sql<number>`MIN(${usageMetrics.latencyMs})`,
    maxLatency: sql<number>`MAX(${usageMetrics.latencyMs})`,
    requestCount: sql<number>`COUNT(*)`,
  })
  .from(usageMetrics)
  .where(
    gte(
      usageMetrics.createdAt,
      Math.floor(Date.now()) - 86400000 // Last 24h
    )
  )
  .groupBy(usageMetrics.modelId)
  .orderBy(desc(sql`COUNT(*)`));
```

### Calculate token usage summary
```typescript
const tokenUsage = await db
  .select({
    type: usageMetrics.type,
    totalTokensIn: sql<number>`COALESCE(SUM(${usageMetrics.tokensIn}), 0)`,
    totalTokensOut: sql<number>`COALESCE(SUM(${usageMetrics.tokensOut}), 0)`,
  })
  .from(usageMetrics)
  .where(
    gte(
      usageMetrics.createdAt,
      Math.floor(Date.now()) - 86400000 // Last 24h
    )
  )
  .groupBy(usageMetrics.type);
```

### Get throughput over time (time-series for dashboard)
```typescript
const throughput = await db
  .select({
    hour: sql<string>`datetime(${usageMetrics.createdAt} / 1000, 'unixepoch', 'start of hour')`,
    count: sql<number>`COUNT(*)`,
    avgLatency: sql<number>`AVG(${usageMetrics.latencyMs})`,
  })
  .from(usageMetrics)
  .where(
    gte(
      usageMetrics.createdAt,
      Math.floor(Date.now()) - 604800000 // Last 7 days
    )
  )
  .groupBy(sql`datetime(${usageMetrics.createdAt} / 1000, 'unixepoch', 'start of hour')`)
  .orderBy(asc(sql`hour`));
```

### Get P50, P95, P99 latency percentiles
```typescript
const percentiles = await db
  .select({
    type: usageMetrics.type,
    p50: sql<number>`
      (SELECT ${usageMetrics.latencyMs}
       FROM ${usageMetrics} m2
       WHERE m2.type = ${usageMetrics.type}
       ORDER BY m2.latency_ms
       LIMIT 1 OFFSET CAST(COUNT(*) * 0.5 AS INTEGER))
    `,
    p95: sql<number>`
      (SELECT ${usageMetrics.latencyMs}
       FROM ${usageMetrics} m2
       WHERE m2.type = ${usageMetrics.type}
       ORDER BY m2.latency_ms
       LIMIT 1 OFFSET CAST(COUNT(*) * 0.95 AS INTEGER))
    `,
  })
  .from(usageMetrics)
  .groupBy(usageMetrics.type);
```

### Get default voice profile
```typescript
const defaultProfile = await db
  .select()
  .from(voiceProfiles)
  .where(eq(voiceProfiles.isDefault, 1))
  .limit(1);
```

### Create voice profile
```typescript
await db.insert(voiceProfiles).values({
  id: nanoid(),
  name: 'Professional',
  sttModel: 'whisper:large-v3-turbo',
  ttsModel: 'kokoro:v1.1',
  ttsVoice: 'af_sky',
  language: 'en',
  isDefault: 0,
  createdAt: Math.floor(Date.now()),
  updatedAt: Math.floor(Date.now()),
});
```

### List all voice profiles
```typescript
const profiles = await db
  .select()
  .from(voiceProfiles)
  .orderBy(desc(voiceProfiles.isDefault), asc(voiceProfiles.name));
```

### Set a voice profile as default
```typescript
// Clear current default
await db.update(voiceProfiles).set({ isDefault: 0 }).where(eq(voiceProfiles.isDefault, 1));

// Set new default
await db
  .update(voiceProfiles)
  .set({ isDefault: 1, updatedAt: Math.floor(Date.now()) })
  .where(eq(voiceProfiles.id, profileId));
```

### Update voice profile
```typescript
await db
  .update(voiceProfiles)
  .set({
    name: 'Updated Profile Name',
    ttsVoice: 'am_michael',
    updatedAt: Math.floor(Date.now()),
  })
  .where(eq(voiceProfiles.id, profileId));
```

### Get metrics with model details
```typescript
const metricsWithModels = await db
  .select({
    metric: usageMetrics,
    modelName: models.displayName,
  })
  .from(usageMetrics)
  .leftJoin(models, eq(usageMetrics.modelId, models.id))
  .where(
    gte(
      usageMetrics.createdAt,
      Math.floor(Date.now()) - 86400000 // Last 24h
    )
  )
  .orderBy(desc(usageMetrics.createdAt));
```

### Delete old metrics (archival/cleanup)
```typescript
const thirtyDaysAgo = Math.floor(Date.now()) - 2592000000; // 30 days in ms

await db
  .delete(usageMetrics)
  .where(lt(usageMetrics.createdAt, thirtyDaysAgo));
```

---

## Aggregation Queries for Dashboard

### Daily request count and average latency
```typescript
const dailyStats = await db
  .select({
    date: sql<string>`DATE(${usageMetrics.createdAt} / 1000, 'unixepoch')`,
    requestCount: sql<number>`COUNT(*)`,
    avgLatency: sql<number>`AVG(${usageMetrics.latencyMs})`,
    totalTokensIn: sql<number>`COALESCE(SUM(${usageMetrics.tokensIn}), 0)`,
    totalTokensOut: sql<number>`COALESCE(SUM(${usageMetrics.tokensOut}), 0)`,
  })
  .from(usageMetrics)
  .where(
    gte(
      usageMetrics.createdAt,
      Math.floor(Date.now()) - 2592000000 // Last 30 days
    )
  )
  .groupBy(sql`DATE(${usageMetrics.createdAt} / 1000, 'unixepoch')`)
  .orderBy(asc(sql`date`));
```

### Request type breakdown (pie chart)
```typescript
const typeBreakdown = await db
  .select({
    type: usageMetrics.type,
    count: sql<number>`COUNT(*)`,
    percentage: sql<number>`ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ${usageMetrics}), 2)`,
  })
  .from(usageMetrics)
  .where(
    gte(
      usageMetrics.createdAt,
      Math.floor(Date.now()) - 86400000 // Last 24h
    )
  )
  .groupBy(usageMetrics.type)
  .orderBy(desc(sql`COUNT(*)`));
```

---

## Performance Considerations

- **High Volume**: Usage metrics table can grow rapidly; implement archival strategy (move old data to separate table or delete).
- **Indexing**: Indexes on `createdAt` and `modelId` optimize common queries; consider compound index for time-range + model queries.
- **Aggregation**: Pre-compute hourly/daily summaries to separate table for faster dashboard queries.
- **Retention Policy**: Define retention window (e.g., 30 days live + 1 year archived) to manage database size.

---

## Migration Notes

- **Timestamps**: Stored as integer (Unix epoch milliseconds) for SQLite compatibility.
- **Token Nullability**: Token fields are nullable for non-LLM request types; application validates consistency.
- **Voice Profiles**: Independent table allows multiple profiles per user; application manages user ownership if needed.
- **Metric Cardinality**: Consider partitioning/archival if metrics grow beyond millions of rows.

---

## Related Documentation

- [Schema: Models](./schema-models.md)
- [Schema: Conversations](./schema-conversations.md)
- [Schema: Settings & Auth](./schema-settings.md)
- [Database Guide](./database.md)
- [Dashboard: Metrics & Analytics](../ui/dashboard.md)
- [API: Voice Profiles Endpoint](../api/voice-profiles.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-20 | Initial schema with usage metrics telemetry and voice profile management |
