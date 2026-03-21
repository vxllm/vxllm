import { defineCommand } from "citty";
import consola from "consola";

function getServerUrl(): string {
  return (
    process.env.VITE_SERVER_URL ||
    `http://localhost:${process.env.PORT || "11500"}`
  );
}

function getVoiceUrl(): string {
  return `http://localhost:${process.env.VOICE_PORT || "11501"}`;
}

const statusCommand = defineCommand({
  meta: { name: "status", description: "Show voice service status" },
  async run() {
    const voiceUrl = getVoiceUrl();
    try {
      const res = await fetch(`${voiceUrl}/health`);
      const data = (await res.json()) as {
        status?: string;
        stt?: { model?: string; engine?: string } | null;
        tts?: { model?: string; engine?: string } | null;
        vad?: { engine?: string } | null;
      };

      consola.success(`Voice service: running (${voiceUrl})`);
      if (data.stt) {
        consola.info(
          `  STT: ${data.stt.model ?? "none"} (${data.stt.engine ?? "unknown"})`,
        );
      } else {
        consola.info("  STT: not loaded");
      }
      if (data.tts) {
        consola.info(
          `  TTS: ${data.tts.model ?? "none"} (${data.tts.engine ?? "unknown"})`,
        );
      } else {
        consola.info("  TTS: not loaded");
      }
      if (data.vad) {
        consola.info(`  VAD: ${data.vad.engine ?? "silero-vad"} (auto)`);
      }
    } catch {
      consola.warn("Voice service not running.");
      consola.info(
        "Start with `vxllm serve --voice` or start the voice service manually.",
      );
    }
  },
});

const loadSttCommand = defineCommand({
  meta: { name: "stt", description: "Load an STT model" },
  args: {
    model: {
      type: "positional",
      description: "STT model name",
      required: true,
    },
  },
  async run({ args }) {
    const serverUrl = getServerUrl();
    consola.start(`Loading STT model: ${args.model}...`);
    try {
      const res = await fetch(`${serverUrl}/rpc/voice.loadModel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "stt", model: args.model }),
      });
      if (!res.ok) {
        const text = await res.text();
        consola.error(`Failed to load STT model: ${text}`);
        process.exit(1);
      }
      consola.success(`STT model loaded: ${args.model}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      consola.error(`Could not reach server: ${message}`);
      process.exit(1);
    }
  },
});

const loadTtsCommand = defineCommand({
  meta: { name: "tts", description: "Load a TTS model" },
  args: {
    model: {
      type: "positional",
      description: "TTS model name",
      required: true,
    },
  },
  async run({ args }) {
    const serverUrl = getServerUrl();
    consola.start(`Loading TTS model: ${args.model}...`);
    try {
      const res = await fetch(`${serverUrl}/rpc/voice.loadModel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tts", model: args.model }),
      });
      if (!res.ok) {
        const text = await res.text();
        consola.error(`Failed to load TTS model: ${text}`);
        process.exit(1);
      }
      consola.success(`TTS model loaded: ${args.model}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      consola.error(`Could not reach server: ${message}`);
      process.exit(1);
    }
  },
});

const loadCommand = defineCommand({
  meta: { name: "load", description: "Load a voice model (stt or tts)" },
  subCommands: {
    stt: loadSttCommand,
    tts: loadTtsCommand,
  },
});

const unloadSttCommand = defineCommand({
  meta: { name: "stt", description: "Unload the STT model" },
  async run() {
    const serverUrl = getServerUrl();
    consola.start("Unloading STT model...");
    try {
      const res = await fetch(`${serverUrl}/rpc/voice.unloadModel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "stt" }),
      });
      if (!res.ok) {
        const text = await res.text();
        consola.error(`Failed to unload STT model: ${text}`);
        process.exit(1);
      }
      consola.success("STT model unloaded");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      consola.error(`Could not reach server: ${message}`);
      process.exit(1);
    }
  },
});

const unloadTtsCommand = defineCommand({
  meta: { name: "tts", description: "Unload the TTS model" },
  async run() {
    const serverUrl = getServerUrl();
    consola.start("Unloading TTS model...");
    try {
      const res = await fetch(`${serverUrl}/rpc/voice.unloadModel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tts" }),
      });
      if (!res.ok) {
        const text = await res.text();
        consola.error(`Failed to unload TTS model: ${text}`);
        process.exit(1);
      }
      consola.success("TTS model unloaded");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      consola.error(`Could not reach server: ${message}`);
      process.exit(1);
    }
  },
});

const unloadCommand = defineCommand({
  meta: { name: "unload", description: "Unload a voice model (stt or tts)" },
  subCommands: {
    stt: unloadSttCommand,
    tts: unloadTtsCommand,
  },
});

export default defineCommand({
  meta: { name: "voice", description: "Manage voice service and models" },
  subCommands: {
    status: statusCommand,
    load: loadCommand,
    unload: unloadCommand,
  },
});
