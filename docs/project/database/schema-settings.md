---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Database Schema: Settings & Auth

## Overview

The settings and auth schema manages application configuration, API key management, and server-mode authentication. The settings table acts as a flexible key-value store for application state, while the API keys table provides secure, rate-limited access control for programmatic clients. API keys are hashed for security and include granular permission and rate-limit controls.

---

## Tables

### `settings`

Key-value store for application settings and configuration.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `key` | `text` | PRIMARY KEY | Setting identifier (e.g., "server.port", "voice.language") |
| `value` | `text` | NOT NULL | JSON string or plain text value |
| `updatedAt` | `integer` | NOT NULL | Epoch milliseconds; timestamp of last update |

**Indexes:**
- No additional indexes (PK on `key` is sufficient)

**Notes:**
- **Flexibility**: Values stored as text; application responsible for parsing (JSON, booleans, etc.)
- **Common Keys**:
  - `server.port`: Server listen port
  - `server.host`: Server bind address
  - `server.apiKey`: Legacy/master API key (deprecated in favor of api_keys table)
  - `ui.theme`: Theme preference
  - `voice.language`: Default language for STT/TTS
  - `models.downloadDir`: Directory for model downloads

---

### `api_keys`

API keys for server-mode authentication with granular permissions and rate limiting.

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | `text` | PRIMARY KEY | nanoid; internal identifier |
| `keyHash` | `text` | NOT NULL, UNIQUE | SHA-256 hash of full key; never store plain key |
| `keyPrefix` | `text` | NOT NULL, UNIQUE | First 8 characters (e.g., "vx_sk_ab..."); for identification |
| `label` | `text` | NOT NULL | Human-readable name (e.g., "Mobile App", "CI/CD Bot") |
| `permissions` | `text` | DEFAULT '*' | JSON array of permission strings or "*" for all; e.g., `["conversations:read", "models:list"]` |
| `rateLimit` | `integer` | | Requests per minute; null = unlimited |
| `lastUsedAt` | `integer` | | Epoch milliseconds of last usage |
| `expiresAt` | `integer` | | Epoch milliseconds; null = never expires |
| `createdAt` | `integer` | NOT NULL | Epoch milliseconds |

**Indexes:**
- `idx_api_keys_hash`: UNIQUE on `keyHash`
- `idx_api_keys_prefix`: UNIQUE on `keyPrefix`

**Notes:**
- **Key Format**: `vx_sk_<random>` (prefix: "vx_sk_", ensures easy identification)
- **Hashing**: Full key hashed with SHA-256 before storage; only show full key on creation (never in logs/API responses)
- **Permissions**: JSON array or wildcard; application validates against permission set
- **Rate Limiting**: Per-API-key limiting; check `rateLimit` on each request

---

## ER Diagram

```
┌────────────────────┐
│    settings        │
├────────────────────┤
│ key (PK)           │
│ value              │
│ updatedAt          │
└────────────────────┘

┌────────────────────────────┐
│     api_keys               │
├────────────────────────────┤
│ id (PK)                    │
│ keyHash (UNI)              │
│ keyPrefix (UNI)            │
│ label                      │
│ permissions                │
│ rateLimit                  │
│ lastUsedAt                 │
│ expiresAt                  │
│ createdAt                  │
└────────────────────────────┘
```

---

## Drizzle Schema Code

```typescript
// /drizzle/schema.ts (additions)
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Settings table
export const settings = sqliteTable(
  'settings',
  {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at').notNull().default(Math.floor(Date.now())),
  }
);

// API Keys table
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull().unique(),
    label: text('label').notNull(),
    permissions: text('permissions').notNull().default('*'), // JSON array or "*"
    rateLimit: integer('rate_limit'), // requests per minute; null = unlimited
    lastUsedAt: integer('last_used_at'),
    expiresAt: integer('expires_at'),
    createdAt: integer('created_at').notNull().default(Math.floor(Date.now())),
  },
  (table) => ({
    idxApiKeysHash: uniqueIndex('idx_api_keys_hash').on(table.keyHash),
    idxApiKeysPrefix: uniqueIndex('idx_api_keys_prefix').on(table.keyPrefix),
  })
);
```

---

## Security Considerations

### API Key Storage

- **Never Store Plain Keys**: Always hash with SHA-256 before storage.
- **Key Creation Response**: Only show full key once during creation. Log only the prefix.
- **Rotation**: No built-in rotation; application should support key revocation and new key generation.
- **Leak Detection**: Monitor hashes in logs; if a key is exposed, delete the API key row.

### Example Key Generation Workflow

```typescript
import crypto from 'crypto';
import { nanoid } from 'nanoid';

function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const randomSuffix = nanoid(32);
  const fullKey = `vx_sk_${randomSuffix}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
  const keyPrefix = fullKey.slice(0, 8); // "vx_sk_xx"

  return { fullKey, keyHash, keyPrefix };
}

// Usage:
const { fullKey, keyHash, keyPrefix } = generateApiKey();

// Insert into DB:
await db.insert(apiKeys).values({
  id: nanoid(),
  keyHash,
  keyPrefix,
  label: 'Mobile App',
  permissions: JSON.stringify(['conversations:read', 'conversations:write']),
  rateLimit: 100, // 100 requests/min
  createdAt: Math.floor(Date.now()),
});

