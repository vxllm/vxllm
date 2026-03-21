---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Workflow: Inference — Chat Completion

## Summary
Handles user chat messages from UI or API, routing through authentication, model loading, token generation, and response persistence. Supports both streaming (SSE) and non-streaming responses, structured output, and real-time metrics collection.

## Trigger
- User sends message via chat UI (useChat hook)
- POST request to `/v1/chat/completions` (OpenAI-compatible endpoint)

## Actors
- **Frontend** (React + AI SDK useChat)
- **Hono Server** (request routing, auth)
- **node-llama-cpp** (LLM inference)
- **Database** (Drizzle + SQLite)
- **Python Voice Service** (optional, if voice response enabled)

## Preconditions
- Server is running (Hono listening on configured port)
- Model is either already loaded or available on disk
- (Server mode) Valid API key provided in Authorization header
- Database schema initialized (messages, usage_metrics tables exist)

## Happy Path

### Step 1: User Initiates Chat
- User types message in chat UI and hits Send button
- OR external client makes POST request to `/v1/chat/completions`

### Step 2: Request Validation & Auth
- Frontend/client sends request:
  ```json
  POST /v1/chat/completions
  Authorization: Bearer <api-key> (server mode only)
  Content-Type: application/json

  {
    "model": "llama3.1:8b",
    "messages": [
      {"role": "user", "content": "What is AI?"},
      {"role": "assistant", "content": "..."},
      {"role": "user", "content": "Tell me more."}
    ],
    "stream": true,
    "max_tokens": 2048,
    "temperature": 0.7
  }
  ```
- Hono route handler receives request
- Request body validation (check required fields, message format)
- If validation fails → return 400 Bad Request with error details

### Step 3: Authentication (Server Mode Only)
- Auth middleware extracts Bearer token from Authorization header
- Queries settings table for valid API keys
- If token invalid/missing → return 401 Unauthorized
- If valid → continue to step 4

### Step 4: Model Resolution
- Extract model name from request body (e.g., "llama3.1:8b")
- Query models table to check if model is loaded in memory
- If not loaded:
  - Query models table for localPath
  - If localPath missing → return 503 Service Unavailable with message "Model not downloaded. Run `vxllm pull llama3.1:8b`"
  - Load model via node-llama-cpp:
    ```js
    const llama = await getLlama();
    const model = await llama.loadModel({modelPath: localPath});
    ```
  - Cache model in memory for subsequent requests
  - If load fails (file corrupted, OOM) → return 500 with detailed error

### Step 5: Prepare Request Parameters
- Build inference parameters from request:
  - system: default system prompt or user-provided
  - messages: format into chat template
  - temperature, top_p, top_k, max_tokens: apply to inference config
  - response_format: check for structured output (json_schema)
- Apply context window truncation if message history exceeds model's max_tokens:
  - Calculate token count for full conversation
  - If exceeds limit, remove oldest messages while keeping system prompt and most recent 2 messages
  - Log truncation event to metrics

### Step 6: Invoke AI SDK & Start Generation
- Call AI SDK `streamText()` (if stream=true) or `generateText()` (if stream=false):
  ```js
  const result = streamText({
    model: languageModel(llama, modelConfig),
    system: systemPrompt,
    messages: formattedMessages,
    temperature, max_tokens, ...
  });
  ```
- node-llama-cpp applies chat template (e.g., ChatML for Llama)
- Start token generation with configured sampler

### Step 7: Token Streaming (if stream=true)
- Tokens stream from node-llama-cpp one at a time
- Hono sends Server-Sent Events (SSE):
  ```
  data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

  data: {"choices":[{"index":0,"delta":{"content":" how"},"finish_reason":null}]}

  data: {"choices":[{"index":0,"delta":{"content":" can"},"finish_reason":null}]}
  ```
- Frontend receives SSE stream via useChat hook
- useChat appends each delta to the message text in real-time
- UI re-renders to display tokens as they arrive

