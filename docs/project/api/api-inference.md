# API: LLM Inference

**Status:** Draft
**Version:** 1.0
**Owner:** Rahul
**Last Updated:** 2026-03-20

## Overview

These are raw Hono routes that match OpenAI's wire format exactly. The server proxies all inference requests through `node-llama-cpp` via the Vercel AI SDK (`streamText()`, `generateObject()`), ensuring compatibility with existing OpenAI-based tooling.

All inference routes are public (no API key required on localhost; API key required for server mode).

---

## Endpoints Summary

| Method | Path | Purpose | Stream? | Auth |
|--------|------|---------|---------|------|
| POST | `/v1/chat/completions` | Chat inference (SSE or buffered) | Optional | Key (localhost exempt) |
| POST | `/v1/completions` | Raw text completion | Optional | Key (localhost exempt) |
| POST | `/v1/embeddings` | Generate vector embeddings | No | Key (localhost exempt) |
| GET | `/v1/models` | List available models | No | Key (localhost exempt) |

---

## Detailed Endpoints

### POST /v1/chat/completions

Chat inference endpoint. Supports both streaming (Server-Sent Events) and buffered responses.

#### Request Body

```typescript
interface ChatCompletionRequest {
  /**
   * Model ID or name (e.g., "mistral-7b-instruct", "neural-chat-7b-v3-1").
   * Must be a currently loaded model or downloading.
   */
  model: string;

  /**
   * Array of message objects representing conversation history.
   * Roles: "user" | "assistant" | "system"
   */
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;

  /**
   * Temperature for sampling: 0.0–2.0.
   * @default 0.7
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   * @default 2048
   */
  max_tokens?: number;

  /**
   * If true, response uses Server-Sent Events streaming format.
   * If false or omitted, response is buffered JSON.
   * @default false
   */
  stream?: boolean;

  /**
   * Nucleus sampling parameter: 0.0–1.0.
   * Only tokens with cumulative probability up to this value are sampled.
   * @default 1.0
   */
  top_p?: number;

  /**
   * Penalize tokens by repetition frequency: -2.0–2.0.
   * @default 0.0
   */
  frequency_penalty?: number;

  /**
   * Penalize tokens for having appeared in conversation: -2.0–2.0.
   * @default 0.0
   */
  presence_penalty?: number;

  /**
   * Stop sequences. Generation halts when any of these strings is generated.
   * @example ["###", "\n\n"]
   */
  stop?: string[];
}
```

#### Response: Non-Streaming (stream=false)

```typescript
interface ChatCompletionResponse {
  /**
   * Unique completion ID (format: "chatcmpl-{nanoid}").
   */
  id: string;

  /**
   * Object type, always "chat.completion".
   */
  object: "chat.completion";

  /**
   * Unix timestamp of creation.
   */
  created: number;

  /**
   * Model used.
   */
  model: string;

  /**
   * Finish reason: "stop" | "length" | "content_filter" | "tool_calls".
   */
  finish_reason: string;

  /**
   * Array with single choice object.
   */
  choices: Array<{
    index: 0;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: string;
  }>;

  /**
   * Token usage statistics.
   */
  usage: {
    /**
     * Tokens in the prompt.
     */
    prompt_tokens: number;

    /**
     * Tokens in the completion.
     */
    completion_tokens: number;

    /**
     * Total tokens (prompt + completion).
     */
    total_tokens: number;
  };
}
```

#### Response: Streaming (stream=true)

Server-Sent Events format. Each event is a JSON object on its own line, prefixed with `data: `.

