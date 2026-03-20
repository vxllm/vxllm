---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: OpenAI API Compatibility

## Summary

Full OpenAI-compatible REST API endpoints enabling any existing OpenAI SDK client to work by changing `base_url` to a VxLLM instance. Implements chat completions with streaming, embeddings, audio transcription/speech, model listing, and health/metrics endpoints. All endpoints use raw Hono routes (not oRPC) to match OpenAI's exact wire format.

## Problem Statement

Users want to:
- Use existing OpenAI SDK code without rewriting for a new API
- Seamlessly switch between OpenAI and local VxLLM by changing a single parameter
- Integrate VxLLM into applications that expect OpenAI compatibility
- Use standard OpenAI tools and libraries (e.g., LangChain, LlamaIndex) with VxLLM
- Maintain code portability across different AI backends

Without API compatibility, users face vendor lock-in and must maintain separate codebases for different backends.

## User Stories

- **Developer**: As a developer, I want to use the OpenAI Python/JS SDK with VxLLM by just changing `base_url` so I can minimize code changes
- **Developer**: As a developer, I want `/v1/chat/completions` with SSE streaming identical to OpenAI's format so my streaming clients work unmodified
- **Developer**: As a developer, I want `/v1/audio/transcriptions` and `/v1/audio/speech` endpoints for voice so I can use audio features
- **Developer**: As a developer, I want `/v1/models` to list available models in OpenAI's format so my model selection UI works unchanged
- **DevOps**: As a DevOps engineer, I want `/health` and `/metrics` endpoints so I can integrate with monitoring systems
- **Integrator**: As an integrator, I want error responses in OpenAI format so my error handling works the same for both backends
- **User**: As a user, I want unsupported parameters to be ignored gracefully so old code doesn't break

## Scope

### In Scope
- **Text Generation**:
  - `POST /v1/chat/completions` - Chat completion (streaming SSE + non-streaming JSON)
  - `POST /v1/completions` - Legacy text completion (streaming + non-streaming)
  - `POST /v1/embeddings` - Text embeddings
- **Model Management**:
  - `GET /v1/models` - List available models in OpenAI format
- **Audio**:
  - `POST /v1/audio/transcriptions` - Speech-to-text (proxies to voice sidecar)
  - `POST /v1/audio/speech` - Text-to-speech (proxies to voice sidecar, supports streaming)
- **Real-time Audio**:
  - `WS /ws/audio/stream` - WebSocket for real-time STT (proxies to voice sidecar)
  - `WS /ws/chat` - Full voice chat loop (integrates LLM + voice sidecar)
- **System**:
  - `GET /health` - Server health check
  - `GET /metrics` - Prometheus-format metrics
- **Response Format**: Exact OpenAI format (id, object, created, model, choices, usage, error format)
- **Streaming Format**: Server-Sent Events (SSE) with `data: {...}\n\n` format and `[DONE]` sentinel
- **Authentication**: API key validation (in server mode only; localhost = no auth)
- **Error Format**: OpenAI error format: `{error: {message, type, code}}`

### Out of Scope
- Assistants API (v1/assistants, threads, runs)
- Files API (file uploads, file lists)
- Fine-tuning API
- Image generation API (DALL-E)
- Batch API
- Vision API (image analysis)
- Function calling (advanced features)
- Rate limiting per token (can do per-request)
- Cost tracking / billing

## Requirements

