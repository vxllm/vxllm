---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# Glossary

This document defines all technical and domain-specific terms used throughout VxLLM documentation and codebase.

## Large Language Models

### Model
A trained neural network capable of generating human-like text responses. In VxLLM, models are quantized GGUF files downloaded from Hugging Face Hub. Models are immutable; the same model file always produces identical results given identical inputs.

### GGUF
**Format:** Quantized language model file format
**Full Name:** "Go Get Unified Format"
**Purpose:** Standardized format for storing quantized LLM weights
**Why Used:** Created by Georgi Gerganov for llama.cpp; now industry standard for local inference. Enables fast loading, efficient memory usage, and hardware-agnostic distribution.
**Example:** `mistral-7b-v0.3.Q4_K_M.gguf` (Mistral 7B model, Q4_K_M quantization)

### Quantization
**Definition:** Reducing the precision of model weights from high precision (float32, float64) to lower precision (int8, int4) to reduce file size and VRAM requirements while maintaining quality.

**Common Formats in VxLLM:**
- **Q4_K_M** ("K-quant 4-bit medium"): 4-bit quantization, very good quality/size tradeoff. Recommended for most users. ~4.5-5GB for 7B models.
- **Q5_K_M** ("K-quant 5-bit medium"): 5-bit quantization, slightly larger than Q4 but higher quality. ~5.5-6.5GB for 7B models.
- **Q8_0** (8-bit): Minimal quality loss but larger files. ~13GB for 7B models. Use when VRAM allows.
- **f16** (float16): Unquantized high precision. ~13GB for 7B models. Rarely used locally due to size.

**Tradeoffs:**
- Lower precision = smaller file, less VRAM, faster inference, slightly worse quality
- Higher precision = larger file, more VRAM, slower inference, better quality

**No Quantization:** Full precision weights. Impractical for local inference.

### Inference
The process of running a model forward pass to generate output (text) from input (prompt). In VxLLM, inference happens in-process via node-llama-cpp on the local machine or remote server.

### Token
A sub-word unit used by language models. Roughly 4 characters or 1 word in English, but varies by language and model. Models predict one token at a time. Token counting is important for rate limiting, cost estimation, and context window calculation.

**Example Tokenization:**
```
"hello world" → ["hello", " world"]  (2 tokens)
"ChatGPT"     → ["Chat", "GPT"]      (2 tokens)
```

### Context Window
**Definition:** The maximum number of tokens a model can consider when generating a response.
**Also Called:** Context length, context size
**VxLLM Default:** 2048 tokens (configurable via `MAX_CONTEXT_SIZE` env var)

**Composition:**
- Input tokens (user prompt + conversation history)
- Output tokens (model response, generated during inference)
- Total must not exceed context window

**Example:** A 2048-token context window might hold a 1500-token conversation history + 548-token new response.

### KV Cache
**Full Name:** Key-Value Cache
**Definition:** Cached attention weights computed during inference to avoid recomputation when predicting subsequent tokens.

**Memory Impact:**
- Proportional to context window size and model dimension
- Grows with each generated token
- Stored in VRAM during inference
- Cleared after response completes

**Optimization:** The `GPU_LAYERS_OVERRIDE` env var lets users trade off VRAM (move layers to CPU) vs. speed (keep in GPU).

### GPU Layers
**Definition:** The number of model layers offloaded to GPU (vs. running on CPU).
**Why Important:** More GPU layers = faster inference but higher VRAM usage. Fewer GPU layers = slower but fits on constrained hardware.

**Auto-Detection in VxLLM:**
- Detects available VRAM automatically
- Calculates safe GPU layer count
- Falls back to CPU if GPU memory insufficient
- Can be overridden via `GPU_LAYERS_OVERRIDE`

**Example:**
```
Mistral 7B Q4_K_M: ~5GB model
GPU with 8GB VRAM: Fit all layers (32/32)
GPU with 4GB VRAM: Fit ~16/32 layers, rest on CPU
GPU with 2GB VRAM: Fit ~8/32 layers, rest on CPU
```