```typescript
/**
 * Each SSE message (data: {...})
 */
interface ChatCompletionStreamEvent {
  /**
   * Unique completion ID, same across all events.
   */
  id: string;

  /**
   * Object type, always "chat.completion.chunk".
   */
  object: "chat.completion.chunk";

  /**
   * Unix timestamp.
   */
  created: number;

  /**
   * Model used.
   */
  model: string;

  /**
   * Choices array with delta (not message).
   */
  choices: Array<{
    /**
     * Always 0 (single stream).
     */
    index: 0;

    /**
     * Partial or final delta. May contain "content" and/or "tool_calls".
     */
    delta: {
      role?: "assistant";
      content?: string;
    };

    /**
     * Finish reason on final chunk. Omitted on intermediate chunks.
     * Values: "stop" | "length" | "content_filter"
     */
    finish_reason?: string;
  }>;

  /**
   * Usage present only on final event (finish_reason !== null).
   */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

**SSE Format Example:**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1710946800,"model":"mistral-7b-instruct","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1710946800,"model":"mistral-7b-instruct","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1710946800,"model":"mistral-7b-instruct","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}

data: [DONE]
```

#### Example Request

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-7b-instruct",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain quantum computing in 2 sentences."}
    ],
    "temperature": 0.7,
    "max_tokens": 256,
    "stream": false
  }'
```

#### Example Response (Non-Streaming)

```json
{
  "id": "chatcmpl-xyz789",
  "object": "chat.completion",
  "created": 1710946800,
  "model": "mistral-7b-instruct",
  "finish_reason": "stop",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Quantum computing harnesses quantum bits (qubits) to perform calculations exponentially faster than classical computers. Unlike classical bits, qubits exist in superposition, allowing parallel processing of multiple states simultaneously."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 28,
    "completion_tokens": 42,
    "total_tokens": 70
  }
}
```

---

### POST /v1/completions

Raw text completion (not chat-based).

#### Request Body

```typescript
interface CompletionRequest {
  /**
   * Model ID.
   */
  model: string;

  /**
   * Prompt text.
   */
  prompt: string;

  /**
   * Temperature: 0.0–2.0.
   * @default 0.7
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   * @default 2048
   */
  max_tokens?: number;

  /**
   * If true, stream as Server-Sent Events.
   * @default false
   */
  stream?: boolean;

  /**
   * Nucleus sampling: 0.0–1.0.
   * @default 1.0
   */
  top_p?: number;

  /**
   * Frequency penalty: -2.0–2.0.
   * @default 0.0
   */
  frequency_penalty?: number;

  /**
   * Presence penalty: -2.0–2.0.
   * @default 0.0
   */
  presence_penalty?: number;

  /**
   * Stop sequences.
   */
  stop?: string[];
}
```

#### Response: Non-Streaming

```typescript
interface CompletionResponse {
  id: string;
  object: "text_completion";
  created: number;
  model: string;

  choices: Array<{
    index: number;
    text: string;
    finish_reason: string;
  }>;

  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

#### Response: Streaming

```typescript
interface CompletionStreamEvent {
  id: string;
  object: "text_completion.chunk";
  created: number;
  model: string;

  choices: Array<{
    index: 0;
    text?: string;
    finish_reason?: string;
  }>;

  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

---

### POST /v1/embeddings

Generate vector embeddings for text input.

#### Request Body

```typescript
interface EmbeddingRequest {
  /**
   * Embedding model ID (e.g., "all-minilm-l6-v2").
   */
  model: string;

  /**
   * Text(s) to embed. Can be a single string or array of strings.
   */
  input: string | string[];

  /**
   * Encoding format: "float" or "base64".
   * @default "float"
   */
  encoding_format?: "float" | "base64";
}
```

#### Response Body

```typescript
interface EmbeddingResponse {
  /**
   * Object type, always "list".
   */
  object: "list";

  /**
   * Array of embedding objects.
   */
  data: Array<{
    /**
     * Index in the input array.
     */
    index: number;

    /**
     * Object type, always "embedding".
     */
    object: "embedding";

    /**
     * The embedding vector (array of floats or base64 string).
     */
    embedding: number[] | string;
  }>;

  /**
   * Model used.
   */
  model: string;

