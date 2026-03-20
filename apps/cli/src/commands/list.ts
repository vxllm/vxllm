import { defineCommand } from "citty";
import { db } from "@vxllm/db";
import { models } from "@vxllm/db/schema/models";
import { eq } from "drizzle-orm";
import { formatBytes, padRight } from "../utils/format";

export default defineCommand({
  meta: { name: "list", description: "List downloaded models" },
  args: {
    json: {
      type: "boolean",
      description: "JSON output",
      default: false,
    },
    type: {
      type: "string",
      description: "Filter by type (llm/stt/tts/embedding)",
    },
  },
  async run({ args }) {
    const results = await db
      .select()
      .from(models)
      .where(eq(models.status, "downloaded"));

    const filtered = args.type
      ? results.filter((m) => m.type === args.type)
      : results;

    if (args.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    if (filtered.length === 0) {
      console.log(
        "\nNo models downloaded. Run `vxllm pull <model>` to download one.\n",
      );
      return;
    }

    console.log();
    console.log(
      padRight("NAME", 25) +
        padRight("TYPE", 10) +
        padRight("VARIANT", 12) +
        padRight("SIZE", 10) +
        "STATUS",
    );
    console.log("\u2500".repeat(67));
    for (const m of filtered) {
      console.log(
        padRight(m.name, 25) +
          padRight(m.type, 10) +
          padRight(m.variant ?? "\u2014", 12) +
          padRight(m.sizeBytes ? formatBytes(m.sizeBytes) : "\u2014", 10) +
          m.status,
      );
    }
    console.log();
  },
});