// Return to user (only once):
console.log(`API Key: ${fullKey}`);
```

### API Key Validation Workflow

```typescript
import crypto from 'crypto';

async function validateApiKey(incomingKey: string): Promise<boolean> {
  // Hash the incoming key
  const keyHash = crypto.createHash('sha256').update(incomingKey).digest('hex');

  // Look up hash in DB
  const apiKey = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKey.length) {
    return false; // Key not found
  }

  const key = apiKey[0];

  // Check expiration
  if (key.expiresAt && key.expiresAt < Date.now()) {
    return false; // Expired
  }

  // Check rate limit
  if (key.rateLimit) {
    const usageCount = await checkRateLimitBucket(key.id);
    if (usageCount >= key.rateLimit) {
      return false; // Rate limited
    }
  }

  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: Math.floor(Date.now()) })
    .where(eq(apiKeys.id, key.id));

  return true;
}
```

---

## Common Query Patterns

### Get setting by key
```typescript
const setting = await db
  .select()
  .from(settings)
  .where(eq(settings.key, 'server.port'));
```

### Update setting (upsert pattern)
```typescript
const newValue = '8000';

await db
  .insert(settings)
  .values({
    key: 'server.port',
    value: newValue,
    updatedAt: Math.floor(Date.now()),
  })
  .onConflictDoUpdate({
    target: settings.key,
    set: {
      value: newValue,
      updatedAt: Math.floor(Date.now()),
    },
  });
```

### Get all settings
```typescript
const allSettings = await db.select().from(settings);
```

### Create API key
```typescript
const { fullKey, keyHash, keyPrefix } = generateApiKey();

const newApiKey = await db
  .insert(apiKeys)
  .values({
    id: nanoid(),
    keyHash,
    keyPrefix,
    label: 'Frontend App',
    permissions: JSON.stringify(['models:list', 'conversations:read', 'conversations:write']),
    rateLimit: 500,
    createdAt: Math.floor(Date.now()),
  })
  .returning();
```

### Get API key details by hash
```typescript
const apiKey = await db
  .select()
  .from(apiKeys)
  .where(eq(apiKeys.keyHash, keyHash));
```

### List all API keys (admin)
```typescript
const allKeys = await db
  .select({
    id: apiKeys.id,
    label: apiKeys.label,
    keyPrefix: apiKeys.keyPrefix,
    permissions: apiKeys.permissions,
    rateLimit: apiKeys.rateLimit,
    lastUsedAt: apiKeys.lastUsedAt,
    expiresAt: apiKeys.expiresAt,
    createdAt: apiKeys.createdAt,
  })
  .from(apiKeys)
  .orderBy(desc(apiKeys.createdAt));
```

### Revoke API key
```typescript
await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
```

### Get active API keys (not expired)
```typescript
const activeKeys = await db
  .select()
  .from(apiKeys)
  .where(
    or(
      isNull(apiKeys.expiresAt),
      gt(apiKeys.expiresAt, Math.floor(Date.now()))
    )
  );
```

### Update API key last used time
```typescript
await db
  .update(apiKeys)
  .set({ lastUsedAt: Math.floor(Date.now()) })
  .where(eq(apiKeys.keyHash, keyHash));
```

### Get settings matching pattern
```typescript
const voiceSettings = await db
  .select()
  .from(settings)
  .where(like(settings.key, 'voice.%'));
```

---

## Permission Model

Permissions follow a hierarchical naming convention for granular access control.

**Standard Permissions:**
- `models:list` — List available models
- `models:read` — Read model details
- `models:download` — Initiate model downloads
- `conversations:read` — Read conversation history
- `conversations:write` — Create/edit conversations
- `conversations:delete` — Delete conversations
- `settings:read` — Read settings
- `settings:write` — Modify settings (admin only)
- `*` — All permissions

**Permission Validation:**

```typescript
function hasPermission(apiKey: ApiKey, requiredPermission: string): boolean {
  const permissions = JSON.parse(apiKey.permissions);

  if (permissions === '*') return true;
  if (permissions.includes(requiredPermission)) return true;
  if (permissions.includes('*')) return true;

  return false;
}
```

---

## Migration Notes

- **Settings Flexibility**: JSON values allow storing complex structures; document expected formats.
- **API Key Rotation**: No automatic rotation; applications should rotate keys periodically.
- **Timestamp Precision**: Unix epoch milliseconds for consistent time handling across SQLite.
- **Hashing Algorithm**: SHA-256; consider upgrading to bcrypt for additional security if performance allows.
- **Rate Limiting**: Database tracks last use; implement in-memory token bucket or sliding window in application layer.

---

## Related Documentation

- [Schema: Models](./schema-models.md)
- [Schema: Conversations](./schema-conversations.md)
- [Schema: Metrics & Voice](./schema-metrics.md)
- [Database Guide](./database.md)
- [API: Authentication](../api/authentication.md)
- [Security: API Key Management](../security/api-keys.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-20 | Initial schema with settings key-value store and secure API key management |
