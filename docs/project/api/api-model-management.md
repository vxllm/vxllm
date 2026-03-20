# API: Model Management

**Status:** Draft
**Version:** 1.0
**Owner:** Rahul
**Last Updated:** 2026-03-20

## Overview

The Model Management API provides type-safe procedures for querying, downloading, and managing LLM models via oRPC. All procedures are validated using Zod schemas. The API queries the SQLite database (models table) and manages the download queue (download_queue table).

**Router:** `modelRouter`
**Auth:** API key required (localhost exempt)

---

## Procedures Summary

| Type | Procedure | Purpose |
|------|-----------|---------|
| Query | `models.list` | List all models with filters |
| Query | `models.get` | Get single model details |
| Mutation | `models.pull` | Start downloading a model |
| Mutation | `models.delete` | Delete installed model |
| Query | `models.downloadStatus` | Get download progress |
| Mutation | `models.cancelDownload` | Cancel in-progress download |
| Query | `models.registry` | Fetch latest models from GitHub |

---

## Detailed Procedures

### Query: models.list

List all models with optional filtering.

#### Input Schema

```typescript
interface ModelsListInput {
  /**
   * Filter by model type.
   * - "llm": language models
   * - "stt": speech-to-text models
   * - "tts": text-to-speech models
   */
  type?: "llm" | "stt" | "tts";

  /**
   * Filter by download status.
   * - "downloaded": fully installed
   * - "downloading": in progress
   * - "available": not yet downloaded
   */
  status?: "downloaded" | "downloading" | "available";

  /**
   * Search query (fuzzy match on name and description).
   */
  search?: string;
}
```

#### Zod Schema

```typescript
const ModelsListInputSchema = z.object({
  type: z.enum(["llm", "stt", "tts"]).optional(),
  status: z.enum(["downloaded", "downloading", "available"]).optional(),
  search: z.string().optional(),
});
```

#### Output Schema

```typescript
interface ModelsListOutput {
  /**
   * Array of model objects.
   */
  items: Array<Model>;

  /**
   * Total count of matching models.
   */
  count: number;
}

interface Model {
  /**
   * Unique model identifier (e.g., "mistral-7b-instruct").
   */
  id: string;

  /**
   * Human-readable model name.
   */
  name: string;

  /**
   * Model description.
   */
  description: string;

  /**
   * Model type: "llm" | "stt" | "tts".
   */
  type: "llm" | "stt" | "tts";

  /**
   * Model status: "downloaded" | "downloading" | "failed" | "available".
   */
  status: "downloaded" | "downloading" | "failed" | "available";

  /**
   * Hugging Face or Ollama model identifier.
   */
  source: string;

  /**
   * File size in bytes.
   */
  sizeBytes: number;

  /**
   * Available variants (e.g., quantization levels).
   * @example ["Q4_K_M", "Q5_K_M", "f16"]
   */
  variants?: string[];

  /**
   * Currently selected variant (if applicable).
   */
  selectedVariant?: string;

  /**
   * Unix timestamp of when model was added to DB.
   */
  createdAt: number;

  /**
   * Unix timestamp of last update.
   */
  updatedAt: number;

  /**
   * Metadata key-value pairs.
   */
  metadata?: Record<string, string>;
}
```

#### Zod Output Schema

```typescript
const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["llm", "stt", "tts"]),
  status: z.enum(["downloaded", "downloading", "failed", "available"]),
  source: z.string(),
  sizeBytes: z.number(),
  variants: z.array(z.string()).optional(),
  selectedVariant: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z.record(z.string()).optional(),
});

const ModelsListOutputSchema = z.object({
  items: z.array(ModelSchema),
  count: z.number(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/models.list \
  -H "Content-Type: application/json" \
  -d '{
    "type": "llm",
    "status": "downloaded",
    "search": "mistral"
  }'
```

#### Example Response

