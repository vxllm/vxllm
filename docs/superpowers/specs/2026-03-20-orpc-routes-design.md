# Sub-project #5: oRPC App Route Implementations — Design Spec

> **Project:** VxLLM
> **Sub-project:** 5 of 14 — oRPC App Route Implementations
> **Date:** 2026-03-20
> **Status:** Approved
> **Approach:** Direct implementation (fill in 23 procedure stubs)

---

## Context

The foundation created 24 oRPC procedure stubs (1 healthCheck implemented, 23 throwing "Not implemented"). The inference engine added ModelManager, DownloadManager, Registry, and OpenAI-compatible routes. This sub-project implements all 23 remaining oRPC procedures — these are the typed RPC endpoints consumed by the React web app via TanStack Query.

### Dependencies

- Sub-project #1 (Foundation): DB schemas, oRPC stubs, Zod schemas
- Sub-project #2 (Inference Engine): ModelManager, DownloadManager, Registry, OpenAI routes with chat persistence

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| All 23 oRPC procedure implementations | Chat UI (Sub-project #6) |
| Expand oRPC context with inference services | Voice endpoints |
| Extract shared ChatService from OpenAI route | Auth middleware |
| Dashboard metrics aggregation queries | New Zod schemas |
| Settings CRUD + API key management | New DB tables |
| CPU usage via os.loadavg() | WebSocket endpoints |

---

## Design

### 1. Expand oRPC Context

Add `modelManager`, `downloadManager`, `registry` to the oRPC context so all procedures can access inference services without importing globals.

**`packages/api/src/context.ts`** — Update `createContext` to accept and pass through inference service instances. The server's `index.ts` passes them when creating context.

### 2. Extract Shared ChatService

Pull the "run inference + persist to DB" logic from `apps/server/src/routes/v1/chat.ts` into a shared service:

**`packages/api/src/services/chat.service.ts`:**
- `persistChat({ db, conversationId, modelName, userMessage, assistantMessage, usage, latencyMs })` — Creates/updates conversation, inserts user + assistant messages, writes usage_metrics
- `runInference({ modelManager, conversationId, messages, options })` — Calls AI SDK generateText/streamText with the active model, returns result

Both the OpenAI `/v1/chat/completions` route and `chat.regenerateLastMessage` oRPC procedure call these shared functions.

### 3. Router Implementations

#### Chat Router (7 procedures)
| Procedure | Type | Logic |
|-----------|------|-------|
| `createConversation` | mutation | INSERT into conversations |
| `getConversation` | query | SELECT by ID, 404 if not found |
| `listConversations` | query | SELECT with offset pagination + optional title LIKE search |
| `deleteConversation` | mutation | DELETE by ID (cascade to messages) |
| `addMessage` | mutation | INSERT into messages, update conversation updatedAt |
| `getMessages` | query | SELECT by conversationId with cursor pagination (cursor = createdAt) |
| `regenerateLastMessage` | mutation | Delete last assistant message, fetch conversation messages, call `runInference()`, persist via `persistChat()` |

#### Model Router (7 procedures)
| Procedure | Type | Logic |
|-----------|------|-------|
| `list` | query | SELECT from models with type/status/format/search filters |
| `getById` | query | SELECT by ID, 404 if not found |
| `download` | mutation | Delegate to `DownloadManager.pull()` |
| `cancelDownload` | mutation | Delegate to `DownloadManager.cancel()` |
| `delete` | mutation | DELETE from models + optionally `fs.unlinkSync(localPath)` |
| `getDownloadStatus` | query | `DownloadManager.getProgress(id)` or `getActive()` |
| `search` | query | `Registry.search(query)` merged with DB status |

#### Settings Router (7 procedures)
| Procedure | Type | Logic |
|-----------|------|-------|
| `get` | query | SELECT from settings WHERE key |
| `set` | mutation | INSERT OR UPDATE (upsert) into settings |
| `getAll` | query | SELECT * from settings |
| `createApiKey` | mutation | Generate `vx_sk_<random>`, SHA-256 hash, INSERT into apiKeys, return full key ONCE |
| `listApiKeys` | query | SELECT from apiKeys (exclude keyHash column) |
| `deleteApiKey` | mutation | DELETE from apiKeys by ID |
| `getHardwareInfo` | query | Call `detectHardware()`, return formatted profile |

#### Dashboard Router (3 procedures)
| Procedure | Type | Logic |
|-----------|------|-------|
| `getMetricsSummary` | query | Aggregate usageMetrics within period: COUNT, AVG latency, SUM tokens, GROUP BY type |
| `getUsageBreakdown` | query | GROUP BY type within period: count, avg latency, total tokens per type |
| `getHardwareStatus` | query | `os.loadavg()[0]` / cores for CPU%, `os.freemem()/os.totalmem()` for RAM%, active model from ModelManager |

### 4. File Impact

| Area | Files Created | Files Modified |
|------|--------------|----------------|
| `packages/api/src/services/` | 1 (chat.service.ts) | 0 |
| `packages/api/src/routers/` | 0 | 4 (all router files) |
| `packages/api/src/` | 0 | 1 (context.ts) |
| `apps/server/src/` | 0 | 1 (index.ts — pass services to context) |
| `apps/server/src/routes/v1/` | 0 | 1 (chat.ts — extract shared logic) |
| **Total** | **1** | **7** |

### 5. Success Criteria

- [ ] All 23 procedures return real data (no "Not implemented" errors)
- [ ] `POST /rpc/chat.createConversation` creates and returns a conversation
- [ ] `POST /rpc/chat.listConversations` returns paginated results
- [ ] `POST /rpc/chat.getMessages` returns cursor-paginated messages
- [ ] `POST /rpc/chat.regenerateLastMessage` re-runs inference and persists
- [ ] `POST /rpc/models.list` returns filtered models from DB
- [ ] `POST /rpc/models.download` starts a download via DownloadManager
- [ ] `POST /rpc/settings.createApiKey` returns a key (shown once) and persists hash
- [ ] `POST /rpc/settings.getAll` returns all settings
- [ ] `POST /rpc/dashboard.getMetricsSummary` returns aggregated metrics
- [ ] `POST /rpc/dashboard.getHardwareStatus` returns CPU/RAM/GPU usage
- [ ] `bun run check-types` passes
- [ ] OpenAI routes still work unchanged

---

*Spec version: 1.0 | Approved: 2026-03-20*
