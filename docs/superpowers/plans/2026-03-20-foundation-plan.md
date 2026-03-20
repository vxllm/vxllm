# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the complete foundation layer for VxLLM — database schemas, environment config, shared configs, API contracts, package scaffolds, and UI component platform.

**Architecture:** 4-layer bottom-up approach. Layer 0 renames apps and scaffolds the marketing site. Layer 1 sets up core infrastructure (config, env, database). Layer 2 creates shared type contracts and package scaffolds. Layer 3 tears down existing UI components and reinstalls with radix-nova style + full component set.

**Tech Stack:** Bun, Turborepo, Drizzle ORM + SQLite, oRPC + Zod, shadcn/ui (radix-nova), Tailwind v4 (oklch), Geist fonts, Next.js (marketing site)

**Spec:** `docs/superpowers/specs/2026-03-20-foundation-design.md` (v2)

---

## Layer 0: Structural Renames & Scaffolding

### Task 1: Rename `apps/web` to `apps/app`

**Files:**
- Rename: `apps/web/` → `apps/app/`
- Modify: `apps/app/package.json`
- Modify: `/Users/rahulretnan/Projects/DataHase/vxllm/package.json` (root)
- Audit: `turbo.json` for any workspace-specific filters
- Audit: `packages/ui/src/styles/globals.css` `@source` paths

- [ ] **Step 1: Rename the directory**

```bash
mv apps/web apps/app
```

- [ ] **Step 2: Update package name in `apps/app/package.json`**

Change `"name": "web"` to `"name": "app"`.

- [ ] **Step 3: Update root `package.json` scripts**

Replace all `-F web` references with `-F app`:
```json
"dev:web": "turbo -F web dev"  →  "dev:app": "turbo -F app dev"
```

- [ ] **Step 4: Audit `turbo.json` for workspace-specific filters**

Check `turbo.json` for any `-F web` or `web`-specific references. The current `turbo.json` uses generic task definitions, but verify no filters reference `web`. Also verify `packages/ui/src/styles/globals.css` `@source "../../../apps/**/*.{ts,tsx}"` still resolves correctly (it uses a glob, so it will).

- [ ] **Step 5: Verify workspace resolution**

```bash
bun install
```

Expected: Succeeds with no errors. Bun resolves `apps/app` as a workspace package.

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "refactor: rename apps/web to apps/app"
```

---

### Task 2: Rename `apps/fumadocs` to `apps/docs`

**Files:**
- Rename: `apps/fumadocs/` → `apps/docs/`
- Modify: `apps/docs/package.json`

- [ ] **Step 1: Rename the directory**

```bash
mv apps/fumadocs apps/docs
```

- [ ] **Step 2: Update package name in `apps/docs/package.json`**

Change `"name": "fumadocs"` to `"name": "docs"`.

- [ ] **Step 3: Verify workspace resolution**

```bash
bun install
```

Expected: Succeeds. Bun resolves `apps/docs` as a workspace package.

- [ ] **Step 4: Add `dev:docs` script to root `package.json`**

Add: `"dev:docs": "turbo -F docs dev"`

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "refactor: rename apps/fumadocs to apps/docs"
```

---

### Task 3: Scaffold `apps/www` (Next.js marketing site)

**Files:**
- Create: `apps/www/package.json`
- Create: `apps/www/next.config.ts`
- Create: `apps/www/tsconfig.json`
- Create: `apps/www/src/app/layout.tsx`
- Create: `apps/www/src/app/page.tsx`
- Create: `apps/www/postcss.config.mjs`

- [ ] **Step 1: Create `apps/www/package.json`**

```json
{
  "name": "www",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@vxllm/ui": "workspace:*",
    "geist": "^1.3.1",
    "lucide-react": "catalog:",
    "next": "^16.2.0",
    "next-themes": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.2",
    "@types/node": "^22.13.14",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vxllm/config": "workspace:*",
    "postcss": "^8.5.3",
    "tailwindcss": "catalog:",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `apps/www/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vxllm/ui"],
};