### Step 8: Final Token & Stop Condition
- Model completes generation (token limit or natural stop token)
- Last SSE event includes finish_reason:
  ```
  data: {"choices":[{"index":0,"delta":{"content":"help?"},"finish_reason":"stop"}]}

  data: [DONE]
  ```
- Frontend detects [DONE] and completes useChat hook

### Step 9: Calculate Metrics
- After generation completes:
  - Calculate input_tokens: token count of messages sent to model
  - Calculate output_tokens: count of generated tokens
  - Calculate latency: time from request start to final token
  - Calculate cost (if applicable): based on token pricing config
  ```js
  metrics = {
    model: "llama3.1:8b",
    input_tokens: 45,
    output_tokens: 128,
    latency_ms: 2341,
    temperature, top_p, ...
  }
  ```

### Step 10: Persist Message & Response
- Build message records:
  ```js
  userMessage = {
    id: uuid(),
    role: "user",
    content: originalUserMessage,
    timestamp: now(),
    model: null
  }

  assistantMessage = {
    id: uuid(),
    role: "assistant",
    content: fullResponseText,
    timestamp: now(),
    model: "llama3.1:8b"
  }
  ```
- Upsert into messages table
- Store conversation_id to link messages (optional, for conversation grouping)

### Step 11: Record Metrics
- Upsert into usage_metrics table:
  ```js
  {
    timestamp: now(),
    model: "llama3.1:8b",
    input_tokens: 45,
    output_tokens: 128,
    latency_ms: 2341,
    source: "api" or "ui"
  }
  ```

### Step 12: Response Complete
- If stream=true: [DONE] already sent, connection closes
- If stream=false: return full JSON response:
  ```json
  {
    "id": "chatcmpl-...",
    "object": "text_completion",
    "created": 1710964800,
    "model": "llama3.1:8b",
    "choices": [{
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }],
    "usage": {
      "prompt_tokens": 45,
      "completion_tokens": 128,
      "total_tokens": 173
    }
  }
  ```

## Alternative Paths

### Non-Streaming Request (stream=false)
1. Client sends same request with `"stream": false`
2. Server buffers all tokens from node-llama-cpp (no SSE)
3. On completion, returns full JSON response as single HTTP 200 response
4. Metrics and persistence same as happy path

### Structured Output (response_format with json_schema)
1. Client sends request with:
   ```json
   "response_format": {
     "type": "json_schema",
     "json_schema": {
       "name": "person",
       "schema": {
         "type": "object",
         "properties": {
           "name": {"type": "string"},
           "age": {"type": "integer"}
         }
       }
     }
   }
   ```
2. Server uses AI SDK `generateObject()` instead of `streamText()`
3. node-llama-cpp applies grammar constraints to force valid JSON
4. Response validated against schema before persisting
5. If validation fails, retry up to 2 times, then return 400

### Vision/Multimodal (if image_url in message)
1. Client includes message with image_url:
   ```json
   {
     "role": "user",
     "content": [
       {"type": "text", "text": "What is in this image?"},
       {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
     ]
   }
   ```
2. Server checks if loaded model supports vision
3. If not supported → return 400 "Model does not support vision"
4. If supported → embed image tokens before text tokens
5. Proceed with normal inference

### Context Overflow with Truncation
1. If full message history + max_tokens exceeds context window:
   - Keep system prompt (always included)
   - Keep last 2 user-assistant exchanges (most recent context)
   - Remove oldest messages until token count is within limit
   - Log truncation to metrics table
2. Proceed with truncated conversation

### Long Response Timeout
1. If generation runs longer than configured timeout (e.g., 5 minutes):
   - Send stop signal to node-llama-cpp
   - Add finish_reason: "length" to last SSE event
   - Persist partial response to messages
   - Send [DONE]

## Failure Scenarios

### Model Not Loaded & File Missing
- **Symptom**: localPath in models table is NULL/empty
- **Response**: HTTP 503 Service Unavailable
  ```json
  {
    "error": {
      "message": "Model not downloaded",
      "type": "server_error",
      "instruction": "Run 'vxllm pull llama3.1:8b' to download the model"
    }
  }
  ```
