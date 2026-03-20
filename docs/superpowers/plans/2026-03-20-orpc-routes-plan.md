# oRPC App Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 23 oRPC procedure stubs with real business logic — DB CRUD, inference delegation, metrics aggregation, and API key management.

**Architecture:** Expand oRPC context with inference services, extract shared ChatService, then implement each router. Mostly Drizzle queries + inference layer delegation.

**Tech Stack:** oRPC + Zod, Drizzle ORM + SQLite, node-llama-cpp (via ModelManager), AI SDK (for regenerate)

**Spec:** `docs/superpowers/specs/2026-03-20-orpc-routes-design.md`

---

## Task 1: Expand oRPC context + extract ChatService

**Files:**
- Modify: `packages/api/src/context.ts`
- Create: `packages/api/src/services/chat.service.ts`
- Modify: `apps/server/src/index.ts` (pass services to context)
- Modify: `apps/server/src/routes/v1/chat.ts` (extract persistence logic)

- [ ] **Step 1: Read existing files**

Read `packages/api/src/context.ts`, `apps/server/src/index.ts` (how context is created), and `apps/server/src/routes/v1/chat.ts` (the `persistChatToDb` function or equivalent).

- [ ] **Step 2: Update context.ts**

Add ModelManager, DownloadManager, Registry, and detectHardware to the context type:

```typescript
import type { ModelManager, DownloadManager, Registry } from "@vxllm/inference";

export type CreateContextOptions = {
  context: HonoContext;
  modelManager: ModelManager;
  downloadManager: DownloadManager;
  registry: Registry;
};

export async function createContext(opts: CreateContextOptions) {
  return {
    db,
    modelManager: opts.modelManager,
    downloadManager: opts.downloadManager,
    registry: opts.registry,
    auth: null,
    session: null,
  };
}
```

- [ ] **Step 3: Update apps/server/src/index.ts**

Pass the global instances when creating context:

```typescript
const context = await createContext({
  context: c,
  modelManager,
  downloadManager,
  registry,
});
```

- [ ] **Step 4: Extract ChatService**

Create `packages/api/src/services/chat.service.ts` with shared persistence logic extracted from the OpenAI chat route. Key functions:

- `persistChat(db, { conversationId, modelName, userContent, assistantContent, tokensIn, tokensOut, latencyMs })` — Upserts conversation, inserts user + assistant messages, writes usage_metrics
- `runInference(modelManager, { messages, maxTokens, temperature, topP })` — Calls AI SDK generateText with the active model provider

Then update `apps/server/src/routes/v1/chat.ts` to call these shared functions instead of inline logic.

- [ ] **Step 5: Verify OpenAI routes still work**

