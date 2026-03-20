---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: Dashboard

## Summary

Real-time monitoring of hardware utilization, inference performance, and API usage. Displays GPU/CPU/RAM gauges, throughput graphs, active models with memory footprint, and request counters. Metrics are polled every 2 seconds and visualized with recharts, with data persisted to the `usage_metrics` table for historical analysis.

## Problem Statement

Users need visibility into:
- Hardware utilization (GPU VRAM, CPU, system RAM) to understand if hardware is bottlenecked
- Inference performance (tokens/second throughput) to evaluate model responsiveness
- Current model state (which models loaded, memory used) to troubleshoot performance issues
- API usage patterns (request counts, user distribution) for capacity planning
- System health at a glance to quickly spot problems

Without a dashboard, users have no way to monitor system performance, diagnose slowdowns, or understand if their hardware is sufficient.

## User Stories

- **User**: As a user, I want to see GPU/CPU/RAM usage in real-time so I know if my hardware is handling the load
- **Server Operator**: As a server operator, I want tokens/sec throughput graphs so I can monitor inference performance and spot degradation
- **Developer**: As a developer, I want to copy the API base URL so I can quickly connect clients to the server
- **System Admin**: As a system admin, I want to see which models are currently loaded and their memory footprint so I can manage resources
- **User**: As a user, I want a responsive dashboard that works on mobile so I can monitor from anywhere
- **Operator**: As an operator, I want request counters (by endpoint, by model) so I understand usage patterns
- **Developer**: As a developer, I want to see inference latency percentiles (p50, p95, p99) so I can understand response time SLOs
- **DevOps**: As a DevOps engineer, I want to export metrics in Prometheus format so I can integrate with my monitoring stack

## Scope

### In Scope
- Real-time GPU VRAM gauge (percentage and absolute usage: X / Y GB)
- CPU usage percentage gauge
- System RAM usage percentage gauge
- Active model display with VRAM footprint
- Tokens per second (tokens/sec) rolling graph (last 60 seconds, updated every 2s)
- Request counter (total requests, requests in last hour)
- Requests per second graph (rolling 60s window)
- Average latency gauge (ms, rolling average over last 60s)
- API base URL display with copy-to-clipboard button
- Prometheus metrics endpoint (GET /metrics)
- Hardware detection via packages/inference/hardware.ts
- Metrics persistence in `usage_metrics` table (timestamp, gpu_vram_used, cpu_percent, ram_percent, tokens_generated, request_count, latency_ms, model_name)
- Responsive grid layout (shadcn cards) that works on desktop and tablet
- Dark mode support via app theme
- Metrics refresh every 2 seconds
- Historical data retention (last 24 hours)
- Model information sidebar (name, parameters, quantization, memory usage)

### Out of Scope
- Multi-node cluster monitoring
- Alerting / notifications based on thresholds
- Log viewer / aggregation
- Custom metric collection
- Data export to CSV/JSON
- Metrics comparison across time periods
- Predictive load forecasting
- Cost estimation based on usage
- Rate limiting insights
- Fine-grained per-user analytics

## Requirements

### Must Have
- Poll hardware stats every 2 seconds (GPU VRAM, CPU, RAM via packages/inference/hardware.ts)
- Recharts line chart for tokens/sec throughput (rolling 60-second window, smooth interpolation)
- Hardware detection and fallback to CPU-only if GPU unavailable
- Store metrics in SQLite `usage_metrics` table
- Responsive grid layout with shadcn/ui Card, Gauge, and LineChart components
- Copy-to-clipboard functionality for API base URL
- Active model display with name, parameter count, and VRAM usage
- Real-time latency display (average, min, max over last 60s)
- Request counter (total + per hour)
- Clean visual hierarchy with section headers
- Responsive design that adapts to mobile viewports (320px+)
- Error handling for missing hardware stats
- Gauge visualization for hardware (GPU %, CPU %, RAM %)

### Should Have
- Requests/sec rolling graph (similar to tokens/sec)
- Latency percentiles (p50, p95, p99) displayed as metrics
- Model switcher showing all loaded/available models
- Inference time breakdown (preprocessing, model inference, postprocessing)
- Cache hit rate for KV cache (if applicable)
- Top endpoints by request count
- Request success/error rate
- Stale data indicator ("Last updated X seconds ago" if fetch fails)
- Timestamp of last metrics refresh
- Export current metrics to clipboard as JSON
- Metrics data retention policy (auto-delete data older than 7 days)

### Nice to Have
- Peak usage indicators (show max GPU/CPU in session)
- Cumulative tokens generated in session
- Average model load time
- Queue depth for pending requests
- Network I/O metrics (if applicable)
- Disk I/O metrics (model loading, cache writes)
- Custom metric dashboard builder (drag-to-reorder cards)
- Dark/light mode toggle in dashboard
- Metrics forecasting (predict next hour usage)
- Comparison mode (today vs. yesterday)
- Alert threshold configuration UI

