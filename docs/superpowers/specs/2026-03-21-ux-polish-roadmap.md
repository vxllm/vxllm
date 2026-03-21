# VxLLM UX Polish Roadmap

> **Purpose:** Complete issue list from thorough UX audit. For a fresh Claude session to pick up and execute.
> **Date:** 2026-03-21
> **Status:** Ready for execution

---

## P0 — Blocking Issues (Must Fix First)

### 1. No model loading flow — users can't start chatting
**Problem:** User lands on `/chat` with no models. No guidance to download one. If they try to send a message, it fails with a server error. The sidebar always says "No model loaded" even when a model IS loaded.

**Files:**
- `apps/app/src/components/chat/chat-sidebar.tsx:136` — hardcoded "No model loaded" badge
- `apps/app/src/routes/chat/index.tsx` — empty state has no model check
- `apps/app/src/components/chat/chat-input.tsx` — no guard for missing model

**Fix:**
- [ ] Query active model from `orpc.dashboard.getHardwareStatus` in sidebar — show actual model name or "No model loaded"
- [ ] In ChatEmptyState: if no downloaded models exist, show a prominent "Download a model to get started" CTA linking to `/models`
- [ ] In ChatInput: if no model is loaded, disable send button and show "Load a model first" tooltip
- [ ] After downloading a model, auto-load it (or prompt user to load it)

### 2. Model selector doesn't load models
**Problem:** The model selector in chat header shows downloaded models but selecting one doesn't actually LOAD it on the server. There's no API call to `ModelManager.load()` from the UI.

**Files:**
- `apps/app/src/components/chat/model-selector.tsx` — only stores selection locally, no server call
- `packages/api/src/routers/model.router.ts` — no "load model" procedure exists
- `packages/inference/src/model-manager.ts` — `load()` exists but not exposed via oRPC

**Fix:**
- [ ] Add `loadModel` oRPC procedure: takes model ID, calls `ModelManager.load()`, returns LoadedModel
- [ ] Add `unloadModel` oRPC procedure: takes session ID, calls `ModelManager.unload()`
- [ ] Add `getActiveModel` oRPC procedure: returns currently loaded model info (or null)
- [ ] ModelSelector: on change, call `loadModel` mutation with loading spinner
- [ ] On app startup: if `DEFAULT_MODEL` is set, auto-load it (server already does this)
- [ ] Show loading state while model loads (can take 5-30s for large models)

### 3. Dashboard "Active Model" card always shows "No model loaded"
**Problem:** Same root cause as #1 — the `getHardwareStatus` endpoint returns `activeModel` from `ModelManager.getActive()` which may be null if no model was loaded via the API.

**Fix:**
- [ ] Same fix as #2 — once load/unload procedures exist, the active model will be populated
- [ ] Fix the "Browse Models" link button in `active-model-card.tsx`

### 4. Voice service ignores downloaded models
**Problem:** The Python voice service auto-downloads its own copies of Whisper/Kokoro instead of using models from `MODELS_DIR`.

**Files:**
- `apps/voice/app/engines/stt.py` — checks `MODELS_DIR/stt/` but path matching is fragile
- `apps/voice/app/engines/tts.py` — checks `MODELS_DIR/tts/` but path matching is fragile
- `apps/voice/app/config.py` — `MODELS_DIR` may not match between Bun server and Python service

**Fix:**
- [ ] Voice service config: ensure `MODELS_DIR` matches the server's `MODELS_DIR` (both use env var)
- [ ] STT engine: scan all subdirs in `MODELS_DIR/stt/` for `model.bin` (already partially done)
- [ ] TTS engine: scan `MODELS_DIR/tts/` for Kokoro/Qwen3 models
- [ ] Add voice model selection to Settings page (choose which STT/TTS model to use)
- [ ] Pass selected STT/TTS model names to voice service via env vars or API

---

## P1 — Major UX Issues

### 5. Chat fails silently when no model is loaded
**Problem:** Sending a message with no loaded model returns a 503 server error. No user-friendly message.

**Fix:**
- [ ] Chat route: before `sendMessage`, check if a model is loaded. If not, show toast: "No model loaded. Go to Models to download and load one."
- [ ] Server: return a clear error message in the 503 response: `{ error: { message: "No model loaded. Use the Models page to download and load a model." } }`