```bash
bun run dev:server
curl http://localhost:11500/health
```

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(api): expand oRPC context with inference services and extract ChatService"
```

---

## Task 2: Implement chat router (7 procedures)

**Files:**
- Modify: `packages/api/src/routers/chat.router.ts`

- [ ] **Step 1: Read the current stub and schemas**

Read `packages/api/src/routers/chat.router.ts` and `packages/api/src/schemas/chat.ts` to understand exact input/output types.

- [ ] **Step 2: Implement all 7 procedures**

Replace every `throw new Error("Not implemented")` with real logic:

1. **createConversation** — `db.insert(conversations).values({ id: crypto.randomUUID(), title, modelId, systemPrompt, createdAt: Date.now(), updatedAt: Date.now() })`

2. **getConversation** — `db.select().from(conversations).where(eq(conversations.id, input.id))`, throw 404 if not found

3. **listConversations** — `db.select().from(conversations).orderBy(desc(conversations.updatedAt)).limit(input.limit).offset((input.page - 1) * input.limit)`. Add `.where(like(conversations.title, `%${input.search}%`))` if search provided.

4. **deleteConversation** — `db.delete(conversations).where(eq(conversations.id, input.id))` (cascade deletes messages)

5. **addMessage** — `db.insert(messages).values({ ... })` + update conversation `updatedAt`

6. **getMessages** — Cursor pagination: `db.select().from(messages).where(and(eq(messages.conversationId, input.conversationId), input.cursor ? lt(messages.createdAt, Number(input.cursor)) : undefined)).orderBy(desc(messages.createdAt)).limit(input.limit + 1)`. Return `nextCursor` from the extra row.

7. **regenerateLastMessage** —
   a. Find last assistant message for the conversation
   b. Delete it
   c. Fetch remaining messages
   d. Call `runInference()` from ChatService
   e. Persist new assistant response via `persistChat()`
   f. Return the new message

- [ ] **Step 3: Verify types compile**

```bash
bun run check-types
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(api): implement chat router (7 procedures)"
```

---

## Task 3: Implement model router (7 procedures)

**Files:**
- Modify: `packages/api/src/routers/model.router.ts`

- [ ] **Step 1: Read stub and schemas**

- [ ] **Step 2: Implement all 7 procedures**

1. **list** — `db.select().from(models)` with conditional `.where()` for type, status, format, search filters. Use `and()` to combine.

2. **getById** — `db.select().from(models).where(eq(models.id, input.id))`, 404 if not found

3. **download** — `context.downloadManager.pull(input.name, { variant: input.format, priority: input.priority })`. Return the download progress.

4. **cancelDownload** — `context.downloadManager.cancel(input.downloadId)`

5. **delete** — Delete from DB + optionally delete file from disk:
   ```typescript
   const model = await db.select()...;
   if (input.deleteFiles && model.localPath) fs.unlinkSync(model.localPath);
   await db.delete(models).where(eq(models.id, input.id));
   ```

6. **getDownloadStatus** — If `downloadId` provided, `context.downloadManager.getProgress(input.downloadId)`. Otherwise `context.downloadManager.getActive()`.

7. **search** — Use `context.registry.search(input.query)` for registry models, then enrich with DB status by joining against the models table.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(api): implement model router (7 procedures)"
```

---

## Task 4: Implement settings router (7 procedures)

**Files:**
- Modify: `packages/api/src/routers/settings.router.ts`

- [ ] **Step 1: Read stub and schemas**

- [ ] **Step 2: Implement all 7 procedures**

1. **get** — `db.select().from(settings).where(eq(settings.key, input.key))`, 404 if not found

2. **set** — Upsert pattern:
   ```typescript
   await db.insert(settings).values({ key: input.key, value: input.value, updatedAt: Date.now() })
     .onConflictDoUpdate({ target: settings.key, set: { value: input.value, updatedAt: Date.now() } });
   ```

3. **getAll** — `db.select().from(settings)`

4. **createApiKey** — Generate key, hash, persist:
   ```typescript
   const raw = crypto.randomUUID().replace(/-/g, "");
   const fullKey = `vx_sk_${raw}`;
   const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
   const keyPrefix = fullKey.slice(0, 10);
   await db.insert(apiKeys).values({
     id: crypto.randomUUID(), keyHash, keyPrefix,
     label: input.label, permissions: input.permissions ?? "*",
     rateLimit: input.rateLimit, expiresAt: input.expiresAt,
     createdAt: Date.now(),
   });
   return { id, keyPrefix, label, fullKey }; // fullKey shown ONCE
   ```

5. **listApiKeys** — `db.select({ id, keyPrefix, label, permissions, rateLimit, lastUsedAt, expiresAt, createdAt }).from(apiKeys)` — explicitly exclude keyHash

6. **deleteApiKey** — `db.delete(apiKeys).where(eq(apiKeys.id, input.id))`

