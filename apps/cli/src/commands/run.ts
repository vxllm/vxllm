import { defineCommand } from "citty";
import consola from "consola";
import readline from "node:readline";
import { streamText } from "ai";
import { ModelManager, Registry } from "@vxllm/inference";
import { createLlamaProvider } from "@vxllm/llama-provider";
import { db } from "@vxllm/db";
import { models as modelsTable } from "@vxllm/db/schema/models";
import { eq } from "drizzle-orm";

export default defineCommand({
  meta: { name: "run", description: "Interactive chat with a model" },
  args: {
    name: {
      type: "positional",
      description: "Model name",
      required: true,
    },
    system: {
      type: "string",
      description: "System prompt",
    },
    temperature: {
      type: "string",
      description: "Temperature",
      default: "0.7",
    },
  },
  async run({ args }) {
    // Resolve model from registry
    const registry = new Registry();
    await registry.load();
    const modelInfo = await registry.resolve(args.name);
    if (!modelInfo) {
      consola.error(`Model not found: ${args.name}`);
      process.exit(1);
    }

    // Check if downloaded (query DB)
    const dbModels = await db
      .select()
      .from(modelsTable)
      .where(eq(modelsTable.name, modelInfo.name));
    const dbModel = dbModels[0];
    if (!dbModel || dbModel.status !== "downloaded" || !dbModel.localPath) {
      consola.error(`Model not downloaded. Run: vxllm pull ${args.name}`);
      process.exit(1);
    }

    // Load model
    const mm = new ModelManager();
    consola.start(`Loading ${modelInfo.name}...`);
    const loaded = await mm.load({
      ...modelInfo,
      localPath: dbModel.localPath,
    });
    consola.success(
      `Loaded (${loaded.contextSize} ctx, ${loaded.gpuLayersLoaded} GPU layers)`,
    );

    const provider = createLlamaProvider(mm);
    const model = provider.chat(loaded.sessionId);

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];
    if (args.system) messages.push({ role: "system", content: args.system });

    console.log(`\nChat with ${modelInfo.name}. Type /bye to exit.\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = (): void => {
      rl.question(">>> ", async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
          askQuestion();
          return;
        }
        if (trimmed === "/bye") {
          console.log("\nGoodbye!\n");
          await mm.disposeAll();
          rl.close();
          return;
        }

        messages.push({ role: "user", content: trimmed });

        const startTime = Date.now();
        let fullResponse = "";

        try {
          const result = streamText({
            model,
            messages,
            temperature: parseFloat(args.temperature),
          });

          process.stdout.write("\n");
          for await (const chunk of result.textStream) {
            process.stdout.write(chunk);
            fullResponse += chunk;
          }
          process.stdout.write("\n");

          const elapsed = Date.now() - startTime;
          const usage = await result.usage;
          const outputTokens = usage?.outputTokens ?? 0;
          const tokPerSec =
            elapsed > 0 ? outputTokens / (elapsed / 1000) : 0;

          // Stats line (dim)
          console.log(
            `\x1b[2m${outputTokens} tokens \u00b7 ${(elapsed / 1000).toFixed(1)}s \u00b7 ${tokPerSec.toFixed(1)} tok/s\x1b[0m\n`,
          );

          messages.push({ role: "assistant", content: fullResponse });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : String(err);
          consola.error(`Error: ${message}`);
        }

        askQuestion();
      });
    };

    askQuestion();
  },
});
