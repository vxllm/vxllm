---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# Architecture Decision Records (ADRs)

This document captures the major architectural decisions in VxLLM, their context, alternatives considered, and consequences. ADRs are immutable once made; changes should be recorded as new ADRs or amendments.

---

## ADR-001: Hono + Bun for Main Server over Python + FastAPI

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** High (foundational choice)

### Context
VxLLM requires a fast, lightweight HTTP server capable of:
1. Exposing OpenAI-compatible REST API
2. Integrating with node-llama-cpp for in-process inference
3. Running on desktop (Tauri) and server deployments
4. Minimizing bundle size and startup time

Two primary contenders emerged:
- **Option A:** Python FastAPI + gunicorn (industry standard, mature)
- **Option B:** Hono + Bun (modern, lightweight, JS/TS native)

### Decision
**Adopt Hono + Bun as the main server framework.**

### Rationale

**Type Safety:** Bun is TypeScript-first; Hono is fully typed. Eliminates Python ↔ JS serialization layer needed if we'd used Python.

**Node-llama-cpp Integration:** node-llama-cpp is a JavaScript package. Using Hono + Bun means no subprocess overhead or IPC complexity; the model runs in-process with zero serialization latency.

**Bundle Size:** Hono minimal (~10KB), Bun self-contained. Python would require shipping Python runtime (~50MB+).

**Startup Time:** Bun starts in milliseconds. Python startup is hundreds of milliseconds, unacceptable for Tauri desktop app.

**Unification:** Single tech stack (TypeScript everywhere) reduces context switching, simplifies dependency management, easier onboarding for new contributors.

**Performance:** Bun's performance is competitive with or better than Python FastAPI in HTTP benchmarks, especially for streaming.

### Consequences

**Positive:**
- Tight integration with node-llama-cpp (no subprocess, no IPC)
- Smaller, faster-to-start executable for Tauri
- Single language throughout backend (TypeScript)
- Type inference across HTTP layer and business logic
- Excellent streaming support via native HTTP APIs
- Simpler deployment (single binary via Bun)

**Negative:**
- Smaller ecosystem than Python/FastAPI (fewer third-party packages)
- Bun is newer, less battle-tested than mature Python frameworks
- Team might have less familiarity (likely Python-heavy ML backgrounds)
- Harder to integrate some Python ML libraries directly (but voice sidecar solves this)

### Alternatives Considered

**Python FastAPI:**
- Pros: Mature, huge ML ecosystem, many tutorials
- Cons: Heavy runtime, slow startup, need Python subprocess for node-llama-cpp (defeats purpose), larger bundle
- Rejected: Bundle size + startup time unacceptable for Tauri

**Deno + Oak:**
- Pros: Also TypeScript-first, similar lightweight philosophy
- Cons: Smaller community than Bun, build tooling less polished
- Rejected: Bun's package manager + build speed advantages outweigh

**Go + Fiber:**
- Pros: Compiled, very fast, small binary
- Cons: Type system weaker for dynamic inference configs, harder to type-check OpenAI compatibility
- Rejected: Need strong TypeScript typing for API validation

---

## ADR-002: node-llama-cpp In-Process over llama.cpp Subprocess

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** High

### Context
Two approaches exist for running LLM inference:
1. **In-Process:** Load GGUF and run inference directly in Node.js via node-llama-cpp bindings
2. **Subprocess:** Spawn llama.cpp as a separate process, communicate over IPC/stdio

### Decision
**Run node-llama-cpp in-process within the Hono server.**

### Rationale

**Latency:** In-process eliminates IPC overhead. Message passing (JSON serialization, process context switch) adds 10-50ms per inference. For conversational AI, every millisecond counts.

**State Management:** In-process inference means model weights stay in RAM between requests. No process spawning on each request.

**Simplicity:** No need to manage separate llama.cpp process lifecycle, handle crashes, or monitor stdio. Simpler Tauri integration.

**Memory Efficiency:** Shared memory space; no duplicate model loading across processes.

