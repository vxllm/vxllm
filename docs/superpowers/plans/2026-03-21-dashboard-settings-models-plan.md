# Dashboard + Settings + Model Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three new pages — Dashboard (hardware gauges, metrics charts), Model Library (browse, download, manage), and Settings (server config, API keys, hardware info) — with app-level icon rail navigation.

**Architecture:** Three route pages consuming existing oRPC endpoints. Dashboard polls hardware status every 3s. Model Library polls download progress every 2s. Settings uses form → oRPC mutations. Icon rail nav added to root layout.

**Tech Stack:** React 19, TanStack Router, oRPC + TanStack Query, shadcn/ui (chart/recharts, card, progress, tabs, table, dialog, badge), lucide-react icons

**Spec:** `docs/superpowers/specs/2026-03-21-dashboard-settings-models-design.md`

---

## Task 1: App-level icon rail navigation

**Files:**
- Create: `apps/app/src/components/app-nav.tsx`
- Modify: `apps/app/src/routes/__root.tsx`
- Modify: `apps/app/src/routes/chat/route.tsx`

- [ ] **Step 1: Read current root and chat layout**

Read `__root.tsx` and `chat/route.tsx` to understand the current structure.

- [ ] **Step 2: Create `app-nav.tsx`**

Icon rail (~48px wide) with 4 navigation items:
- `MessageSquare` → `/chat`
- `BarChart3` → `/dashboard`
- `Box` → `/models`
- `Settings` → `/settings`

Use `Link` from TanStack Router. Highlight active route. Dark background, vertical stack. Tooltip on each icon. Place VxLLM logo/icon at top.

- [ ] **Step 3: Update root layout**

Add the icon rail to the left of all pages. The root layout becomes:
```
<div className="flex h-screen">
  <AppNav />
  <div className="flex-1">
    <Outlet />
  </div>
</div>
```

Remove any other layout wrappers that conflict.

- [ ] **Step 4: Adjust chat layout**

The chat layout (`chat/route.tsx`) currently takes full height. With the icon rail, it sits inside the root's flex-1 area. Verify the resizable panels still work correctly.

- [ ] **Step 5: Verify and commit**

```bash
bun run check-types && bun run dev:app
```

Navigate between `/chat`, `/dashboard`, `/models`, `/settings` — icon rail should be visible and active state should highlight.

```bash
git add . && git commit -m "feat(app): add app-level icon rail navigation"
```

---

## Task 2: Dashboard page

**Files:**
- Create: `apps/app/src/routes/dashboard/index.tsx`
- Create: `apps/app/src/components/dashboard/hardware-gauges.tsx`
- Create: `apps/app/src/components/dashboard/active-model-card.tsx`
- Create: `apps/app/src/components/dashboard/metrics-summary.tsx`
- Create: `apps/app/src/components/dashboard/usage-chart.tsx`
- Create: `apps/app/src/components/dashboard/api-url-card.tsx`

- [ ] **Step 1: Read oRPC dashboard procedures**

Read `packages/api/src/routers/dashboard.router.ts` to understand the exact return shapes of `getMetricsSummary`, `getUsageBreakdown`, `getHardwareStatus`.

Also read `packages/ui/src/components/chart.tsx` to understand the recharts wrapper.

- [ ] **Step 2: Create hardware-gauges.tsx**

3 cards in a row (grid-cols-3). Each card:
- Title (CPU/RAM/GPU)
- Circular progress (use shadcn `Progress` component or a custom radial gauge)
- Percentage text
- Subtitle (e.g., "8.2 / 16.0 GB" for RAM)

Query: `orpc.dashboard.getHardwareStatus.useQuery({}, { refetchInterval: 3000 })`

Use the oRPC query pattern from the chat sidebar as reference.

- [ ] **Step 3: Create active-model-card.tsx**

Card showing loaded model info from `getHardwareStatus.activeModel`. Empty state with "No model loaded" + Link to `/models`.

- [ ] **Step 4: Create metrics-summary.tsx**

4 stat cards: Total Requests, Avg Latency, Tokens In, Tokens Out.

shadcn `ToggleGroup` for period selection (1h/6h/24h). Local state for period, passed to query.

Query: `orpc.dashboard.getMetricsSummary.useQuery({ input: { period } })`

- [ ] **Step 5: Create usage-chart.tsx**

Recharts AreaChart via shadcn `chart` component. Show request count by type.

Query: `orpc.dashboard.getUsageBreakdown.useQuery({ input: { period } })`

If the data shape doesn't directly map to recharts, transform it in the component.

- [ ] **Step 6: Create api-url-card.tsx**

Simple card with `http://localhost:11500/v1` text, copy button, sonner toast.

- [ ] **Step 7: Create dashboard route**

`apps/app/src/routes/dashboard/index.tsx` — stacks all 5 sections vertically with spacing:

```tsx
export const Route = createFileRoute("/dashboard/")({ component: DashboardPage });

function DashboardPage() {
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <HardwareGauges />
      <ActiveModelCard />
      <MetricsSummary />
      <UsageChart />
      <ApiUrlCard />
    </div>
  );
}
```

- [ ] **Step 8: Verify and commit**

```bash
bun run check-types && bun run dev:app
```

Navigate to `/dashboard` — should show gauges, metrics, and chart (empty data is fine).

```bash
git add . && git commit -m "feat(app): implement dashboard page with hardware gauges and metrics"
```

---

## Task 3: Model Library page

**Files:**
- Create: `apps/app/src/routes/models/index.tsx`
- Create: `apps/app/src/components/models/model-card.tsx`
- Create: `apps/app/src/components/models/downloaded-model-row.tsx`
- Create: `apps/app/src/components/models/download-progress.tsx`

