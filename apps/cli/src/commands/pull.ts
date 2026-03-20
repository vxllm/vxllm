import { defineCommand } from "citty";
import consola from "consola";
import { DownloadManager, Registry } from "@vxllm/inference";
import { formatBytes } from "../utils/format";

export default defineCommand({
  meta: { name: "pull", description: "Download a model" },
  args: {
    name: {
      type: "positional",
      description: "Model name (e.g., qwen2.5:7b)",
      required: true,
    },
    variant: {
      type: "string",
      description: "Quantization variant",
    },
    force: {
      type: "boolean",
      description: "Re-download if already present",
      default: false,
    },
  },
  async run({ args }) {
    const registry = new Registry();
    await registry.load();
    const modelInfo = await registry.resolve(args.name);
    if (!modelInfo) {
      consola.error(`Model not found: ${args.name}`);
      process.exit(1);
    }

    consola.start(
      `Pulling ${modelInfo.name} (${modelInfo.variant ?? "default"}, ${formatBytes(modelInfo.sizeBytes)})...`,
    );

    const dm = new DownloadManager(registry);
    const progress = await dm.pull(args.name, { variant: args.variant });

    // Poll progress until completed or failed
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const p = dm.getProgress(progress.modelId);
        if (!p) return;

        const pct = Math.round(p.progressPct);
        const barLen = 30;
        const filled = Math.floor((pct / 100) * barLen);
        const bar =
          "\u2501".repeat(filled) + "\u2500".repeat(barLen - filled);
        const speed =
          p.speedBps > 0 ? `${formatBytes(p.speedBps)}/s` : "...";
        process.stdout.write(
          `\r  ${bar} ${pct}%  ${formatBytes(p.downloadedBytes)} / ${formatBytes(p.totalBytes)}  ${speed}  `,
        );

        if (p.status === "completed") {
          clearInterval(interval);
          process.stdout.write("\n");
          consola.success(`Downloaded ${modelInfo.name}`);
          resolve();
        }
        if (p.status === "failed") {
          clearInterval(interval);
          process.stdout.write("\n");
          consola.error(`Failed: ${p.error}`);
          resolve();
        }
      }, 500);
    });
  },
});
