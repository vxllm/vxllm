---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Workflow: Settings — Update Configuration

## Summary
Handles user configuration changes in Settings screen. Validates input, persists to SQLite, manages restart requirements, and applies runtime settings immediately or on next model load.

## Trigger
- User navigates to Settings screen and modifies a configuration value
- User submits settings form with changed key-value pairs
- Client sends POST to `/rpc/settings.update` with new settings

## Actors
- **Frontend** (React, Settings component)
- **Hono Server** (validation, persistence)
- **Database** (Drizzle + SQLite, settings table)
- **node-llama-cpp** (runtime config like gpu_layers)

## Preconditions
- Server is running
- User can access Settings screen (desktop mode or admin API key for server mode)
- Database schema initialized (settings table exists)
- settings table populated with defaults

## Happy Path

### Step 1: Navigate to Settings
- User clicks Settings icon/link in main navigation
- Frontend loads Settings screen
- Query current settings via `settings.getAll` RPC call:
  ```js
  const currentSettings = await fetch("/rpc/settings.getAll", {
    method: "POST",
    body: JSON.stringify({})
  }).then(r => r.json());
  ```
- Server queries settings table:
  ```js
  const settings = await db.select().from(settingsTable);
  ```
- Return all settings as object:
  ```json
  {
    "port": 11500,
    "host": "127.0.0.1",
    "models_dir": "/home/user/.vxllm/models",
    "enable_voice": true,
    "gpu_layers": 32,
    "context_size": 2048,
    "temperature": 0.7,
    "api_key": "sk-...",
    "enable_metrics": true,
    "log_level": "info"
  }
  ```

### Step 2: Render Settings Form
- Frontend displays settings form with current values populated:
  ```jsx
  <SettingsForm defaultValues={currentSettings}>
    <Input label="Port" name="port" type="number" min={1024} max={65535} />
    <Input label="Host" name="host" type="text" />
    <Input label="Models Directory" name="models_dir" type="text" />
    <Select label="Log Level" name="log_level" options={["debug", "info", "warn", "error"]} />
    <Slider label="GPU Layers" name="gpu_layers" min={0} max={40} />
    <Slider label="Context Size" name="context_size" min={512} max={4096} step={256} />
    <Checkbox label="Enable Voice" name="enable_voice" />
    <Checkbox label="Enable Metrics" name="enable_metrics" />
  </SettingsForm>
  ```
- Show visual indicators for settings that require restart:
  - Mark "Port", "Host", "Models Directory" with ⚠ icon
  - Tooltip: "Changes require server restart"

### Step 3: User Modifies Settings
- User changes one or more settings:
  - Changes port from 11500 to 12000
  - Adjusts gpu_layers from 32 to 35
  - Enables voice (was disabled)
  - Disables metrics collection
  - etc.
- Form tracks changed fields (delta from initial values)

### Step 4: User Submits Form
- User clicks "Save Settings" button
- Frontend validates locally (client-side validation):
  ```js
  const errors = {};
  if (port < 1024 || port > 65535) errors.port = "Port must be 1024-65535";
  if (!models_dir) errors.models_dir = "Models directory required";
  if (context_size < 512) errors.context_size = "Context size minimum 512";
  ```
- If validation fails:
  - Show error messages inline
  - Highlight invalid fields in red
  - Do NOT submit to server
  - User fixes and resubmits

### Step 5: Submit to Server
- Frontend sends POST `/rpc/settings.update` with changed settings:
  ```json
  POST /rpc/settings.update
  {
    "port": 12000,
    "gpu_layers": 35,
    "enable_voice": true,
    "enable_metrics": false
  }
  ```

### Step 6: Server-Side Validation
- Hono route handler receives request
- Validate each changed setting:
  ```js
  const changedKeys = Object.keys(body);
  const errors = {};

  changedKeys.forEach(key => {
    const value = body[key];
    switch (key) {
      case "port":
        if (typeof value !== "number" || value < 1024 || value > 65535) {
          errors.port = "Invalid port number";
        }
        break;
      case "host":
        if (typeof value !== "string" || !isValidHostname(value)) {
          errors.host = "Invalid hostname";
        }
        break;
      case "models_dir":
        if (!pathExists(value)) {
          errors.models_dir = "Directory does not exist";
        }
        if (!isWritable(value)) {
          errors.models_dir = "Directory is not writable";
        }
        break;
      case "gpu_layers":
        if (typeof value !== "number" || value < 0 || value > 40) {
          errors.gpu_layers = "GPU layers must be 0-40";
        }
        break;
      case "context_size":
        if (typeof value !== "number" || value < 512 || value > 8192) {
          errors.context_size = "Context size must be 512-8192";
        }
        break;
      // ... etc for other settings
    }
  });
  ```
- If validation fails:
  - Return HTTP 400 Bad Request with error details:
    ```json
    {
      "error": "Validation failed",
      "fields": {
        "port": "Invalid port number"
      }
    }
    ```
  - Frontend displays errors inline (same as client-side errors)
  - No settings updated

