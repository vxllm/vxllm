# Sub-project #7: Dashboard + Settings + Model Library — Design Spec

> **Project:** VxLLM
> **Sub-project:** 7 of 14 — Dashboard + Settings + Model Library UI
> **Date:** 2026-03-21
> **Status:** Approved

---

## Context

Three new pages consuming already-implemented oRPC endpoints. All backend procedures exist — this is purely frontend work.

### Dependencies

- Sub-project #5 (oRPC Routes): dashboard.*, settings.*, models.* procedures
- Sub-project #6 (Chat UI): route structure, sidebar, shadcn components

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| Dashboard page (hardware gauges, metrics, charts) | Voice settings |
| Model Library page (registry browser, downloads, delete) | Docker deployment config |
| Settings page (server config, API keys, hardware info) | User authentication |
| App-level navigation (icon rail) | Advanced model import (safetensors conversion) |
| Polling for live hardware stats | |

---

## Route Structure

```
apps/app/src/routes/
├── __root.tsx            # MODIFY: add app nav context
├── chat/                 # EXISTING
├── dashboard/
│   └── index.tsx         # Dashboard page
├── models/
│   └── index.tsx         # Model library page
└── settings/
    └── index.tsx         # Settings page with tabs
```

## Navigation

Icon rail (~48px) on the far left of the app, always visible:

```
┌──┬─────────────┬──────────────────────────┐
│  │  Sidebar     │  Content                 │
│💬│  (chat only) │                          │
│📊│              │                          │
│📦│              │                          │
│⚙️│              │                          │
└──┴─────────────┴──────────────────────────┘
```

- `MessageSquare` → `/chat`
- `BarChart3` → `/dashboard`
- `Box` → `/models`
- `Settings` → `/settings`

Active route highlighted. On chat pages, the icon rail sits beside the chat sidebar. On other pages, no sidebar — just the icon rail + full-width content.

Create `apps/app/src/components/app-nav.tsx` for the icon rail.

---

## Dashboard Page (`/dashboard`)

Single scrollable page, sections stacked vertically.

### Section 1: Hardware Gauges

3 cards side by side:
- **CPU** — Circular or linear progress, `loadAvg / cores * 100`%
- **RAM** — `(total - free) / total * 100`%
- **GPU** — VRAM usage % (if available, otherwise "N/A")

Data: `orpc.dashboard.getHardwareStatus` polled every 3 seconds via `refetchInterval: 3000`.

### Section 2: Active Model

Card showing:
- Model name + variant badge
- Context size, memory usage
- "No model loaded" empty state → link to `/models`

Data: from `getHardwareStatus.activeModel` or `orpc.models.list({ status: "downloaded" })`.

### Section 3: Metrics Summary

4 stat cards in a row: Total Requests, Avg Latency (ms), Tokens In, Tokens Out.

Period selector: `1h` / `6h` / `24h` toggle group.

Data: `orpc.dashboard.getMetricsSummary({ period })`.

### Section 4: Usage Chart

Recharts `AreaChart` or `BarChart` using shadcn `chart` component. Shows request count by type (chat/embedding/completion) over the selected period.

Data: `orpc.dashboard.getUsageBreakdown({ period })`.

### Section 5: API Base URL

Copy-ready card: `http://localhost:11500/v1` with copy button + toast.

---

## Model Library Page (`/models`)

### Section 1: Search + Filters

Search input (debounced) + type filter (All / LLM / STT / TTS / Embedding).

### Section 2: Registry Browser

Grid of model cards from `orpc.models.search({ query, type? })`. Each card:
- Model name + type badge
- Description
- Size + minRamGb
- "Download" button → calls `orpc.models.download({ name })`

### Section 3: Downloaded Models

List/grid of downloaded models from `orpc.models.list({ status: "downloaded" })`. Each:
- Name + variant + format badge
- Size on disk
- "Delete" button → `AlertDialog` confirmation → `orpc.models.delete({ id })`
- "Load" button (if not active)

### Section 4: Active Downloads

Progress cards for each active download from `orpc.models.getDownloadStatus()`. Polled every 2s:
- Model name
- Progress bar (%)
- Speed (MB/s), ETA
- Cancel button

---

## Settings Page (`/settings`)

Tabbed layout using shadcn `Tabs`.

### Tab 1: Server Config

Form with fields:
- Port (number input, read from `settings.get("server.port")`)
- Host (text input)
- CORS Origins (text input)
- Default Model (select from downloaded models)
- Max Context Size (number input with slider)
- GPU Layers Override (number input, optional)

Save button → iterates fields, calls `orpc.settings.set({ key, value })` for each.

### Tab 2: API Keys

- "Create API Key" button → `Dialog` with: label input, permissions select, rate limit input
- On create → `orpc.settings.createApiKey()` → show full key ONCE in a dialog with copy button
- Table of keys from `orpc.settings.listApiKeys()`:
  - Key prefix (`vx_sk_...`)
  - Label
  - Permissions badge
  - Rate limit
  - Last used (relative date)
  - Created (relative date)
  - Delete button with confirmation

### Tab 3: Hardware Info

Read-only display from `orpc.settings.getHardwareInfo()`:
- Platform + Architecture
- GPU: vendor, name, VRAM
- CPU: model, physical cores, logical cores
- RAM: total, available

---

## Component Structure

```
apps/app/src/
├── components/
│   ├── app-nav.tsx                    # Icon rail navigation
│   ├── dashboard/
│   │   ├── hardware-gauges.tsx        # CPU/RAM/GPU gauge cards
│   │   ├── active-model-card.tsx      # Current model display
│   │   ├── metrics-summary.tsx        # 4 stat cards
│   │   ├── usage-chart.tsx            # Recharts area/bar chart
│   │   └── api-url-card.tsx           # Copyable API base URL
│   ├── models/
│   │   ├── model-card.tsx             # Single model card (registry)
│   │   ├── downloaded-model-row.tsx   # Downloaded model list item
│   │   └── download-progress.tsx      # Active download progress
│   └── settings/
│       ├── server-config-form.tsx     # Server settings form
│       ├── api-keys-table.tsx         # API key list + CRUD
│       ├── create-api-key-dialog.tsx  # Create key dialog
│       └── hardware-info.tsx          # Read-only hardware profile
```

---

## File Impact Summary

| Area | Files Created | Files Modified |
|------|--------------|----------------|
| `apps/app/src/routes/` | 3 (dashboard, models, settings index) | 1 (__root.tsx for nav) |
| `apps/app/src/components/` | 1 (app-nav.tsx) | 0 |
| `apps/app/src/components/dashboard/` | 5 | 0 |
| `apps/app/src/components/models/` | 3 | 0 |
| `apps/app/src/components/settings/` | 4 | 0 |
| **Total** | **~16** | **~1** |

## Success Criteria

- [ ] `/dashboard` shows hardware gauges with live polling
- [ ] Metrics summary updates with period selector (1h/6h/24h)
- [ ] Usage chart renders with recharts
- [ ] `/models` shows registry models with download button
- [ ] Download starts and shows progress bar
- [ ] Downloaded models listed with delete option
- [ ] `/settings` server config tab reads/writes settings
- [ ] API key creation shows full key once, persists hash
- [ ] API key table lists keys without exposing hashes
- [ ] Hardware info tab shows system profile
- [ ] Icon rail nav works across all pages
- [ ] `bun run check-types` passes

---

*Spec version: 1.0 | Approved: 2026-03-21*