## UX

### Entry Points
1. Desktop app: Main navigation links to Dashboard tab
2. Browser: `http://localhost:11500/dashboard`
3. Sidebar: Dashboard icon (or menu item) in main app
4. After server start: Suggested next step "View Dashboard"

### Key Screens

1. **Dashboard Grid View** (responsive grid of metric cards)
   - Top row: API URL card, Active Model card
   - Second row: GPU/CPU/RAM gauges (3-column grid)
   - Third row: Tokens/sec chart (full width)
   - Fourth row: Requests/sec chart (full width)
   - Fifth row: Latency card, Request counter card, Cache stats (3-column)
   - Bottom: Metrics refresh timestamp, data retention notice

2. **Gauge Cards** (GPU VRAM, CPU, RAM)
   - Title: "GPU VRAM", "CPU", "RAM"
   - Large circular or linear gauge showing percentage
   - Subtitle: "X GB / Y GB" (for VRAM) or "X%" (for CPU/RAM)
   - Color coding: Green (0-50%), Yellow (50-80%), Red (80%+)
   - Trend indicator: Arrow up/down showing if increasing/decreasing

3. **Chart Cards** (Tokens/sec, Requests/sec)
   - Title: "Throughput" or "Requests/sec"
   - Recharts LineChart with smooth curves
   - X-axis: Time (60s rolling, showing last 10 time points)
   - Y-axis: Auto-scaled based on max value
   - Tooltip on hover showing exact value and timestamp
   - Current value prominently displayed above/below chart

4. **Active Model Card**
   - Model name (e.g., "llama3.1:8b")
   - Parameters (e.g., "8.0B")
   - Quantization (e.g., "Q4_0")
   - Memory usage (e.g., "4.2 GB / 8.0 GB available")
   - Status: "Running" (green) or "Loading..."
   - "Change Model" button → opens model selector dialog

5. **API URL Card**
   - Title: "API Base URL"
   - URL field: `http://localhost:11500` (non-editable)
   - Copy button (icon + tooltip "Copied!")
   - Subtitle: "Use this URL with OpenAI SDKs"
   - Example usage code snippet (collapsible)

6. **Request Counter Card**
   - Total requests (large number)
   - Requests in last hour
   - Requests in last day (if available)
   - "Clear metrics" button (clears usage_metrics table)

7. **Latency Card**
   - Average latency (ms)
   - Min / Max latency
   - Percentiles: p50, p95, p99 (if tracking)
   - Small sparkline showing trend

### User Flow
1. User starts VxLLM server
2. User opens desktop app → Dashboard is default tab
3. User sees API URL, clicks Copy → URL copied to clipboard, toast "Copied!"
4. User opens OpenAI SDK documentation and pastes URL
5. User makes API request → tokens/sec chart updates in real-time
6. User observes GPU/CPU/RAM gauges to see if hardware stressed
7. User clicks on Model card → sees model details, option to swap models
8. User checks latency trends → notices p99 latency spiking, suspects hardware saturation
9. User opens Settings to override GPU layers
10. User returns to Dashboard → metrics reset after model reload, latency improves

## Business Rules

- **Polling Interval**: Hardware stats polled every 2 seconds; updates reflected immediately
- **Data Retention**: Metrics stored for last 24 hours; older data auto-deleted by cron job
- **Gauge Colors**: Green (0-50%), Yellow (50-80%), Red (80%+) based on utilization percentage
- **Stale Data**: If metrics fetch fails 3 times consecutively, show "Last updated X seconds ago" with warning icon
- **No Model Loaded**: Show placeholder "No model loaded. Select a model to start" with link to model library
- **GPU Not Detected**: Show CPU-only mode indicator in GPU card ("GPU not detected, CPU-only mode")
- **Throughput Metric**: Tokens generated / elapsed time (seconds); reset on model reload
- **Request Counter**: Increments on every API request (success or error); can be reset via UI
- **Latency Tracking**: Track all inference requests; compute rolling average, min, max over 60s window
- **Time Zones**: Timestamps displayed in user's local time zone (inferred from browser)
- **Empty State**: First 60s of app run, charts show "No data yet, start a chat to see metrics"

## Edge Cases

### Empty Cases
- **No metrics yet**: Show "No data yet, start a chat to see metrics" placeholder in chart cards
- **No model loaded**: Show "No model loaded" prompt with "Select Model" button in active model card
- **No requests made**: Request counter shows "0", requests/sec chart is flat at 0
- **GPU not detected**: GPU VRAM card shows "GPU not detected" with CPU-only fallback message
- **Metrics table empty on startup**: Show empty state, begin collecting after first request

