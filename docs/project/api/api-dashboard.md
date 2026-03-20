# API: Dashboard

**Status:** Draft
**Version:** 1.0
**Owner:** Rahul
**Last Updated:** 2026-03-20

## Overview

The Dashboard API provides type-safe procedures for querying real-time server metrics, usage statistics, and hardware utilization via oRPC. All operations are read-only (Query-only) and validated using Zod schemas. Data is sourced from in-memory metrics and the SQLite usage_metrics table.

**Router:** `dashboardRouter`
**Auth:** API key required (localhost exempt)

---

## Procedures Summary

| Type | Procedure | Purpose |
|------|-----------|---------|
| Query | `dashboard.stats` | Current server statistics |
| Query | `dashboard.metrics` | Historical usage metrics with time series |
| Query | `dashboard.hardware` | Real-time hardware utilization |

---

## Detailed Procedures

### Query: dashboard.stats

Get current server statistics (uptime, active model, resource usage, connections).

#### Input Schema

```typescript
interface DashboardStatsInput {
  // No input required
}
```

#### Output Schema

```typescript
interface DashboardStatsOutput {
  /**
   * Currently active/loaded model ID.
   * Null if no model is loaded.
   */
  activeModel: string | null;

  /**
   * Memory usage statistics.
   */
  memoryUsage: {
    /**
     * Resident set size (RSS) in bytes.
     */
    rss: number;

    /**
     * Heap size in bytes.
     */
    heap: number;

    /**
     * GPU memory used in bytes (0 if no GPU).
     */
    gpu: number;
  };

  /**
   * Server uptime in seconds.
   */
  uptime: number;

  /**
   * Total requests processed since startup.
   */
  requestCount: number;

  /**
   * Number of active WebSocket connections.
   */
  activeConnections: number;

  /**
   * Timestamp of this stat snapshot (ISO 8601).
   */
  timestamp: string;
}
```

#### Zod Output Schema

```typescript
const DashboardStatsOutputSchema = z.object({
  activeModel: z.string().nullable(),
  memoryUsage: z.object({
    rss: z.number(),
    heap: z.number(),
    gpu: z.number(),
  }),
  uptime: z.number(),
  requestCount: z.number(),
  activeConnections: z.number(),
  timestamp: z.string(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/dashboard.stats \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Example Response

```json
{
  "activeModel": "mistral-7b-instruct",
  "memoryUsage": {
    "rss": 5368709120,
    "heap": 2147483648,
    "gpu": 4294967296
  },
  "uptime": 3600,
  "requestCount": 1250,
  "activeConnections": 3,
  "timestamp": "2026-03-20T10:30:00Z"
}
```

---

### Query: dashboard.metrics

Get historical usage metrics with optional time series data.

#### Input Schema

```typescript
interface DashboardMetricsInput {
  /**
   * Time period for metrics.
   * - "1h": last 1 hour
   * - "24h": last 24 hours
   * - "7d": last 7 days
   * - "30d": last 30 days
   */
  period: "1h" | "24h" | "7d" | "30d";
}
```

#### Zod Schema

```typescript
const DashboardMetricsInputSchema = z.object({
  period: z.enum(["1h", "24h", "7d", "30d"]),
});
```

#### Output Schema

```typescript
interface DashboardMetricsOutput {
  /**
   * Total tokens processed (input + output).
   */
  tokensIn: number;

  /**
   * Total tokens generated.
   */
  tokensOut: number;

  /**
   * Average latency in milliseconds.
   */
  avgLatencyMs: number;

  /**
   * Total number of requests in the period.
   */
  requestCount: number;

  /**
   * Time series data (aggregated by time bucket).
   */
  timeSeries: Array<{
    /**
     * Timestamp of the bucket (ISO 8601).
     */
    timestamp: string;

    /**
     * Tokens per second during this bucket.
     */
    tokensPerSec: number;

    /**
     * Requests in this bucket.
     */
    requests: number;

    /**
     * Average latency in this bucket (ms).
     */
    avgLatencyMs: number;
  }>;

  /**
   * Period analyzed.
   */
  period: string;

  /**
   * Period start timestamp (ISO 8601).
   */
  startedAt: string;

