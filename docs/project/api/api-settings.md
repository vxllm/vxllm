# API: Settings

**Status:** Draft
**Version:** 1.0
**Owner:** Rahul
**Last Updated:** 2026-03-20

## Overview

The Settings API provides type-safe procedures for querying and updating application configuration, API key management, and hardware information via oRPC. All operations are validated using Zod schemas. Settings are persisted in SQLite (settings table) and API keys in the api_keys table.

**Router:** `settingsRouter`
**Auth:** API key required (localhost exempt)

---

## Procedures Summary

| Type | Procedure | Purpose |
|------|-----------|---------|
| Query | `settings.getAll` | Get all settings |
| Query | `settings.get` | Get single setting |
| Mutation | `settings.update` | Update one or more settings |
| Query | `apiKeys.list` | List API keys (masked) |
| Mutation | `apiKeys.create` | Generate new API key |
| Mutation | `apiKeys.delete` | Revoke API key |
| Query | `hardware.info` | Get hardware profile |

---

## Detailed Procedures

### Query: settings.getAll

Retrieve all application settings as a key-value map.

#### Input Schema

```typescript
interface SettingsGetAllInput {
  // No input required
}
```

#### Output Schema

```typescript
interface SettingsGetAllOutput extends Record<string, string> {
  // All settings as key-value pairs
  // Examples:
  // "activeModel": "mistral-7b-instruct"
  // "theme": "dark"
  // "language": "en"
  // "maxTokens": "2048"
  // "temperature": "0.7"
}
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/settings.getAll \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Example Response

```json
{
  "activeModel": "mistral-7b-instruct",
  "theme": "dark",
  "language": "en",
  "maxTokens": "2048",
  "temperature": "0.7",
  "serverMode": "false",
  "bindAddress": "127.0.0.1",
  "bindPort": "8000",
  "apiKeyRequired": "false"
}
```

---

### Query: settings.get

Retrieve a single setting by key.

#### Input Schema

```typescript
interface SettingsGetInput {
  /**
   * Setting key.
   */
  key: string;
}
```

#### Zod Schema

```typescript
const SettingsGetInputSchema = z.object({
  key: z.string().min(1),
});
```

#### Output Schema

```typescript
interface SettingsGetOutput {
  /**
   * Setting key.
   */
  key: string;

  /**
   * Setting value (as string).
   */
  value: string;

  /**
   * Unix timestamp of last update.
   */
  updatedAt: number;
}
```

#### Zod Output Schema

```typescript
const SettingsGetOutputSchema = z.object({
  key: z.string(),
  value: z.string(),
  updatedAt: z.number(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/settings.get \
  -H "Content-Type: application/json" \
  -d '{"key": "activeModel"}'
```

#### Example Response

```json
{
  "key": "activeModel",
  "value": "mistral-7b-instruct",
  "updatedAt": 1710946800
}
```

---

### Mutation: settings.update

Update one or more settings.

#### Input Schema

```typescript
interface SettingsUpdateInput {
  /**
   * Key-value map of settings to update.
   */
  settings: Record<string, string>;
}
```

#### Zod Schema

```typescript
const SettingsUpdateInputSchema = z.object({
  settings: z.record(z.string(), z.string()),
});
```

#### Output Schema

```typescript
interface SettingsUpdateOutput extends Record<string, string> {
  // All updated settings as key-value pairs
}
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/settings.update \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "activeModel": "neural-chat-7b-v3-1",
      "temperature": "0.8",
      "theme": "light"
    }
  }'
```

#### Example Response

```json
{
  "activeModel": "neural-chat-7b-v3-1",
  "temperature": "0.8",
  "theme": "light"
}
```

---

## API Key Management

### Query: apiKeys.list

List all API keys (with keys masked for security).

#### Input Schema

```typescript
interface ApiKeysListInput {
  // No input required
}
```

#### Output Schema

```typescript
interface ApiKeysListOutput {
  /**
   * Array of API key objects.
   */
  keys: Array<ApiKey>;
}

interface ApiKey {
  /**
   * Unique API key ID (UUID).
   */
  id: string;

  /**
   * User-assigned label.
   */
  label: string;

  /**
   * Masked key (last 8 chars visible, e.g., "sk_****...abc123").
   */
  maskedKey: string;

  /**
   * Permissions granted to this key.
   * @example ["inference", "chat", "models"]
   */
  permissions?: string[];

  /**
   * Rate limit (requests per hour). Null = unlimited.
   */
  rateLimit?: number;

  /**
   * Unix timestamp of creation.
   */
  createdAt: number;

  /**
   * Unix timestamp of last use. Null if never used.
   */
  lastUsedAt?: number;

  /**
   * Whether the key is active.
   * @default true
   */
  isActive: boolean;

  /**
   * Expiration timestamp. Null = never expires.
   */
  expiresAt?: number;
}
```

#### Zod Output Schema

```typescript
const ApiKeySchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  maskedKey: z.string(),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().optional(),
  createdAt: z.number(),
  lastUsedAt: z.number().optional(),
  isActive: z.boolean(),
  expiresAt: z.number().optional(),
});