export default nextConfig;
```

- [ ] **Step 3: Create `apps/www/tsconfig.json`**

**Note:** This initially uses the old config path. Task 4 will move it to `tsconfig/nextjs`, and Task 4 Step 9 must update this file to `"extends": "@vxllm/config/tsconfig/nextjs"`. For now, use inline settings:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["react", "react-dom", "node"]
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `apps/www/postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Create `apps/www/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";

import "@vxllm/ui/globals.css";

export const metadata: Metadata = {
  title: "VxLLM — Open Source Local AI Server",
  description:
    "Self-hostable AI model server with LLM inference, voice I/O, and OpenAI-compatible API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Create `apps/www/src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">VxLLM</h1>
      <p className="text-muted-foreground text-lg">
        Open source local AI model server — coming soon.
      </p>
    </main>
  );
}
```

- [ ] **Step 7: Install dependencies and verify**

```bash
bun install && bun run -F www build
```

Expected: Next.js build succeeds.

- [ ] **Step 8: Add dev:www script to root package.json**

Add: `"dev:www": "turbo -F www dev"`

- [ ] **Step 9: Commit**

```bash
git add . && git commit -m "feat: scaffold apps/www marketing site (Next.js)"
```

---

## Layer 1: Core Infrastructure

### Task 4: Expand `packages/config` with shared tsconfig presets

**Files:**
- Existing: `packages/config/tsconfig.base.json` (already has good settings)
- Create: `packages/config/tsconfig/react.json`
- Create: `packages/config/tsconfig/bun.json`
- Create: `packages/config/tsconfig/nextjs.json`
- Modify: `packages/config/package.json`

- [ ] **Step 1: Move existing base config into tsconfig/ directory and strip Bun types**

```bash
mkdir -p packages/config/tsconfig
mv packages/config/tsconfig.base.json packages/config/tsconfig/base.json
```

**IMPORTANT:** The existing `tsconfig.base.json` has `"types": ["bun"]` (line 20). This MUST be removed from `base.json` because `react.json` and `nextjs.json` extend it, and Bun types would leak into React/Next.js consumers. Only `bun.json` should add `"types": ["bun"]`.

Edit `packages/config/tsconfig/base.json` to remove the `"types": ["bun"]` line from `compilerOptions`.

- [ ] **Step 2: Create `packages/config/tsconfig/react.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "types": ["react", "react-dom"]
  }
}
```

- [ ] **Step 3: Create `packages/config/tsconfig/bun.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ESNext"],
    "types": ["bun"]
  }
}
```

- [ ] **Step 4: Create `packages/config/tsconfig/nextjs.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./react.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }]
  }
}
```

- [ ] **Step 5: Create `packages/config/eslint/base.js`**

Create a flat ESLint config with TypeScript-ESLint and import ordering. Install necessary dev dependencies in `packages/config`:

```bash
cd packages/config && bun add -d eslint @eslint/js typescript-eslint eslint-plugin-import-x
```

Then create the config file exporting a flat config array.

- [ ] **Step 6: Create `packages/config/tailwind/preset.ts`**

Create a shared Tailwind v4 preset that defines Geist font families, slate/blue color tokens, and the radius scale. This preset is imported by consumer `tailwind.config.ts` files (or via `@import` in CSS).

Note: With Tailwind v4, most config is CSS-based (already in `globals.css`). This preset file can export theme extension values for JS-based consumers if needed, or simply be a documentation anchor. The actual theme tokens are already defined in `packages/ui/src/styles/globals.css`.

- [ ] **Step 7: Update `packages/config/package.json` exports**

```json
{
  "name": "@vxllm/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tsconfig/*": "./tsconfig/*.json",
    "./eslint": "./eslint/base.js",
    "./tailwind": "./tailwind/preset.ts"
  }
}
```

- [ ] **Step 6: Update root `tsconfig.json`** to point to new path

```json
{
  "extends": "@vxllm/config/tsconfig/base"
}
```

- [ ] **Step 7: Update ALL consumer tsconfig.json files**

Search for any `tsconfig.json` referencing the old path and update to the appropriate new preset. Known consumers to update:

- `apps/app/tsconfig.json` → extend `@vxllm/config/tsconfig/react`
- `apps/www/tsconfig.json` → extend `@vxllm/config/tsconfig/nextjs`
- `apps/docs/tsconfig.json` → extend `@vxllm/config/tsconfig/nextjs` (if applicable)
- `apps/server/tsconfig.json` → extend `@vxllm/config/tsconfig/bun`
- All `packages/*/tsconfig.json` → extend `@vxllm/config/tsconfig/base`

Run `grep -r "tsconfig.base" --include="tsconfig.json"` to find any remaining old references.

- [ ] **Step 8: Verify type checking passes**

```bash
bun run check-types
```

- [ ] **Step 9: Commit**

```bash
git add . && git commit -m "feat: expand config package with react, bun, nextjs tsconfig presets"
```

---

### Task 5: Expand `packages/env` with full environment variables

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `packages/env/src/web.ts`

- [ ] **Step 1: Rewrite `packages/env/src/server.ts`**

```typescript
import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1).default("file:./local.db"),
    DATABASE_AUTH_TOKEN: z.string().min(1).optional(),
    PORT: z.coerce.number().min(1024).max(65535).default(11500),
    HOST: z.string().default("127.0.0.1"),
    MODELS_DIR: z.string().default("~/.vxllm/models"),
    VOICE_SIDECAR_URL: z.string().url().default("http://localhost:11501"),
    VOICE_SIDECAR_PORT: z.coerce.number().min(1024).max(65535).default(11501),
    API_KEY: z.string().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    DEFAULT_MODEL: z.string().optional(),
    CORS_ORIGINS: z.string().default("*"),
    MAX_CONTEXT_SIZE: z.coerce.number().default(8192),
    GPU_LAYERS_OVERRIDE: z.coerce.number().optional(),
    MAX_CONCURRENT_DOWNLOADS: z.coerce.number().min(1).max(5).default(2),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

- [ ] **Step 2: Rewrite `packages/env/src/web.ts`**

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.string().url().default("http://localhost:11500"),
    VITE_WS_URL: z.string().url().default("ws://localhost:11500"),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
```

- [ ] **Step 3: Update `apps/server/src/index.ts` CORS usage**

**IMPORTANT:** This step MUST happen in the same commit as Steps 1-2, or the server will crash because `env.CORS_ORIGIN` no longer exists.

In `/Users/rahulretnan/Projects/DataHase/vxllm/apps/server/src/index.ts`, find the cors middleware block (around lines 18-21):

```typescript
// REPLACE THIS:
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

// WITH THIS:
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGINS === "*" ? "*" : env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);
```

Also update the import at the top from `@vxllm/env/server` — the `env` object shape changes but the import stays the same.

- [ ] **Step 4: Update `apps/server/src/index.ts` to use PORT and HOST**

Replace `export default app;` at the bottom of the file with:

```typescript
export default {
  port: env.PORT,
  hostname: env.HOST,
  fetch: app.fetch,
};
```

This is the Bun.serve pattern for Hono — Bun reads `port`, `hostname`, and `fetch` from the default export.

- [ ] **Step 5: Create/update `.env.example` at project root**

```
DATABASE_URL=file:./local.db
# DATABASE_AUTH_TOKEN=
PORT=11500
HOST=127.0.0.1
MODELS_DIR=~/.vxllm/models
# VOICE_SIDECAR_URL=http://localhost:11501
# VOICE_SIDECAR_PORT=11501
# API_KEY=
LOG_LEVEL=info
# DEFAULT_MODEL=
CORS_ORIGINS=*
MAX_CONTEXT_SIZE=8192
# GPU_LAYERS_OVERRIDE=
# MAX_CONCURRENT_DOWNLOADS=2
VITE_SERVER_URL=http://localhost:11500
VITE_WS_URL=ws://localhost:11500
```

- [ ] **Step 6: Verify server starts**

```bash
bun run dev:server
```

Expected: Server starts on port 11500 without validation errors.

- [ ] **Step 7: Commit**

```bash
git add . && git commit -m "feat: expand env package with all VxLLM environment variables"
```

---

### Task 6: Create database schemas — models domain

**Files:**
- Create: `packages/db/src/schema/models.ts`
- Reference: `docs/project/database/schema-models.md`

- [ ] **Step 1: Create `packages/db/src/schema/models.ts`**

Implement the `models`, `tags`, `model_tags`, and `download_queue` tables exactly as defined in `schema-models.md`. Use the Drizzle code from that doc as the implementation reference, including all indexes.

Key points:
- `models.format` CHECK: `['gguf', 'whisper', 'kokoro']` (per ADR-004, no mlx)
- `download_queue.progress_pct` is `real` (not integer)
- `download_queue.priority` is `integer NOT NULL DEFAULT 0`
- `download_queue.error` (not `error_message`)
- All indexes from source doc must be present

- [ ] **Step 2: Verify file compiles**

```bash
cd packages/db && bunx tsc --noEmit src/schema/models.ts
```

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(db): add models, tags, model_tags, download_queue schemas"
```

---

### Task 7: Create database schemas — conversations domain

**Files:**
- Create: `packages/db/src/schema/conversations.ts`
- Reference: `docs/project/database/schema-conversations.md`

- [ ] **Step 1: Create `packages/db/src/schema/conversations.ts`**

Implement `conversations` and `messages` tables from `schema-conversations.md`.

Key points:
- `conversations.title` is **nullable** (no NOT NULL)
- `messages.audio_path` column must be present
- All indexes: `idx_conversations_updated`, `idx_messages_conversation`, `idx_messages_created`

- [ ] **Step 2: Verify file compiles**

```bash
cd packages/db && bunx tsc --noEmit src/schema/conversations.ts
```

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(db): add conversations and messages schemas"
```

---

### Task 8: Create database schemas — settings domain

**Files:**
- Create: `packages/db/src/schema/settings.ts`
- Reference: `docs/project/database/schema-settings.md`

- [ ] **Step 1: Create `packages/db/src/schema/settings.ts`**

Implement `settings` and `api_keys` tables from `schema-settings.md`.

Key points:
- `api_keys.permissions` has `DEFAULT '*'` and `.notNull()`
- Indexes: `idx_api_keys_hash` (UNIQUE), `idx_api_keys_prefix` (UNIQUE)

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "feat(db): add settings and api_keys schemas"
```

---

### Task 9: Create database schemas — metrics domain

**Files:**
- Create: `packages/db/src/schema/metrics.ts`
- Reference: `docs/project/database/schema-metrics.md`

- [ ] **Step 1: Create `packages/db/src/schema/metrics.ts`**

Implement `usage_metrics` and `voice_profiles` from `schema-metrics.md`.

Key points:
- `usage_metrics.latency_ms` is `NOT NULL`
- `voice_profiles.language` is `NOT NULL, DEFAULT 'en'`
- Indexes: `idx_metrics_model`, `idx_metrics_created`, `idx_metrics_type`, `idx_voice_profiles_default`

- [ ] **Step 2: Commit**

```bash
git add . && git commit -m "feat(db): add usage_metrics and voice_profiles schemas"
```

---

### Task 10: Create relations and schema index

**Files:**
- Create: `packages/db/src/schema/relations.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/index.ts` (update db client for optional auth token)

- [ ] **Step 1: Create `packages/db/src/schema/relations.ts`**

Define all Drizzle `relations()` in one file to avoid circular imports:
- `modelsRelations` — many modelTags, many downloadQueue, many conversations, many usageMetrics
- `tagsRelations` — many modelTags
- `modelTagsRelations` — one model, one tag
- `downloadQueueRelations` — one model
- `conversationsRelations` — one model, many messages
- `messagesRelations` — one conversation
- `usageMetricsRelations` — one model

- [ ] **Step 2: Update `packages/db/src/schema/index.ts`**

Replace `export {};` with re-exports of all tables and relations:

```typescript
export * from "./models";
export * from "./conversations";
export * from "./settings";
export * from "./metrics";
export * from "./relations";
```

- [ ] **Step 3: Update `packages/db/src/index.ts`**

Make `authToken` conditional (undefined when not set):

```typescript
const client = createClient({
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
});
```

This should already work since we made `DATABASE_AUTH_TOKEN` optional in Task 5. Verify the type is `string | undefined`.

- [ ] **Step 4: Generate migration and push schema**

```bash
bun run db:generate && bun run db:push
```

Expected: Migration files generated in the drizzle output directory. All 10 tables created in SQLite with correct columns, constraints, and indexes.

- [ ] **Step 5: Verify with Drizzle Studio**

```bash
bun run db:studio
```

Open the studio URL and verify all 10 tables are visible with correct schema.

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(db): add relations, wire up schema index, push all 10 tables"
```

---

## Layer 2: Shared Contracts

### Task 11: Create API schemas — common + openai

**Files:**
- Create: `packages/api/src/schemas/common.ts`
- Create: `packages/api/src/schemas/openai.ts`

- [ ] **Step 1: Create `packages/api/src/schemas/common.ts`**

Define shared Zod schemas:
- `PaginationInput` — cursor-based pagination (cursor optional string, limit 1-100 default 20)
- `PaginationOutput` — generic factory: `{ items: T[], nextCursor: string | null }`
- `SortInput` — `{ field: string, direction: "asc" | "desc" }`
- `ApiErrorResponse` — `{ code: string, message: string, details?: unknown }`
- `nanoid()` helper re-export or utility

- [ ] **Step 2: Create `packages/api/src/schemas/openai.ts`**

Define all OpenAI-compatible Zod schemas per the spec. Reference `docs/project/api/api-inference.md` and `docs/project/features/feature-api-compatibility.md` for exact format.

Key schemas: `ChatCompletionRequest`, `ChatCompletionResponse`, `ChatCompletionChunk`, `EmbeddingRequest`, `EmbeddingResponse`, `AudioTranscriptionRequest`, `AudioSpeechRequest`, `ModelObject`, `ModelListResponse`, `OpenAIError`.

- [ ] **Step 3: Verify types compile**

```bash
cd packages/api && bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(api): add common and OpenAI-compatible Zod schemas"
```

---

### Task 12: Create API schemas — domain schemas

**Files:**
- Create: `packages/api/src/schemas/models.ts`
- Create: `packages/api/src/schemas/chat.ts`
- Create: `packages/api/src/schemas/voice.ts`
- Create: `packages/api/src/schemas/settings.ts`
- Create: `packages/api/src/schemas/dashboard.ts`

- [ ] **Step 1: Create all 5 domain schema files**

Each file defines Zod schemas for its domain's oRPC procedure inputs and outputs. Derive types from the database schema (Task 6-9) to ensure consistency.

- `models.ts` — ModelFilter, ModelListOutput, ModelDownloadInput, DownloadStatusOutput, ModelSearchInput
- `chat.ts` — CreateConversationInput, ConversationOutput, MessageOutput, AddMessageInput
- `voice.ts` — VoiceProfileInput, VoiceProfileOutput, VoiceConfigInput (STT/TTS/VAD settings)
- `settings.ts` — SettingValue, CreateApiKeyInput, ApiKeyOutput (without hash), HardwareInfoOutput
- `dashboard.ts` — MetricsPeriod, MetricsSummaryOutput, UsageBreakdownOutput, HardwareStatusOutput

- [ ] **Step 2: Verify types compile**

```bash
cd packages/api && bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat(api): add domain Zod schemas for models, chat, voice, settings, dashboard"
```

---

### Task 13: Create oRPC router stubs

**Files:**
- Create: `packages/api/src/routers/model.router.ts`
- Create: `packages/api/src/routers/chat.router.ts`
- Create: `packages/api/src/routers/settings.router.ts`
- Create: `packages/api/src/routers/dashboard.router.ts`
- Modify: `packages/api/src/routers/index.ts`
- Modify: `packages/api/src/context.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Update `packages/api/src/context.ts`**

Add `db` reference to the context type:

```typescript
import type { Context as HonoContext } from "hono";
import { db } from "@vxllm/db";  // Value import, NOT type import (verbatimModuleSyntax enforces this)

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  return {
    db,
    auth: null,
    session: null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

Note: Import `db` from `@vxllm/db` — it's already a workspace dependency.

- [ ] **Step 2: Create all 4 router files**

Each router defines procedure stubs with correct input/output schemas from Task 12, but throws `new Error("Not implemented")` in every handler. Follow the exact procedure list from the spec (7 model, 7 chat, 7 settings, 3 dashboard = 24 total procedures).

**Note:** There is no `voice.router.ts` — voice schemas (from Task 12) exist for type-sharing, but voice endpoints are proxied directly to the Python sidecar via raw Hono routes, not through oRPC routers.

Example pattern:
```typescript
import { publicProcedure } from "../index";
import { z } from "zod";

export const modelRouter = {
  list: publicProcedure
    .input(z.object({ /* PaginationInput + filters */ }))
    .handler(async () => {
      throw new Error("Not implemented");
    }),
  // ... more procedures
};
```

- [ ] **Step 3: Update `packages/api/src/routers/index.ts`**

Merge all routers into `appRouter`, preserving the existing `healthCheck`:

```typescript
import { modelRouter } from "./model.router";
import { chatRouter } from "./chat.router";
import { settingsRouter } from "./settings.router";
import { dashboardRouter } from "./dashboard.router";
import { publicProcedure } from "../index";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  models: modelRouter,
  chat: chatRouter,
  settings: settingsRouter,
  dashboard: dashboardRouter,
};

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Update `packages/api/src/index.ts`**