- [ ] **Step 1: Read oRPC model procedures**

Read `packages/api/src/routers/model.router.ts` to understand: `list`, `search`, `download`, `delete`, `getDownloadStatus` return shapes.

Also read `packages/inference/src/registry.ts` — the Registry `search()` method signature.

- [ ] **Step 2: Create model-card.tsx**

Card for a registry model:
- Name (bold) + type badge (LLM/STT/TTS/Embedding)
- Description text
- Size + minRamGb text
- "Download" button → calls `orpc.models.download.useMutation()`
- Disabled if already downloading or downloaded

- [ ] **Step 3: Create downloaded-model-row.tsx**

Row/card for a downloaded model:
- Name + variant badge + format badge
- Size on disk (formatted: GB/MB)
- Local path (truncated)
- "Delete" button → AlertDialog → `orpc.models.delete.useMutation()`

- [ ] **Step 4: Create download-progress.tsx**

Progress card for active downloads:
- Model name
- shadcn `Progress` bar
- Speed (MB/s), ETA, progress %
- Cancel button

Polled via `orpc.models.getDownloadStatus.useQuery({}, { refetchInterval: 2000 })`

- [ ] **Step 5: Create models route**

`apps/app/src/routes/models/index.tsx`:

```tsx
function ModelsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 300);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Model Library</h1>
        <div className="flex gap-2">
          <Input placeholder="Search models..." value={search} onChange={...} />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="llm">LLM</SelectItem>
              <SelectItem value="stt">STT</SelectItem>
              <SelectItem value="tts">TTS</SelectItem>
              <SelectItem value="embedding">Embedding</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Downloads */}
      <DownloadProgress />

      {/* Downloaded Models */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Downloaded</h2>
        {/* Grid of downloaded-model-row */}
      </section>

      {/* Registry Browser */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Available Models</h2>
        {/* Grid of model-card from registry search */}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Verify and commit**

```bash
git add . && git commit -m "feat(app): implement model library page with registry browser and downloads"
```

---

## Task 4: Settings page

**Files:**
- Create: `apps/app/src/routes/settings/index.tsx`
- Create: `apps/app/src/components/settings/server-config-form.tsx`
- Create: `apps/app/src/components/settings/api-keys-table.tsx`
- Create: `apps/app/src/components/settings/create-api-key-dialog.tsx`
- Create: `apps/app/src/components/settings/hardware-info.tsx`

- [ ] **Step 1: Read oRPC settings procedures**

Read `packages/api/src/routers/settings.router.ts`: `get`, `set`, `getAll`, `createApiKey`, `listApiKeys`, `deleteApiKey`, `getHardwareInfo`.

- [ ] **Step 2: Create server-config-form.tsx**

Form with inputs for server settings. On mount, load values via `orpc.settings.getAll`. On save, iterate changed fields and call `orpc.settings.set` for each.

Fields: Port, Host, CORS Origins, Default Model (select), Max Context Size (slider + number), GPU Layers Override (optional number).

- [ ] **Step 3: Create api-keys-table.tsx**

Table of API keys from `orpc.settings.listApiKeys`. Columns: Prefix, Label, Permissions, Rate Limit, Last Used, Created, Actions (delete).

Delete button → AlertDialog → `orpc.settings.deleteApiKey`.

- [ ] **Step 4: Create create-api-key-dialog.tsx**

Dialog with form: Label (required), Permissions (select/input, default "*"), Rate Limit (optional number).

On create → `orpc.settings.createApiKey.useMutation()` → Response includes `fullKey`.

Show the full key in a prominent box with copy button and warning: "This key will only be shown once."

- [ ] **Step 5: Create hardware-info.tsx**

Read-only display from `orpc.settings.getHardwareInfo`. Grid of info rows:
- Platform: darwin / linux / win32
- Architecture: arm64 / x64
- GPU: vendor, name, VRAM (formatted)
- CPU: model, cores
- RAM: total (formatted)

- [ ] **Step 6: Create settings route**

`apps/app/src/routes/settings/index.tsx` with shadcn `Tabs`:

```tsx
function SettingsPage() {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Tabs defaultValue="server">
        <TabsList>
          <TabsTrigger value="server">Server Config</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
        </TabsList>
        <TabsContent value="server"><ServerConfigForm /></TabsContent>
        <TabsContent value="api-keys">
          <div className="space-y-4">
            <CreateApiKeyDialog />
            <ApiKeysTable />
          </div>
        </TabsContent>
        <TabsContent value="hardware"><HardwareInfo /></TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 7: Verify and commit**

```bash
git add . && git commit -m "feat(app): implement settings page with server config, API keys, and hardware info"
```

---

## Task 5: Final verification

- [ ] **Step 1: Type check**
```bash
bun run check-types
```

- [ ] **Step 2: Visual check**
```bash
bun run dev:app
```

Verify:
1. Icon rail shows on all pages
2. `/dashboard` — gauges render, metrics cards show, chart renders
3. `/models` — registry models show, download button works, downloaded section shows
4. `/settings` — server config form loads, API key create/list/delete works, hardware tab shows
5. Navigation between all pages works
6. Chat UI still works at `/chat`

- [ ] **Step 3: Commit fixes**
```bash
git add . && git commit -m "fix: resolve dashboard/settings/models verification issues"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | App-level icon rail navigation | app-nav.tsx, __root.tsx |
| 2 | Dashboard page (gauges, metrics, chart, API URL) | 6 files |
| 3 | Model Library page (registry, downloads, management) | 4 files |
| 4 | Settings page (config, API keys, hardware) | 5 files |
| 5 | Final verification | — |
