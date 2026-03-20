# Contributing to VxLLM

Thank you for your interest in contributing to VxLLM! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Convention](#commit-convention)
- [Reporting Issues](#reporting-issues)
- [Community](#community)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Node.js](https://nodejs.org) >= 18 (for some tooling)
- [Python](https://python.org) >= 3.11 (for voice sidecar)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Rust](https://rustup.rs/) (only for Tauri desktop builds)
- [CMake](https://cmake.org/) >= 3.15 (for node-llama-cpp native build)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/DataHase/vxllm.git
cd vxllm

# Install dependencies
bun install

# Push database schema
bun run db:push

# Start development (all apps)
bun run dev
```

## Development Setup

### Monorepo Structure

VxLLM is a Turborepo monorepo with Bun workspaces:

```
vxllm/
├── apps/
│   ├── app/          # React + Vite + Tauri 2 (UI)
│   ├── server/       # Hono + Bun (API server)
│   ├── cli/          # citty (CLI tool)
│   ├── docs/         # Fumadocs (documentation)
│   └── www/          # Next.js (marketing site)
├── packages/
│   ├── inference/    # node-llama-cpp wrapper
│   ├── llama-provider/ # AI SDK adapter
│   ├── api/          # oRPC routers + Zod schemas
│   ├── db/           # Drizzle ORM schemas
│   ├── ui/           # shadcn/ui components
│   ├── env/          # Environment validation
│   └── config/       # Shared configs
├── sidecar/
│   └── voice/        # Python FastAPI (STT/TTS/VAD)
└── docker/           # Docker deployment
```

### Running Individual Apps

```bash
bun run dev:app          # React app (port 3001)
bun run dev:server       # API server (port 11500)
bun run dev:cli          # CLI
bun run dev:docs         # Documentation (port 4000)
bun run dev:www          # Marketing site (port 3000)
```

### Voice Sidecar

```bash
cd sidecar/voice
uv sync
uv run uvicorn app.main:app --port 11501
```

### Database

```bash
bun run db:push          # Push schema changes
bun run db:generate      # Generate migrations
bun run db:studio        # Open Drizzle Studio
```

### Type Checking

```bash
bun run check-types      # Check all packages
```

## How to Contribute

### Ways to Contribute

- **Report bugs** — File issues for bugs you encounter
- **Suggest features** — Open discussions for new ideas
- **Fix bugs** — Pick up issues labeled `good first issue` or `bug`
- **Add models** — Contribute to `models.json` with new model entries
- **Improve docs** — Fix typos, add examples, improve guides
- **Write tests** — Add test coverage for existing features
- **Translate** — Help translate the UI

### Contributing to `models.json`

The model registry (`models.json`) is the easiest way to contribute. To add a new model:

1. Find the model on [HuggingFace](https://huggingface.co)
2. Add an entry to `models.json`:

```json
{
  "name": "your-model:7b",
  "displayName": "Your Model 7B",
  "type": "llm",
  "format": "gguf",
  "description": "Description of the model",
  "tags": ["chat", "instruct"],
  "variants": [{
    "variant": "q4_k_m",
    "repo": "owner/repo-name-GGUF",
    "fileName": "model-q4_k_m.gguf",
    "sizeBytes": 4700000000,
    "minRamGb": 5,
    "recommendedVramGb": 6
  }]
}
```

3. Open a PR with the new entry

### Adding shadcn/ui Components

```bash
cd apps/app
npx shadcn@latest add <component-name>
```

Components are installed into `packages/ui/src/components/`.

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
3. **Make your changes** — follow the coding standards below
4. **Test** your changes:
   ```bash
   bun run check-types
   ```
5. **Commit** using the conventional commit format
6. **Push** and open a Pull Request

### PR Checklist

- [ ] Code compiles without errors (`bun run check-types`)
- [ ] New features include relevant documentation updates
- [ ] No unrelated changes included
- [ ] Commit messages follow conventional commits
- [ ] PR description explains the "why", not just the "what"

### Review Process

- All PRs require at least one maintainer review
- CI must pass (type checking, linting)
- Large features should be discussed in an issue first

## Coding Standards

### TypeScript

- **Strict mode** — All packages use `strict: true`
- **No `any`** — Use proper types. If you must, use `unknown` + type guards
- **Exports** — Use named exports, not default exports (except for route components)
- **Formatting** — Consistent with existing code (no specific formatter enforced yet)
- **Imports** — Use workspace aliases: `@vxllm/ui/components/button`, `@vxllm/inference`, etc.

### React

- **Server Components by default** (in Next.js apps)
- **`use client`** only when needed (interactivity, browser APIs)
- **Hooks** — Custom hooks in `hooks/` directory
- **Components** — One component per file, named after the file

### Python (Voice Sidecar)

- **Python 3.11+** — Use modern syntax (type hints, `match`, `|` unions)
- **uv** — Use uv for package management
- **FastAPI** — Follow FastAPI patterns (Pydantic models, dependency injection)

### Database

- **Drizzle ORM** — All database operations through Drizzle
- **Migrations** — Generate with `bun run db:generate`, don't write SQL manually
- **Nanoid IDs** — Text primary keys using `crypto.randomUUID()`
- **Timestamps** — Integer Unix epoch milliseconds

### Styling

- **Tailwind CSS v4** — Use utility classes
- **oklch()** — Color space for CSS variables
- **Geist** — Font family (Sans + Mono)
- **Dark-first** — Design for dark mode, support light mode
- **shadcn/ui** — Use existing components before building custom ones

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `refactor` | Code refactoring (no feature/fix) |
| `test` | Adding or updating tests |
| `chore` | Build, CI, tooling changes |
| `perf` | Performance improvement |

### Scopes

| Scope | Package/Area |
|-------|-------------|
| `app` | `apps/app` (React UI) |
| `server` | `apps/server` (Hono API) |
| `cli` | `apps/cli` (CLI tool) |
| `docs` | `apps/docs` (documentation) |
| `www` | `apps/www` (marketing site) |
| `inference` | `packages/inference` |
| `llama-provider` | `packages/llama-provider` |
| `api` | `packages/api` (oRPC) |
| `db` | `packages/db` (database) |
| `ui` | `packages/ui` (components) |
| `voice` | `sidecar/voice` (Python) |
| `tauri` | Tauri desktop |
| `docker` | Docker deployment |

### Examples

```bash
feat(app): add conversation search in sidebar
fix(server): handle empty message array in chat completions
docs: update API endpoint examples
refactor(inference): simplify GPU layer calculation
chore: update dependencies
```

## Reporting Issues

### Bug Reports

Include:
1. **Description** — What happened vs what you expected
2. **Steps to reproduce** — Minimal steps to trigger the bug
3. **Environment** — OS, hardware (GPU), Bun version, Node version
4. **Logs** — Server console output, browser console errors

### Feature Requests

Include:
1. **Problem** — What problem does this solve?
2. **Proposed solution** — How would you implement it?
3. **Alternatives** — What alternatives did you consider?

## Community

- **GitHub Issues** — Bug reports and feature requests
- **GitHub Discussions** — Questions, ideas, and general discussion
- **Pull Requests** — Code contributions

## License

By contributing to VxLLM, you agree that your contributions will be licensed under the [MIT License](LICENSE).