### 6. Downloaded models still show in "Available Models"
**Problem:** After downloading, the model shows in both "Downloaded" and "Available" sections.

**File:** `apps/app/src/routes/models/index.tsx:146-147`

**Fix:**
- [ ] Filter available models to exclude names that exist in downloaded models list (already attempted but may not work correctly with registry vs DB name mismatch)

### 7. No conversation until first message
**Problem:** Clicking "New Chat" creates an empty conversation in the DB immediately. Opening example prompts also creates empty conversations.

**Fix:**
- [ ] Don't call `createConversation` until the first message is sent
- [ ] The `useChatWithPersistence` hook should create the conversation lazily

### 8. Settings changes require restart (not communicated)
**Problem:** Changing port, host, or GPU layers in Settings saves to DB but doesn't affect the running server.

**Fix:**
- [ ] Add a banner/note in Settings form: "Changes take effect after restarting the server"
- [ ] Or: implement hot-reload for settings that can change at runtime (CORS, context size)

---

## P2 — Polish & UX Improvements

### 9. Voice UX
- [ ] Voice selector dropdown in chat header (choose Kokoro vs Qwen3-TTS voice)
- [ ] Show voice service health status in nav or settings
- [ ] Show visual indicator when TTS audio is playing
- [ ] Show toast error when microphone access is denied
- [ ] Manual play button on assistant messages (not just auto-play)

### 10. Chat UX
- [ ] Conversation sidebar: add pagination or "Load More" button (currently capped at 50)
- [ ] Copy button: always visible (not just on hover) for accessibility
- [ ] Regenerate: allow regenerating any assistant message, not just the last
- [ ] Token counter near input showing context usage
- [ ] Support Shift+Enter as alternative send shortcut
- [ ] Show "Saved" indicator subtly after conversation auto-saves

### 11. Dashboard UX
- [ ] Color-code gauges: green < 60%, yellow 60-80%, red > 80%
- [ ] GPU gauge: show tooltip explaining "N/A" (no GPU / detection failed)
- [ ] Usage chart: render all configured metrics (count + latency + tokens), not just count
- [ ] Show active model name, type, quantization, memory usage in the active model card

### 12. Settings UX
- [ ] Help text/tooltips for each setting field (what does GPU Layers Override do?)
- [ ] Form validation (port range 1024-65535, host format)
- [ ] Warning banner when changing Host to 0.0.0.0 (security implication)
- [ ] API keys: show "last used" relative date, add optional expiry date

### 13. Models UX
- [ ] Show download progress on the model card itself (not just in separate section)
- [ ] Speed formatter: show "< 1 KB/s" instead of "--" for slow connections
- [ ] Show freed disk space in delete confirmation dialog
- [ ] Success toast after model deletion

### 14. Command Palette (Cmd+K)
- [ ] Implement proper command palette with searchable actions:
  - New conversation
  - Switch model
  - Toggle sidebar
  - Go to Dashboard / Models / Settings
  - Toggle dark/light mode
- [ ] Show keyboard shortcut hints on hover

### 15. First-Time Experience
- [ ] Welcome screen on first launch: "Welcome to VxLLM" → "Download your first model" → guided flow
- [ ] Or: if no models downloaded, redirect `/chat` to `/models` with a banner

---

## Execution Order

**Phase 1 — Make it work (P0):**
1. Add model load/unload/getActive oRPC procedures (#2)
2. Wire model selector to actually load models (#2)
3. Fix sidebar active model badge (#1)
4. Fix ChatEmptyState for first-time users (#1)
5. Guard chat input when no model loaded (#5)

**Phase 2 — Fix flows (P1):**
6. Fix voice service model paths (#4)
7. Lazy conversation creation (#7)
8. Fix available models filtering (#6)
9. Settings restart notice (#8)

**Phase 3 — Polish (P2):**
10. Voice UX improvements (#9)
11. Chat UX improvements (#10)
12. Dashboard improvements (#11)
13. Settings improvements (#12)
14. Models page improvements (#13)
15. Command palette (#14)
16. First-time experience (#15)

---

## How to execute

Start a fresh Claude session and say:
> Read `docs/superpowers/specs/2026-03-21-ux-polish-roadmap.md` and execute Phase 1 (items 1-5). These are the P0 blocking issues.

Then Phase 2, then Phase 3.

---

*Generated from full UX audit on 2026-03-21*
