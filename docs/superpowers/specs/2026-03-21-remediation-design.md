# Project Remediation — Design Spec

> **Project:** VxLLM
> **Date:** 2026-03-21
> **Status:** Approved
> **Scope:** Fix out-of-sync docs, missing features, and cleanup items found in full project audit

---

## Audit Summary

Three parallel audits scanned the entire codebase. After cross-checking and eliminating false positives, here are the verified issues:

**False positives eliminated (actually implemented):**
- Dashboard polling (refetchInterval: 3000ms) ✓
- Rate limiting (token bucket in auth.ts) ✓
- Settings persistence (onConflictDoUpdate upsert) ✓
- Structured output (createGrammarForJsonSchema) ✓
- Tool calling (defineChatSessionFunction) ✓

---

## CRITICAL: Docs Out of Sync (7 items)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `CLAUDE.md` | Monorepo structure says `apps/web` | Change to `apps/app` |
| 2 | `CLAUDE.md` | Monorepo structure says `apps/fumadocs` | Change to `apps/docs` |
| 3 | `CLAUDE.md` | Missing `apps/www` and `apps/cli` from structure | Add entries |
| 4 | `CLAUDE.md` | Dev command `dev:web` listed | Change to `dev:app`, add `dev:cli`, `dev:www`, `dev:docs` |
| 5 | `README.md` | Same directory name issues as CLAUDE.md | Mirror all CLAUDE.md fixes |
| 6 | `VxLLM_Plan_of_Action.md` | Describes Python+FastAPI, not marked superseded | Add SUPERSEDED notice at top |
| 7 | `design-guidelines.md` | System font stack (not Geist), hsl() (not oklch()) | Update font and color sections |

## MAJOR: Missing Features (5 items)

| # | Area | Issue | Impact |
|---|------|-------|--------|
| 8 | Download resume | `resume()` re-downloads from scratch, no HTTP Range headers | Interrupted downloads waste bandwidth |
| 9 | Kokoro TTS | Placeholder engine returns silence | Voice output non-functional |
| 10 | GPU utilization | `gpuPercent: null` in dashboard hardware status | Dashboard GPU gauge shows N/A |
| 11 | Context truncation | No message truncation before inference when context window exceeded | Could crash on long conversations |
| 12 | Prometheus metrics | No `GET /metrics` endpoint | Can't integrate with monitoring |

## MINOR: Cleanup (6 items)

| # | File | Issue |
|---|------|-------|
| 13 | `chat-empty-state.tsx:32` | TODO: Example prompts don't pre-populate chat input |
| 14 | `ps.ts:16` | Hardcoded `localhost:11500` instead of env var |
| 15 | `command-palette.tsx:43` | Fragile DOM querySelector by placeholder text |
| 16 | `tech-stack.md` | References "ai-sdk-llama-cpp (forked)" — we wrote a fresh adapter |
| 17 | `workflow-cli-serve.md` | References `/ui` and `/docs` routes that don't exist |
| 18 | `dashboard.router.ts:97` | gpuPercent TODO comment |

---

## Remediation Plan

### Task 1: Fix all docs (CLAUDE.md, README.md, design-guidelines.md, tech-stack.md)
- Update monorepo structure in CLAUDE.md + README.md
- Update dev commands
- Add SUPERSEDED notice to VxLLM_Plan_of_Action.md
- Update design-guidelines.md font stack + color format
- Update tech-stack.md adapter description
- Remove /ui and /docs references from workflow-cli-serve.md

### Task 2: Fix download resume with HTTP Range
- Update `DownloadManager.resume()` to send `Range: bytes=N-` header
- Track `downloadedBytes` properly for resume offset

### Task 3: Fix GPU utilization in dashboard
- Query node-llama-cpp for VRAM state in `dashboard.getHardwareStatus`
- Update `detectHardware()` to return VRAM usage (not just total)

### Task 4: Add context truncation
- Before inference in chat route, count total tokens of messages
- If exceeds context window, truncate oldest messages (keep system prompt + latest N)
- Warn in response headers when truncation occurred

### Task 5: Wire example prompts in empty state
- Store selected prompt in URL search param or zustand
- Chat input reads and auto-sends on mount

### Task 6: Fix minor issues
- `ps.ts`: Use env var for server URL
- `command-palette.tsx`: Use data attribute instead of querySelector
- `dashboard.router.ts`: Remove TODO comment if GPU is fixed

### Task 7: Add Prometheus /metrics endpoint (optional)
- Create simple Prometheus-format text output for basic metrics
- Counter: total_requests, by type
- Histogram: request_latency_ms

---

## Out of Scope for This Remediation

These are real gaps but deferred to future work:
- Kokoro TTS integration (depends on package availability)
- WebSocket real-time voice streaming (separate sub-project when needed)
- Token rate display during streaming (UI enhancement)
- Full-text search across messages
- Shell completions for CLI
- First-run wizard

---

*Spec version: 1.0 | Approved: 2026-03-21*
