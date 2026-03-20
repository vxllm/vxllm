import { defineCommand } from "citty";
import consola from "consola";
import path from "node:path";

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
  },
  async run({ args }) {
    // Set env vars before server imports so it picks up the CLI flags
    process.env.PORT = args.port;
    process.env.HOST = args.host;
    if (args.model) process.env.DEFAULT_MODEL = args.model;

    consola.info("Starting VxLLM server...");

    try {
      // Resolve the server entry point at runtime to avoid TS rootDir issues.
      // The path is computed dynamically so TypeScript won't follow it.
      const serverEntry = path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "server",
        "src",
        "index.ts",
      );

      // Dynamic import triggers server startup (calls Bun.serve via default export)
      const serverModule = await import(serverEntry);

      // The server exports { port, hostname, fetch } for Bun.serve.
      // When run under Bun, the default export is automatically picked up
      // from the entry point, but since this is a dynamic import it may
      // not auto-start. Explicitly call Bun.serve with the exported config.
      if (typeof Bun !== "undefined" && serverModule.default) {
        Bun.serve(serverModule.default);
      }

      console.log();
      consola.success(`Server running at http://${args.host}:${args.port}`);
      consola.info(`  API:     http://${args.host}:${args.port}/v1`);
      consola.info(`  Health:  http://${args.host}:${args.port}/health`);
      consola.info(`  RPC:     http://${args.host}:${args.port}/rpc`);
      console.log();
      consola.info("Press Ctrl+C to stop");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      consola.error(`Failed to start: ${message}`);
      process.exit(1);
    }
  },
});