### Prompt Template
**Definition:** The exact format and wrapping text used to structure user input for a specific model.
**Example (Mistral):**
```
[INST] {user_message} [/INST] {model_response}
```
**Importance:** Using the wrong template severely degrades quality. VxLLM auto-detects templates based on model name.

### Chat Template
**Definition:** The structured format for multi-turn conversations.
**Example Structure:**
```
<s>[INST] User: Hello [/INST] Assistant: Hi there! </s>
<s>[INST] User: How are you? [/INST] Assistant: I'm doing well! </s>
```
**Auto-Detection:** VxLLM inspects model card (Hugging Face) to determine correct format.

## Model Execution & Hardware

### Streaming
**Definition:** Generating and sending output text incrementally (one token at a time) instead of waiting for the full response.
**Benefit:** Users see text appear in real-time, feel lower latency
**Implementation:** HTTP Server-Sent Events (SSE) in REST API, WebSocket support in future

### Embeddings
**Definition:** Vector representations of text used for semantic similarity search.
**Current Status in VxLLM:** Not implemented in Phase 1 (focus on chat/generation)
**Future Use:** Enable semantic search over conversation history

### VRAM
**Full Name:** Video Random Access Memory
**Definition:** GPU memory used for storing model weights, KV cache, and intermediate activations during inference.
**Constraint:** Limited (typically 2-24GB on consumer hardware), determines maximum model size and batch size

**Estimation:**
```
Model size (GB) × precision_factor + KV cache (context × 2.5MB/layer)
```

### Metal (Apple Silicon)
**Definition:** Apple's low-level GPU programming framework, equivalent to CUDA for NVIDIA.
**VxLLM Support:** Auto-detected and used on macOS/M1/M2/M3 via node-llama-cpp
**Performance:** Comparable to CUDA, sometimes faster than NVIDIA on equivalent hardware
**Alternative to MLX:** VxLLM uses node-llama-cpp's Metal backend instead of MLX (both are excellent)

### CUDA
**Full Name:** Compute Unified Device Architecture
**Definition:** NVIDIA's parallel computing platform for GPU acceleration.
**VxLLM Support:** Auto-detected on systems with NVIDIA GPUs via node-llama-cpp
**Requirements:** NVIDIA GPU (GeForce, Tesla, etc.) + CUDA toolkit installed

### CPU
**Definition:** Central Processing Unit, fallback inference target when GPU unavailable.
**Performance:** Slowest but always available. A 7B model might take 20-30 seconds per response on CPU vs. 1-2 seconds on modern GPU.
**Optimization:** SSE (Streaming SIMD Extensions) used automatically on CPUs

### SSE
**Full Name:** Streaming SIMD Extensions
**Definition:** CPU instruction set for vectorized operations.
**VxLLM:** Auto-used for CPU inference; no configuration needed.

## Voice & Audio

### STT
**Full Name:** Speech-To-Text
**Definition:** Converting spoken audio to text transcription.
**VxLLM Implementation:** faster-whisper running in Python voice sidecar
**Use Case:** User speaks, audio converted to text, sent to LLM for processing

### TTS
**Full Name:** Text-To-Speech
**Definition:** Converting text to spoken audio.
**VxLLM Implementation:** Kokoro-82M running in Python voice sidecar
**Use Case:** Model's text response converted to audio and played back to user

### VAD
**Full Name:** Voice Activity Detection
**Definition:** Detecting when a user is speaking vs. silent (pause).
**VxLLM Implementation:** silero-vad running in Python voice sidecar
**Use Case:** Auto-stop recording when user finishes speaking (improves UX)

### Sidecar
**Definition:** A separate process that runs alongside the main application to handle specialized tasks.
**VxLLM Implementation:** Python FastAPI service on port 11501 handling STT/TTS/VAD
**Why Separate:** Python libraries (whisper, kokoro) are mature; easier to manage dependencies than mixing with Node.js
**Communication:** HTTP JSON API over localhost

## API & Protocol

### oRPC
**Full Name:** Object RPC
**Definition:** Type-safe remote procedure call system that exposes TypeScript objects as callable endpoints.
**VxLLM Use:** Internal API for app logic (chat, model management, settings)
**Benefits:** End-to-end type safety, zero serialization overhead in dev, TanStack Query integration
**Alternative:** Raw HTTP REST (used instead for OpenAI compatibility)