  /**
   * Period end timestamp (ISO 8601).
   */
  endedAt: string;
}
```

#### Zod Output Schema

```typescript
const TimeSeriesBucketSchema = z.object({
  timestamp: z.string(),
  tokensPerSec: z.number(),
  requests: z.number(),
  avgLatencyMs: z.number(),
});

const DashboardMetricsOutputSchema = z.object({
  tokensIn: z.number(),
  tokensOut: z.number(),
  avgLatencyMs: z.number(),
  requestCount: z.number(),
  timeSeries: z.array(TimeSeriesBucketSchema),
  period: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
});
```

#### Example Request (1-Hour Period)

```bash
curl -X POST http://localhost:8000/rpc/dashboard.metrics \
  -H "Content-Type: application/json" \
  -d '{"period": "1h"}'
```

#### Example Response

```json
{
  "tokensIn": 45230,
  "tokensOut": 23450,
  "avgLatencyMs": 850,
  "requestCount": 342,
  "timeSeries": [
    {
      "timestamp": "2026-03-20T09:00:00Z",
      "tokensPerSec": 12.5,
      "requests": 45,
      "avgLatencyMs": 920
    },
    {
      "timestamp": "2026-03-20T09:10:00Z",
      "tokensPerSec": 15.2,
      "requests": 58,
      "avgLatencyMs": 850
    },
    {
      "timestamp": "2026-03-20T09:20:00Z",
      "tokensPerSec": 18.7,
      "requests": 72,
      "avgLatencyMs": 780
    },
    {
      "timestamp": "2026-03-20T09:30:00Z",
      "tokensPerSec": 14.3,
      "requests": 62,
      "avgLatencyMs": 910
    },
    {
      "timestamp": "2026-03-20T09:40:00Z",
      "tokensPerSec": 16.8,
      "requests": 68,
      "avgLatencyMs": 820
    },
    {
      "timestamp": "2026-03-20T09:50:00Z",
      "tokensPerSec": 13.5,
      "requests": 37,
      "avgLatencyMs": 880
    }
  ],
  "period": "1h",
  "startedAt": "2026-03-20T09:00:00Z",
  "endedAt": "2026-03-20T10:00:00Z"
}
```

#### Example Request (7-Day Period)

```bash
curl -X POST http://localhost:8000/rpc/dashboard.metrics \
  -H "Content-Type: application/json" \
  -d '{"period": "7d"}'
```

#### Example Response (Abbreviated)

```json
{
  "tokensIn": 2150000,
  "tokensOut": 1200000,
  "avgLatencyMs": 920,
  "requestCount": 15000,
  "timeSeries": [
    {
      "timestamp": "2026-03-13T00:00:00Z",
      "tokensPerSec": 22.5,
      "requests": 2100,
      "avgLatencyMs": 950
    },
    {
      "timestamp": "2026-03-14T00:00:00Z",
      "tokensPerSec": 25.8,
      "requests": 2250,
      "avgLatencyMs": 920
    },
    {
      "timestamp": "2026-03-15T00:00:00Z",
      "tokensPerSec": 28.3,
      "requests": 2400,
      "avgLatencyMs": 880
    },
    {
      "timestamp": "2026-03-16T00:00:00Z",
      "tokensPerSec": 30.1,
      "requests": 2650,
      "avgLatencyMs": 850
    },
    {
      "timestamp": "2026-03-17T00:00:00Z",
      "tokensPerSec": 26.7,
      "requests": 2300,
      "avgLatencyMs": 910
    },
    {
      "timestamp": "2026-03-18T00:00:00Z",
      "tokensPerSec": 24.5,
      "requests": 2100,
      "avgLatencyMs": 960
    },
    {
      "timestamp": "2026-03-19T00:00:00Z",
      "tokensPerSec": 29.2,
      "requests": 2200,
      "avgLatencyMs": 890
    }
  ],
  "period": "7d",
  "startedAt": "2026-03-13T00:00:00Z",
  "endedAt": "2026-03-20T00:00:00Z"
}
```

---

### Query: dashboard.hardware

Get real-time hardware utilization (CPU, RAM, GPU).

#### Input Schema

```typescript
interface DashboardHardwareInput {
  // No input required
}
```

#### Output Schema

```typescript
interface DashboardHardwareOutput {
  /**
   * CPU utilization statistics.
   */
  cpu: {
    /**
     * CPU usage percentage (0–100).
     */
    usage: number;

    /**
     * Number of CPU cores.
     */
    cores: number;
  };