### Boundary Cases
- **GPU VRAM at 100%**: Gauge shows red, no new requests accepted (handled by inference layer)
- **CPU at 100%**: Gauge shows red, system may be unresponsive (warn user)
- **Hardware stats fetch fails**: Show stale data with "Last updated X seconds ago" + warning icon
- **Chart data exceeds Y-axis scale**: Auto-scale Y-axis to max value in rolling window
- **Timestamp skew (clock adjustment)**: Handle by allowing metrics with timestamps up to 10s in past/future
- **Model name extremely long**: Truncate with ellipsis in model card
- **API base URL not available (server offline)**: Show error "Unable to fetch metrics" with retry button
- **Rolling window has < 2 data points**: Show partial chart or placeholder, not error

### Concurrent Cases
- **Multiple dashboard sessions open**: Each polls independently; eventual consistency (slight lag OK)
- **Model changes while dashboard open**: Previous model metrics cleared, new model stats begin accumulating
- **Server restarts while viewing dashboard**: Connection error shown, auto-reconnect after 5s
- **Metrics stored faster than UI updates**: UI updates every 2s; metrics stored on every request (no loss)
- **Request in progress when metrics queried**: Include in-flight request in request count, but don't double-count

### Data Integrity Cases
- **Metrics table corrupted**: Log error, show "Unable to load metrics" message, allow continue without dashboard
- **GPU stats return NaN**: Filter out, use last valid value
- **Latency is negative (clock skew)**: Log warning, treat as 0
- **Request count decreases**: Log anomaly, keep value as-is (don't correct to avoid confusion)
- **Stale data older than 24h in table**: Auto-cleaned by migration/cron; don't display in UI
- **Duplicate timestamps in rolling window**: Use most recent value for that second

## Success Criteria

- Dashboard loads without errors and displays all metric cards
- Hardware gauges update in real-time (within 2-second polling interval)
- Tokens/sec and requests/sec charts display smoothly without gaps or jumps
- API base URL can be copied to clipboard with single click
- Active model displays correctly with memory footprint
- Empty states show helpful messages ("No data yet", "No model loaded")
- GPU not detected state handled gracefully with CPU-only indicator
- Stale data indicator appears if metrics fetch fails
- Responsive design works on mobile (320px width) and desktop (1920px+)
- Request counter increments correctly with each API call
- Latency metrics track p50, p95, p99 accurately
- Prometheus endpoint (/metrics) returns valid Prometheus format
- Metrics persisted to DB and queryable for historical analysis
- Data older than 24h auto-deleted without affecting live metrics
- Dashboard works in dark mode and light mode

## Dependencies

- **Recharts**: LineChart, Tooltip, ResponsiveContainer for throughput/requests graphs
- **shadcn/ui**: Card, Button, Badge, Tabs, Tooltip components
- **lucide-react**: Icons for metric cards (Activity, Zap, Database, Cpu, HardDrive, etc.)
- **packages/inference/hardware.ts**: Hardware detection and stats collection
- **Drizzle + SQLite**: `usage_metrics` table for metrics persistence
- **zustand**: Client-side state for current metrics (real-time cache)
- **TanStack Query**: Server state management for metrics fetching with polling
- **Tauri 2**: Inter-process communication for hardware stats (if collected in separate process)
- **packages/db/schema.ts**: `usage_metrics` table schema definition

## Related Docs

- `api-dashboard`: OpenAI-compatible endpoint (GET /v1/metrics, GET /metrics)
- `schema-metrics`: Drizzle schema definition for usage_metrics table
- `api-models`: GET /v1/models endpoint (for active model display)
- `api-health`: GET /health endpoint (for server status in dashboard)
- `workflow-metrics-collection`: Background job that aggregates metrics
- `feature-settings`: Hardware override settings (GPU layers) affect dashboard GPU gauge

## Open Questions

1. Should metrics be aggregated per-model (separate row for each model) or global?
2. Should we track per-endpoint metrics (e.g., /chat/completions vs. /completions)?
3. Should latency include queuing time or just inference time?
4. Should we support custom metric tags (e.g., "user_id", "request_type")?
5. Should metrics export include correlation IDs for tracing requests?
6. Should we track model load time separately from inference time?
7. Should we warn users if GPU memory is predicted to be exceeded?
8. Should token count be tracked per-model or globally?
9. Should we surface cache statistics (KV cache hit rate)?
10. Should Prometheus metrics include request labels (model, endpoint)?

## Changelog

### v1.0 (2026-03-20)
- Initial feature specification
- Defined hardware monitoring (GPU VRAM, CPU, RAM gauges)
- Defined throughput graphs (tokens/sec, requests/sec with recharts)
- Specified 2-second polling interval for hardware stats
- Defined API URL copy functionality
- Specified active model display with memory footprint
- Outlined responsive grid layout with shadcn/ui cards
- Defined usage_metrics table schema for persistence
- Specified empty states and error handling
- Defined gauge color coding (green/yellow/red thresholds)
- Outlined data retention policy (24 hours)
- Specified Prometheus metrics endpoint
- Listed edge cases (empty, boundary, concurrent, data integrity)