- **Action**: Log error, alert admin if appropriate

### Model Load Failure (Corrupted File, OOM)
- **Symptom**: node-llama-cpp throws during model loading
- **Response**: HTTP 500 Internal Server Error
  ```json
  {
    "error": {
      "message": "Failed to load model",
      "details": "Corrupted model file or insufficient memory"
    }
  }
  ```
- **Action**:
  - Log full error stack
  - Attempt to clear model cache
  - Suggest re-downloading model via CLI

### Authentication Failure
- **Symptom**: Invalid or missing Bearer token
- **Response**: HTTP 401 Unauthorized
  ```json
  {
    "error": {
      "message": "Invalid API key",
      "type": "auth_error"
    }
  }
  ```
- **Action**: Log failed auth attempt (rate-limit if >10/min from same IP)

### Request Validation Failure
- **Symptom**: Missing required field, invalid JSON, invalid parameter type
- **Response**: HTTP 400 Bad Request
  ```json
  {
    "error": {
      "message": "Invalid request body",
      "details": "Field 'messages' is required"
    }
  }
  ```

### Inference Crash (Segfault, Exception)
- **Symptom**: node-llama-cpp crashes during token generation
- **Response**:
  - If crash before first token streamed: HTTP 500
  - If crash mid-stream: send error message in SSE, then [DONE]
- **Action**:
  - Unload model from memory
  - Log full crash dump
  - Attempt to auto-recover on next request (reload model)
  - Alert admin if crashes persist

### Database Connection Lost
- **Symptom**: Cannot write to messages or metrics table
- **Response**: HTTP 500 Internal Server Error
- **Action**:
  - Log error with timestamp
  - Attempt to reconnect to SQLite
  - If reconnection fails after 3 attempts, mark server as unhealthy
  - Do NOT crash the server; still serve inference but warn user

### Token Count Calculation Error
- **Symptom**: Token counter library throws or returns invalid count
- **Response**: Log error, use conservative estimate (assume all words = 1.3 tokens)
- **Action**: Proceed with inference; use estimated token count in metrics

### SSE Connection Interrupted
- **Symptom**: Client disconnects mid-stream or network drops
- **Response**:
  - node-llama-cpp stops generation
  - Partial response persisted (with finish_reason: "client_disconnect")
- **Action**: Log disconnection, clean up resources

## Permissions
- **Unauthenticated (Desktop Mode)**: Full access to all inference
- **API Key (Server Mode)**: Check Bearer token against settings.api_keys
- **Rate Limiting**: Per-key limits (optional, configurable in settings)

## Exit Conditions
- **Success**: [DONE] sent (streaming) or full JSON response returned (non-streaming)
- **User Cancel**: Client closes connection → server stops generation
- **Timeout**: Generation exceeds max_duration → send partial response with finish_reason: "length"
- **Error**: HTTP error response sent

## Data Changes

### Tables Written
- **messages**
  - Insert: user message, assistant response
  - Fields: id, role, content, timestamp, model, conversation_id, audio_path (if voice)

- **usage_metrics**
  - Insert: one row per inference
  - Fields: timestamp, model, input_tokens, output_tokens, latency_ms, source, temperature, top_p

### Tables Read
- **models** (check status, load localPath)
- **settings** (API keys, system prompt, inference defaults)

## Related Documentation
- `/docs/api/endpoints.md` — Detailed OpenAI-compatible endpoint specs
- `/docs/models/node-llama-cpp.md` — Model loading and inference config
- `/docs/deployment/server-mode.md` — API key setup
- `workflow-voice-chat.md` — Voice response flow
- `workflow-settings-update.md` — Inference parameter configuration

## Changelog
- **v1.0** (2026-03-20): Initial workflow documentation
  - Streaming and non-streaming paths
  - Structured output support
  - Context overflow truncation
  - Comprehensive failure scenarios