### Procedure
**Definition:** A callable function exposed via oRPC that performs a specific action.
**Examples:**
- `chat.createMessage` → Send a message and get streaming response
- `models.listAvailable` → List downloaded models
- `settings.update` → Update user preferences

### WebSocket
**Definition:** Bidirectional communication protocol for real-time data exchange over a single TCP connection.
**Current Status:** Not used in Phase 1 (HTTP polling/streaming used instead)
**Future Use:** Voice streaming, live collaboration, real-time metrics

### REST
**Full Name:** Representational State Transfer
**Definition:** HTTP-based API style using standard methods (GET, POST, PUT, DELETE) and resource-oriented URLs.
**VxLLM Implementation:** OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/models`, etc.)

## Database & Storage

### Model Registry
**Definition:** A catalog of available models with metadata (name, description, size, quantization variants, download URL).
**VxLLM Implementation:** `models.json` in root, curated list of recommended models
**Source:** Hugging Face Hub (models downloaded on-demand)

**Example Entry:**
```json
{
  "id": "mistral-7b",
  "name": "Mistral 7B",
  "variants": [
    {
      "quant": "Q4_K_M",
      "huggingface_id": "TheBloke/Mistral-7B-v0.3-GGUF"
    }
  ]
}
```

### Model Variant
**Definition:** A specific quantization of a model (e.g., same model in Q4_K_M and Q5_K_M).
**Purpose:** Users can choose tradeoff (quality vs. file size) for their hardware
**Example:** Mistral 7B has Q4_K_M (5GB), Q5_K_M (6.5GB), and Q8_0 (13GB) variants

## Frontend & UI

### Responsive Design
**Definition:** UI that adapts layout and styling based on screen size (mobile, tablet, desktop).
**VxLLM Approach:** Mobile-first with Tailwind breakpoints (sm, md, lg, xl)
**Tools:** TanStack Router for layout logic, Tailwind responsive utilities

### Dark Mode
**Definition:** Alternative color scheme (light text on dark backgrounds) to reduce eye strain.
**VxLLM Implementation:** next-themes (stores preference in localStorage), Tailwind dark: prefix
**Default:** System preference (light or dark based on OS)

### Streaming Response
**Definition:** Displaying model output character-by-character as it's generated, instead of waiting for completion.
**Frontend Handling:** @ai-sdk/react useChat hook manages streaming state
**Backend:** Hono streams response via HTTP chunked encoding
**UX Benefit:** Feels instant, builds engagement

## Deployment & Architecture

### Localhost
**Definition:** The local machine (127.0.0.1), accessible only from the same computer.
**VxLLM Default:** Binds to 127.0.0.1:11500 (no network exposure by default)
**Security:** No API key required when running on localhost
**Use Case:** Desktop app, development

### Server Mode
**Definition:** Running VxLLM with `HOST=0.0.0.0` to expose API on the network.
**Port:** Still 11500 (configurable via `PORT`)
**Security:** Requires `API_KEY` env var; clients must send Bearer token
**Use Cases:** Docker deployment, shared team instance, cloud server

### Docker
**Definition:** Containerization platform for packaging app with dependencies into isolated environments.
**VxLLM Use:** Multi-service compose (server + voice sidecar) for reproducible deployments
**Benefits:** Works on any OS, no dependency conflicts, easier scaling

### Monorepo
**Definition:** A single Git repository containing multiple projects/packages.
**VxLLM Structure:** apps (web, server, cli), packages (ui, db, api, inference, etc.), sidecar (voice), docker
**Tool:** Turborepo for task orchestration and caching

## Development & Operations

### Hot Reload
**Definition:** Auto-reloading app when source code changes without losing state.
**VxLLM Dev Experience:** Vite for React, Bun for server (both support HMR)
**Benefit:** Instant feedback loop during development

### Type Safety
**Definition:** Compile-time verification that variables, functions, and data conform to expected types.
**VxLLM Approach:** TypeScript everywhere (frontend, backend, API, database)
**Tools:** TypeScript compiler, Zod for runtime validation, oRPC for RPC typing

### ORM
**Full Name:** Object-Relational Mapping
**Definition:** Abstraction layer translating between SQL and object-oriented code.
**VxLLM Implementation:** Drizzle ORM (type-safe SQL generation)
**Benefit:** Less error-prone than raw SQL, TypeScript type inference

### Migration
**Definition:** A versioned database schema change (add column, create table, etc.).
**VxLLM Tooling:** Drizzle Kit auto-generates migrations
**Workflow:** Define schema in TypeScript → `bun db:generate` → `bun db:migrate` to apply

### CI/CD
**Full Name:** Continuous Integration / Continuous Deployment
**Current Status:** Not configured in Phase 1
**Future Use:** Auto-run tests, build, and deploy on push to main

## Audio & Media

### Server-Sent Events (SSE)
**Definition:** Browser API for server-to-client streaming over HTTP.
**VxLLM Use:** Streaming chat responses to frontend
**Advantages:** Simple, works over HTTP, built into browsers
**Alternative:** WebSocket (future consideration for voice streaming)

### ReadableStream
**Definition:** JavaScript API for reading data in chunks rather than all at once.
**VxLLM Use:** Model download progress tracking, response streaming
**Benefit:** Memory efficient for large downloads/responses

### Chunked Encoding
**Definition:** HTTP Transfer-Encoding mode that sends response body in chunks.
**VxLLM Use:** Streaming responses via Hono
**Header:** `Transfer-Encoding: chunked`

## Performance & Optimization

### Caching
**Definition:** Storing frequently-accessed data to avoid recomputation.
**Levels in VxLLM:**
- **HTTP Cache:** Browser caches static assets
- **Query Cache:** TanStack Query caches API responses with stale-time
- **KV Cache:** Model inference caches attention weights
- **GPU Memory:** Model weights cached after first load

### Lazy Loading
**Definition:** Deferring resource loading until needed.
**VxLLM Examples:**
- Code splitting: Route components loaded on-demand
- Image lazy loading: Chat images load when scrolled into view
- Model loading: Large models only loaded when selected

### Memoization
**Definition:** Caching function results to avoid redundant computation.
**VxLLM Use:** React.memo for expensive components, useMemo for derived state

## Security

### API Key
**Definition:** A secret token proving identity and authorization.
**VxLLM Use:** Required for server mode (`HOST=0.0.0.0`)
**Format:** Bearer token sent in `Authorization` header
**Storage:** Server-side only, never sent to frontend

### CORS
**Full Name:** Cross-Origin Resource Sharing
**Definition:** Browser security policy controlling which external sites can access the API.
**VxLLM Config:** `CORS_ORIGINS` env var (comma-separated whitelist)
**Default:** `http://localhost:5173,http://localhost:1430` (Vite dev + Tauri app)