### Must Have
- **Chat Completions**: Exact OpenAI response format (id, object, created, model, choices[0].{message, finish_reason}, usage)
- **Streaming**: SSE format with `data: <json>\n\n`, each delta has choices[0].{delta, finish_reason}
- **[DONE] Sentinel**: Stream ends with `data: [DONE]\n\n`
- **Models Endpoint**: Returns `{object: "list", data: [{id, object: "model", owned_by, created, permission: [...]}]}`
- **Error Format**: `{error: {message: "...", type: "...", code: "..."}}`
- **Audio Transcription**: Accept multipart file, return `{text: "..."}`
- **Audio Speech**: Accept text + voice params, return audio bytes (with streaming support)
- **Token Counting**: Count tokens in usage field (prompts, completions, total)
- **Health Endpoint**: Return `{status: "ok", model: "current_model", uptime_seconds: 123}`
- **Metrics Endpoint**: Prometheus format with histogram/counter metrics
- **API Key Auth**: Validate via "Authorization: Bearer <key>" header in server mode
- **Graceful Unsupported**: Parameters like logprobs, function_call → ignore, don't error
- **Request ID**: Generate unique request_id, include in response headers and error context
- **Max Tokens Capping**: If max_tokens > context_size, cap at context_size and warn in response

### Should Have
- **Request/Response Logging**: Log all API calls with timestamp, model, tokens, latency
- **Timeout Handling**: Long-running inference doesn't timeout; client timeout respected
- **Connection Pooling**: Reuse connections for /v1/models, /health checks
- **Batch Streaming Optimization**: Combine multiple tokens before sending if arriving fast
- **Partial Streaming**: Stream initial tokens quickly, batch later ones for efficiency
- **Usage Tracking**: Count each call in usage_metrics table with endpoint, model, tokens, latency
- **Error Context**: Include request_id in error responses for debugging
- **Compression**: Support gzip/deflate request/response compression
- **HEAD Requests**: Support HEAD /health for fast liveness checks
- **CORS**: Configurable CORS origins (env var CORS_ORIGINS)

### Nice to Have
- **OpenAPI/Swagger**: Auto-generated docs endpoint (/docs)
- **Rate Limiting**: Per-key rate limits (enforced via API key permissions)
- **Token Streaming Callback**: Callback endpoint to POST chunks to (for WebSocket fallback)
- **Model Warming**: Background request to keep model in VRAM
- **Cache Warmup**: Batch similar requests to amortize overhead
- **Request Deduplication**: Cache identical requests for N seconds
- **Connection Upgrade**: Auto-upgrade to WebSocket for better streaming
- **Structured Outputs**: JSON schema support for structured responses (Phase 2)
- **Vision Support**: Image understanding (Phase 2)

## UX

### Entry Points
1. Any OpenAI SDK: Change `base_url` to `http://localhost:11500` or server URL
2. Direct HTTP: `curl http://localhost:11500/v1/chat/completions -X POST ...`
3. Browser: Navigate to `/health` for status or `/docs` for API docs

### Request/Response Examples

#### 1. Chat Completion (Streaming)
```
POST /v1/chat/completions

{
  "model": "llama3.1:8b",
  "messages": [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true
}

---

HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"id": "req-123", "object": "text_completion.chunk", "created": 1710964800, "model": "llama3.1:8b", "choices": [{"delta": {"role": "assistant", "content": "Hello"}, "finish_reason": null, "index": 0}]}

data: {"id": "req-123", "object": "text_completion.chunk", "created": 1710964800, "model": "llama3.1:8b", "choices": [{"delta": {"content": "!"}, "finish_reason": null, "index": 0}]}

data: {"id": "req-123", "object": "text_completion.chunk", "created": 1710964800, "model": "llama3.1:8b", "choices": [{"delta": {}, "finish_reason": "stop", "index": 0}], "usage": {"prompt_tokens": 42, "completion_tokens": 2, "total_tokens": 44}}

data: [DONE]
```

#### 2. Chat Completion (Non-streaming)
```
POST /v1/chat/completions

{
  "model": "llama3.1:8b",
  "messages": [{"role": "user", "content": "What's 2+2?"}],
  "stream": false
}

---

HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "req-456",
  "object": "chat.completion",
  "created": 1710964800,
  "model": "llama3.1:8b",
  "choices": [
    {
      "index": 0,
      "message": {"role": "assistant", "content": "2+2 equals 4."},
      "finish_reason": "stop"
    }
  ],
  "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
}
```

