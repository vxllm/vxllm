---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: Settings & Configuration

## Summary

Centralized configuration management for server settings, model defaults, hardware overrides, and API keys. Settings persist across restarts via SQLite, with validation via t3-env on startup and a user-friendly settings UI in the desktop app.

## Problem Statement

Users need a way to:
- Configure server behavior (port, host, CORS origins) without modifying environment files
- Set model defaults and storage paths
- Override hardware parameters (GPU layers, context size) for hardware optimization
- Manage API keys in server mode with labels, permissions, and rate limits
- Persist configuration changes across app restarts
- Validate environment variables on startup with clear error messages

Without centralized settings, users face configuration friction, lose settings on restart, and lack visibility into API key usage.

## User Stories

- **Desktop User**: As a desktop user, I want a settings screen to configure port, model storage path, and default model so I can customize VxLLM without code changes
- **Server Operator**: As a server operator, I want to manage API keys with labels and rate limits so I can control access and monitor usage
- **Power User**: As a power user, I want to override GPU layers and context size for fine-tuned control so I can optimize for my specific hardware
- **Developer**: As a developer, I want settings to persist across restarts via the database so I don't lose my configuration
- **Operator**: As an operator, I want clear error messages for invalid environment variables on startup so I can troubleshoot quickly
- **Admin**: As an admin, I want to see all configured settings at a glance so I understand the current system state

## Scope

### In Scope
- Settings UI screen in desktop app (React + shadcn/ui form)
- Key-value storage in SQLite `settings` table
- API key management (CRUD) in `api_keys` table with columns: id, label, key_hash, created_at, last_used_at, rate_limit, permissions, enabled
- Hardware override settings: gpu_layers, max_context_size
- Server config: port, host, cors_origins, default_model
- Model settings: models_dir, default_model, default_stt_model, default_tts_model
- Voice settings: voice_provider, voice_language
- Startup behavior: auto_start_server (Tauri auto-start plugin)
- Environment variable validation via t3-env with clear error messages
- Settings form validation (port ranges, path existence, key format)
- Settings synchronization between desktop UI and server config
- Settings history/audit log for API key operations

### Out of Scope
- User accounts / multi-user settings
- Team management or role-based access
- OAuth / SSO integration
- Settings import/export
- Settings rollback / version history
- Scheduled backups of settings
- Cloud sync of settings

## Requirements

### Must Have
- Full settings form with validation in desktop UI (shadcn/ui form components)
- API key generation using `crypto.randomUUID()` or similar
- API key table with CRUD operations (create, read, update, disable)
- Settings persisted to SQLite `settings` table with schema: setting_name (text PK), setting_value (text), setting_type (text), last_modified_at (datetime)
- t3-env validation on server startup that surfaces errors with actionable messages
- API key hash storage (never plain text) using bcrypt or similar
- Form field validation: port (1024-65535), path existence, integer ranges for GPU/context
- Settings UI accessible from desktop app main menu or sidebar
- Read settings from env vars as defaults on first run
- API key enable/disable toggle without deletion
- Rate limit enforcement at the API layer (429 Too Many Requests)
- Last used timestamp tracking for API keys (for audit)
- Clear visual distinction between env-var-sourced and user-configured settings

### Should Have
- Bulk API key operations (export, disable multiple)
- Settings change log with timestamp and source (UI vs env var)
- Rate limit templates (free, standard, premium tiers)
- API key permissions granularity (read-only, full access)
- Settings reset to defaults button with confirmation
- Import/export settings as JSON for migration
- Settings validation before save (with inline error display)
- Real-time validation feedback in form fields

### Nice to Have
- Settings search/filter for large configurations
- Dark mode toggle in settings
- Settings sync across multiple instances via webhook
- Telemetry opt-in setting
- Performance profiling settings (debug logging, trace collection)
- Custom CSS theme settings
- Keyboard shortcuts configuration
- Language preference for UI

## UX

### Entry Points
1. Desktop app menu: Settings → click to open settings modal
2. Sidebar icon in main app
3. First-run wizard (on app launch if settings table is empty)
4. Direct route: `/settings` in desktop app

### Key Screens
1. **Settings Dashboard** (grid of sections)
   - Server Configuration section (port, host, CORS)
   - Model Defaults section (default model, models_dir)
   - Hardware Overrides section (GPU layers, context size)
   - Voice section (default STT/TTS, voice provider)
   - Startup section (auto-start toggle)
   - Danger Zone: Reset to Defaults button

2. **API Keys Management** (table view)
   - Table columns: Label, Created, Last Used, Rate Limit, Status (Enabled/Disabled), Actions (Edit, Copy, Revoke)
   - "Generate New Key" button
   - API key is shown once (with "Copy to clipboard" button) on creation, then masked
   - Key preview: showing last 4 chars for identity

3. **Create/Edit API Key Modal**
   - Label input (text)
   - Rate Limit dropdown (Unlimited, 100/min, 1000/min, custom)
   - Permissions checkboxes (Read Models, Chat Completions, Audio, Full Access)
   - Enabled toggle
   - Save / Cancel buttons

4. **Environment Variables Validator** (shown at startup or in settings)
   - List of env vars with validation status (✓ Valid, ⚠ Warning, ✗ Error)
   - Descriptions for each var (what it does, expected format)
   - "Fix Configuration" link for errors

### User Flow
1. User opens desktop app → checks if settings exist in DB
2. If first run: show wizard, collect basic settings (port, models_dir, default model)
3. User clicks Settings icon → modal opens showing current settings
4. User changes port → validation runs inline (shows error if invalid)
5. User clicks Save → settings written to DB, server reloads config
6. User wants to use API in server mode → clicks "API Keys" tab
7. User clicks "Generate New Key" → modal appears
8. User enters label, selects rate limit, clicks Save
9. System generates key, shows it once with copy button
10. User copies key and uses it in API requests
11. Server validates API key (bcrypt compare) on each request, checks rate limit