### Step 7: Categorize Settings
- Determine which settings require server restart vs runtime application:
  ```js
  const RESTART_REQUIRED = ["port", "host", "models_dir", "api_key"];
  const RUNTIME = ["gpu_layers", "context_size", "temperature", "log_level"];
  const RELOAD = ["enable_voice"]; // Requires model reload, not server restart

  const requiresRestart = changedKeys.some(k => RESTART_REQUIRED.includes(k));
  const runtimeOnly = changedKeys.every(k => RUNTIME.includes(k) || k === "enable_metrics");
  ```

### Step 8: Persist to Database
- Upsert each changed setting into settings table:
  ```js
  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(settingsTable)
      .values({ key, value: String(value), updatedAt: now() })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(value), updatedAt: now() } });
  }
  ```
- Verify upsert successful
- On database error → return HTTP 500 with error message

### Step 9: Apply Runtime Settings (If Applicable)
- If only runtime settings changed (no restart required):
  ```js
  if (runtimeOnly) {
    // Apply gpu_layers on next model load (update config object)
    updateInferenceConfig({
      gpu_layers: body.gpu_layers,
      context_size: body.context_size,
      temperature: body.temperature
    });

    // Update log level immediately (no restart needed)
    if (body.log_level) {
      logger.setLevel(body.log_level);
    }

    // Update metrics flag immediately
    if ("enable_metrics" in body) {
      enableMetricsCollection(body.enable_metrics);
    }
  }
  ```
- Changes take effect immediately for log level and metrics
- GPU layers and context size take effect on next model load/inference

### Step 10: Build Response
- Prepare response to frontend:
  ```json
  {
    "success": true,
    "message": "Settings saved",
    "requiresRestart": requiresRestart,
    "applied": {
      "gpu_layers": 35,
      "enable_metrics": false
    },
    "pendingRestart": ["port", "host"]
  }
  ```

### Step 11: Frontend Receives Response
- Parse response and update local state:
  ```js
  if (response.requiresRestart) {
    // Show restart banner
    showRestartBanner({
      message: "Some settings require a server restart to take effect.",
      affectedSettings: response.pendingRestart,
      restartButton: true
    });
  } else {
    // Settings applied immediately
    showToast({
      type: "success",
      message: "Settings saved",
      duration: 3000
    });
  }
  ```

### Step 12a: Runtime Settings Applied (No Restart)
- If no restart needed:
  - Toast notification: "✓ Settings saved"
  - Close toast after 3 seconds
  - Settings take effect immediately
  - User can continue using app without interruption

### Step 12b: Restart Required
- If restart needed:
  - Show persistent banner at top of Settings:
    ```
    ⚠ Restart Required

    The following settings require a server restart:
    • Port changed from 11500 to 12000
    • Host changed from 127.0.0.1 to 0.0.0.0

    [Restart Server] [Later]
    ```
  - If user clicks "Restart Server":
    - Graceful shutdown: unload model, close DB, stop server
    - Server restarts with new settings
    - Frontend automatically reconnects
    - Show spinner: "Server restarting... Please wait (1-5 seconds)"
  - If user clicks "Later":
    - Dismiss banner
    - Settings are saved but not yet applied
    - Prompt user again on next Settings access or on next server startup

## Alternative Paths

### Batch Settings Update
- User changes multiple settings at once (port + models_dir + gpu_layers)
- All submitted together in single POST request
- Server processes all validations, then batch upsert
- Single response with consolidated restart requirement

### Reset to Defaults
- User clicks "Reset to Defaults" button
- Show confirmation: "Reset all settings to default values? This may change server behavior."
- On confirm:
  - Delete all rows from settings table
  - Reinitialize with hardcoded defaults
  - Optionally trigger server restart if defaults differ from current

### Import/Export Settings
- User clicks "Export Settings" → download JSON file with all settings
- User clicks "Import Settings" → upload JSON file
- Validate imported settings, upsert all at once
- Useful for backup or sharing config between instances
- (Future feature, not in v1.0)

### Advanced Settings (Hidden by Default)
- Settings divided into "Basic" and "Advanced" tabs
- Advanced includes: log_level, enable_metrics, context_size limits
- User clicks "Show Advanced" to reveal
- Less likely to accidentally change expert-level settings

## Failure Scenarios

### Invalid Port Number
- **Symptom**: User enters port 99 (too low) or 99999 (too high)
- **Detection**: Server validation in Step 6
- **Response**:
  - Return 400 with field error: `"port": "Port must be 1024-65535"`
  - Frontend shows inline error with red border
  - Settings not persisted
  - User corrects and resubmits

### Port Already in Use
- **Symptom**: User changes port to one already in use by another process
- **Detection**: Server attempts to bind to port during restart (not immediately)
- **Response**:
  - Server fails to start on new port
  - Return error to frontend: "Failed to restart server: Port {port} is in use"
  - Old port still running (graceful degradation)
  - Show error with suggested action: "Run `lsof -i :{port}` to see what's using this port"
  - User corrects setting and retries restart