Add schema re-exports so consumers can import types:

```typescript
export * from "./schemas/common";
export * from "./schemas/openai";
export * from "./schemas/models";
export * from "./schemas/chat";
export * from "./schemas/voice";
export * from "./schemas/settings";
export * from "./schemas/dashboard";
```

- [ ] **Step 5: Verify types compile and server starts**

```bash
bun run check-types && bun run dev:server
```

Expected: Type checking passes. Server starts and health check still returns "OK".

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(api): add oRPC router stubs with 24 typed procedures"
```

---

### Task 14: Scaffold `packages/inference`

**Files:**
- Create: `packages/inference/package.json`
- Create: `packages/inference/tsconfig.json`
- Create: `packages/inference/src/types.ts`
- Create: `packages/inference/src/constants.ts`
- Create: `packages/inference/src/hardware.ts`
- Create: `packages/inference/src/model-manager.ts`
- Create: `packages/inference/src/download.ts`
- Create: `packages/inference/src/registry.ts`
- Create: `packages/inference/src/index.ts`

- [ ] **Step 1: Create `packages/inference/package.json`**

```json
{
  "name": "@vxllm/inference",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "dependencies": {
    "@vxllm/env": "workspace:*",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "@vxllm/config": "workspace:*",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `packages/inference/tsconfig.json`**

```json
{
  "extends": "@vxllm/config/tsconfig/bun",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/inference/src/types.ts`**

Define all inference types from the spec: `HardwareProfile`, `ModelInfo`, `InferenceOptions`, `LoadedModel`, `DownloadProgress`. Use the exact type definitions from the spec (v2) which align with the database schema.

- [ ] **Step 4: Create `packages/inference/src/constants.ts`**

```typescript
export const DEFAULT_MODELS_DIR = "~/.vxllm/models";
export const DEFAULT_CONTEXT_SIZE = 8192;
export const MAX_CONCURRENT_DOWNLOADS = 2;
export const DEFAULT_PORT = 11500;

export const MODEL_TYPES = ["llm", "stt", "tts", "embedding"] as const;
export const MODEL_FORMATS = ["gguf", "whisper", "kokoro"] as const;

export const QUANTIZATION_TIERS = {
  Q4_K_S: { bitsPerWeight: 4.5, label: "Small (4-bit)" },
  Q4_K_M: { bitsPerWeight: 4.8, label: "Medium (4-bit)" },
  Q5_K_M: { bitsPerWeight: 5.7, label: "Medium (5-bit)" },
  Q8_0: { bitsPerWeight: 8.5, label: "High (8-bit)" },
  IQ3_M: { bitsPerWeight: 3.4, label: "Tiny (3-bit)" },
} as const;
```

- [ ] **Step 5: Create stub classes** (`hardware.ts`, `model-manager.ts`, `download.ts`, `registry.ts`)

Each file exports a class or function with the correct method signatures and JSDoc, but throws `Not implemented`. Example:

```typescript
// hardware.ts
import type { HardwareProfile } from "./types";

/** Detect system hardware capabilities */
export async function detectHardware(): Promise<HardwareProfile> {
  throw new Error("Not implemented");
}
```

- [ ] **Step 6: Create `packages/inference/src/index.ts`**

```typescript
export * from "./types";
export * from "./constants";
export { detectHardware } from "./hardware";
export { ModelManager } from "./model-manager";
export { DownloadManager } from "./download";
export { Registry } from "./registry";
```

- [ ] **Step 7: Install and verify**

```bash
bun install && cd packages/inference && bunx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add . && git commit -m "feat: scaffold packages/inference with types and class stubs"
```

---

### Task 15: Scaffold `packages/llama-provider`

**Files:**
- Create: `packages/llama-provider/package.json`
- Create: `packages/llama-provider/tsconfig.json`
- Create: `packages/llama-provider/src/types.ts`
- Create: `packages/llama-provider/src/llama-chat-model.ts`
- Create: `packages/llama-provider/src/llama-embedding-model.ts`
- Create: `packages/llama-provider/src/index.ts`

- [ ] **Step 1: Create `packages/llama-provider/package.json`**

```json
{
  "name": "@vxllm/llama-provider",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@vxllm/inference": "workspace:*",
    "ai": "^4.0.0",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "@vxllm/config": "workspace:*",
    "typescript": "^5"
  }
}
```

Note: The `ai` package version should match whatever is currently in use or the latest v4.x. Check the actual installed version during implementation.

- [ ] **Step 2: Create tsconfig.json, types.ts, and stub model classes**

- `types.ts` — `LlamaProviderSettings` (modelManager reference, default options)
- `llama-chat-model.ts` — Class implementing the AI SDK language model interface (stub)
- `llama-embedding-model.ts` — Class implementing AI SDK embedding model interface (stub)
- `index.ts` — `createLlamaProvider()` factory function

The exact interface to implement depends on the installed `ai` package version. Check what `LanguageModelV1` / `LanguageModelV2` etc. is exported and implement accordingly. All methods throw `Not implemented`.

- [ ] **Step 3: Install and verify**

```bash
bun install && cd packages/llama-provider && bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat: scaffold packages/llama-provider with AI SDK provider stubs"
```

---

## Layer 3: UI Platform

### Task 16: Teardown existing shadcn components

**Files:**
- Delete: `packages/ui/src/components/button.tsx`
- Delete: `packages/ui/src/components/card.tsx`
- Delete: `packages/ui/src/components/checkbox.tsx`
- Delete: `packages/ui/src/components/dropdown-menu.tsx`
- Delete: `packages/ui/src/components/input.tsx`
- Delete: `packages/ui/src/components/label.tsx`
- Delete: `packages/ui/src/components/skeleton.tsx`
- Delete: `packages/ui/src/components/sonner.tsx`

- [ ] **Step 1: Delete all existing components**

```bash
rm packages/ui/src/components/*.tsx
```

- [ ] **Step 2: Verify the web app still compiles (it won't — fix imports)**

The `apps/app/src/routes/__root.tsx` imports `@vxllm/ui/components/sonner`. This will break. Leave it broken for now — Task 18 will reinstall all components.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "refactor(ui): remove existing base-nova shadcn components for reinstall"
```

---

**WARNING:** Type checking (`bun run check-types`) will fail between Task 16 and Task 18 because `apps/app` imports deleted components. This is expected — Task 18 reinstalls them.

### Task 17: Update shadcn config and theme for radix-nova

**Files:**
- Modify: `apps/app/components.json` (shadcn config)
- Modify: `packages/ui/src/styles/globals.css`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Update `apps/app/components.json`**

Change style from `"base-nova"` to the target style. The current config already uses `"base-nova"` — if `"radix-nova"` is not recognized by shadcn CLI, keep `"base-nova"` as it is already a nova variant. Check `npx shadcn@latest init --help` for available styles.

The important configuration to verify/update:
- `"baseColor": "neutral"` → change to `"slate"` if the user wants slate tokens
- `"aliases.ui": "@vxllm/ui/components"` (already correct)

- [ ] **Step 2: Update font in `packages/ui/src/styles/globals.css`**

In the `@theme inline` block, change:
```css
--font-sans: "Inter Variable", sans-serif;
```
To:
```css
--font-sans: "Geist", sans-serif;
--font-mono: "Geist Mono", monospace;
```

**Note:** The `geist` npm package registers the font-family as `"Geist"` (not `"Geist Sans"`). The monospace variant is `"Geist Mono"`. Verify by checking the `@font-face` declarations in `geist/font/sans.css` during implementation.

- [ ] **Step 3: Add custom success/warning color tokens**

Add to both `:root` and `.dark` blocks in globals.css:

```css
/* :root (light) */
--success: oklch(0.59 0.2 145);
--success-foreground: oklch(1 0 0);
--warning: oklch(0.75 0.18 85);
--warning-foreground: oklch(0.2 0 0);

/* .dark */
--success: oklch(0.65 0.2 145);
--success-foreground: oklch(0.1 0 0);
--warning: oklch(0.7 0.15 85);
--warning-foreground: oklch(0.1 0 0);
```

And in `@theme inline`:
```css
--color-success: var(--success);
--color-success-foreground: var(--success-foreground);
--color-warning: var(--warning);
--color-warning-foreground: var(--warning-foreground);
```

- [ ] **Step 4: Install `geist` font package**

```bash
cd apps/app && bun add geist
```

- [ ] **Step 5: Update `apps/app/src/routes/__root.tsx` to load Geist fonts**

Import and apply Geist fonts. Since this is a Vite app (not Next.js), use CSS import:

```typescript
// At the top of __root.tsx, add:
import "geist/font/sans.css";
import "geist/font/mono.css";
```

The CSS variables `--font-sans` and `--font-mono` in globals.css will pick up Geist via the font-face declarations.

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "feat(ui): configure radix-nova theme with Geist fonts and oklch tokens"
```

---

### Task 18: Install full shadcn component set

**Files:**
- Create: ~35 component files in `packages/ui/src/components/`

- [ ] **Step 1: Install layout & navigation components**

```bash
cd apps/app && npx shadcn@latest add sidebar sheet tabs separator breadcrumb navigation-menu collapsible
```

Note: shadcn CLI uses the `components.json` config to place files in `packages/ui/src/components/`.

- [ ] **Step 2: Install data display components**

```bash
npx shadcn@latest add table card badge avatar tooltip accordion scroll-area progress
```

- [ ] **Step 3: Install form & input components**

```bash
npx shadcn@latest add button input textarea label checkbox radio-group select switch slider form
```

- [ ] **Step 4: Install feedback & overlay components**

```bash
npx shadcn@latest add dialog alert-dialog dropdown-menu context-menu popover sonner alert skeleton
```

- [ ] **Step 5: Install specialized components**

```bash
npx shadcn@latest add command resizable toggle toggle-group chart
```

- [ ] **Step 6: Verify all components installed**

```bash
ls packages/ui/src/components/ | wc -l
```

Expected: ~35 files.

- [ ] **Step 7: Verify app compiles**

```bash
bun run check-types
```

Expected: Type checking passes for all packages.

- [ ] **Step 8: Commit**

```bash
git add . && git commit -m "feat(ui): install full shadcn/ui component set (~35 components)"
```

---

### Task 19: Add shared UI hooks

**Files:**
- Create: `packages/ui/src/hooks/use-mobile.ts`
- Create: `packages/ui/src/hooks/use-debounce.ts`
- Delete: `packages/ui/src/hooks/.gitkeep` (if present)

- [ ] **Step 1: Create `packages/ui/src/hooks/use-mobile.ts`**

```typescript
import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
```

- [ ] **Step 2: Create `packages/ui/src/hooks/use-debounce.ts`**

```typescript
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

- [ ] **Step 3: Remove `.gitkeep` if present**

```bash
rm -f packages/ui/src/hooks/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat(ui): add shared hooks (useIsMobile, useDebounce)"
```

---

## Final Verification

### Task 20: End-to-end verification

- [ ] **Step 1: Full install**

```bash
bun install
```

Expected: No errors.

- [ ] **Step 2: Type check all packages**

```bash
bun run check-types
```

Expected: All packages pass type checking.

- [ ] **Step 3: Database push**

```bash
bun run db:push
```

Expected: All 10 tables created/updated successfully.

- [ ] **Step 4: Start server**

```bash
bun run dev:server
```

Expected: Hono server starts on port 11500, health check returns "OK".

- [ ] **Step 5: Start app**

```bash
bun run dev:app
```

Expected: Vite dev server starts, page loads with dark theme and Geist fonts.

- [ ] **Step 6: Start marketing site**

```bash
bun run dev:www
```

Expected: Next.js dev server starts on port 3000, placeholder page loads with dark theme.

- [ ] **Step 7: Verify schema matches source docs**

Open Drizzle Studio (`bun run db:studio`) and manually verify all 10 tables have correct columns, types, constraints, and indexes per the source docs in `docs/project/database/`.

- [ ] **Step 8: Final commit**

If any fixes were needed during verification:

```bash
git add . && git commit -m "fix: resolve verification issues in foundation layer"
```

---

## Summary

| Task | Layer | Description | Est. Steps |
|------|-------|-------------|-----------|
| 1 | 0 | Rename apps/web → apps/app | 5 |
| 2 | 0 | Rename apps/fumadocs → apps/docs | 4 |
| 3 | 0 | Scaffold apps/www | 9 |
| 4 | 1 | Config package tsconfig presets | 9 |
| 5 | 1 | Full environment variables | 7 |
| 6 | 1 | DB schemas — models domain | 3 |
| 7 | 1 | DB schemas — conversations domain | 3 |
| 8 | 1 | DB schemas — settings domain | 2 |
| 9 | 1 | DB schemas — metrics domain | 2 |
| 10 | 1 | DB relations + schema index + push | 6 |
| 11 | 2 | API schemas — common + openai | 4 |
| 12 | 2 | API schemas — domain schemas | 3 |
| 13 | 2 | oRPC router stubs | 6 |
| 14 | 2 | Scaffold packages/inference | 8 |
| 15 | 2 | Scaffold packages/llama-provider | 4 |
| 16 | 3 | Teardown existing components | 3 |
| 17 | 3 | Theme + Geist fonts config | 6 |
| 18 | 3 | Install full shadcn component set | 8 |
| 19 | 3 | Shared UI hooks | 4 |
| 20 | — | End-to-end verification | 8 |
| **Total** | | **20 tasks** | **~104 steps** |