```json
{
  "items": [
    {
      "id": "mistral-7b-instruct",
      "name": "Mistral 7B Instruct",
      "description": "Mistral 7B optimized for instruction-following tasks.",
      "type": "llm",
      "status": "downloaded",
      "source": "ollama:mistral:7b-instruct-v0.2-q4_K_M",
      "sizeBytes": 4294967296,
      "variants": ["Q4_K_M", "Q5_K_M", "f16"],
      "selectedVariant": "Q4_K_M",
      "createdAt": 1710946800,
      "updatedAt": 1710946800,
      "metadata": {
        "contextLength": "32768",
        "architecture": "transformer"
      }
    }
  ],
  "count": 1
}
```

---

### Query: models.get

Retrieve a single model by ID with full variant information.

#### Input Schema

```typescript
interface ModelsGetInput {
  /**
   * Model ID to retrieve.
   */
  id: string;
}
```

#### Zod Schema

```typescript
const ModelsGetInputSchema = z.object({
  id: z.string().min(1),
});
```

#### Output Schema

Same as `Model` (see `models.list` output).

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/models.get \
  -H "Content-Type: application/json" \
  -d '{"id": "mistral-7b-instruct"}'
```

#### Example Response

```json
{
  "id": "mistral-7b-instruct",
  "name": "Mistral 7B Instruct",
  "description": "Mistral 7B optimized for instruction-following tasks.",
  "type": "llm",
  "status": "downloaded",
  "source": "ollama:mistral:7b-instruct-v0.2-q4_K_M",
  "sizeBytes": 4294967296,
  "variants": ["Q4_K_M", "Q5_K_M", "f16"],
  "selectedVariant": "Q4_K_M",
  "createdAt": 1710946800,
  "updatedAt": 1710946800,
  "metadata": {
    "contextLength": "32768",
    "architecture": "transformer"
  }
}
```

---

### Mutation: models.pull

Start downloading a model from a registry (Ollama, Hugging Face, etc.).

#### Input Schema

```typescript
interface ModelsPullInput {
  /**
   * Model name or registry reference (e.g., "mistral:7b-instruct").
   */
  name: string;

  /**
   * Optional variant/quantization to download (e.g., "Q4_K_M").
   * If omitted, default variant is selected.
   */
  variant?: string;

  /**
   * If true, re-download even if model exists.
   * @default false
   */
  force?: boolean;
}
```

#### Zod Schema

```typescript
const ModelsPullInputSchema = z.object({
  name: z.string().min(1),
  variant: z.string().optional(),
  force: z.boolean().default(false),
});
```

#### Output Schema

```typescript
interface ModelsPullOutput {
  /**
   * Unique download ID for tracking progress.
   */
  downloadId: string;