  /**
   * RAM utilization statistics.
   */
  ram: {
    /**
     * Total RAM in bytes.
     */
    total: number;

    /**
     * Used RAM in bytes.
     */
    used: number;

    /**
     * Available RAM in bytes.
     */
    available: number;
  };

  /**
   * GPU utilization (if available).
   */
  gpu?: {
    /**
     * GPU device name.
     */
    name: string;

    /**
     * VRAM statistics.
     */
    vram: {
      /**
       * Total VRAM in bytes.
       */
      total: number;

      /**
       * Used VRAM in bytes.
       */
      used: number;
    };

    /**
     * GPU utilization percentage (0–100).
     */
    usage?: number;
  };

  /**
   * Timestamp of this measurement (ISO 8601).
   */
  timestamp: string;
}
```

#### Zod Output Schema

```typescript
const DashboardHardwareOutputSchema = z.object({
  cpu: z.object({
    usage: z.number().min(0).max(100),
    cores: z.number(),
  }),
  ram: z.object({
    total: z.number(),
    used: z.number(),
    available: z.number(),
  }),
  gpu: z.object({
    name: z.string(),
    vram: z.object({
      total: z.number(),
      used: z.number(),
    }),
    usage: z.number().min(0).max(100).optional(),
  }).optional(),
  timestamp: z.string(),
});
```

#### Example Request

```bash
curl -X POST http://localhost:8000/rpc/dashboard.hardware \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Example Response (With GPU)

```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8
  },
  "ram": {
    "total": 34359738368,
    "used": 17179869184,
    "available": 17179869184
  },
  "gpu": {
    "name": "NVIDIA GeForce RTX 4090",
    "vram": {
      "total": 24696061952,
      "used": 12348030976
    },
    "usage": 52.8
  },
  "timestamp": "2026-03-20T10:30:00Z"
}
```

#### Example Response (CPU-Only)

```json
{
  "cpu": {
    "usage": 62.5,
    "cores": 4
  },
  "ram": {
    "total": 8589934592,
    "used": 6442450944,
    "available": 2147483648
  },
  "timestamp": "2026-03-20T10:30:00Z"
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
| `INVALID_PERIOD` | 400 | Invalid period. Valid values: "1h", "24h", "7d", "30d". |
| `SERVER_ERROR` | 500 | Internal server error. |

#### Example Error Response

```json
{
  "error": {
    "message": "Invalid period. Valid values: 1h, 24h, 7d, 30d.",
    "code": "INVALID_PERIOD"
  }
}
```

---

## Database Tables

### usage_metrics

Stores historical request and token metrics for analytics.

```sql
CREATE TABLE usage_metrics (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  tokensIn INTEGER NOT NULL,
  tokensOut INTEGER NOT NULL,
  latencyMs INTEGER NOT NULL,
  model TEXT,
  userId TEXT,
  UNIQUE(timestamp, model)
);

CREATE INDEX idx_usage_metrics_timestamp ON usage_metrics(timestamp DESC);
CREATE INDEX idx_usage_metrics_model ON usage_metrics(model, timestamp DESC);
```

---

## Metrics Collection

Metrics are collected and aggregated automatically:

- **Real-time metrics** are stored in memory and updated per request
- **Historical metrics** are persisted to `usage_metrics` table every 10 minutes
- **Time series bucketing**:
  - 1h period: 10-minute buckets
  - 24h period: 1-hour buckets
  - 7d period: 6-hour buckets (daily aggregates shown in response)
  - 30d period: 1-day buckets

---

## Related Documentation

- [API: Chat](./api-chat.md)
- [API: Inference](./api-inference.md)
- [API: Settings](./api-settings.md)
- [Architecture Overview](../architecture.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-20 | 1.0 | Initial draft. Full dashboard metrics with time series and hardware monitoring. |
