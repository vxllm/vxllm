# Sub-project #6: Chat UI — Design Spec

> **Project:** VxLLM
> **Sub-project:** 6 of 14 — Chat UI
> **Date:** 2026-03-20
> **Status:** Approved
> **Layout:** Resizable panels (sidebar + main chat)
> **Message style:** Full-width alternating blocks
> **Streaming:** AI SDK `useChat` hook → `/v1/chat/completions`
> **Rendering:** AI Elements (Message, MessageResponse, CodeBlock)

---

## Context

This sub-project builds the React chat frontend for VxLLM. It connects to the Hono server's OpenAI-compatible API for streaming inference and oRPC endpoints for conversation management. The foundation (Sub-project #1) provides 38 shadcn/ui components, and the inference engine (Sub-project #2) provides working `/v1/chat/completions` with SSE streaming.

### Dependencies

- Sub-project #1 (Foundation): shadcn/ui components, TanStack Router, oRPC client
- Sub-project #2 (Inference Engine): `/v1/chat/completions` (streaming), `/v1/models`
- Sub-project #5 (oRPC Routes): chat.*, models.list procedures

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| Chat message area with streaming | Voice input/output (Sub-project #10) |
| Conversation sidebar with search + date grouping | Dashboard + settings pages (Sub-project #7) |
| AI Elements for message rendering (markdown, code, tool calls) | Model download UI (Sub-project #7) |
| Model selector dropdown | CLI interface |
| System prompt editor (sheet) | |
| Keyboard shortcuts (Cmd+Enter, Escape, Cmd+K) | |
| Copy message, regenerate last response | |
| Tokens/s display during streaming | |
| Context usage bar (tokens used / max) | |
| New chat empty state with example prompts | |
| Conversation deletion with confirmation | |
| Mobile responsive (sidebar → sheet) | |

---

## Component Architecture

```
apps/app/src/
├── routes/
│   ├── __root.tsx                   # MODIFY: add sidebar provider
│   ├── index.tsx                    # MODIFY: redirect to /chat
│   └── chat/
│       ├── route.tsx                # Chat layout (resizable sidebar + main)
│       ├── index.tsx                # New chat (empty state)
│       └── $conversationId.tsx      # Active conversation
├── components/
│   ├── chat/
│   │   ├── chat-sidebar.tsx         # Conversation list, search, new chat btn, date groups
│   │   ├── chat-header.tsx          # Conversation title, model selector, system prompt btn, settings
│   │   ├── chat-messages.tsx        # Scrollable message list using AI Elements
│   │   ├── chat-input.tsx           # Auto-grow textarea, send btn, context bar, voice btn placeholder
│   │   ├── chat-empty-state.tsx     # Welcome screen with example prompts
│   │   ├── model-selector.tsx       # Dropdown of downloaded models
│   │   └── system-prompt-editor.tsx # Sheet/dialog for editing system prompt
│   ├── ai-elements/                 # Installed via npx ai-elements
│   │   └── ...                      # Message, MessageResponse, CodeBlock, etc.
│   ├── header.tsx                   # EXISTING: may be simplified/removed
│   ├── mode-toggle.tsx              # EXISTING: dark/light toggle
│   └── theme-provider.tsx           # EXISTING: theme context
├── hooks/
│   └── use-chat-persistence.ts      # Syncs useChat with oRPC for DB persistence
└── lib/
    └── chat.ts                      # Helpers: format timestamps, truncate titles, etc.
```

---

## Layout Design

### Resizable Panels

Using shadcn `resizable` component (wraps `react-resizable-panels`):

```
┌──────────────────────────────────────────────────────┐
│ ┌─────────────┐ ║ ┌──────────────────────────────┐  │
│ │  Sidebar     │ ║ │  Header (title + model + ⚙️)  │  │
│ │             │ ║ ├──────────────────────────────┤  │
│ │ 🔍 Search   │ ║ │                              │  │
│ │             │ ║ │  Messages                    │  │
│ │ Today       │ ║ │  (AI Elements <Message>)     │  │
│ │  ▸ Conv 1   │ ║ │                              │  │
│ │  ▸ Conv 2   │ ║ │                              │  │
│ │             │ ║ │                              │  │
│ │ Yesterday   │ ║ ├──────────────────────────────┤  │
│ │  ▸ Conv 3   │ ║ │  Input (textarea + send)     │  │
│ │             │ ║ │  Context: 1,247/4,096 tokens │  │
│ │ ────────── │ ║ └──────────────────────────────┘  │
│ │ qwen2.5:7b │ ║                                    │
│ └─────────────┘ ║                                    │
└──────────────────────────────────────────────────────┘
```

- Sidebar default width: 280px, min 200px, max 400px
- Drag-resizable border between sidebar and chat
- On mobile (< 768px): sidebar becomes a sheet (slide-over), triggered by hamburger icon

### Message Rendering (Full-Width Blocks)

```
┌──────────────────────────────────────────┐
│ 👤  User                                  │  ← plain background
│     Explain how async/await works in JS   │
├──────────────────────────────────────────┤
│ 🤖  Assistant              32.4 tok/s    │  ← slightly darker bg
│                                          │
│     **Async/await** is syntactic sugar   │
│     built on Promises...                 │
│                                          │
│     ```javascript                        │
│     async function fetchData() {         │
│       const res = await fetch(url);      │
│       return res.json();                 │
│     }                                    │
│     ```                                  │
│                                          │
│     📋 Copy  🔄 Regenerate  84tok 1.2s  │
└──────────────────────────────────────────┘
```

- User messages: plain background, user icon
- Assistant messages: slightly darker background, AI icon
- Message actions (copy, regenerate, token stats) appear on hover or below message
- Streaming indicator: animated dots while generating, tok/s counter in header

---

## Data Flow

### Streaming Chat (Happy Path)

```
User types message → Cmd+Enter
  ↓
useChat.sendMessage({ text })
  ↓
POST /v1/chat/completions (stream: true)
  ↓
SSE chunks → useChat updates message state → AI Elements re-renders
  ↓
Stream complete (data: [DONE])
  ↓
use-chat-persistence hook:
  1. If new chat → orpc.chat.createConversation()
  2. orpc.chat.addMessage() for user message (if not already persisted)
  3. Assistant message already persisted by server route
  4. Invalidate conversation list query
  ↓
UI updates: sidebar shows new/updated conversation
```

### Loading Existing Conversation

```
User clicks conversation in sidebar
  ↓
Navigate to /chat/$conversationId
  ↓
orpc.chat.getMessages.useQuery({ conversationId })
  ↓
Load messages into useChat initial state
  ↓
Ready for new messages
```

### Regenerate Last Message

```
User clicks 🔄 Regenerate
  ↓
orpc.chat.regenerateLastMessage({ conversationId })
  ↓
Server: deletes last assistant msg, re-runs inference, persists new response
  ↓
Invalidate messages query → UI updates with new response
```

---

## Key Components

### `chat-sidebar.tsx`
- New Chat button (prominent, top of sidebar)
- Search input (filters conversations by title, debounced)
- Conversation list grouped by date (Today, Yesterday, Last 7 days, Older)
- Each item shows: title (truncated), timestamp, message count badge
- Active conversation highlighted
- Right-click context menu: Rename, Delete (with AlertDialog confirmation)
- Bottom: active model name + quantization badge

### `chat-header.tsx`
- Conversation title (editable inline)
- Model selector dropdown (shows downloaded models from `orpc.models.list`)
- System prompt button → opens sheet editor
- Settings gear icon (placeholder for Sub-project #7)
- During streaming: tok/s counter

### `chat-messages.tsx`
- Scrollable area using shadcn `scroll-area`
- Renders messages using AI Elements `<Message>` component
- Auto-scrolls to bottom on new messages
- Scroll-to-bottom FAB when scrolled up
- Loading skeleton while fetching history

### `chat-input.tsx`
- Auto-growing textarea (min 1 row, max 8 rows)
- Send button (disabled when empty or streaming)
- Context usage bar: `{used} / {max} tokens` with progress indicator
- Keyboard: `Cmd/Ctrl+Enter` sends, `Shift+Enter` newline, `Escape` stops streaming
- Voice button placeholder (disabled, icon only — wired in Sub-project #10)

### `chat-empty-state.tsx`
- VxLLM logo/icon
- "Start a new conversation" heading
- 4 example prompt cards (clickable → fills input):
  - "Explain quantum computing in simple terms"
  - "Write a Python function that..."
  - "Help me debug this React component"
  - "What are the best practices for..."
- Model info: currently loaded model name + context size

### `model-selector.tsx`
- Combobox/select dropdown using shadcn `command` + `popover`
- Shows model name, type badge, quantization, size
- Groups: Loaded (in memory) vs Downloaded (on disk)
- Selecting a non-loaded model triggers model load

### `system-prompt-editor.tsx`
- shadcn `sheet` (slides from right)
- Textarea for custom system prompt
- Template dropdown (general, code assistant, creative writing)
- Save button → updates conversation via oRPC
- Reset to default button

---

## Dependencies to Install

```bash
# AI Elements (shadcn registry)
cd apps/app && npx ai-elements@latest

# AI SDK React hooks
bun add @ai-sdk/react

# Additional if not already present
bun add react-markdown  # Streamdown may handle this
```

AI Elements installs as source code via shadcn registry into `components/ai-elements/`. Streamdown is included as the markdown renderer.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Send message |
| `Shift + Enter` | New line in input |
| `Escape` | Stop streaming / close sheets |
| `Cmd/Ctrl + K` | Command palette (model switch, new chat) |
| `Cmd/Ctrl + N` | New conversation |
| `Cmd/Ctrl + Shift + S` | Toggle sidebar |

---

## File Impact Summary

| Area | Files Created | Files Modified |
|------|--------------|----------------|
| `apps/app/src/routes/chat/` | 3 (route.tsx, index.tsx, $conversationId.tsx) | 0 |
| `apps/app/src/routes/` | 0 | 2 (__root.tsx, index.tsx) |
| `apps/app/src/components/chat/` | 7 (sidebar, header, messages, input, empty-state, model-selector, system-prompt) | 0 |
| `apps/app/src/components/ai-elements/` | ~10+ (installed via npx ai-elements) | 0 |
| `apps/app/src/hooks/` | 1 (use-chat-persistence.ts) | 0 |
| `apps/app/src/lib/` | 1 (chat.ts) | 0 |
| `apps/app/` | 0 | 1 (package.json — add deps) |
| **Total** | **~22+** | **3** |

---

## Success Criteria

- [ ] `/chat` route loads with empty state and example prompts
- [ ] New chat: typing + sending a message streams a response
- [ ] Streaming displays tokens in real-time via AI Elements `<Message>`
- [ ] Code blocks render with syntax highlighting (Streamdown)
- [ ] Conversation persists to DB after streaming completes
- [ ] Sidebar shows conversation list with date grouping
- [ ] Clicking a conversation loads its message history
- [ ] Search filters conversations by title
- [ ] Delete conversation works with confirmation dialog
- [ ] Model selector shows downloaded models
- [ ] System prompt editor opens as sheet and saves
- [ ] Regenerate replaces last assistant message
- [ ] Copy message copies content to clipboard with toast
- [ ] Context usage bar shows token count
- [ ] Tok/s displays during streaming
- [ ] Keyboard shortcuts work (Cmd+Enter, Escape, Cmd+K)
- [ ] Mobile responsive: sidebar becomes sheet
- [ ] `bun run check-types` passes
- [ ] `bun run dev:app` loads without errors

---

*Spec version: 1.0 | Approved: 2026-03-20*
