# Project Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all out-of-sync documentation, missing features, and cleanup items found in the full project audit.

**Architecture:** Targeted fixes — no new features, just alignment and gap-filling.

**Spec:** `docs/superpowers/specs/2026-03-21-remediation-design.md`

---

## Task 1: Fix all documentation

**Files to modify:**
- `CLAUDE.md`
- `README.md`
- `docs/VxLLM_Plan_of_Action.md`
- `docs/project/design-guidelines.md`
- `docs/project/tech-stack.md`
- `docs/project/workflows/workflow-cli-serve.md`

- [ ] **Step 1: Update CLAUDE.md monorepo structure**

Replace `apps/web` → `apps/app`, `apps/fumadocs` → `apps/docs`. Add `apps/www` and `apps/cli`. Update the monorepo structure diagram. Fix dev commands: `dev:web` → `dev:app`, add `dev:cli`, `dev:www`, `dev:docs`.

- [ ] **Step 2: Update README.md**

Mirror all structure fixes from CLAUDE.md. Update any stale project description or getting started instructions.

- [ ] **Step 3: Add SUPERSEDED notice to VxLLM_Plan_of_Action.md**

Add at the very top:
```markdown
> **⚠️ SUPERSEDED:** This document describes the original Python + FastAPI architecture plan. The project now uses **Bun + Hono + node-llama-cpp**. See `CLAUDE.md` for the current architecture. This document is preserved for historical context only.
```

- [ ] **Step 4: Update design-guidelines.md**

Replace system font stack with Geist:
```css
/* OLD */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI"...
/* NEW */
font-family: "Geist Sans", sans-serif;
/* MONO */
font-family: "Geist Mono", monospace;
```

Replace hsl() references with oklch() — note that the actual CSS vars in `globals.css` already use oklch. The doc should reflect that.

- [ ] **Step 5: Update tech-stack.md**

Change "ai-sdk-llama-cpp (forked)" to "Fresh AI SDK adapter on node-llama-cpp (packages/llama-provider)" to reflect the actual implementation.

- [ ] **Step 6: Fix workflow-cli-serve.md**

Remove references to `/ui` and `/docs` routes that don't exist on the server. Replace with actual available routes (`/health`, `/v1/models`, `/rpc/*`).

- [ ] **Step 7: Commit**

```bash
git add . && git commit -m "docs: fix out-of-sync documentation (structure, fonts, colors, commands)"
```

---

## Task 2: Fix download resume with HTTP Range

**Files:**
- Modify: `packages/inference/src/download.ts`

- [ ] **Step 1: Read current resume() implementation**

- [ ] **Step 2: Update resume() to use Range headers**

When resuming a paused download:
1. Read `downloadedBytes` from the download queue DB entry
2. Check the partial `.download` file size on disk
3. Send `Range: bytes={downloadedBytes}-` header in the fetch request
4. Append to existing file instead of overwriting
5. Update progress from the resumed offset

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "fix(inference): implement proper HTTP Range resume for downloads"
```

---

## Task 3: Fix GPU utilization in dashboard

**Files:**
- Modify: `packages/inference/src/hardware.ts`
- Modify: `packages/api/src/routers/dashboard.router.ts`

- [ ] **Step 1: Update detectHardware() to return VRAM usage**

node-llama-cpp's `getLlama()` provides `getVramState()` which returns `{ used, total }`. Call this and include used/total in the `HardwareProfile.gpu` object. May need to add `vramUsedBytes` to the type.

- [ ] **Step 2: Update dashboard.getHardwareStatus**

Calculate `gpuPercent` from `vramUsed / vramTotal * 100` instead of returning null. Remove the TODO comment.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "fix(dashboard): implement GPU VRAM utilization monitoring"
```

---

## Task 4: Add context truncation

**Files:**
- Modify: `apps/server/src/routes/v1/chat.ts`

- [ ] **Step 1: Add truncation logic before inference**

Before calling `streamText()` or `generateText()`, count total tokens of all messages. If total exceeds the model's context window:
1. Keep the system prompt (always)
2. Keep the latest N messages that fit within 80% of context window
3. Drop oldest messages
4. Add a `X-Context-Truncated: true` response header

Use `ModelManager.countTokens()` for token counting.

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "fix(server): add context truncation for oversized conversations"
```

---

## Task 5: Wire example prompts

**Files:**
- Modify: `apps/app/src/components/chat/chat-empty-state.tsx`
- Modify: `apps/app/src/routes/chat/index.tsx` or `$conversationId.tsx`

- [ ] **Step 1: Make example prompts functional**

When user clicks an example prompt:
1. Navigate to `/chat?prompt=<encoded text>` (URL search param)
2. In the chat route, read the search param and auto-send via `sendMessage({ text })`

Or simpler: use zustand store to pass the prompt.

- [ ] **Step 2: Remove the TODO comment**

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "fix(app): wire example prompts to create conversations"
```

---

## Task 6: Fix minor issues

**Files:**
- Modify: `apps/cli/src/commands/ps.ts`
- Modify: `apps/app/src/components/chat/command-palette.tsx`

- [ ] **Step 1: Fix ps.ts hardcoded URL**

Replace `http://localhost:11500` with env var or make it configurable:
```typescript
const serverUrl = process.env.VITE_SERVER_URL || "http://localhost:11500";
```

- [ ] **Step 2: Fix command-palette.tsx querySelector**

Replace fragile `querySelector('[placeholder="Search conversations..."]')` with a React ref or data-attribute approach.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "fix: minor cleanup (hardcoded URLs, fragile DOM queries)"
```

---

## Task 7: Verification

- [ ] **Step 1: Type check**

```bash
bun run check-types
```

- [ ] **Step 2: Verify docs are accurate**

Spot-check CLAUDE.md monorepo structure against actual `ls apps/`.

- [ ] **Step 3: Start server and verify health**

```bash
bun run dev:server
curl http://localhost:11500/health
```

- [ ] **Step 4: Commit any fixes**

```bash
git add . && git commit -m "fix: resolve remediation verification issues"
```

---

## Summary

| Task | Type | Items Fixed |
|------|------|------------|
| 1 | Docs | 7 documentation files synced |
| 2 | Feature | Download resume with Range headers |
| 3 | Feature | GPU utilization monitoring |
| 4 | Feature | Context truncation |
| 5 | Feature | Example prompts wired |
| 6 | Cleanup | Hardcoded URLs, fragile queries |
| 7 | Verification | Final checks |