7. **getHardwareInfo** — `detectHardware()` from inference package, format and return

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(api): implement settings router (7 procedures)"
```

---

## Task 5: Implement dashboard router (3 procedures)

**Files:**
- Modify: `packages/api/src/routers/dashboard.router.ts`

- [ ] **Step 1: Read stub and schemas**

- [ ] **Step 2: Implement all 3 procedures**

1. **getMetricsSummary** — Time-windowed aggregation:
   ```typescript
   const periodMs = { "1h": 3600000, "6h": 21600000, "24h": 86400000 }[input.period];
   const since = Date.now() - periodMs;

   const result = await db.select({
     totalRequests: sql<number>`COUNT(*)`,
     avgLatency: sql<number>`AVG(${usageMetrics.latencyMs})`,
     totalTokensIn: sql<number>`COALESCE(SUM(${usageMetrics.tokensIn}), 0)`,
     totalTokensOut: sql<number>`COALESCE(SUM(${usageMetrics.tokensOut}), 0)`,
   }).from(usageMetrics).where(gte(usageMetrics.createdAt, since));

   // requestsByType: GROUP BY type
   const byType = await db.select({
     type: usageMetrics.type,
     count: sql<number>`COUNT(*)`,
   }).from(usageMetrics).where(gte(usageMetrics.createdAt, since)).groupBy(usageMetrics.type);
   ```

2. **getUsageBreakdown** — Similar GROUP BY type but with avg latency and total tokens per type.

3. **getHardwareStatus** —
   ```typescript
   const cpus = os.cpus();
   const loadAvg = os.loadavg()[0]; // 1-minute average
   const cpuPercent = Math.min(100, (loadAvg / cpus.length) * 100);
   const ramPercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
   const active = context.modelManager.getActive();

   return {
     cpuPercent: Math.round(cpuPercent * 10) / 10,
     ramPercent: Math.round(ramPercent * 10) / 10,
     gpuPercent: undefined, // TODO: GPU utilization from node-llama-cpp
     activeModel: active?.modelInfo.name ?? undefined,
     memoryUsage: {
       usedMb: Math.round((os.totalmem() - os.freemem()) / 1048576),
       totalMb: Math.round(os.totalmem() / 1048576),
     },
   };
   ```

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(api): implement dashboard router (3 procedures)"
```

---

## Task 6: Final verification

- [ ] **Step 1: Type check**

```bash
bun run check-types
```

- [ ] **Step 2: Start server and test key procedures**

```bash
bun run dev:server

# Test chat
curl -X POST http://localhost:11500/rpc/chat.createConversation -H "Content-Type: application/json" -d '{"json":{"title":"Test"}}'
curl -X POST http://localhost:11500/rpc/chat.listConversations -H "Content-Type: application/json" -d '{"json":{"page":1,"limit":10}}'

# Test settings
curl -X POST http://localhost:11500/rpc/settings.set -H "Content-Type: application/json" -d '{"json":{"key":"test.setting","value":"hello"}}'
curl -X POST http://localhost:11500/rpc/settings.getAll -H "Content-Type: application/json" -d '{"json":{}}'

# Test dashboard
curl -X POST http://localhost:11500/rpc/dashboard.getHardwareStatus -H "Content-Type: application/json" -d '{"json":{}}'
curl -X POST http://localhost:11500/rpc/dashboard.getMetricsSummary -H "Content-Type: application/json" -d '{"json":{"period":"24h"}}'

# Test models
curl -X POST http://localhost:11500/rpc/models.list -H "Content-Type: application/json" -d '{"json":{}}'

# Verify OpenAI routes still work
curl http://localhost:11500/health
curl http://localhost:11500/v1/models
```

- [ ] **Step 3: Fix any issues and commit**

```bash
git add . && git commit -m "fix: resolve verification issues in oRPC routes"
```

---

## Summary

| Task | Description | Procedures |
|------|-------------|------------|
| 1 | Expand context + extract ChatService | 0 (infrastructure) |
| 2 | Chat router | 7 |
| 3 | Model router | 7 |
| 4 | Settings router | 7 |
| 5 | Dashboard router | 3 |
| 6 | Verification | — |
| **Total** | **6 tasks** | **24 procedures** |