  /**
   * Token usage (may be approximate for embeddings).
   */
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}
```

#### Example Request

```bash
curl -X POST http://localhost:8000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "all-minilm-l6-v2",
    "input": ["hello world", "goodbye world"],
    "encoding_format": "float"
  }'
```

#### Example Response

```json
{
  "object": "list",
  "data": [
    {
      "index": 0,
      "object": "embedding",
      "embedding": [0.123, -0.456, 0.789, ...]
    },
    {
      "index": 1,
      "object": "embedding",
      "embedding": [0.124, -0.457, 0.790, ...]
    }
  ],
  "model": "all-minilm-l6-v2",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

---

### GET /v1/models

List all available models (installed, downloading, or available for download).

#### Query Parameters

None required. All models are returned.

#### Response Body

```typescript
interface ModelsListResponse {
  /**
   * Object type, always "list".
   */
  object: "list";

  /**
   * Array of model objects.
   */
  data: Array<{
    /**
     * Model ID (e.g., "mistral-7b-instruct").
     */
    id: string;

    /**
     * Object type, always "model".
     */
    object: "model";

    /**
     * Unix timestamp of model creation/addition.
     */
    created: number;

    /**
     * Owner identifier (e.g., "ollama", "huggingface").
     */
    owned_by: string;

    /**
     * Permission array (always []).
     */
    permission: [];
  }>;
}
```

#### Example Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "mistral-7b-instruct",
      "object": "model",
      "created": 1710946800,
      "owned_by": "ollama"
    },
    {
      "id": "neural-chat-7b-v3-1",
      "object": "model",
      "created": 1710946801,
      "owned_by": "ollama"
    }
  ]
}
```

---

## Error Responses

All endpoints use the standard OpenAI error format:

```typescript
interface ErrorResponse {
  error: {
    /**
     * Human-readable error message.
     */
    message: string;

    /**
     * Error type: "invalid_request_error" | "authentication_error" | "rate_limit_error" | "server_error"
     */
    type: string;

    /**
     * Parameter name that caused the error (if applicable).
     */
    param?: string;

    /**
     * Error code: "model_not_found" | "invalid_request" | "server_error" | "rate_limit_exceeded"
     */
    code?: string;
  };
}
```

### Common Error Codes

| HTTP Status | Code | Message |
|-------------|------|---------|
| 400 | `invalid_request` | Invalid request parameters. |
| 401 | `invalid_api_key` | Invalid or missing API key. |
| 404 | `model_not_found` | Model does not exist or is not loaded. |
| 429 | `rate_limit_exceeded` | Rate limit exceeded. |
| 500 | `server_error` | Internal server error. |

#### Example Error Response

```json
{
  "error": {
    "message": "Model 'unknown-model' not found.",
    "type": "invalid_request_error",
    "param": "model",
    "code": "model_not_found"
  }
}
```

---

## Authentication

- **Localhost (`127.0.0.1`, `localhost`):** No API key required.
- **Server mode (bound to external IP):** API key required.
  - Pass key via `Authorization: Bearer <API_KEY>` header.
  - Or query parameter: `?api_key=<API_KEY>`

---

## Implementation Notes

- **Streaming:** Uses Server-Sent Events (Content-Type: `text/event-stream`). Each event is JSON prefixed with `data: `.
- **Inference:** Proxied to `node-llama-cpp` via Vercel AI SDK `streamText()` for streaming and fallback to `generateObject()` for buffering.
- **Token counting:** Performed client-side using `js-tiktoken` or similar; may be approximate.
- **Model loading:** If model is not in memory, response is 404. Use model management API to pull/download first.

---

## Related Documentation

- [API: Model Management](./api-model-management.md)
- [API: Chat](./api-chat.md)
- [Architecture Overview](../architecture.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-20 | 1.0 | Initial draft. Full OpenAI-compatible inference endpoints. |
