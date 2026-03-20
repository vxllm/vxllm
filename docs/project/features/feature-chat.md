---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: Chat

## Summary

Conversational AI chat interface with real-time streaming responses, persistent conversation history, model selection, and OpenAI-compatible API. Provides intuitive UI for interacting with local LLMs plus server-side API for programmatic access.

## Problem Statement

Users need an intuitive, responsive chat interface to interact with local LLMs that:
1. **Feels responsive** — streaming tokens in real-time, not waiting for full response
2. **Persists conversations** — conversations aren't lost on app restart
3. **Supports model switching** — easily swap between models mid-conversation
4. **Shows performance** — visible token/s rate so users understand inference speed
5. **Integrates with tools** — OpenAI-compatible API so existing tools (Python scripts, integrations, other clients) work without modification

Currently, no local-first chat solution provides all five with good UX.

## User Stories

- As a casual user, I want to click "New Chat", type a question, and see the AI respond in real-time so the experience feels natural and interactive.
- As a researcher, I want to save conversations with all context (prompts, system message, model, settings) so I can reference them later or share with colleagues.
- As a power user, I want to switch between LLM models in the same conversation so I can compare responses without retyping my messages.
- As a developer, I want an OpenAI-compatible `/v1/chat/completions` endpoint so I can drop in VxLLM as a replacement for my existing API client.
- As an accessibility user, I want to see tokens/second metrics and full message latency so I can understand performance characteristics.
- As a privacy advocate, I want all conversations stored locally in an encrypted database (optional) so my data never touches cloud services.

## Scope

### In Scope
- **Chat UI**: React 19 component with message list, text input, send button
- **Streaming**: Server-Sent Events (SSE) for token-by-token streaming via AI SDK `useChat()` hook
- **Persistence**: SQLite storage of conversations (conversations table) and messages (messages table)
- **Conversation Management**: New conversation, conversation list sidebar, conversation title auto-generation, conversation deletion
- **Model Selector**: Dropdown to switch active model; selector shows hardware compatibility and VRAM estimate
- **System Prompt**: Customizable system prompt per conversation
- **Markdown Rendering**: Render message content as markdown with syntax-highlighted code blocks (react-markdown + shiki)
- **Message Actions**: Copy message to clipboard, regenerate last response, edit message (Phase 2)
- **Token Counter**: Display tokens/s in streaming responses; show context window fill % (current tokens / max tokens)
- **Conversation Search**: Full-text search across messages in a conversation (Phase 2)
- **OpenAI API**: `/v1/chat/completions` endpoint compatible with openai npm package and curl requests
- **Conversation Export**: Export conversation as JSON or Markdown (Phase 2)

### Out of Scope
- Multi-modal messages (image/file uploads) — Phase 2
- Function/tool calling UI (backend support Phase 1, UI Phase 2)
- Real-time collaboration or multi-user chat
- Conversation sharing links or public sharing
- Chat analytics or conversation statistics
- Message reactions or threading
- Full conversation editing (edit old messages and rerun inference)

## Requirements

### Must Have
1. Chat UI with message list, input field, and send button
2. Stream chat responses via SSE using AI SDK core; show tokens in real-time
3. Persist conversations and messages in SQLite with role (user/assistant), content, token_count, latency_ms
4. Render markdown with syntax-highlighted code blocks using react-markdown + shiki
5. Model selector dropdown; switching models clears current input and shows "Ready for {new_model}"
6. "New Conversation" button and sidebar list of previous conversations
7. System prompt textarea per conversation (editable, persisted)
8. Copy message button (copy to clipboard via native API)
9. Regenerate last response button (re-run inference with same context, new response)
10. Display tokens/s rate in streaming responses (e.g., "[32 tok/s]")
11. Show context usage (e.g., "1,200/4,096 tokens used")
12. OpenAI-compatible `/v1/chat/completions` POST endpoint accepting messages, temperature, top_p, max_tokens, model
13. Graceful error handling with retry buttons (e.g., "Inference failed: CUDA out of memory. Retry?")

### Should Have
1. Conversation title auto-generation from first user message (truncated to 50 chars)
2. Full-text search across messages (filter conversations by keyword)
3. Conversation deletion with confirmation
4. Message copy feedback ("Copied!" toast)
5. System prompt templates (dropdown: "Default", "Code Assistant", "Creative Writing")
6. Response regeneration with different temperature/top_p (advanced)
7. Keyboard shortcuts (Cmd/Ctrl+Enter to send, Escape to clear input)
8. Conversation list sorting (by date, alphabetical, last accessed)
9. Import conversation from file (JSON)

