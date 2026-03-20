---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: LLM Inference Engine

## Summary

In-process LLM inference via node-llama-cpp with automatic hardware detection (Metal/CUDA/Vulkan/CPU) and concurrent request handling. Provides streaming text generation, embeddings, structured output support, and tool calling capabilities without external dependencies.

## Problem Statement

Users need fast, deterministic local LLM inference without network latency, external API costs, or vendor lock-in. Current solutions either sacrifice performance (pure JS implementations), require complex setup (standalone binaries), or leak data to cloud services. VxLLM must deliver sub-second time-to-first-token and consistent throughput while adapting seamlessly to heterogeneous hardware (laptops with M-series chips, gaming PCs with NVIDIA GPUs, servers with CPU-only constraints).

## User Stories

- As a developer, I want to load a GGUF model and get streaming chat completions so I can build AI-powered apps locally with familiar APIs (OpenAI, Vercel AI SDK).
- As a desktop user, I want automatic hardware detection so the best GPU backend (Metal/CUDA/Vulkan) is selected without manual configuration or recompilation.
- As a server operator, I want concurrent request handling so multiple clients can use the same model simultaneously with fair resource allocation.
- As a privacy-conscious user, I want all inference to stay on my machine so no data leaves my network.
- As a performance engineer, I want fine-grained control over context size and layer offloading so I can optimize for my specific hardware limits.

## Scope

### In Scope
- GGUF model loading and validation via node-llama-cpp
- Streaming text generation with token-by-token output via AI SDK `streamText()`
- Embeddings endpoint (all-sentence-transformers-based models support)
- Structured output generation via `generateObject()` with JSON schema validation
- Tool/function calling with parameter binding and execution
- Automatic hardware detection and backend selection (Metal on macOS, CUDA on NVIDIA, Vulkan fallback, CPU default)
- Context management with KV cache optimization
- Concurrent request handling via context sequences
- Model info endpoint (context size, quantization, architecture)
- Token counting and context usage analytics

### Out of Scope
- MLX backend integration (potential Phase 2)
- Model training or fine-tuning
- Image generation or processing
- Multi-modal models (vision, audio inputs) — Phase 2+
- Model quantization or conversion tools
- Speculative decoding (Phase 2 optimization)
- Prompt caching with analytics (Phase 2)
- Model compilation or optimization

## Requirements

### Must Have
1. Load GGUF models from local filesystem via node-llama-cpp
2. Stream tokens via AI SDK `streamText()` with sub-100ms batching
3. Automatically detect GPU (Metal/CUDA/Vulkan) and set optimal layer offloading
4. Support standard chat templates (ChatML, Llama2, Mistral)
5. Embeddings endpoint returning float32 vectors
6. Handle concurrent requests with isolated context sequences
7. Graceful error handling with informative error messages (model not found, VRAM insufficient, invalid GGUF format)
8. Token counting via `countTokens()` for context budgeting

### Should Have
1. GPU layer override via environment variable or config file
2. Configurable context size with validation against model limits
3. Structured output generation via `generateObject()` with schema enforcement
4. Model hot-swap without server restart (queue swap requests, complete active inference first)
5. Token-per-second metrics in streaming responses
6. Context window resize mid-conversation with message truncation
7. System prompt management per conversation

### Nice to Have
1. Speculative decoding for token prediction speedup
2. Prompt caching for repeated sequences
3. Model benchmarking suite (throughput, latency per quantization)
4. Adaptive batching based on queue depth
5. Layer-wise memory profiling

## UX

The inference engine has no direct user-facing UI. It is exposed entirely through REST API endpoints consumed by:
- **Chat screen**: `/api/chat` endpoint with streaming responses
- **Dashboard**: Hardware stats card (GPU type, VRAM usage, model name, context fill %)
- **Model management screen**: Model selector dropdown + "Switch Model" button

Error states visible to users:
- "Model not loaded" → show CTA to download/load a model
- "Inference failed: out of VRAM" → recommend smaller model or quantization
- "Context window exceeded" → show tooltip explaining message limits
- Token/s rate shown in chat UI as `[24 tok/s]` indicator

## Business Rules

1. **Single Active Model**: Only one LLM model loaded at a time per model type. Loading a new model unloads the previous one.
2. **Pre-Download Requirement**: Model must be fully downloaded and verified before loading. If download incomplete, return 409 Conflict.
3. **Hardware Fallback**: If GPU VRAM insufficient for full layer offloading, automatically fall back to CPU layers. If total memory insufficient, return error with hardware recommendations.
4. **Context Isolation**: Each concurrent request gets an independent context sequence to prevent token interference.
5. **Token Counting**: All token counts (in requests, responses, context) use the model's native tokenizer.
6. **Error Transparency**: All inference errors include root cause (OOM, invalid GGUF, context overflow) so operators can remediate.