  /**
   * The model object with status "downloading".
   */
  model: Model;
}
```

#### Zod Output Schema

```typescript
const ModelsPullOutputSchema = z.object({
  downloadId: z.string(),
  model: ModelSchema,
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/models.pull \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mistral:7b-instruct",
    "variant": "Q4_K_M",
    "force": false
  }'
```

#### Example Response

```json
{
  "downloadId": "dl_xyz789_abc123",
  "model": {
    "id": "mistral-7b-instruct",
    "name": "Mistral 7B Instruct",
    "description": "Mistral 7B optimized for instruction-following tasks.",
    "type": "llm",
    "status": "downloading",
    "source": "ollama:mistral:7b-instruct-v0.2-q4_K_M",
    "sizeBytes": 4294967296,
    "variants": ["Q4_K_M", "Q5_K_M", "f16"],
    "selectedVariant": "Q4_K_M",
    "createdAt": 1710946800,
    "updatedAt": 1710946805,
    "metadata": {}
  }
}
```

---

### Mutation: models.delete

Delete an installed model and optionally remove its files from disk.

#### Input Schema

```typescript
interface ModelsDeleteInput {
  /**
   * Model ID to delete.
   */
  id: string;

  /**
   * If true, delete model files from disk.
   * If false, only remove DB entry.
   * @default true
   */
  deleteFiles?: boolean;
}
```

#### Zod Schema

```typescript
const ModelsDeleteInputSchema = z.object({
  id: z.string().min(1),
  deleteFiles: z.boolean().default(true),
});
```

#### Output Schema

```typescript
interface ModelsDeleteOutput {
  /**
   * True if deletion succeeded.
   */
  success: boolean;
}
```

#### Zod Output Schema

```typescript
const ModelsDeleteOutputSchema = z.object({
  success: z.boolean(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/models.delete \
  -H "Content-Type: application/json" \
  -d '{"id": "mistral-7b-instruct", "deleteFiles": true}'
```

#### Example Response

```json
{
  "success": true
}
```

---

### Query: models.downloadStatus

Get progress for one or all in-progress downloads.

#### Input Schema

```typescript
interface ModelsDownloadStatusInput {
  /**
   * Optional download ID. If omitted, returns all active downloads.
   */
  downloadId?: string;
}
```

#### Zod Schema

```typescript
const ModelsDownloadStatusInputSchema = z.object({
  downloadId: z.string().optional(),
});
```

#### Output Schema

```typescript
interface ModelsDownloadStatusOutput {
  /**
   * Array of download status objects.
   */
  downloads: Array<DownloadStatus>;
}

interface DownloadStatus {
  /**
   * Download ID.
   */
  downloadId: string;

  /**
   * Model ID being downloaded.
   */
  modelId: string;

  /**
   * Human-readable model name.
   */
  modelName: string;

  /**
   * Download status: "downloading" | "paused" | "failed" | "completed".
   */
  status: "downloading" | "paused" | "failed" | "completed";

  /**
   * Bytes downloaded so far.
   */
  bytesDownloaded: number;

  /**
   * Total bytes to download.
   */
  bytesTotal: number;

  /**
   * Progress as percentage (0–100).
   */
  progress: number;

  /**
   * Download speed in bytes per second.
   */
  speedBytesPerSecond: number;

  /**
   * Estimated seconds remaining.
   */
  etaSeconds: number;

  /**
   * Error message if status is "failed".
   */
  errorMessage?: string;

  /**
   * Unix timestamp when download started.
   */
  startedAt: number;

  /**
   * Unix timestamp of last update.
   */
  updatedAt: number;
}
```

#### Zod Output Schema

```typescript
const DownloadStatusSchema = z.object({
  downloadId: z.string(),
  modelId: z.string(),
  modelName: z.string(),
  status: z.enum(["downloading", "paused", "failed", "completed"]),
  bytesDownloaded: z.number(),
  bytesTotal: z.number(),
  progress: z.number(),
  speedBytesPerSecond: z.number(),
  etaSeconds: z.number(),
  errorMessage: z.string().optional(),
  startedAt: z.number(),
  updatedAt: z.number(),
});

const ModelsDownloadStatusOutputSchema = z.object({
  downloads: z.array(DownloadStatusSchema),
});
```

#### Example Request (All Downloads)

```bash
curl -X POST http://localhost:8000/rpc/models.downloadStatus \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Example Response

```json
{
  "downloads": [
    {
      "downloadId": "dl_xyz789_abc123",
      "modelId": "mistral-7b-instruct",
      "modelName": "Mistral 7B Instruct",
      "status": "downloading",
      "bytesDownloaded": 2147483648,
      "bytesTotal": 4294967296,
      "progress": 50,
      "speedBytesPerSecond": 10485760,
      "etaSeconds": 204,
      "startedAt": 1710946805,
      "updatedAt": 1710946850
    }
  ]
}
```

---

### Mutation: models.cancelDownload

Cancel an in-progress download.

#### Input Schema

```typescript
interface ModelsCancelDownloadInput {
  /**
   * Download ID to cancel.
   */
  downloadId: string;
}
```

#### Zod Schema

```typescript
const ModelsCancelDownloadInputSchema = z.object({
  downloadId: z.string().min(1),
});
```

#### Output Schema

```typescript
interface ModelsCancelDownloadOutput {
  /**
   * True if cancellation succeeded.
   */
  success: boolean;
}
```

#### Zod Output Schema

```typescript
const ModelsCancelDownloadOutputSchema = z.object({
  success: z.boolean(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/models.cancelDownload \
  -H "Content-Type: application/json" \
  -d '{"downloadId": "dl_xyz789_abc123"}'
```

#### Example Response

```json
{
  "success": true
}
```

---

### Query: models.registry

Fetch the latest models registry from GitHub (or local cache).

#### Input Schema

```typescript
interface ModelsRegistryInput {
  // No input required
}
```

#### Output Schema

```typescript
interface ModelsRegistryOutput {
  /**
   * Array of registry entries.
   */
  models: Array<RegistryEntry>;

  /**
   * Unix timestamp of when registry was last updated.
   */
  updatedAt: number;
}

interface RegistryEntry {
  /**
   * Model ID.
   */
  id: string;

  /**
   * Human-readable name.
   */
  name: string;

  /**
   * Model description.
   */
  description: string;

  /**
   * Model type: "llm" | "stt" | "tts".
   */
  type: "llm" | "stt" | "tts";

  /**
   * Source reference (e.g., "ollama:mistral:7b").
   */
  source: string;

  /**
   * Size in bytes.
   */
  sizeBytes: number;

  /**
   * Available quantization variants.
   */
  variants: string[];

  /**
   * Default recommended variant.
   */
  defaultVariant: string;

  /**
   * Model tags for categorization.
   * @example ["fast", "instruction-following"]
   */
  tags: string[];

  /**
   * Custom metadata.
   */
  metadata?: Record<string, string>;
}
```

#### Zod Output Schema

```typescript
const RegistryEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["llm", "stt", "tts"]),
  source: z.string(),
  sizeBytes: z.number(),
  variants: z.array(z.string()),
  defaultVariant: z.string(),
  tags: z.array(z.string()),
  metadata: z.record(z.string()).optional(),
});

const ModelsRegistryOutputSchema = z.object({
  models: z.array(RegistryEntrySchema),
  updatedAt: z.number(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/models.registry \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Example Response

```json
{
  "models": [
    {
      "id": "mistral-7b-instruct",
      "name": "Mistral 7B Instruct",
      "description": "Mistral 7B optimized for instruction-following.",
      "type": "llm",
      "source": "ollama:mistral:7b-instruct-v0.2",
      "sizeBytes": 4294967296,
      "variants": ["Q4_K_M", "Q5_K_M", "f16"],
      "defaultVariant": "Q4_K_M",
      "tags": ["fast", "instruction-following", "7b"],
      "metadata": {
        "contextLength": "32768",
        "architecture": "transformer"
      }
    }
  ],
  "updatedAt": 1710946800
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
| `MODEL_NOT_FOUND` | 404 | Model with given ID does not exist. |
| `INVALID_INPUT` | 400 | Invalid input parameters. |
| `DOWNLOAD_IN_PROGRESS` | 409 | Another download is in progress for this model. |
| `INSUFFICIENT_SPACE` | 507 | Not enough disk space to download model. |
| `NETWORK_ERROR` | 503 | Network error during download. |
| `SERVER_ERROR` | 500 | Internal server error. |

#### Example Error Response

```json
{
  "error": {
    "message": "Model 'unknown-7b' not found in registry.",
    "code": "MODEL_NOT_FOUND"
  }
}
```

---

## Database Tables

### models

Stores metadata for all known models.

```sql
CREATE TABLE models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'llm', 'stt', 'tts'
  status TEXT NOT NULL, -- 'downloaded', 'downloading', 'failed', 'available'
  source TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  variants TEXT, -- JSON array
  selectedVariant TEXT,
  metadata TEXT, -- JSON object
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### download_queue

Tracks active and completed downloads.

```sql
CREATE TABLE download_queue (
  id TEXT PRIMARY KEY,
  modelId TEXT NOT NULL,
  modelName TEXT NOT NULL,
  status TEXT NOT NULL, -- 'downloading', 'paused', 'failed', 'completed'
  bytesDownloaded INTEGER NOT NULL,
  bytesTotal INTEGER NOT NULL,
  speedBytesPerSecond REAL NOT NULL,
  errorMessage TEXT,
  startedAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (modelId) REFERENCES models(id)
);
```

---

## Related Documentation

- [API: Inference](./api-inference.md)
- [Architecture Overview](../architecture.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-20 | 1.0 | Initial draft. Full model management procedures with Zod schemas. |