### Nice to Have
1. Message editing and re-inference (edit old message, regenerate all downstream messages)
2. Conversation branching (fork conversation at any point, diverge responses)
3. Conversation tagging and custom categorization
4. Dark mode toggle with persistence
5. Custom themes or color schemes
6. Typing indicator ("AI is thinking...")
7. Message timestamps with timezone support
8. Export as PDF with formatting
9. Voice chat integration (see feature-voice.md)

## UX

### Main Chat Screen

**Layout**
- Sidebar (left, ~250px): Conversation list + "New Chat" button at top
- Main area (right): Message thread, input area at bottom
- Top bar: Model selector dropdown, settings icon, export button

**Message Rendering**
- User message: Right-aligned, light background, no avatar
- Assistant message: Left-aligned, darker background, model icon avatar
- Code blocks: Syntax highlighting with language badge, copy-code button
- Inline code: Monospace font, subtle background
- Links: Blue, underlined, open in new tab
- Images: (Phase 2) Embedded thumbnails with lightbox

**Input Area**
- Textarea: Auto-grow with Shift+Enter for multi-line; Cmd/Ctrl+Enter sends
- Character counter: "234/2048" (if we implement limit)
- Typing indicator when AI is generating
- Context usage bar: Visual indication of tokens used in conversation

**Model Selector**
- Dropdown showing current model + VRAM estimate
- Switching shows confirmation: "Switch to Llama 3.1 8B? This will clear input."
- Green checkmark if sufficient VRAM; yellow warning if marginal; red error if insufficient

**Error States**
- "Connection lost. Retrying..."
- "Model not loaded. Download a model first."
- "Context window exceeded. Last message not sent."
- Inline error button: "Retry" or "Clear and start over"

**Empty States**
- Welcome screen with "Start a new chat" CTA, quick-start prompts (e.g., "Ask me anything", "Write a poem", "Explain this code")
- No models downloaded: "Download a model from Model Management to begin."
- First message: Show system prompt in tooltip on hover

### Conversation List Sidebar
- List of previous conversations with title truncation
- Last message preview (one line, truncated)
- Time indicator ("Today", "Yesterday", "2 weeks ago")
- Hover actions: Delete (trash icon), pin (star icon)
- Search box to filter conversations by title/content
- "New Chat" button at top with + icon

### Settings/Advanced Panel (Collapsible)
- System prompt textarea with character count and reset button
- Temperature slider (0.0 — 2.0 with 0.1 steps)
- Top-p slider (0.0 — 1.0 with 0.05 steps)
- Max tokens input (numeric, 1 — context_size)
- "Reset to defaults" button
- Conversation metadata (created_at, message_count, total_tokens)

## Business Rules

1. **Conversation-Model Binding**: Each conversation is tied to a single model (specified at creation). Changing model doesn't delete conversation but switches to that model's context.
2. **Message Persistence**: All messages (user and assistant) persisted with: role, content, token_count, finish_reason (stop, length, error), latency_ms, created_at, model_id, conversation_id
3. **Token Counting**: All displayed token counts via model's native tokenizer; shown in UI as discrete count or as fill % (e.g., "75%")
4. **Conversation Titles**: Auto-generated from first message on send (first 50 chars); user can edit title manually
5. **System Prompt**: Defaults to "You are a helpful AI assistant." Per conversation, user can override; persisted in database
6. **Streaming**: All assistant responses streamed via SSE; no buffering before first token
7. **Error Recovery**: Failed messages not persisted; user can retry from same input
8. **Message Ordering**: Messages ordered by created_at ascending (oldest first in thread)
9. **Deletion Cascade**: Deleting conversation deletes all messages; uses DB cascade on DELETE
10. **Session State**: No session expiry (local app); conversations persist indefinitely until user deletes

## Edge Cases

### Empty States
- **No conversations yet**: Show welcome screen with "Start a new chat" CTA and example prompts
- **No models downloaded**: Show setup screen "Download a model from Model Management first" with link/button to Model Management
- **Empty conversation** (created but no messages yet): Show input field ready to type
- **Archived/deleted model** (conversation references deleted model): Show warning "Original model no longer available. Choose a model to continue."

### Boundary Conditions
- **Very long response** (10k+ tokens): Render progressively; auto-scroll to bottom; no performance degradation
- **Very long conversation** (100+ messages): Implement virtual scrolling; only render visible messages; lazy-load more as user scrolls up
- **Very long single message** (2k+ tokens): Truncate in preview with "…" and "Show More" button; full message on click
- **Context window exceeded**: Stop generation and return response with note "[context limit reached at {token_count} tokens]"
- **Maximum conversation count** (e.g., 1000): No hard limit; warn user if > 500 (performance consideration)

### Permissions & Access
- No authentication in local app; all conversations are user's own
- (Cloud/multi-user Phase 2: would add user_id to conversations and messages)