## Edge Cases

### Empty States
- **No models downloaded**: Calling inference returns 400 Bad Request with message "No models loaded. Download a model from Model Management first."
- **Model file missing**: Loaded model file deleted from disk returns 500 Internal Server Error on next request with "Model file not found at {path}. Reinitialize or redownload."

### Boundary Conditions
- **Context window exceeded**: Stop generation at max tokens; return partial response with note "[context limit reached]"
- **Model larger than available RAM**: Refuse to load with recommendation "Model requires 16GB VRAM, but only 8GB available. Try quantized variant or smaller model."
- **Very long input (e.g., 50k tokens)**: Acknowledge with context fill % in response headers; if exceeds 95%, warn user
- **Extremely long generation request (e.g., max_tokens=100k)**: Cap at safe limit (e.g., 4k tokens); log warning

### Permissions & Access
- No authentication layer at inference level (handled by Hono middleware); all requests assume authorized once routed to engine

### Concurrent Requests
- **Multiple chat requests on same model**: node-llama-cpp's context sequence system handles isolation; scale up to ~4-8 concurrent requests before performance degrades
- **Model swap during active inference**: Queue swap request; prevent swap until all in-flight requests complete (timeout 30s); return 202 Accepted
- **Rapid sequence of inference calls**: Batch tokens in 50-100ms windows to maximize throughput; return 429 Too Many Requests if queue depth exceeds threshold

### Network (Not Applicable)
- Inference is local; no network dependencies

### Data Integrity
- **Corrupted GGUF file**: Validate mxGraphModel header on load; reject with "Invalid GGUF format at {path}. Redownload model."
- **Partial/incomplete GGUF file**: Detect via file size vs. expected size; reject with "Model file incomplete: {size}B / {expected}B"
- **Model file modified during inference**: Detect via inode hash; log warning but continue (edge case, unlikely on most systems)

### Time-Based
- **Long inference (e.g., 30s for long response)**: No timeout imposed (local LLM can take time); UI shows loading indicator
- **Idle model in memory**: Keep loaded indefinitely unless explicitly swapped; no auto-unload timeout

## Success Criteria

1. **Performance**: Load 8B quantized (Q4_K_M) model in < 5 seconds; achieve 30+ tokens/second on M2 MacBook Air
2. **Concurrency**: Handle 4 concurrent chat requests without throughput degradation > 20%
3. **Accuracy**: Generated tokens match reference implementation (e.g., llama.cpp CLI); bit-identical output
4. **Reliability**: Zero crashes over 24-hour load test; handle all edge cases gracefully
5. **API Compliance**: OpenAI Chat Completions API compatibility (model, messages, system, temperature, top_p, max_tokens)

## Dependencies

### Internal
- node-llama-cpp (v0.2+): Core GGUF loader and inference engine
- AI SDK core: `streamText()`, `generateObject()`, `countTokens()` utilities
- AI SDK llama-cpp provider: Type-safe integration layer
- SQLite (via Drizzle): Metrics and configuration storage
- Hono: HTTP server routing and middleware

### External
- GGUF models (from HuggingFace Hub): Runtime dependencies
- Bun runtime: JavaScript execution

### Hardware
- Requires 4GB+ RAM for inference; 8GB+ recommended for 7B models
- GPU optional; Metal (Apple), CUDA (NVIDIA), Vulkan (AMD, Intel)

## Related Documentation

- **api-inference.md**: REST API endpoints for chat, embeddings, completions
- **schema-models.md**: Database schema for loaded model metadata
- **workflow-inference-chat.md**: End-to-end chat flow from UI to inference engine
- **workflow-model-load.md**: Model loading and validation pipeline
- **feature-model-management.md**: Model download and lifecycle

## Open Questions

1. **KV Cache Persistence**: Should KV cache be saved to disk to resume long conversations faster? (Currently recomputed on load.)
2. **Batch Size Tuning**: What is optimal batch size for token generation given common hardware? Should this be auto-tuned?
3. **Context Shifting**: For conversations exceeding context limit, should we implement sliding window (summarize old messages) or hard truncation?
4. **Multi-Model Loading**: Phase 2 feature — should we support multiple models (one LLM + one embedding model) or keep single-model constraint?

## Changelog

### v1.0 (2026-03-20) — Initial Draft
- Defined core LLM inference engine capabilities
- Specified hardware auto-detection (Metal/CUDA/Vulkan/CPU)
- Outlined streaming, embeddings, and structured output features
- Detailed edge cases and success criteria
