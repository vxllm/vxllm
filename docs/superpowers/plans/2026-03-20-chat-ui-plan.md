# Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full chat interface — resizable sidebar with conversation list, streaming message area with AI Elements, model selector, system prompt editor, keyboard shortcuts, and conversation persistence.

**Architecture:** TanStack Router file-based routes for `/chat` and `/chat/$conversationId`. `useChat` from `@ai-sdk/react` connects to `/v1/chat/completions` for SSE streaming. AI Elements render messages with markdown/code highlighting. oRPC via TanStack Query handles conversation CRUD. Sidebar uses shadcn `resizable` + `sidebar` components.

**Tech Stack:** React 19, TanStack Router, @ai-sdk/react (useChat), AI Elements (Message/MessageResponse), shadcn/ui (resizable, sidebar, command, sheet), oRPC + TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-20-chat-ui-design.md`

**AI SDK v6 key patterns:**
- `useChat({ transport: new DefaultChatTransport({ api: '/v1/chat/completions' }) })`
- Messages have `parts` array (not `content`): `message.parts.map(part => part.type === 'text' ? part.text : ...)`
- `sendMessage({ text })` to send (not `handleSubmit`)
- `status` is `'ready' | 'submitted' | 'streaming' | 'error'` (not `isLoading`)
- `stop()` to cancel streaming, `regenerate()` to redo last

---

## Task 1: Install dependencies + AI Elements

**Files:**
- Modify: `apps/app/package.json`
- Create: `apps/app/src/components/ai-elements/` (via npx)

- [ ] **Step 1: Install @ai-sdk/react and ai core**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/apps/app
bun add @ai-sdk/react
```

Verify `ai` is also available (should be in node_modules from llama-provider deps). If not: `bun add ai`.

- [ ] **Step 2: Install AI Elements**

```bash
cd /Users/rahulretnan/Projects/DataHase/vxllm/apps/app
npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/message.json
```

This installs the AI Elements `Message` and `MessageResponse` components via the shadcn registry. They handle streaming markdown rendering, code highlighting, and AI SDK message parts out of the box.

If the registry URL doesn't work, try:
```bash
npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/conversation.json
```

Or install components individually. Check https://elements.ai-sdk.dev for the latest registry URLs.

As a last resort fallback, install `react-markdown` and `shiki` manually:
```bash
bun add react-markdown @shikijs/rehype shiki
```

- [ ] **Step 3: Verify the install**

Check what was installed:
```bash
ls apps/app/src/components/ai-elements/ 2>/dev/null || ls packages/ui/src/components/ai-elements/ 2>/dev/null || echo "AI Elements not found - use fallback"
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(app): install @ai-sdk/react and AI Elements for chat UI"
```

---

## Task 2: Chat route structure + layout

**Files:**
- Create: `apps/app/src/routes/chat/route.tsx`
- Create: `apps/app/src/routes/chat/index.tsx`
- Create: `apps/app/src/routes/chat/$conversationId.tsx`
- Modify: `apps/app/src/routes/index.tsx` (redirect to /chat)
- Modify: `apps/app/src/routes/__root.tsx` (remove old header for chat layout)

- [ ] **Step 1: Read existing route files**

Read `apps/app/src/routes/__root.tsx` and `apps/app/src/routes/index.tsx` to understand current structure.