### Concurrent Requests
- **User sends message while previous response streaming**: Queue new message until stream completes; show "Waiting for response..."
- **User rapidly clicks send multiple times**: Debounce send button; only one request at a time
- **User switches model while message streaming**: Cancel current stream, show confirmation, allow model switch
- **User deletes conversation while viewing it**: Redirect to empty state; show toast "Conversation deleted"

### Network Conditions
- **Server connection lost during streaming**: Detect SSE disconnect; show "Connection lost. Retry?" button
- **Server restarts during streaming**: Socket closes; catch error, offer "Retry" button; resume from same user message
- **Very slow response (> 30s)**: Show timeout warning after 10s; offer "Cancel" button; don't timeout automatically

### Data Integrity
- **Message saved to DB but streaming response fails**: Message persisted with response marked as failed (finish_reason: error); user sees "Generation failed" with retry button
- **Conversation metadata corrupted**: Detect via JSON parse error in Drizzle query; fall back to defaults; log error
- **Token count mismatch** (UI shows different count than saved): Re-count on load; update DB if discrepancy > 5%
- **Orphaned messages** (message references deleted conversation): Handled by DB cascade; shouldn't occur

### Time-Based
- **Conversation idle for weeks**: No auto-expiry (local app); stays accessible indefinitely
- **System clock adjusted backwards**: Timestamps may be out of order; tolerate with warning, don't break UI
- **Extremely fast inference** (< 100ms total): Show completion immediately; don't show loading spinner
- **Slow inference** (> 60s): Show time elapsed counter ("Generating... 45s")

### Concurrent Conversations
- **User opens same conversation in multiple tabs/windows**: Last write wins; no real-time sync (Phase 2 consideration)
- **User has 100+ conversations**: List remains responsive via virtualization; search mitigates scrolling

## Success Criteria

1. **Responsiveness**: First token appears in < 500ms from send button click
2. **Streaming**: Tokens appear in UI within 50-100ms of generation
3. **Persistence**: Conversations and messages survive app restart; state fully restored
4. **Rendering**: 100+ message conversations render and scroll smoothly without lag
5. **API Compatibility**: `curl -X POST http://localhost:8000/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"llama3.1:8b", "messages":[{"role":"user","content":"Hello"}]}'` returns valid OpenAI-format response
6. **Error Handling**: All error cases display user-friendly message with actionable next step (e.g., "Download model", "Retry")
7. **Token Accuracy**: Token count displayed matches actual model tokenizer count (< 1% variance)

## Dependencies

### Internal
- **React 19**: UI framework
- **Vite**: Build tool
- **TanStack Router**: Client-side routing (between chat, model management, settings)
- **Tauri 2**: Desktop container
- **@ai-sdk/react**: `useChat()` hook for streaming
- **ai core**: `streamText()` for server-side streaming
- **Drizzle ORM**: Database access
- **SQLite**: Persistent storage
- **Hono**: HTTP server (Chat endpoint)
- **oRPC**: Type-safe RPC for app routes

### External Libraries
- **react-markdown**: Parse and render markdown
- **shiki**: Syntax highlighting for code blocks
- **clsx** or **classnames**: Conditional className utility

### Runtime
- Inference engine running (feature-inference.md)
- At least one model downloaded and loaded

## Related Documentation

- **api-chat.md**: REST endpoints for chat and OpenAI compatibility
- **schema-conversations.md**: Database schema for conversations and messages tables
- **workflow-chat-send-message.md**: End-to-end flow from UI send → streaming response → persistence
- **workflow-model-switch.md**: Logic for switching models mid-conversation
- **feature-voice.md**: Voice chat integration with STT/TTS
- **feature-inference.md**: Underlying inference engine
- **feature-model-management.md**: Model selection and loading

## Open Questions

1. **Local Storage Encryption**: Should conversations be encrypted at rest? (Current: no; assume OS-level user isolation is sufficient)
2. **Message Editing**: Should users be able to edit old messages and regenerate all downstream responses? (Complex; Phase 2)
3. **Conversation Branching**: Should conversations support multiple branches (e.g., "try different response")? (Nice to have; Phase 2)
4. **Collaborative Chat**: Phase 2 — multi-user chat on same machine or network (would require user auth)
5. **Export Formats**: Which export formats are most valuable (JSON, Markdown, PDF)? Should exports be encrypted?

## Changelog

### v1.0 (2026-03-20) — Initial Draft
- Defined chat UI with streaming and persistence
- Specified OpenAI API compatibility
- Outlined conversation management and model switching
- Detailed all edge cases (empty, boundary, concurrent, network, data integrity, time-based)
- Success criteria covering performance, responsiveness, and reliability
