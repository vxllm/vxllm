import { defineCommand } from "citty";
import consola from "consola";
import { db } from "@vxllm/db";
import { models } from "@vxllm/db/schema/models";
import { eq, like } from "drizzle-orm";
import fs from "node:fs";
import readline from "node:readline";

export default defineCommand({
  meta: { name: "rm", description: "Remove a downloaded model" },
  args: {
    name: {
      type: "positional",
      description: "Model name",
      required: true,
    },
    force: {
      type: "boolean",
      description: "Skip confirmation",
      default: false,
    },
  },
  async run({ args }) {
    const results = await db
      .select()
      .from(models)
      .where(like(models.name, `%${args.name}%`));

    if (results.length === 0) {
      consola.error(`Model not found: ${args.name}`);
      process.exit(1);
    }

    const model = results[0]!;

    if (!args.force) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await new Promise<string>((resolve) =>
        rl.question(`Remove ${model.name}? (y/N) `, resolve),
      );
      rl.close();
      if (answer.toLowerCase() !== "y") {
        consola.info("Cancelled");
        return;
      }
    }

    // Delete file from disk
    if (model.localPath) {
      try {
        fs.unlinkSync(model.localPath);
      } catch {
        // File may already be gone
      }
    }

    // Delete from DB
    await db.delete(models).where(eq(models.id, model.id));
    consola.success(`Removed ${model.name}`);
  },
});
