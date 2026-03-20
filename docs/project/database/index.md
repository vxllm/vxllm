---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# Database Registry

## Overview

VxLLM uses **Drizzle ORM** with **SQLite** (libsql via `@libsql/client`) for all persistent storage. Compatible with **Turso** for optional cloud sync.

## Schema Files

| Schema | Tables | Description | Link |
|--------|--------|-------------|------|
| Models | `models`, `tags`, `model_tags`, `download_queue` | Model registry, tagging, download tracking | [→](./schema-models.md) |
| Conversations | `conversations`, `messages` | Chat history and message storage | [→](./schema-conversations.md) |
| Settings | `settings`, `api_keys` | App configuration and server-mode auth | [→](./schema-settings.md) |
| Metrics | `usage_metrics`, `voice_profiles` | Telemetry and voice presets | [→](./schema-metrics.md) |

## All Tables

| Table | PK Type | Rows (est.) | Description |
|-------|---------|-------------|-------------|
| `models` | text (nanoid) | 10-100 | All known models (registry + downloaded) |
| `tags` | text (nanoid) | 20-50 | Model categorization tags |
| `model_tags` | composite | 50-200 | Model ↔ tag junction |
| `download_queue` | text (nanoid) | 0-5 | Active/queued downloads |
| `conversations` | text (nanoid) | 10-1000+ | Chat conversations |
| `messages` | text (nanoid) | 100-10000+ | Chat messages |
| `settings` | text (key) | 10-20 | Key-value configuration |
| `api_keys` | text (nanoid) | 0-20 | Server-mode API keys |
| `usage_metrics` | text (nanoid) | 1000-100000+ | Per-request telemetry |
| `voice_profiles` | text (nanoid) | 1-10 | Voice configuration presets |

## Entity Relationships

```
models 1──N download_queue
models N──N tags (via model_tags)
models 1──N conversations
models 1──N usage_metrics
conversations 1──N messages
```

## Conventions

- **Primary keys**: `text` type using nanoid (not UUID — SQLite has no native UUID)
- **Timestamps**: `integer` storing Unix epoch milliseconds (SQLite has no native timestamptz)
- **Enums**: `text` columns with CHECK constraints (SQLite has no ENUM type)
- **Soft delete**: Not used — hard delete with CASCADE for simplicity
- **ORM**: Drizzle with `drizzle-orm/sqlite-core` imports (`sqliteTable`, `text`, `integer`, `real`)
