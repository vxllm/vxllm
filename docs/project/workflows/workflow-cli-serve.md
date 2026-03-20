---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Workflow: CLI — Start Server

## Summary
Initializes VxLLM server from command line. Parses CLI arguments, validates environment, initializes database, starts Hono HTTP server, optionally loads model and voice sidecar, then listens for shutdown signal.

## Trigger
- User runs `vxllm serve` from terminal
- User runs `vxllm serve --port 12000 --host 0.0.0.0 --model llama3.1:8b`

## Actors
- **CLI** (citty command parser)
- **Hono Server** (HTTP + WebSocket)
- **Drizzle + SQLite** (database)
- **node-llama-cpp** (model inference)
- **Python Voice Sidecar** (optional)
- **Bun** (runtime)

## Preconditions
- Bun runtime is installed
- VxLLM package is installed globally or locally
- User has read/write permissions in models directory
- Database file path is writable

## Happy Path

### Step 1: Command Invocation
- User types in terminal:
  ```bash
  vxllm serve --port 11500 --host 127.0.0.1 --model llama3.1:8b
  ```
- CLI parser (citty) receives command and parses arguments

### Step 2: Parse CLI Arguments
- Extract arguments:
  ```js
  const args = {
    port: 11500,          // default 11500
    host: "127.0.0.1",    // default 127.0.0.1
    model: "llama3.1:8b", // optional
    dataDir: null,        // optional, default ~/.vxllm
    verbose: false        // optional, for debug logging
  };
  ```
- Parse from argv and apply defaults:
  ```js
  const cliConfig = {
    port: parseInt(process.argv.find(a => a.startsWith("--port="))?.split("=")[1]) || 11500,
    host: process.argv.find(a => a.startsWith("--host="))?.split("=")[1] || "127.0.0.1",
    model: process.argv.find(a => a.startsWith("--model="))?.split("=")[1] || null,
    dataDir: process.argv.find(a => a.startsWith("--data-dir="))?.split("=")[1] || expandPath("~/.vxllm"),
    verbose: process.argv.includes("--verbose") || false
  };
  ```

### Step 3: Validate Port
- Check port is in valid range:
  ```js
  if (port < 1024 || port > 65535) {
    console.error(`Error: port must be 1024-65535, got ${port}`);
    process.exit(1);
  }
  ```
- Check if port is already in use:
  ```js
  const isPortInUse = await checkPortInUse(port, host);
  if (isPortInUse) {
    const pid = await getProcessUsingPort(port);
    console.error(`Error: port ${port} already in use`);
    console.error(`  PID: ${pid}`);
    console.error(`  Kill with: kill ${pid}`);
    process.exit(1);
  }
  ```

### Step 4: Validate Host
- Validate hostname/IP:
  ```js
  if (!isValidHostname(host) && !isValidIP(host)) {
    console.error(`Error: invalid host '${host}'`);
    process.exit(1);
  }
  ```
- Validate that host is accessible (optional warning if 0.0.0.0):
  ```js
  if (host === "0.0.0.0") {
    console.warn("⚠ Server will be accessible from any network interface");
    console.warn("  This may be a security risk. Use specific IP in production.");
  }
  ```

### Step 5: Initialize Data Directory
- Create ~/.vxllm structure if missing:
  ```js
  const dataDir = expandPath(cliConfig.dataDir);
  const modelsDir = path.join(dataDir, "models");
  const dbPath = path.join(dataDir, "vxllm.db");

  // Create directories
  await mkdir(dataDir, { recursive: true });
  await mkdir(modelsDir, { recursive: true });
  await mkdir(path.join(dataDir, "logs"), { recursive: true });
  ```
- Log location:
  ```
  Data directory: /home/user/.vxllm
  Models directory: /home/user/.vxllm/models
  Database: /home/user/.vxllm/vxllm.db
  ```

### Step 6: Initialize Database
- Connect to SQLite via Drizzle:
  ```js
  import Database from "bun:sqlite";
  const sqliteDb = new Database(dbPath);
  const db = drizzle(sqliteDb);
  ```
- Verify schema exists (or create via migrations):
  ```js
  try {
    await db.select().from(models).limit(1); // test query
    console.log("✓ Database initialized");
  } catch (e) {
    if (e.message.includes("no such table")) {
      console.log("→ Running migrations...");
      await runMigrations(db);
      console.log("✓ Database schema created");
    } else {
      throw e;
    }
  }
  ```
