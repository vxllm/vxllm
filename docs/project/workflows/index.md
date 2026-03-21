---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# Workflow Registry

## Overview

Step-by-step workflow documentation for all major user actions in VxLLM.

## Workflows

### Inference

| Workflow | Trigger | Actors | Link |
|----------|---------|--------|------|
| Chat Completion | User sends message or POST /v1/chat/completions | User, Hono Server, node-llama-cpp, AI SDK | [→](./workflow-inference-chat.md) |

### Model Management

| Workflow | Trigger | Actors | Link |
|----------|---------|--------|------|
| Download Model | UI "Install" button, CLI `vxllm pull`, or API | User, Hono Server, HuggingFace, DB | [→](./workflow-model-download.md) |
| Delete Model | UI delete button, CLI `vxllm rm`, or API | User, Hono Server, Filesystem, DB | [→](./workflow-model-delete.md) |

### Voice

| Workflow | Trigger | Actors | Link |
|----------|---------|--------|------|
| Voice Chat | User activates voice mode in UI | User, Browser Mic, WebSocket, Voice Service, node-llama-cpp | [→](./workflow-voice-chat.md) |

### Settings

| Workflow | Trigger | Actors | Link |
|----------|---------|--------|------|
| Update Settings | User modifies settings form | User, Hono Server, DB | [→](./workflow-settings-update.md) |

### CLI

| Workflow | Trigger | Actors | Link |
|----------|---------|--------|------|
| Start Server | `vxllm serve` command | Developer, CLI, Hono Server, DB | [→](./workflow-cli-serve.md) |
| Pull Model | `vxllm pull <model>` command | Developer, CLI, HuggingFace, DB | [→](./workflow-cli-pull.md) |

## Workflow Conventions

Each workflow document includes: happy path steps, alternative paths, failure scenarios with recovery, permissions matrix, data changes (created/updated/deleted), and exit conditions.