#### 3. Models List
```
GET /v1/models

---

HTTP/1.1 200 OK
Content-Type: application/json

{
  "object": "list",
  "data": [
    {
      "id": "llama3.1:8b",
      "object": "model",
      "created": 1710000000,
      "owned_by": "vxllm",
      "permission": [{"id": "modelperm-123", "object": "model_permission", "created": 1710000000, "allow": "all", "organization": "*"}]
    },
    {
      "id": "mistral:7b",
      "object": "model",
      "created": 1710000000,
      "owned_by": "vxllm",
      "permission": [...]
    }
  ]
}
```

#### 4. Audio Transcription
```
POST /v1/audio/transcriptions
Content-Type: multipart/form-data

file=<audio.mp3>
model=whisper-1
language=en

---

HTTP/1.1 200 OK
Content-Type: application/json

{
  "text": "This is the transcribed text."
}
```

#### 5. Error Response
```
POST /v1/chat/completions

{
  "model": "nonexistent",
  "messages": [{"role": "user", "content": "test"}]
}

---

HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "message": "Model not found: nonexistent",
    "type": "invalid_request_error",
    "code": "model_not_found",
    "param": "model"
  }
}
```

#### 6. Health Check
```
GET /health

---

HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "model": "llama3.1:8b",
  "uptime_seconds": 3600,
  "timestamp": 1710964800
}
```

## Business Rules

- **Exact Format Matching**: Response format must match OpenAI's exactly (field order, types, presence/absence of fields)
- **No API Key in Localhost**: Requests to 127.0.0.1 or localhost skip API key validation
- **Server Mode Auth**: In server mode (non-localhost), API key in Authorization header is required (401 if missing/invalid)
- **Streaming Chunks**: Each chunk includes full message delta (not just added content) for compatibility
- **Finish Reason**: Sent with last token's delta (finish_reason is null until stream ends)
- **Token Counting**: prompt_tokens from input, completion_tokens from output, total_tokens = sum
- **Model Name**: Request model name must match loaded model exactly (case-sensitive)
- **Unsupported Params**: logprobs, function_call, top_logprobs → log warning but process request normally
- **Max Tokens**: If max_tokens not specified, use context_size - prompt_tokens
- **Temperature**: Clamp to 0.0-2.0 (OpenAI range); warn if out of range
- **Timeout**: No timeout on inference (streaming continues as long as needed)
- **Error Type Mapping**: Map internal errors to OpenAI types (invalid_request_error, server_error, rate_limit_error, authentication_error)

## Edge Cases

### Empty Cases
- **No model loaded**: Return `{error: {message: "No model loaded", type: "server_error", code: "model_not_loaded"}}`
- **Empty messages array**: Return `{error: {message: "Messages cannot be empty", type: "invalid_request_error"}}`
- **Empty audio file**: Return `{error: {message: "Audio file is empty", type: "invalid_request_error"}}`
- **No models available**: GET /v1/models returns `{object: "list", data: []}`