- **Recovery**:
  - User kills conflicting process or chooses different port
  - User retries restart

### Invalid Directory Path
- **Symptom**: User sets models_dir to non-existent path
- **Detection**: Server validation pathExists() in Step 6
- **Response**:
  - Return 400 with field error: `"models_dir": "Directory does not exist"`
  - Frontend shows error
  - Settings not persisted

### Directory Not Writable
- **Symptom**: User sets models_dir to read-only directory (e.g., /usr/bin)
- **Detection**: Server validation isWritable() in Step 6
- **Response**:
  - Return 400 with field error: `"models_dir": "Directory is not writable"`
  - Frontend shows error
  - Settings not persisted
  - Show suggestion: "Ensure you have write permissions to the directory"

### Database Update Fails
- **Symptom**: db.insert().onConflictDoUpdate() throws error
- **Detection**: Exception in Step 8
- **Response**:
  - Return HTTP 500 Internal Server Error:
    ```json
    {
      "error": "Failed to save settings",
      "details": "Database connection error"
    }
    ```
  - Frontend shows error toast: "✗ Settings failed to save. Please try again."
  - Settings remain unchanged (previous values still in DB)
- **Recovery**:
  - Retry settings update (values cached in form)
  - If persistent, admin checks database connection

### Concurrent Settings Updates
- **Symptom**: Two simultaneous POST /rpc/settings.update requests
- **Detection**: Race condition (upsert should be idempotent, but can cause inconsistency)
- **Response**:
  - Both requests processed, last write wins
  - No explicit locking in v1.0
  - Unlikely race condition issue
  - If problematic in future, add mutex lock

### Model Reload Fails on Runtime Update
- **Symptom**: gpu_layers changed, on next inference model fails to load with new settings
- **Detection**: Model load exception during inference in next request
- **Response**:
  - Inference fails with 500 error
  - Log error: "Failed to load model with new gpu_layers setting"
  - Rollback gpu_layers to previous value in DB
  - Return error to user: "Settings change incompatible with current model. Reverted setting."
  - User can manually adjust setting or reload server

### Server Restart Timeout
- **Symptom**: Server takes longer than expected to restart (>10 seconds)
- **Detection**: Frontend timeout waiting for server to respond
- **Response**:
  - Frontend spinner shows: "Server restarting... (10+ seconds, may need manual restart)"
  - If server comes back: auto-reconnect succeeds, UI updates
  - If server still down after 30s:
    - Show error: "Server restart failed. Please manually restart."
    - Provide instruction: `vxllm serve`
    - Link to documentation

### Settings Validation Logic Bug
- **Symptom**: A setting passes validation but causes side effects (e.g., bad log_level crashes logger)
- **Detection**: Server crash or error after settings update
- **Response**:
  - Server crashes → comes back up with previous settings (transaction-like safety)
  - Log critical error with stack trace
  - Alert admin
  - User may need to manually edit settings file

### Settings Table Corruption
- **Symptom**: Malformed data in settings table (corrupted SQLite)
- **Detection**: Query fails or returns invalid values
- **Response**:
  - Server detects and attempts to repair schema
  - If repair fails: fall back to defaults
  - Log error: "Settings table corrupted, reverted to defaults"
  - Alert admin

## Permissions
- **Desktop Mode**: Full settings access
- **Server Mode**: Requires API key with admin scope (not standard API key)
- **Restricted Settings**: api_key, port, host require higher privilege

## Exit Conditions
- **Success**: Settings persisted, response sent, changes applied (runtime) or pending (restart)
- **Validation Error**: Settings not saved, error returned, user can correct
- **Database Error**: Settings not saved, user retried
- **Restart Required**: Settings saved, banner shown, user clicks Restart (goes to server restart flow)
- **Timeout**: Restart takes too long, user shown manual restart instruction

## Data Changes

### Tables Written
- **settings**
  - Upsert: one row per changed setting
  - Fields: key, value (stored as string), updatedAt timestamp

### In-Memory State
- **Inference Config**: gpu_layers, context_size, temperature updated (if changed)
- **Logger Config**: log_level updated (if changed)
- **Metrics Flag**: enable_metrics_collection updated (if changed)

### Files Read/Written
- Server restarts may re-read models_dir (no file changes, just path)

## Related Documentation
- `/docs/deployment/configuration.md` — Complete settings reference
- `/docs/deployment/server-mode.md` — API key and admin privileges
- `/docs/models/inference-config.md` — gpu_layers and context_size tuning
- `workflow-inference-chat.md` — How inference config is applied
- `workflow-cli-serve.md` — Initial settings during server startup

## Changelog
- **v1.0** (2026-03-20): Initial workflow documentation
  - Form-based settings UI with validation
  - Restart requirement detection and banners
  - Runtime setting application without restart
  - Comprehensive error handling and recovery
  - Settings persistence to SQLite
