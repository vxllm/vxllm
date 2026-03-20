---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: CLI

## Summary

TypeScript CLI built with citty for managing VxLLM from the terminal. Provides commands to start the server, download/manage models, run interactive chat, list models, monitor running processes, and view hardware profiles. Shares packages/inference and packages/db code with the main server for consistency.

## Problem Statement

Developers need a lightweight, scriptable way to:
- Start the VxLLM server without opening a GUI
- Download and manage GGUF models from HuggingFace registry
- Test models interactively without the web UI
- List installed models and view their status
- Monitor running models and memory usage
- Understand hardware capabilities and get optimization recommendations
- Integrate VxLLM into CI/CD pipelines and automation workflows

Without a CLI, users are forced to use the desktop app for all operations, limiting automation and scriptability.

## User Stories

- **Developer**: As a developer, I want `vxllm serve` to start the server so I can use it from any OpenAI SDK without opening the GUI
- **Developer**: As a developer, I want `vxllm pull llama3.1:8b` to download models so I can get started quickly without manual downloads
- **Developer**: As a developer, I want `vxllm run llama3.1:8b` for interactive CLI chat so I can test models without a UI
- **Developer**: As a developer, I want `vxllm list` to see installed models so I know what's available locally
- **DevOps**: As a DevOps engineer, I want `vxllm ps` to see running models and memory usage so I can monitor running instances
- **User**: As a user, I want `vxllm info` to see my hardware profile so I know what models will run well
- **Developer**: As a developer, I want `vxllm rm llama3.1:8b` to delete models so I can free up disk space
- **Operator**: As an operator, I want `--json` output for all commands so I can parse results in scripts
- **Developer**: As a developer, I want model name auto-complete in the shell so I can discover models quickly

## Scope

### In Scope
- **Commands**:
  - `vxllm serve [--port 11500] [--host 127.0.0.1] [--model llama3.1:8b]` - Start server
  - `vxllm pull <model> [--force]` - Download model from HuggingFace
  - `vxllm run <model> [--system "prompt"]` - Interactive chat (streaming, multiline input)
  - `vxllm list [--json]` - List installed models
  - `vxllm ps [--json]` - List running models with memory/stats
  - `vxllm rm <model> [--force]` - Delete model
  - `vxllm info` - Hardware profile and recommendations
- **Output**: Rich terminal formatting with tables, progress bars, colors, and structured output
- **Error Handling**: Clear error messages with suggestions (e.g., "Model not found. Try: vxllm pull llama3.1:8b")
- **Bun-based**: Uses Bun as runtime, shares packages/inference and packages/db with server
- **Configuration**: Reads from env vars (DATABASE_URL, MODELS_DIR, PORT, etc.)
- **Interactive Mode**: `vxllm run` supports multiline input and streaming output
- **Flags**: --json for machine-readable output, --quiet for minimal output, --force for confirmations

### Out of Scope
- GUI interface (use desktop app for that)
- Voice in CLI mode (Phase 2)
- Model conversion tools (assumes GGUF format)
- Plugin management / custom extensions
- Scheduled task management
- Web UI serving from CLI (that's in serve command)
- SSH/remote server management
- Container orchestration helpers
- Model quantization / fine-tuning

## Requirements

### Must Have
- **citty sub-commands**: Typed argument parsing with validation
- **serve command**: Start server with optional port/host/model overrides; block until Ctrl+C; show connection info
- **pull command**: Download models from HuggingFace with progress bar, verify checksum, resume on failure
- **run command**: Interactive chat loop with streaming output, multiline input support, system prompt option
- **list command**: Table output with columns (Name, Size, Params, Quantization, Loaded)
- **ps command**: Table output with columns (PID, Model, Memory, Created, Status)
- **rm command**: Delete model from disk (with --force to skip confirmation)
- **info command**: Display hardware (CPU cores, RAM, GPU VRAM), recommendations, bottleneck analysis
- **Rich output**: Use consola or @clack/prompts for progress bars, colored tables, and formatted output
- **Error messages**: Actionable error text (e.g., "Port 11500 in use. Use --port 11501 or kill process XYZ")
- **JSON output**: --json flag for all commands returning structured data (JSON object/array)
- **Quiet mode**: --quiet flag to suppress non-essential output
- **Exit codes**: 0 on success, non-zero on error (with specific codes for different errors)
- **Signal handling**: Graceful shutdown on SIGINT/SIGTERM (cleanup, close DB connections)

### Should Have
- **Auto-complete**: Shell completions for bash/zsh/fish (generate via `vxllm completion bash`)
- **Model name suggestions**: If model not found in pull, show "Did you mean: llama2:7b?" with fuzzy matching
- **Streaming in run**: Show tokens as they arrive (tokens/sec meter)
- **Help text**: `vxllm help <command>` or `vxllm <command> --help` with examples
- **Version flag**: `vxllm --version` shows build version and date
- **Config file**: Support ~/.vxllmrc or .vxllm.json for default args (port, models_dir, etc.)
- **Model registry**: List available models to download with `vxllm pull --list`
- **Caching**: Cache model metadata locally to speed up pull command
- **Bandwidth limit**: --max-bandwidth flag for limited connections

### Nice to Have
- **Update checker**: Notify user if newer CLI version available
- **Telemetry**: Optional usage tracking (must be opt-in)
- **Shell prompt integration**: Show running model in bash prompt (via PROMPT_COMMAND)
- **Model aliases**: Support aliases like "latest" → "llama3.1:8b"
- **Benchmark mode**: `vxllm run <model> --benchmark` to run perf tests
- **Metrics export**: Export current metrics to JSON/CSV
- **Config validation**: `vxllm config validate` to check settings
- **Model search**: `vxllm search <query>` to find models by name/description
- **Request tracing**: `--trace` flag to log all API calls and responses

## UX

### Entry Points
1. Terminal: `vxllm serve` (main entry)
2. Terminal: `vxllm <command> --help` (documentation)
3. GitHub releases: Download pre-built binary
4. npm: `npm install -g @vxllm/cli` (if published)

### Key Screens / Output Formats

#### 1. `vxllm serve` Output
```
┌──────────────────────────────────────┐
│ VxLLM Server Starting                │
├──────────────────────────────────────┤
│ Host:           127.0.0.1:11500      │
│ Models Dir:     /home/user/.vxllm    │
│ Default Model:  llama3.1:8b          │
│ API Key Auth:   Disabled             │
├──────────────────────────────────────┤
│ Server ready! Press Ctrl+C to stop.  │
│ API URL: http://localhost:11500      │
└──────────────────────────────────────┘
```

#### 2. `vxllm pull llama3.1:8b` Output
```
Downloading llama3.1:8b...
████████████████░░░░░ 75% (4.2GB / 5.6GB)
Speed: 12.5 MB/s | ETA: 30s
✓ Download complete (5.6 GB in 7m 24s)
✓ Checksum verified
Model ready at: /home/user/.vxllm/llama3.1:8b.gguf
```

#### 3. `vxllm run llama3.1:8b` Output
```
Starting interactive chat (llama3.1:8b)
Type 'exit' or Ctrl+C to quit. Multiline mode: Shift+Enter for new line.

You: Hello, what's 2+2?