const ApiKeysListOutputSchema = z.object({
  keys: z.array(ApiKeySchema),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/apiKeys.list \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Example Response

```json
{
  "keys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "label": "Development Key",
      "maskedKey": "sk_****...abc123",
      "permissions": ["inference", "chat", "models"],
      "rateLimit": 1000,
      "createdAt": 1710946700,
      "lastUsedAt": 1710946800,
      "isActive": true,
      "expiresAt": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "label": "Production Key",
      "maskedKey": "sk_****...xyz789",
      "permissions": ["inference"],
      "rateLimit": 10000,
      "createdAt": 1710946600,
      "lastUsedAt": 1710946750,
      "isActive": true,
      "expiresAt": 1711551600
    }
  ]
}
```

---

### Mutation: apiKeys.create

Generate a new API key.

#### Input Schema

```typescript
interface ApiKeysCreateInput {
  /**
   * Label for this key (e.g., "Development", "Production").
   */
  label: string;

  /**
   * Permissions to grant.
   * @example ["inference", "chat", "models"]
   */
  permissions?: string[];

  /**
   * Rate limit (requests per hour). Null = unlimited.
   */
  rateLimit?: number;

  /**
   * Expiration timestamp (unix seconds). Null = never expires.
   */
  expiresAt?: number;
}
```

#### Zod Schema

```typescript
const ApiKeysCreateInputSchema = z.object({
  label: z.string().min(1),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().optional(),
  expiresAt: z.number().optional(),
});
```

#### Output Schema

```typescript
interface ApiKeysCreateOutput {
  /**
   * The full API key (shown ONCE, never again).
   * Client must securely store this value.
   */
  key: string;

  /**
   * API key metadata object (same as in list).
   */
  apiKey: ApiKey;
}
```

#### Zod Output Schema

```typescript
const ApiKeysCreateOutputSchema = z.object({
  key: z.string(),
  apiKey: ApiKeySchema,
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/apiKeys.create \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Mobile App",
    "permissions": ["inference", "chat"],
    "rateLimit": 5000
  }'
```

#### Example Response

```json
{
  "key": "sk_abc123def456ghi789jkl012mno345pqr",
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "label": "Mobile App",
    "maskedKey": "sk_****...pqr",
    "permissions": ["inference", "chat"],
    "rateLimit": 5000,
    "createdAt": 1710946805,
    "isActive": true,
    "expiresAt": null
  }
}
```

**Important:** The `key` field is the full API key and is shown only once. Client must securely store it.

---

### Mutation: apiKeys.delete

Revoke an API key.

#### Input Schema

```typescript
interface ApiKeysDeleteInput {
  /**
   * API key ID to revoke.
   */
  id: string;
}
```

#### Zod Schema

```typescript
const ApiKeysDeleteInputSchema = z.object({
  id: z.string().uuid(),
});
```

#### Output Schema

```typescript
interface ApiKeysDeleteOutput {
  /**
   * True if deletion succeeded.
   */
  success: boolean;
}
```

#### Zod Output Schema

```typescript
const ApiKeysDeleteOutputSchema = z.object({
  success: z.boolean(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/apiKeys.delete \
  -H "Content-Type: application/json" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440002"}'
```

#### Example Response

```json
{
  "success": true
}
```

---

## Hardware Information

### Query: hardware.info

Get hardware profile and recommendations.

#### Input Schema

```typescript
interface HardwareInfoInput {
  // No input required
}
```

#### Output Schema

```typescript
interface HardwareInfoOutput {
  /**
   * Operating system platform.
   * @example "darwin" | "linux" | "win32"
   */
  platform: string;

  /**
   * True if running on Apple Silicon (M1/M2/M3).
   */
  isAppleSilicon: boolean;

  /**
   * GPU VRAM available in GB (0 if no dedicated GPU).
   */
  gpuVramGb: number;

  /**
   * System RAM in GB.
   */
  systemRamGb: number;

  /**
   * Number of CPU cores.
   */
  cpuCores: number;

  /**
   * Recommended number of GPU layers for efficient inference.
   * Null if no GPU available.
   */
  recommendedGpuLayers?: number;

  /**
   * Recommended quantization level.
   * @example "Q4_K_M" | "Q5_K_M" | "f16"
   */
  recommendedQuantization: string;

  /**
   * Additional GPU information (if available).
   */
  gpu?: {
    name: string;
    vramGb: number;
  };

  /**
   * CPU model name.
   */
  cpuModel?: string;
}
```

#### Zod Output Schema

```typescript
const HardwareInfoOutputSchema = z.object({
  platform: z.string(),
  isAppleSilicon: z.boolean(),
  gpuVramGb: z.number(),
  systemRamGb: z.number(),
  cpuCores: z.number(),
  recommendedGpuLayers: z.number().optional(),
  recommendedQuantization: z.string(),
  gpu: z.object({
    name: z.string(),
    vramGb: z.number(),
  }).optional(),
  cpuModel: z.string().optional(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/hardware.info \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Example Response

```json
{
  "platform": "darwin",
  "isAppleSilicon": true,
  "gpuVramGb": 16,
  "systemRamGb": 32,
  "cpuCores": 8,
  "recommendedGpuLayers": 40,
  "recommendedQuantization": "f16",
  "gpu": {
    "name": "Apple GPU",
    "vramGb": 16
  },
  "cpuModel": "Apple M2 Max"
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
| `SETTING_NOT_FOUND` | 404 | Setting key does not exist. |
| `INVALID_INPUT` | 400 | Invalid input parameters. |
| `API_KEY_NOT_FOUND` | 404 | API key ID does not exist. |
| `INVALID_PERMISSION` | 400 | Invalid permission name. |
| `SERVER_ERROR` | 500 | Internal server error. |

#### Example Error Response

```json
{
  "error": {
    "message": "API key not found.",
    "code": "API_KEY_NOT_FOUND"
  }
}
```

---

## Database Tables

### settings

Stores application configuration key-value pairs.

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### api_keys

Stores API keys for programmatic access.

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  hashedKey TEXT NOT NULL UNIQUE,
  permissions TEXT, -- JSON array
  rateLimit INTEGER,
  isActive INTEGER NOT NULL DEFAULT 1, -- 0=false, 1=true
  createdAt INTEGER NOT NULL,
  lastUsedAt INTEGER,
  expiresAt INTEGER,
  UNIQUE(label)
);

CREATE INDEX idx_api_keys_expiresAt ON api_keys(expiresAt);
```

---

## Default Settings

| Key | Default Value | Description |
|-----|---------------|-------------|
| `activeModel` | First downloaded model | Current model for inference |
| `theme` | `dark` | UI theme: `dark` \| `light` |
| `language` | `en` | Language code |
| `maxTokens` | `2048` | Max tokens to generate |
| `temperature` | `0.7` | Sampling temperature |
| `serverMode` | `false` | Enable server mode (non-localhost) |
| `bindAddress` | `127.0.0.1` | Server bind address |
| `bindPort` | `8000` | Server port |
| `apiKeyRequired` | `false` | Require API key on localhost |

---

## Related Documentation

- [API: Chat](./api-chat.md)
- [API: Model Management](./api-model-management.md)
- [Architecture Overview](../architecture.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-20 | 1.0 | Initial draft. Full settings, API key, and hardware info procedures. |
