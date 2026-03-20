import { defineCommand } from "citty";
import consola from "consola";
import { formatDuration } from "../utils/format";

export default defineCommand({
  meta: { name: "ps", description: "Show server status and loaded models" },
  args: {
    json: {
      type: "boolean",
      description: "JSON output",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const res = await fetch("http://localhost:11500/health");
      const data = (await res.json()) as {
        model?: string;
        uptime_seconds?: number;
      };
      if (args.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      consola.success("Server running");
      consola.info(`Model:  ${data.model ?? "None loaded"}`);
      consola.info(
        `Uptime: ${formatDuration((data.uptime_seconds ?? 0) * 1000)}`,
      );
    } catch {
      if (args.json) {
        console.log(JSON.stringify({ status: "stopped" }));
        return;
      }
      consola.warn("Server not running. Start with `vxllm serve`");
    }
  },
});
