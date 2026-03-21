import { defineCommand } from "citty";
import consola from "consola";
import path from "node:path";
import { spawn } from "node:child_process";

export default defineCommand({
  meta: { name: "serve", description: "Start VxLLM server" },
  args: {
    port: {
      type: "string",
      description: "Server port",
      default: "11500",
    },
    host: {
      type: "string",
      description: "Bind host",
      default: "127.0.0.1",
    },
    model: {
      type: "string",
      description: "Auto-load model on startup",
    },
    voice: {
      type: "boolean",
      description: "Also start the Python voice service",
      default: true,
    },
    "voice-port": {
      type: "string",
      description: "Voice service port",
      default: "11501",
    },
  },
  async run({ args }) {
    // Set env vars before server imports so it picks up the CLI flags
    process.env.PORT = args.port;
    process.env.HOST = args.host;
    if (args.model) process.env.DEFAULT_MODEL = args.model;

    let voiceProcess: ReturnType<typeof spawn> | null = null;

    // Start Python voice service if --voice is enabled
    if (args.voice) {
      const voiceDir = path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "voice",
      );

      try {
        voiceProcess = spawn(
          "uv",
          ["run", "uvicorn", "app.main:app", "--host", args.host, "--port", args["voice-port"]],
          {
            cwd: voiceDir,
            stdio: "pipe",
            env: {
              ...process.env,
              VOICE_HOST: args.host,
              VOICE_PORT: args["voice-port"],
            },
          },
        );

        voiceProcess.on("error", (err: any) => {
          consola.warn(`Voice service failed to start: ${err.message}`);
          consola.info("Voice features will be unavailable. Install Python + uv to enable.");
        });

        voiceProcess.on("exit", (code: any) => {
          if (code !== null && code !== 0) {
            consola.warn(`Voice service exited with code ${code}`);
          }
        });

        // Give it a moment to start
        await new Promise((resolve) => setTimeout(resolve, 1000));
        consola.success(`Voice service starting on http://${args.host}:${args["voice-port"]}`);
      } catch {
        consola.warn("Could not start voice service (uv/Python not found)");
        consola.info("Voice features will be unavailable.");
      }
    }

    consola.info("Starting VxLLM server...");

    try {
      const serverEntry = path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "server",
        "src",
        "index.ts",
      );

      const serverModule = await import(serverEntry);

      if (typeof Bun !== "undefined" && serverModule.default) {
        Bun.serve(serverModule.default);
      }

      console.log();
      consola.success(`Server running at http://${args.host}:${args.port}`);
      consola.info(`  API:     http://${args.host}:${args.port}/v1`);
      consola.info(`  Health:  http://${args.host}:${args.port}/health`);
      consola.info(`  RPC:     http://${args.host}:${args.port}/rpc`);
      if (args.voice) {
        consola.info(`  Voice:   http://${args.host}:${args["voice-port"]}`);
      }
      console.log();
      consola.info("Press Ctrl+C to stop");

      // Graceful shutdown — kill voice service too
      const shutdown = () => {
        if (voiceProcess && !voiceProcess.killed) {
          voiceProcess.kill("SIGTERM");
        }
        process.exit(0);
      };

      process.on("SIGTERM", shutdown);
      process.on("SIGINT", shutdown);
    } catch (err: unknown) {
      if (voiceProcess && !voiceProcess.killed) voiceProcess.kill();
      const message = err instanceof Error ? err.message : String(err);
      consola.error(`Failed to start: ${message}`);
      process.exit(1);
    }
  },
});