## Business Rules

- **Default Settings**: On first run, seeds defaults from env vars or hardcoded fallbacks
- **API Key Security**: Keys hashed in DB using bcrypt, never logged or displayed after creation
- **Rate Limiting**: Enforced per-key; returns 429 with retry-after header when exceeded
- **Env Var Priority**: Env vars override DB settings on server startup (allows ops to override via deployment)
- **Settings Persistence**: All changes via UI persisted immediately to DB
- **Validation**: Form validates before DB write; startup validates all env vars and surfaces errors
- **Audit Trail**: API key operations logged with timestamp, user (if applicable), and operation type
- **Immutability**: API key value never shown again after creation; only the hash stored
- **Hardware Safety**: GPU layers cannot exceed available layers; context size capped at model's max
- **Port Binding**: Port must be free and >= 1024 (no privileged ports)

## Edge Cases

### Empty Cases
- **No settings exist on first run**: Seed defaults from env vars, fall back to hardcoded values (port 11500, models_dir ./models)
- **No API keys created**: Server starts without API key requirement (localhost mode only)
- **No models in models_dir**: Settings screen shows warning with "Download Models" link
- **Settings table doesn't exist**: Drizzle migration creates it on startup

### Boundary Cases
- **Invalid port number**: Form shows error "Port must be between 1024 and 65535"
- **Models dir path doesn't exist**: Show error with "Create Directory" button or allow user to select existing path
- **GPU layers exceed available**: Cap to max available and show warning "GPU layers reduced to available: X"
- **Context size > model max**: Form shows dynamic max (fetched from loaded model), prevents invalid input
- **Rate limit = 0**: Treat as unlimited (no throttling)
- **API key label is empty**: Form validation error "Label is required"
- **Rate limit string is malformed**: Parse error shows "Invalid rate limit format; use '100/min'"

### Concurrent Cases
- **Settings changed while inference running**: Apply on next model load (don't hot-reload GPU layers mid-inference)
- **Multiple instances reading settings**: Race condition on write; last write wins (acceptable for non-critical settings)
- **API key created while server restarting**: New key available after restart completes
- **Rate limit checked during streaming request**: Count tokens streamed, check against limit for next request

### Data Integrity Cases
- **Settings table corrupted**: Log error, fall back to env vars and hardcoded defaults
- **API key hash corrupted**: Disable key, notify admin, create audit log entry
- **Inconsistent GPU layers and context size**: Validate together; warn if context_size < gpu_layers * layer_size
- **Stale last_used_at timestamp**: Update on each request; clock skew handled by allowing 5s tolerance
- **Orphaned API key**: No cleanup needed; can be disabled via UI

## Success Criteria

- Settings form renders without errors in desktop app
- Settings successfully persist to SQLite across restart
- Environment variable validation runs on startup with clear error messages for invalid config
- API keys can be created, labeled, and revoked via UI
- API key hash is never logged or displayed (except once on creation)
- Rate limiting enforces correctly (429 returned at limit, request header shows reset time)
- Hardware overrides (GPU, context) take effect on next model load
- First-run wizard completes and seeds reasonable defaults
- Settings changes apply to running server without restart (except GPU layers)
- Port/host validation prevents invalid configurations
- API key last_used_at updates correctly for audit purposes
- All settings form fields have inline validation with user-friendly messages

## Dependencies

- **Drizzle + SQLite**: `settings` and `api_keys` tables with schema defined in packages/db/schema.ts
- **t3-env**: Environment variable validation with typed schema in packages/env.ts
- **shadcn/ui**: Form, Input, Button, Checkbox, Select, Tabs components for settings UI
- **Tauri 2**: Auto-start plugin integration for startup behavior setting
- **bcrypt** or **argon2**: API key hashing (bcrypt recommended for simplicity)
- **lucide-react**: Icons for settings sections
- **React Hook Form**: Form state management in settings UI
- **Zod**: Client-side validation schema for form fields
- **zustand**: Global state for current settings (read on app load, update on save)

## Related Docs

- `api-settings`: OpenAI-compatible settings endpoint (GET /v1/settings, POST /v1/settings)
- `schema-settings`: Drizzle schema definition for settings table
- `schema-api-keys`: Drizzle schema definition for api_keys table
- `workflow-settings-update`: Flow for updating settings and notifying clients
- `workflow-startup-validation`: Env var validation at server startup
- `feature-cli`: CLI serve command uses settings from DB for defaults

## Open Questions

1. Should settings be versioned (e.g., `settings_version` field for migrations)?
2. Should we support per-user settings in multi-user deployments (future)?
3. Should API key rotation be automatic (e.g., every 90 days) or manual only?
4. Should settings changes trigger a server reload or only apply to next inference?
5. Should we expose settings via an API endpoint (/v1/settings) for programmatic access?
6. Should we support settings templates (e.g., "high-performance", "low-resource")?
7. How granular should API key permissions be (read-only per endpoint vs. global read-only)?
8. Should rate limits be based on tokens or requests (or both)?

## Changelog

### v1.0 (2026-03-20)
- Initial feature specification
- Defined settings table schema with key-value storage
- Defined API keys table with label, rate_limit, permissions, enabled fields
- Specified hardware override settings (gpu_layers, max_context_size)
- Specified server config settings (port, host, cors_origins)
- Defined API key generation and hashing approach
- Specified rate limiting enforcement at API layer
- Outlined first-run wizard and settings UI components
- Defined env var validation flow via t3-env
- Listed edge cases (empty, boundary, concurrent, data integrity)
