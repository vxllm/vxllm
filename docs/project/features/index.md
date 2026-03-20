---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# Feature Registry

## Overview

All feature specifications for VxLLM, organized by priority and domain.

## Features

| Feature | Description | Status | Priority | Link |
|---------|-------------|--------|----------|------|
| LLM Inference | In-process inference via node-llama-cpp with Metal/CUDA/CPU auto-detection | Draft | P0 | [→](./feature-inference.md) |
| Model Management | Download, store, track, and manage AI models from HuggingFace Hub | Draft | P0 | [→](./feature-model-management.md) |
| Chat | Conversational AI with streaming responses and persistent history | Draft | P0 | [→](./feature-chat.md) |
| Voice Pipeline | Real-time STT + TTS + VAD via Python sidecar | Draft | P0 | [→](./feature-voice.md) |
| OpenAI API Compatibility | Full OpenAI-compatible REST API endpoints | Draft | P0 | [→](./feature-api-compatibility.md) |
| Settings & Configuration | Centralized config management, API keys, hardware overrides | Draft | P1 | [→](./feature-settings.md) |
| Dashboard | Real-time hardware monitoring and inference metrics | Draft | P1 | [→](./feature-dashboard.md) |
| CLI | TypeScript CLI with citty for terminal-based management | Draft | P1 | [→](./feature-cli.md) |

## Feature Dependencies

```
feature-inference ← feature-chat (requires loaded model)
feature-inference ← feature-voice (LLM step in voice loop)
feature-model-management ← feature-inference (models must be downloaded first)
feature-voice ← feature-chat (voice mode is a chat input method)
feature-settings ← ALL (configuration affects all features)
```

## Phase Mapping

| Phase | Features | Target |
|-------|----------|--------|
| Phase 1 (MVP) | All above | Q2 2026 |
| Phase 2 | Voice cloning (F5-TTS), multi-modal, model conversion | Q3 2026 |
| Phase 3 | Plugin system, multi-node, fine-tuning UI | Q4 2026 |
