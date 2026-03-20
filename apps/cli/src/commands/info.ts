import { defineCommand } from "citty";
import consola from "consola";
import { detectHardware } from "@vxllm/inference";
import { formatBytes } from "../utils/format";

export default defineCommand({
  meta: { name: "info", description: "Show hardware profile" },
  args: {
    json: { type: "boolean", description: "JSON output", default: false },
  },
  async run({ args }) {
    const hw = await detectHardware();
    if (args.json) {
      console.log(JSON.stringify(hw, null, 2));
      return;
    }
    console.log();
    consola.info(
      `Platform:      ${hw.platform} (${hw.arch})`,
    );
    consola.info(
      `GPU:           ${hw.gpu.available ? `${hw.gpu.name} (${hw.gpu.vendor}) — ${formatBytes(hw.gpu.vramBytes)} VRAM` : "None"}`,
    );
    consola.info(
      `CPU:           ${hw.cpu.model} — ${hw.cpu.physicalCores} cores (${hw.cpu.logicalCores} logical)`,
    );
    consola.info(
      `RAM:           ${formatBytes(hw.ram.totalBytes)} total, ${formatBytes(hw.ram.availableBytes)} available`,
    );
    consola.info(
      `Apple Silicon: ${hw.isAppleSilicon ? "Yes" : "No"}`,
    );
    console.log();
  },
});