### Boundary Cases
- **Unsupported parameter (logprobs)**: Log warning, ignore, process normally (don't error)
- **Max tokens exceeds context**: Cap at context_size - prompt_tokens, include warning in response metadata
- **Invalid model name**: Return 404 `{error: {message: "Model not found", type: "invalid_request_error"}}`
- **API key invalid format**: Return 401 `{error: {message: "Invalid API key", type: "authentication_error"}}`
- **Request body size exceeds limit (100MB)**: Return 413 `{error: {message: "Request too large", type: "invalid_request_error"}}`
- **Temperature out of range (> 2.0)**: Clamp silently to 2.0, no warning
- **Negative max_tokens**: Return error `{error: {message: "max_tokens must be positive", type: "invalid_request_error"}}`
- **Content-Type mismatch (multipart for non-audio)**: Return 400 error

### Concurrent Cases
- **Multiple streaming requests**: Queue handled by node-llama-cpp context sequences
- **Streaming request while non-streaming running**: Both proceed concurrently
- **Model change mid-stream**: Active streams continue with old model; new requests use new model
- **Server shutdown while streaming**: Stream abruptly closes (client receives incomplete data)
- **Network disconnect mid-stream**: Hono/Bun handles gracefully (stream ends at HTTP level)

### Data Integrity Cases
- **Corrupted request JSON**: Return 400 with parse error message
- **Token count mismatch**: Log warning, use best estimate from node-llama-cpp
- **Negative timestamp**: Use current time instead
- **Model name contains null byte**: Sanitize or reject
- **User content is extremely long (1M+ chars)**: Accept if within context size, warn if approaching limit
- **UTF-8 encoding issue in response**: Fall back to ASCII or return encoding error

## Success Criteria

- All endpoints return responses in exact OpenAI format (structure, field names, types)
- Streaming responses match OpenAI's SSE format (data: {...}\n\n with [DONE] sentinel)
- Models endpoint returns list of available models in OpenAI format
- API key validation works in server mode (401 for invalid/missing in non-localhost)
- Error responses include message, type, and code fields
- Token counting in usage field is accurate
- Unsupported parameters are ignored without error (graceful degradation)
- Max tokens are capped at context size and user is informed
- Health endpoint returns correct status and model info
- Metrics endpoint returns valid Prometheus format
- Streaming persists through network latency (tokens arrive when ready)
- Audio transcription/speech endpoints proxy correctly to voice sidecar
- WebSocket endpoints /ws/audio/stream and /ws/chat work for real-time audio
- Request IDs are unique and included in response headers
- CORS headers are set correctly (if configured)
- Compressed requests/responses work correctly (gzip/deflate)

## Dependencies

- **Hono**: Raw HTTP route handlers (not oRPC) for exact OpenAI format control
- **node-llama-cpp**: Core inference engine for chat completions
- **AI SDK**: ai core + ai-sdk-llama-cpp provider for token counting and structured output
- **Voice Sidecar (FastAPI)**: Proxied for /v1/audio/transcriptions, /v1/audio/speech, /ws/audio/stream
- **Bun**: HTTP server runtime
- **Drizzle + SQLite**: usage_metrics table for tracking API calls
- **packages/inference**: Model loading, inference, token counting
- **packages/db**: Settings, models, api_keys tables

## Related Docs

- `api-chat`: POST /v1/chat/completions implementation details
- `api-completions`: POST /v1/completions (legacy)
- `api-embeddings`: POST /v1/embeddings
- `api-models`: GET /v1/models
- `api-audio`: POST /v1/audio/transcriptions, POST /v1/audio/speech
- `api-voice`: WS /ws/audio/stream, WS /ws/chat
- `api-health`: GET /health, GET /metrics
- `workflow-inference-chat`: Full chat completion flow (validation, inference, response)
- `feature-cli`: CLI uses same API endpoints

## Open Questions

1. Should we support OpenAI's "functions" parameter for structured output?
2. Should we implement the Assistants API in the future?
3. Should we support vision/image understanding in the future?
4. Should we implement full function calling with tool use?
5. Should we support fine-tuning API for model adaptation?
6. Should we implement batching API for bulk requests?
7. Should we support prompt caching for repeated prompts?
8. Should we implement custom roles (beyond user/assistant/system)?
9. Should we support logit bias for controlling token probability?
10. Should we implement usage-based rate limiting (tokens/sec) or request-based only?

## Changelog

### v1.0 (2026-03-20)
- Initial feature specification
- Defined chat completions endpoint (streaming and non-streaming)
- Specified exact OpenAI response format (id, object, created, model, choices, usage)
- Defined streaming SSE format with [DONE] sentinel
- Specified models list endpoint in OpenAI format
- Defined audio transcription and speech endpoints (proxied to voice sidecar)
- Specified WebSocket endpoints for real-time audio (/ws/audio/stream, /ws/chat)
- Outlined error format and code mapping
- Specified API key authentication in server mode
- Defined health and metrics endpoints
- Specified token counting in usage field
- Listed boundary cases (unsupported params, max tokens, invalid model names)
- Defined concurrent streaming request handling
- Outlined graceful degradation for unsupported parameters