**Exception Handling:** Model errors (OOM, invalid GGUF) surface directly as JavaScript exceptions; easier to debug.

### Consequences

**Positive:**
- Lowest latency for inference (no IPC)
- No need to spawn/manage subprocess
- Single process model for easier deployment
- Easier crash recovery and health checks
- TypeScript exception handling for model errors

**Negative:**
- Single inference at a time (JavaScript is single-threaded for compute)
- If inference crashes, crashes the server (not isolated)
- Memory not freed between models (must reload to switch models)
- Model must fit in available RAM (no out-of-core computation)

### Tradeoffs Accepted
- **Single inference at a time:** MVP phase doesn't require concurrent generations. Queue-based batching can be added later.
- **Server crash risk:** Isolated exception handling in Tauri can auto-restart. Acceptable for Phase 1.
- **Memory**: Model switching requires reload, but models are cached after first load.

### Alternatives Considered

**llama.cpp Subprocess (with IPC):**
- Pros: Process isolation (crash doesn't kill server), can run multiple inferences in parallel via multiple processes
- Cons: 10-50ms IPC overhead per request, more complex lifecycle management, harder Tauri integration
- Rejected: Latency unacceptable for interactive chat

**llama-server (HTTP):**
- Pros: Same as subprocess but with HTTP (cleaner IPC)
- Cons: Still adds latency over in-process, extra binary to deploy
- Rejected: Solves for parallelism we don't need yet

---

## ADR-003: Separate Python Voice Sidecar for STT/TTS/VAD

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** High

### Context
VxLLM requires voice capabilities: Speech-to-Text (faster-whisper), Text-to-Speech (Kokoro-82M), and Voice Activity Detection (silero-vad). These have mature, high-quality Python implementations. Two approaches:

1. **Integrated:** Include Python runtime in Bun app, import whisper/kokoro directly
2. **Sidecar:** Separate Python FastAPI service on port 11501, communicate over HTTP

### Decision
**Run voice processing in a separate Python FastAPI sidecar service.**

### Rationale

**Ecosystem:** Python has the best SOTA models for voice:
- faster-whisper: 4x faster than Whisper, industry standard
- Kokoro-82M: Lightweight, high-quality TTS
- silero-vad: SOTA open-source VAD

**Separation of Concerns:** Voice is a distinct service; isolate it from core inference logic. Allows independent scaling, updating, or disabling.

**Dependency Management:** Mixing Python + Node.js dependencies in one package.json is painful. Separate requirements.txt keeps voice clean.

**Startup Time:** Voice sidecar can lazy-load models (load only when voice tab opened). Doesn't block main server startup.

**Language Appropriateness:** Python is better for numeric/ML work. Node.js is better for HTTP/async. Use each language where it shines.

**Optional Feature:** Users uninterested in voice can disable it or run server without voice sidecar.

### Consequences

**Positive:**
- Access to best-in-class Python voice models
- Isolated voice failures (voice down ≠ chat down)
- Clean dependency management
- Independently scalable
- Optional feature (can be disabled)
- Easier to add voice features without touching core server

**Negative:**
- Extra process to manage (one more thing to keep alive)
- Inter-process communication (HTTP) adds latency compared to in-process
- More complex deployment (docker-compose instead of single binary)
- Separate logs, monitoring, versioning
- Users must have Python installed (for local deployment)

### Tradeoffs Accepted
- **Multi-process complexity:** Offset by gains in code clarity and access to better models
- **Latency:** Voice requests aren't as latency-sensitive as text inference (human speech is slow)
- **Deployment:** Docker Compose handles multi-service orchestration elegantly

### Alternatives Considered

**Integrated Python in Node:**
- Pros: Single process, no IPC
- Cons: Dependency hell, slow startup, mixing paradigms
- Rejected: Benefits of separation outweigh complexity

**Use JS voice libraries:**
- Pros: Single language, single process
- Cons: JS equivalents of whisper/kokoro are immature or non-existent
- Rejected: Would sacrifice quality significantly

**Use Hugging Face Spaces (external):**
- Pros: No local infrastructure, no VRAM required
- Cons: Requires internet, higher latency, privacy concerns, costs money at scale
- Rejected: Local-first philosophy

---

## ADR-004: Skip MLX, Use node-llama-cpp Metal for Apple Silicon

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** Medium

### Context
Apple Silicon (M1/M2/M3) support requires a choice:
1. **MLX:** Apple's ML framework, optimized for their hardware
2. **node-llama-cpp with Metal backend:** llama.cpp's Metal backend, multi-platform

### Decision
**Use node-llama-cpp's Metal backend. Do not implement MLX support in Phase 1.**

### Rationale

**Single Inference Runtime:** node-llama-cpp abstracts Metal, CUDA, CPU behind one interface. One API for all platforms.

**Metal Backend Quality:** llama.cpp's Metal implementation is excellent, nearly feature-parity with CUDA.

**Simplicity:** No need to maintain two codebases (llama.cpp + MLX), handle feature divergence, or version them separately.

**Hardware Support:** Users can move between Intel Mac and Apple Silicon without code changes.

**Future-Proof:** If node-llama-cpp's Metal backend falls behind, can switch without rewriting logic.

**Performance:** Metal backend is fast enough for MVP; performance optimization can come later.

### Consequences

**Positive:**
- Single codebase for all platforms
- Strong hardware auto-detection
- Full access to llama.cpp ecosystem improvements
- Excellent Metal performance

**Negative:**
- Might be slightly slower than hand-tuned MLX on M-series Macs (benchmarks show it's competitive)
- No access to MLX-specific optimizations (e.g., grouped attention)
- MLX community (smaller) might feel less represented

### Tradeoffs Accepted
- **Potential performance gap:** Metal backend is fast enough; can optimize later if needed
- **MLX ecosystem lock-in:** Avoided by design

### Alternatives Considered

**MLX-only support:**
- Pros: Absolute best performance on Apple Silicon
- Cons: Only works on Macs, excludes Linux/Windows, creates fragmentation
- Rejected: Violates cross-platform goal

**Hybrid (support both):**
- Pros: Best of both worlds
- Cons: Massive maintenance burden, two completely different codebases, complex build
- Rejected: Too complex for MVP

---

## ADR-005: oRPC for App Routes + Raw Hono for OpenAI Proxy

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** Medium-High

### Context
VxLLM needs to expose two distinct APIs:
1. **App logic:** Chat, model management, settings (internal, used by React app)
2. **OpenAI compatibility:** `/v1/chat/completions` and similar endpoints (external, for third-party tools)

Two approaches considered:
1. **Single API:** Use one technology for both (all oRPC or all REST)
2. **Dual API:** Use best tool for each use case

### Decision
**Use oRPC for internal app routes, raw Hono routes for OpenAI proxy.**

### Rationale

**oRPC for App Routes:**
- Type safety end-to-end (frontend → backend)
- Zero serialization overhead in dev environment
- Auto-generated client types via @ai-sdk/react integration
- Simpler validation (Zod at procedure level)
- Cleaner code (feels like calling functions, not HTTP)

**Raw Hono for OpenAI Proxy:**
- oRPC is JavaScript/TypeScript only; OpenAI clients are polyglot (Python, Go, Node.js, etc.)
- HTTP REST is the lingua franca for tool integrations
- Standard endpoint structure expected by ecosystem
- Can proxy to remote server (running on different machine)

**Separation of Concerns:**
- App logic ≠ external integrations
- Different auth strategies (oRPC uses session context, REST uses Bearer token)
- Different versioning strategies (app routes can change freely, OpenAI proxy is public contract)

### Consequences

**Positive:**
- Type-safe internal APIs
- Standards-compliant external APIs
- Each tool optimized for its domain
- Clear separation of concerns
- Flexibility (could run voice sidecar as separate OpenAI-compatible server)

**Negative:**
- Two different API styles to maintain
- Potential feature duplication (same logic exposed twice)
- More code to test/review
- Mental model complexity for new contributors

### Tradeoffs Accepted
- **Code duplication risk:** Offset by clear separation; makes it obvious when divergence exists

### Alternatives Considered

**All oRPC:**
- Pros: Single API, maximum type safety
- Cons: Breaks OpenAI ecosystem, no third-party tool support, locks users into ecosystem
- Rejected: Violates openness principle

**All REST/OpenAI:**
- Pros: Single API, third-party support
- Cons: No type safety, verbose Zod validation everywhere, verbose client code in React
- Rejected: Poor DX for internal app

---

## ADR-006: Drizzle ORM + SQLite over JSON Files

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** Medium

### Context
VxLLM requires persistence for:
- Conversation history
- Model metadata
- User settings
- API keys
- Usage metrics

Two approaches:
1. **JSON files:** Simple, zero setup, all data in `~/.vxllm/data.json`
2. **SQLite + ORM:** Structured, queryable, relational

### Decision
**Use Drizzle ORM with SQLite database.**

### Rationale

**Queryability:** "Show conversations with model X from last week" is easy SQL, impossible with JSON files (manual filtering).

**Relationships:** Conversations → Messages → Tags (relational data is messy in JSON).

**Scalability:** 1000 conversations in JSON = slow file I/O and parsing. SQLite handles efficiently.

**Type Safety:** Drizzle generates TypeScript types from schema; catches mistakes at build time.

**Transactions:** ACID guarantees for concurrent writes (message from two conversations simultaneously).

**Migration Path:** Can evolve schema without breaking old data files.

**Industry Standard:** SQLite is ubiquitous for local persistence (Slack desktop, many Electron apps, browsers).

### Consequences

**Positive:**
- Powerful queries (filtering, sorting, aggregation)
- Relational integrity
- Type-safe access
- Easy to migrate to cloud DB if needed
- Better performance at scale

**Negative:**
- More setup than JSON (schema definitions, migrations)
- More complex backups (binary file vs. JSON)
- Slightly higher learning curve (ORM concepts)
- Export/import more complex (need to dump/restore)

### Tradeoffs Accepted
- **Complexity:** Offset by better long-term maintainability

### Alternatives Considered

**JSON files:**
- Pros: Zero setup, human-readable backups, simple
- Cons: Doesn't scale, no querying, no relational integrity
- Rejected: Limits future feature development

**PostgreSQL (server):**
- Pros: Powerful, scalable, industry standard
- Cons: Requires external process, overkill for local/small deployments, adds ops burden
- Rejected: Local-first philosophy

---

## ADR-007: AI SDK (ai + ai-sdk-llama-cpp) for Streaming

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** Medium

### Context
Streaming LLM responses requires:
- Token-by-token generation
- Chunked HTTP responses
- Type-safe generation (structured outputs with Zod)
- React hook integration (useChat)

Options:
1. **Roll custom:** Implement streaming, hooks, Zod integration ourselves
2. **AI SDK + custom provider:** Use Vercel's AI SDK + fork llama-cpp provider

### Decision
**Use Vercel AI SDK (ai package) with custom llama-cpp provider (ai-sdk-llama-cpp forked into packages/llama-provider).**

### Rationale

**Streaming:**  AI SDK's `streamText()` handles SSE (Server-Sent Events), chunking, error handling. Don't reinvent.

**React Hooks:** `useChat()` manages conversation state, loading, errors. Saves 500+ lines of custom code.

**Type Safety:** `generateObject()` validates output against Zod schema; catches hallucinations before frontend sees them.

**Provider Pattern:** One interface for OpenAI, Anthropic, local (llama-cpp). Easy to add other models later.

**Ecosystem:** Huge community (LangChain, Hugging Face, others all use this pattern).

**Custom Provider:** ai-sdk-llama-cpp is a Vercel example project. We fork it and customize (adjust for node-llama-cpp v3 API, add cost estimation). Maintain full control.

### Consequences

**Positive:**
- Streaming out of the box
- React hooks for state management
- Type-safe generation
- Easy to swap models later
- Battle-tested by thousands of projects

**Negative:**
- Dependency on external library (Vercel ecosystem)
- Must fork + maintain ai-sdk-llama-cpp provider
- Breaking changes if Vercel changes major versions
- Some overhead (more abstraction) vs. bare-bones custom solution

### Tradeoffs Accepted
- **External dependency:** Benefits (no reinventing streaming) outweigh risks

### Alternatives Considered

**Custom streaming implementation:**
- Pros: Full control, minimal dependencies
- Cons: 500+ LOC, reinvent error handling/chunking, no React hooks
- Rejected: Reinventing the wheel

**LangChain:**
- Pros: Mature, lots of integrations
- Cons: Very heavy (~2MB), too many features VxLLM doesn't need
- Rejected: Overkill, worse DX

---

## ADR-008: Single Unified App (Web + Tauri) over Separate Code

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** Medium

### Context
VxLLM needs to work both:
1. In-browser (for web deployment)
2. In Tauri desktop app (for offline-first, native integration)

Two approaches:
1. **Separate codebases:** Web app (React) + Desktop app (separate React)
2. **Unified codebase:** One React app works in both browser and Tauri webview

### Decision
**Create single React + Vite app that works in both browser and Tauri.**

### Rationale

**DRY Principle:** Don't maintain two versions of the same UI.

**Conditional Rendering:** Check `__TAURI__.tauri` to enable Tauri-only features (file access, tray menus) at runtime. Rest of code identical.

**Deployment:** One build, two deployment targets (web server + .dmg/.exe/.AppImage).

**Testing:** Single test suite works for both.

**Maintenance:** Feature added once, works everywhere.

**Vite Excellent:** Vite's plugin system and conditional imports make this seamless.

### Consequences

**Positive:**
- No code duplication
- Single test suite
- Faster feature development (add once, works everywhere)
- Clear Tauri vs. browser boundaries (conditional checks)

**Negative:**
- Some UI code checks `__TAURI__` (adds conditionals)
- Hard to optimize perfectly for both (compromises)
- Browser version can't access desktop features (by design)

### Tradeoffs Accepted
- **Conditional complexity:** Minimal; just a few checks for Tauri-only features

### Alternatives Considered

**Completely separate desktop app:**
- Pros: Can optimize perfectly for desktop
- Cons: Double maintenance, duplicate UI code, slower to add features
- Rejected: Maintenance nightmare

**Web-only (no desktop):**
- Pros: Simpler deployment
- Cons: Loses offline-first, native integration advantages
- Rejected: Desktop is core to VxLLM vision

---

## ADR-009: citty for CLI

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** Low-Medium

### Context
VxLLM CLI needs to handle:
- Starting server (`serve`)
- Downloading models (`pull`)
- Running single inference (`run`)
- Listing models, processes, etc.

Options:
1. **Manual argv parsing:** Hand-roll argument parsing
2. **Commander.js:** Industry standard (React-style philosophy)
3. **citty:** Minimal, modern, by UnJS (same folks as h3, Nuxt)
4. **Yargs:** Heavy, lots of features

### Decision
**Use citty for CLI framework.**

### Rationale

**Minimalism:** Matches project philosophy (lightweight, focused).

**Modern:** Designed for modern JavaScript (async/await, top-level).

**UnJS Ecosystem:** Same authors as h3, Nuxt, antfu. Quality library.

**Type Safety:** Excellent TypeScript support.

**Pretty Output:** Built-in colored output, tables, status messages.

**Small:** Minimal footprint in CLI binary.

### Consequences

**Positive:**
- Lightweight CLI binary
- Modern design
- Good TypeScript support
- Easy to add commands

**Negative:**
- Smaller community than Commander.js
- Fewer pre-built integrations (e.g., shell completion generators)
- Less documentation (but minimal API = not much to document)

### Tradeoffs Accepted
- **Smaller ecosystem:** Fine for CLI (fewer integrations needed)

### Alternatives Considered

**Commander.js:**
- Pros: Huge ecosystem, lots of examples
- Cons: Heavy, overly complex for simple CLI
- Rejected: Overkill

**Manual argv parsing:**
- Pros: No dependency
- Cons: Error-prone, slow development
- Rejected: Premature optimization

---

## ADR-010: API Key Auth for Server Mode Only

**Status:** Accepted
**Date:** 2026-03-20
**Severity:** Medium

### Context
VxLLM supports two deployment modes:
1. **Desktop/Localhost:** App runs on user's machine (`HOST=127.0.0.1`)
2. **Server:** API exposed on network (`HOST=0.0.0.0` or remote IP)

Authentication strategy:
- Localhost is inherently private (can't be accessed remotely)
- Network-exposed server needs protection from unauthorized access

### Decision
**Require API key (Bearer token) only when `HOST` is not 127.0.0.1. No auth on localhost.**

### Rationale

**Network Security:** If the server is exposed to the network, any unauthenticated client could send unlimited requests (DoS), extract model weights, or consume VRAM.

**Localhost Trust:** Localhost (127.0.0.1) is only accessible from the local machine. The user is already "authenticated" (has code execution on that machine).

**Zero Friction for Desktop:** Tauri app doesn't need API key management; just run locally.

**Simple Implementation:** One Bearer token, validated on each request. No session management, JWT expiration, or refresh tokens needed in MVP.

**Env-driven:** `API_KEY` env var controls whether auth is enabled. Clear security model.

### Consequences

**Positive:**
- Simple mental model (localhost = no auth, network = auth)
- No token management complexity for desktop users
- Easy to enforce (single Hono middleware check)
- Clear security boundary

**Negative:**
- Localhost apps can't easily expose API to other machines
- No user/permission model (single API key, all-or-nothing)
- API key exposure (if in .env) is critical risk
- No audit trail (who made this request?)

### Future Improvements (Out of Scope for Phase 1)
- User/permission model
- Multiple API keys with scopes
- OAuth/OpenID Connect for server deployments
- Audit logging
- Rate limiting per key

### Tradeoffs Accepted
- **Single API key:** Acceptable for Phase 1; server deployments assume trusted network
- **No user model:** Added complexity not needed yet

### Alternatives Considered

**No auth anywhere:**
- Pros: Simplest
- Cons: Completely insecure if exposed to network
- Rejected: Dangerous default

**Auth everywhere (even localhost):**
- Pros: Consistent
- Cons: Bad UX for desktop (extra config), unnecessary complexity
- Rejected: Violates principle of least friction for default case

**OAuth/OpenID:**
- Pros: Standard, familiar to enterprises
- Cons: Massive complexity for Phase 1, requires user management backend
- Rejected: Too heavy

---

## Decision Matrix Summary

| ADR | Decision | Rationale | Confidence |
|-----|----------|-----------|------------|
| 001 | Hono+Bun | Speed, type safety, bundling | Very High |
| 002 | In-process inference | Latency, simplicity | Very High |
| 003 | Python voice sidecar | Best models + separation | High |
| 004 | Metal not MLX | Cross-platform unification | High |
| 005 | oRPC+Hono hybrid | Each for its strength | High |
| 006 | Drizzle+SQLite | Scalability, type safety | Very High |
| 007 | AI SDK | Streaming, hooks, type safety | Very High |
| 008 | Unified app | DRY, faster iteration | High |
| 009 | citty | Lightweight, modern | Medium |
| 010 | Auth for server only | Security vs. friction balance | High |

## Amendment Process

To amend an ADR:
1. Create a new ADR with "Amended by ADR-NNN"
2. Link old ADR to new one ("Superseded by ADR-NNN")
3. Document the change reason and date
4. Do not edit old ADRs; append amendments only

This preserves decision history for future maintainers.