### Authentication
**Definition:** Verifying the identity of a user or client.
**VxLLM Implementation:** API key for server mode (password-less on localhost)
**Future Consideration:** OAuth, OIDC (out of Phase 1 scope)

## Model Formats & Compatibility

### Hugging Face Hub
**Definition:** Central repository hosting 500,000+ open models
**VxLLM Integration:** @huggingface/hub SDK downloads models
**Model Organization:** User/org names like "TheBloke", "NeuralHermes"
**Benefits:** Community curation, version control, model cards with documentation

---

## Quick Reference Table

| Term | Category | Definition |
|------|----------|-----------|
| GGUF | Model Format | Quantized model file format |
| Q4_K_M | Quantization | 4-bit quantization (recommended) |
| Token | LLM | Sub-word unit for model I/O |
| Context Window | LLM | Max tokens model can process |
| KV Cache | Memory | Cached attention weights during inference |
| GPU Layers | Hardware | Model layers run on GPU |
| STT | Voice | Speech to text |
| TTS | Voice | Text to speech |
| VAD | Voice | Voice activity detection |
| oRPC | API | Type-safe RPC system |
| Streaming | Frontend | Incremental response generation |
| Sidecar | Architecture | Separate supporting process |
| ORM | Database | Object-relational mapping |
| Monorepo | DevOps | Single repo with multiple packages |

This glossary is a living document. New terms will be added as VxLLM evolves.