- [ ] **Step 2: Update index.tsx to redirect to /chat**

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/chat" });
  },
  component: () => null,
});
```

- [ ] **Step 3: Create chat/route.tsx (layout)**

This is the parent layout for all `/chat/*` routes. Uses shadcn `ResizablePanelGroup` for sidebar + main area:

```typescript
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@vxllm/ui/components/resizable";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

export const Route = createFileRoute("/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen">
      <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
        <ChatSidebar />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={78}>
        <Outlet />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

- [ ] **Step 4: Create chat/index.tsx (empty state / new chat)**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";

export const Route = createFileRoute("/chat/")({
  component: ChatEmptyState,
});
```

- [ ] **Step 5: Create chat/$conversationId.tsx (active conversation)**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";

export const Route = createFileRoute("/chat/$conversationId")({
  component: ActiveChat,
});

function ActiveChat() {
  const { conversationId } = Route.useParams();
  // useChat + oRPC integration here (Task 5)
  return (
    <div className="flex flex-col h-full">
      <ChatHeader conversationId={conversationId} />
      <ChatMessages conversationId={conversationId} />
      <ChatInput conversationId={conversationId} />
    </div>
  );
}
```

- [ ] **Step 6: Update __root.tsx**

The root layout currently renders a `<Header />` component. For the chat UI, the sidebar replaces the header. Either remove the Header from the root layout or make it conditional based on the route.

Simplest: remove the Header wrapper from root, let each route handle its own layout.

- [ ] **Step 7: Verify routes work**

```bash
bun run dev:app
```

Navigate to `http://localhost:3001` — should redirect to `/chat`. The page will be mostly empty since components aren't built yet.

- [ ] **Step 8: Commit**

```bash
git add . && git commit -m "feat(app): create chat route structure with resizable layout"
```

---

## Task 3: Chat sidebar

**Files:**
- Create: `apps/app/src/components/chat/chat-sidebar.tsx`
- Create: `apps/app/src/lib/chat.ts`

- [ ] **Step 1: Create chat helpers in lib/chat.ts**

```typescript
export function formatRelativeDate(timestamp: number): string {
  // Returns "Today", "Yesterday", "Last 7 days", or formatted date
}

export function groupConversationsByDate(conversations: Array<{ updatedAt: number; [key: string]: any }>) {
  // Groups into { today: [], yesterday: [], lastWeek: [], older: [] }
}

export function truncateTitle(title: string | null, maxLength = 40): string {
  if (!title) return "New conversation";
  return title.length > maxLength ? title.slice(0, maxLength) + "..." : title;
}
```

- [ ] **Step 2: Create chat-sidebar.tsx**

Uses shadcn components. Key elements:
- "New Chat" button at top (navigates to `/chat`)
- Search input (debounced via `useDebounce` from `@vxllm/ui/hooks/use-debounce`)
- Conversation list grouped by date
- Each conversation item: title, relative timestamp, click → navigate to `/chat/$id`
- Context menu on right-click: Delete (with AlertDialog confirmation)
- Bottom section: active model badge

Data source: `orpc.chat.listConversations.useQuery({ page: 1, limit: 50, search })`

Read `apps/app/src/utils/orpc.ts` to understand how to call oRPC procedures with TanStack Query. The pattern should be something like:
```typescript
import { orpc } from "@/utils/orpc";
const { data } = orpc.chat.listConversations.useQuery({ input: { page: 1, limit: 50 } });
```

Discover the exact TanStack Query integration pattern from the oRPC client setup.

- [ ] **Step 3: Test sidebar renders**

```bash
bun run dev:app
```

Navigate to `/chat` — sidebar should show with "New Chat" button and empty conversation list.

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(app): implement chat sidebar with conversation list and search"
```

---

## Task 4: Chat empty state

**Files:**
- Create: `apps/app/src/components/chat/chat-empty-state.tsx`

- [ ] **Step 1: Create empty state component**

Shows when at `/chat` with no active conversation:
- VxLLM logo/icon (use lucide `Bot` or `Cpu` icon)
- "Start a new conversation" heading
- 4 clickable example prompt cards in a 2x2 grid
- Currently loaded model name + context size at bottom

Example prompts:
1. "Explain quantum computing in simple terms"
2. "Write a Python function to sort a list"
3. "Help me debug this React component"
4. "What are best practices for REST API design?"

Clicking a prompt should navigate to `/chat` and pre-fill the input (or create a new conversation and send the message). Simplest: use a zustand store or URL search param to pass the initial prompt.

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "feat(app): add chat empty state with example prompts"
```

---

## Task 5: Chat messages + useChat integration

**Files:**
- Create: `apps/app/src/components/chat/chat-messages.tsx`
- Create: `apps/app/src/hooks/use-chat-persistence.ts`
- Modify: `apps/app/src/routes/chat/$conversationId.tsx`

This is the core task — wiring `useChat` to the server and rendering messages.

- [ ] **Step 1: Create use-chat-persistence.ts hook**

Custom hook that wraps `useChat` and adds conversation persistence:

```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { orpc } from "@/utils/orpc";

export function useChatWithPersistence(conversationId: string) {
  const chat = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: "http://localhost:11500/v1/chat/completions",
      // Headers for conversation tracking
      headers: {
        "X-Conversation-Id": conversationId,
      },
    }),
  });

  // Load existing messages from DB on mount
  // Sync with oRPC after streaming completes

  return {
    ...chat,
    // Add any extra state/methods
  };
}
```

**Important AI SDK v6 patterns:**
- Use `DefaultChatTransport` with `api` URL (not the v5 `api` parameter on useChat)
- `sendMessage({ text })` to send (not `handleSubmit`)
- `status` enum: `'ready' | 'submitted' | 'streaming' | 'error'`
- `messages` array has `parts` on each message (not `content`)
- `stop()` to cancel, `regenerate()` to redo

- [ ] **Step 2: Create chat-messages.tsx**

Renders the message list. Uses AI Elements `<Message>` if available, otherwise custom rendering with `message.parts`:

```typescript
import { ScrollArea } from "@vxllm/ui/components/scroll-area";

export function ChatMessages({ conversationId }: { conversationId: string }) {
  const { messages, status } = useChatWithPersistence(conversationId);

  return (
    <ScrollArea className="flex-1">
      {messages.map((message) => (
        <div key={message.id} className={/* user vs assistant styling */}>
          {/* Avatar */}
          {/* Message content via parts iteration or AI Elements */}
          {/* Use AI Elements <Message> component which handles all part types automatically */}
          {/* It renders text parts as markdown via Streamdown, and tool-* parts as tool call UI */}
          {/* If AI Elements not available, iterate message.parts manually: */}
          {/* part.type === "text" → render markdown */}
          {/* part.type starts with "tool-" → render tool call (v6 pattern: tool-<toolName>) */}
          {/* Actions: copy, regenerate, token stats */}
        </div>
      ))}
      {status === "streaming" && <StreamingIndicator />}
    </ScrollArea>
  );
}
```

If AI Elements `<Message>` component is available, use it instead of manual parts rendering — it handles markdown, code blocks, streaming, and tool calls automatically.

- [ ] **Step 3: Update $conversationId.tsx to use the hook**

Wire `useChatWithPersistence` into the active chat route. Pass `messages`, `sendMessage`, `status`, `stop` down to child components.

- [ ] **Step 4: Test streaming**

Start the server (`bun run dev:server`), load a model, then:
1. Open `http://localhost:3001/chat`
2. Create a conversation
3. Type a message and send
4. Verify streaming works (tokens appear one by one)

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat(app): implement chat messages with useChat streaming and AI Elements"
```

---

## Task 6: Chat input

**Files:**
- Create: `apps/app/src/components/chat/chat-input.tsx`

- [ ] **Step 1: Create chat-input.tsx**

Auto-growing textarea with send button and keyboard shortcuts:

```typescript
export function ChatInput({
  onSend,
  status,
  onStop,
  tokenCount,
  maxTokens,
}: {
  onSend: (text: string) => void;
  status: string;
  onStop: () => void;
  tokenCount?: number;
  maxTokens?: number;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!input.trim() || status === "streaming") return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && status === "streaming") {
      onStop();
    }
  };

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  return (
    <div className="border-t p-4">
      <div className="flex gap-2 items-end">
        <Textarea ref={textareaRef} value={input} onChange={...} onKeyDown={handleKeyDown}
          placeholder="Type a message..." className="min-h-[40px] max-h-[200px] resize-none" />
        {status === "streaming" ? (
          <Button variant="outline" size="icon" onClick={onStop}>⏹</Button>
        ) : (
          <Button size="icon" onClick={handleSend} disabled={!input.trim()}>↑</Button>
        )}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>⌘+Enter to send · Shift+Enter for newline</span>
        {tokenCount != null && maxTokens && (
          <span>{tokenCount.toLocaleString()} / {maxTokens.toLocaleString()} tokens</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "feat(app): implement chat input with auto-grow and keyboard shortcuts"
```

---

## Task 7: Chat header + model selector

**Files:**
- Create: `apps/app/src/components/chat/chat-header.tsx`
- Create: `apps/app/src/components/chat/model-selector.tsx`

- [ ] **Step 1: Create model-selector.tsx**

Combobox using shadcn `popover` + `command`:
- Lists downloaded models from `orpc.models.list.useQuery({ input: { status: "downloaded" } })`
- Groups: LLM models vs Embedding models
- Shows model name, quantization badge, size
- Selecting a model stores the preference (zustand or context)

- [ ] **Step 2: Create chat-header.tsx**

Top bar of the chat area:
- Conversation title (from oRPC query)
- Model selector component
- System prompt button (opens sheet — Task 8)
- During streaming: tok/s counter

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(app): implement chat header with model selector"
```

---

## Task 8: System prompt editor

**Files:**
- Create: `apps/app/src/components/chat/system-prompt-editor.tsx`

- [ ] **Step 1: Create system-prompt-editor.tsx**

shadcn `Sheet` that slides from the right:
- Textarea for custom system prompt
- Template dropdown with presets:
  - "General Assistant" (default)
  - "Code Assistant" — "You are an expert programmer..."
  - "Creative Writer" — "You are a creative writing assistant..."
- Save button → calls `orpc.chat.getConversation` to get current, then updates via oRPC or local state
- Reset to default button

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "feat(app): implement system prompt editor sheet"
```

---

## Task 9: Message actions (copy, regenerate, stats)

**Files:**
- Modify: `apps/app/src/components/chat/chat-messages.tsx`

- [ ] **Step 1: Add message actions**

For each assistant message, show on hover:
- **Copy button** — `navigator.clipboard.writeText(messageText)` + sonner toast "Copied!"
- **Regenerate button** — calls `regenerate()` from useChat (or `orpc.chat.regenerateLastMessage` for persisted conversations)
- **Token stats** — `{tokensOut} tokens · {latencyMs}ms · {tokensOut/latencyMs*1000} tok/s`

For user messages, show on hover:
- **Copy button** only

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "feat(app): add message actions (copy, regenerate, token stats)"
```

---

## Task 10: Keyboard shortcuts + command palette

**Files:**
- Create: `apps/app/src/components/chat/command-palette.tsx`
- Modify: `apps/app/src/routes/chat/route.tsx` (add global keyboard listener)

- [ ] **Step 1: Create command palette**

shadcn `CommandDialog` (Cmd+K):
- Search models and switch
- New conversation
- Toggle sidebar

- [ ] **Step 2: Add global keyboard shortcuts to chat layout**

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCommandOpen(true);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      navigate({ to: "/chat" });
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "s") {
      e.preventDefault();
      toggleSidebar();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(app): add command palette and keyboard shortcuts"
```

---

## Task 11: Mobile responsive + polish

**Files:**
- Modify: `apps/app/src/routes/chat/route.tsx`
- Modify: `apps/app/src/components/chat/chat-sidebar.tsx`

- [ ] **Step 1: Mobile sidebar as sheet**

On mobile (< 768px), replace resizable sidebar with shadcn `Sheet`:
- Hamburger button in chat header triggers sheet
- Use `useIsMobile()` hook from `@vxllm/ui/hooks/use-mobile`
- Sheet slides from left, contains same sidebar content

- [ ] **Step 2: Polish scrolling and auto-scroll**

- Auto-scroll to bottom when new messages arrive
- Show "scroll to bottom" FAB when user scrolls up
- Smooth scroll animation

- [ ] **Step 3: Loading states**

- Skeleton loading for conversation list
- Skeleton loading for message history
- Animated dots for streaming indicator

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(app): add mobile responsive sidebar and UI polish"
```

---

## Task 12: Final verification

- [ ] **Step 1: Type check**

```bash
bun run check-types
```

- [ ] **Step 2: Start both server and app**

```bash
# Terminal 1
bun run dev:server

# Terminal 2
bun run dev:app
```

- [ ] **Step 3: Test full flow**

1. Open `http://localhost:3001` — should redirect to `/chat`
2. See empty state with example prompts
3. Click an example prompt — should create new conversation and start streaming
4. Verify streaming works (tokens appear in real-time)
5. Verify markdown renders (bold, code blocks with highlighting)
6. Verify conversation appears in sidebar
7. Click sidebar conversation — loads history
8. Send another message — response streams
9. Test regenerate button
10. Test copy button + toast
11. Test model selector (shows downloaded models)
12. Test system prompt editor (sheet opens/closes)
13. Test search in sidebar
14. Test delete conversation (with confirmation)
15. Test keyboard shortcuts: Cmd+Enter, Escape, Cmd+K, Cmd+N
16. Test mobile view: resize browser < 768px, verify sheet sidebar

- [ ] **Step 4: Fix issues and commit**

```bash
git add . && git commit -m "fix: resolve chat UI verification issues"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Install deps + AI Elements | package.json, ai-elements/ |
| 2 | Route structure + resizable layout | routes/chat/*.tsx |
| 3 | Chat sidebar (conversations, search, groups) | chat-sidebar.tsx, lib/chat.ts |
| 4 | Empty state with example prompts | chat-empty-state.tsx |
| 5 | Messages + useChat streaming (core) | chat-messages.tsx, use-chat-persistence.ts |
| 6 | Chat input (auto-grow, keyboard) | chat-input.tsx |
| 7 | Header + model selector | chat-header.tsx, model-selector.tsx |
| 8 | System prompt editor | system-prompt-editor.tsx |
| 9 | Message actions (copy, regenerate, stats) | chat-messages.tsx |
| 10 | Command palette + keyboard shortcuts | command-palette.tsx |
| 11 | Mobile responsive + polish | route.tsx, chat-sidebar.tsx |
| 12 | Final verification | all |