- Migrations create tables: models, download_queue, messages, usage_metrics, settings
- Ensure settings table has required entries (port, host, models_dir, etc.)

### Step 7: Initialize Settings
- Load or create settings in database:
  ```js
  const settings = await db.select().from(settingsTable).where(eq(settingsTable.key, "port"));
  if (settings.length === 0) {
    // Insert default settings
    await db.insert(settingsTable).values([
      { key: "port", value: String(port) },
      { key: "host", value: host },
      { key: "models_dir", value: modelsDir },
      { key: "enable_voice", value: "false" },
      { key: "gpu_layers", value: "32" },
      { key: "context_size", value: "2048" },
      { key: "api_key", value: generateAPIKey() }
    ]);
    console.log("✓ Settings initialized");
  }
  ```

### Step 8: Start Hono Server
- Create Hono app instance:
  ```js
  const app = new Hono();

  // Register middleware
  app.use(cors());
  app.use(logger());
  app.use(bodyParser());

  // Register routes
  import routes from "./routes";
  app.route("/", routes);

  // Start HTTP server
  const server = Bun.serve({
    fetch: app.fetch,
    port: cliConfig.port,
    hostname: cliConfig.host
  });

  console.log(`✓ Server running at http://${cliConfig.host}:${cliConfig.port}`);
  ```
- Server is now listening for HTTP requests

### Step 9: Register WebSocket Endpoint
- Register WebSocket handler for voice chat:
  ```js
  app.get("/ws/chat", (c) => {
    const upgradeHeader = c.req.header("upgrade");
    if (upgradeHeader !== "websocket") {
      return c.text("Upgrade header is missing", 400);
    }

    const { socket, response } = Bun.upgrade(c.req);
    // Proxy to Python voice sidecar
    proxyToVoiceSidecar(socket);
    return response;
  });
  ```

### Step 10: Load Initial Model (If --model Specified)
- Check if model specified:
  ```js
  if (cliConfig.model) {
    console.log(`→ Loading model: ${cliConfig.model}`);
    try {
      const model = await loadModel(cliConfig.model);
      console.log(`✓ Model loaded: ${cliConfig.model}`);
    } catch (e) {
      console.error(`✗ Failed to load model: ${e.message}`);
      console.error("  Continuing without model (will be loaded on first inference)");
    }
  }
  ```
- Model loading is async but doesn't block server startup

### Step 11: Start Voice Sidecar (If Enabled)
- Check settings.enable_voice:
  ```js
  const enableVoice = await getSetting("enable_voice");
  if (enableVoice === "true") {
    console.log("→ Starting voice sidecar...");
    try {
      const sidecarProcess = await startVoiceSidecar({
        port: cliConfig.port + 1000, // e.g., 12500
        modelsDir: modelsDir,
        python: "python3" // or python
      });
      console.log(`✓ Voice sidecar running on port ${cliConfig.port + 1000}`);
    } catch (e) {
      console.warn(`✗ Failed to start voice sidecar: ${e.message}`);
      console.warn("  Voice features will be unavailable");
      // Continue without voice sidecar
    }
  }
  ```
- Sidecar startup is async, runs in background

### Step 12: Display Startup Summary
- Show server info:
  ```
  ╭─────────────────────────────────────────────────────────────────╮
  │ VxLLM Server                                                    │
  ├─────────────────────────────────────────────────────────────────┤
  │ Version: 1.0.0                                                  │
  │ Server: http://127.0.0.1:11500                                  │
  │ Health: http://127.0.0.1:11500/health                           │
  │ Models: http://127.0.0.1:11500/v1/models                        │
  │ RPC: http://127.0.0.1:11500/rpc/*                               │
  │ Model: llama3.1:8b (loaded)                                     │
  │ Voice: enabled (/ws/chat)                                       │
  │ Database: /home/user/.vxllm/vxllm.db                            │
  │ Models Dir: /home/user/.vxllm/models                            │
  ├─────────────────────────────────────────────────────────────────┤
  │ Press Ctrl+C to stop                                            │
  ╰─────────────────────────────────────────────────────────────────╯
  ```

### Step 13: Listen for Shutdown Signal
- Register signal handlers:
  ```js
  process.on("SIGINT", async () => {
    console.log("\n→ Shutting down...");
    await gracefulShutdown();
  });

  process.on("SIGTERM", async () => {
    console.log("\n→ Terminating...");
    await gracefulShutdown();
  });
  ```

### Step 14: Graceful Shutdown
- On Ctrl+C:
  ```js
  async function gracefulShutdown() {
    // 1. Stop accepting new requests
    console.log("  Closing server...");
    await server.stop();

    // 2. Unload model
    if (currentModel) {
      console.log("  Unloading model...");
      await unloadModel();
    }

    // 3. Stop voice sidecar
    if (sidecarProcess) {
      console.log("  Stopping voice sidecar...");
      sidecarProcess.kill();
      await sleep(1000); // grace period
    }

    // 4. Close database connection
    console.log("  Closing database...");
    db.close();

    console.log("✓ Shutdown complete");
    process.exit(0);
  }
  ```
- Waits for active requests to complete (configurable timeout)
- Unloads model cleanly
- Terminates sidecar process
- Closes database connection

### Step 15: Server Running State
- Server is now fully operational
- Listening on configured port
- Ready to accept HTTP/WebSocket connections
- Metrics being collected
- Database recording messages and usage

## Alternative Paths

### No Arguments (All Defaults)
- User runs `vxllm serve` (no arguments)
- Uses default port 11500, host 127.0.0.1
- No model pre-loaded (loads on first inference)
- Voice disabled (can be enabled in Settings)
- All same initialization steps

### Custom Data Directory
- User runs `vxllm serve --data-dir /mnt/ssd/vxllm`
- Creates database and models dir at specified location
- Useful for multi-user or alternative disk locations
- All validation and initialization same as happy path

### Verbose Logging
- User runs `vxllm serve --verbose`
- Enables debug-level logging from Hono, Drizzle, etc.
- More detailed output during startup:
  ```
  [debug] Loading config...
  [debug] Connecting to database...
  [debug] Creating tables...
  [debug] Starting HTTP server...
  ```
- Useful for troubleshooting

### With Multiple Models
- Future feature: `vxllm serve --models llama3.1:8b,mistral:7b`
- Load multiple models at startup (if memory allows)
- Switch between loaded models on inference requests
- Not in v1.0

### Run as Background Service
- User runs `vxllm serve &` (background)
- Or use process manager (systemd, supervisor, PM2)
- Server continues running even if terminal closed
- Not directly supported by CLI (external tool)

## Failure Scenarios

### Port Already in Use
- **Symptom**: Another process already listening on specified port
- **Detection**: Bun.serve() throws error or checkPortInUse() returns true in Step 3
- **Response**:
  ```
  Error: port 11500 already in use
  PID: 12345 (node vxllm.js)

  Kill with: kill 12345
  Or use different port: vxllm serve --port 12000
  ```
- **Recovery**:
  - User kills process: `kill 12345`
  - User chooses different port: `vxllm serve --port 12000`

### Invalid Port Number
- **Symptom**: User specifies port 99 (too low) or 99999 (too high)
- **Detection**: Validation in Step 3
- **Response**:
  ```
  Error: port must be 1024-65535, got 99
  ```
- **Recovery**:
  - User provides valid port: `vxllm serve --port 11500`

### Data Directory Not Writable
- **Symptom**: No write permissions in models directory or database location
- **Detection**: mkdir() or Database() throws EACCES in Step 5 or 6
- **Response**:
  ```
  Error: Cannot write to data directory: /home/user/.vxllm
  Permission denied

  Fix with: chmod 755 ~/.vxllm
  ```
- **Recovery**:
  - User fixes permissions: `chmod 755 ~/.vxllm`
  - User restarts server

### Database Corruption
- **Symptom**: SQLite file is corrupted or partially initialized
- **Detection**: db.query() throws error in Step 6
- **Response**:
  ```
  Error: Database is locked or corrupted

  Try: rm ~/.vxllm/vxllm.db
  Server will reinitialize on next start
  ```
- **Recovery**:
  - User deletes database: `rm ~/.vxllm/vxllm.db`
  - Server re-creates on startup (all data lost, but recoverable if backed up)

### Model File Missing
- **Symptom**: --model specified but file not found on disk
- **Detection**: loadModel() throws "File not found" in Step 10
- **Response**:
  ```
  ✗ Failed to load model: llama3.1:8b
  File not found at /home/user/.vxllm/models/llama3.1-8b.gguf

  Download with: vxllm pull llama3.1:8b
  Continuing without model (will be loaded on first inference)
  ```
- **Recovery**:
  - User downloads model: `vxllm pull llama3.1:8b`
  - User restarts server with --model flag

### Model Load Fails (OOM or Corrupted File)
- **Symptom**: Model file exists but loading fails (insufficient memory or corrupted)
- **Detection**: node-llama-cpp throws error in Step 10
- **Response**:
  ```
  ✗ Failed to load model: llama3.1:8b
  Out of memory (available: 2GB, required: 5GB)

  Solution 1: Use smaller model or quantization
  Solution 2: Increase available system memory
  Continuing without model (will be loaded on first inference)
  ```
- **Recovery**:
  - User restarts without --model flag (models loaded on-demand)
  - User frees up memory
  - User tries smaller model variant

### Voice Sidecar Startup Fails
- **Symptom**: Python sidecar fails to start (python not found, or port in use)
- **Detection**: startVoiceSidecar() throws error in Step 11
- **Response**:
  ```
  ✗ Failed to start voice sidecar: python3 not found
  Voice features will be unavailable

  Install Python 3 and required packages: pip install faster-whisper kokoro-onnx
  Then enable voice in Settings or restart with updated Python
  ```
- **Recovery**:
  - User installs Python: `sudo apt install python3 python3-pip`
  - User installs dependencies: `pip install faster-whisper kokoro-onnx silero-vad`
  - User restarts server, enables voice in Settings

### Hostname Invalid
- **Symptom**: User specifies invalid hostname (e.g., "host with spaces")
- **Detection**: isValidHostname() returns false in Step 4
- **Response**:
  ```
  Error: invalid host 'host with spaces'
  Use valid hostname or IP address
  ```
- **Recovery**:
  - User provides valid host: `vxllm serve --host localhost`

### Signal Handler Fails During Shutdown
- **Symptom**: Model unload or sidecar termination fails during graceful shutdown
- **Detection**: Exception in gracefulShutdown() in Step 14
- **Response**:
  ```
  → Shutting down...
  ✗ Error unloading model: device lost
  ✗ Error stopping sidecar: timeout
  Forcing shutdown...
  ```
- **Recovery**:
  - Process exits forcefully with exit code 1
  - User may need to manually kill child processes
  - User restarts server

### Long-Running Requests Don't Complete During Shutdown
- **Symptom**: Active inference request still processing during Ctrl+C
- **Detection**: Timeout waiting for active requests in gracefulShutdown()
- **Response**:
  ```
  → Shutting down...
  ⚠ 1 request still active (timeout in 10s)
  Force-closing active requests...
  ✓ Shutdown complete
  ```
- **Recovery**:
  - Clients receive connection reset
  - Users see error: "Server connection lost"
  - Client should retry on next inference

## Permissions
- **Process**: Must run with permissions to:
  - Bind to specified port
  - Write to models directory
  - Create/access SQLite database file
  - (Optional) Start Python subprocess

## Exit Conditions
- **Success**: Server running, listening on port, all subsystems initialized
- **Init Error**: Validation fails (port, directory), process exits with error code
- **Shutdown**: Ctrl+C received, graceful shutdown executed, process exits cleanly (code 0)
- **Crash**: Unhandled exception, process exits with error code

## Data Changes

### Tables Created (if missing)
- **models** — registry of available models
- **download_queue** — download status and progress
- **messages** — conversation history
- **usage_metrics** — inference metrics and stats
- **settings** — configuration key-value pairs

### Files Created
- **~/.vxllm/vxllm.db** — SQLite database file
- **~/.vxllm/models/** — directory for GGUF model files
- **~/.vxllm/logs/** — directory for log files (optional)

### In-Memory State
- **Server instance** (Hono)
- **Database connection** (Drizzle + SQLite)
- **Model cache** (if --model specified)
- **Voice sidecar process** (if enabled)

## Related Documentation
- `/docs/cli/commands.md` — All vxllm CLI commands
- `/docs/deployment/standalone.md` — Running as standalone server
- `/docs/deployment/configuration.md` — All configuration options
- `/docs/voice/setup.md` — Voice sidecar setup and requirements
- `workflow-inference-chat.md` — What happens after server starts

## Changelog
- **v1.0** (2026-03-20): Initial workflow documentation
  - CLI argument parsing and validation
  - Database initialization with migrations
  - Model pre-loading on startup
  - Voice sidecar startup
  - Graceful shutdown handling
  - Comprehensive error scenarios and recovery
