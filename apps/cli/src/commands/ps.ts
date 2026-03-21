import { defineCommand } from "citty";
import consola from "consola";
import { formatDuration } from "../utils/format";

async function getVoiceStatus(voiceUrl: string): Promise<{
  running: boolean;
  stt?: { model?: string; engine?: string } | null;
  tts?: { model?: string; engine?: string } | null;
  vad?: { engine?: string } | null;
}> {
  try {
    const res = await fetch(`${voiceUrl}/health`);
    const data = (await res.json()) as {
      stt?: { model?: string; engine?: string } | null;
      tts?: { model?: string; engine?: string } | null;
      vad?: { engine?: string } | null;
    };
    return { running: true, ...data };
  } catch {
    return { running: false };
  }
}

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
    const serverUrl =
      process.env.VITE_SERVER_URL ||
      `http://localhost:${process.env.PORT || "11500"}`;
    const voicePort = process.env.VOICE_PORT || "11501";
    const voiceUrl = `http://localhost:${voicePort}`;

    try {
      const res = await fetch(`${serverUrl}/health`);
      const data = (await res.json()) as {
        model?: string;
        uptime_seconds?: number;
      };

      if (args.json) {
        const voice = await getVoiceStatus(voiceUrl);
        console.log(JSON.stringify({ ...data, voice }, null, 2));
        return;
      }

      consola.success("Server running");
      consola.info(`Model:  ${data.model ?? "None loaded"}`);
      consola.info(
        `Uptime: ${formatDuration((data.uptime_seconds ?? 0) * 1000)}`,
      );

      // Voice service status
      console.log();
      const voice = await getVoiceStatus(voiceUrl);
      if (voice.running) {
        consola.success(`VOICE SERVICE: running (port ${voicePort})`);
        if (voice.stt) {
          consola.info(
            `  STT: ${voice.stt.model ?? "none"} (${voice.stt.engine ?? "unknown"})`,
          );
        } else {
          consola.info("  STT: not loaded");
        }
        if (voice.tts) {
          consola.info(
            `  TTS: ${voice.tts.model ?? "none"} (${voice.tts.engine ?? "unknown"})`,
          );
        } else {
          consola.info("  TTS: not loaded");
        }
        if (voice.vad) {
          consola.info(`  VAD: ${voice.vad.engine ?? "silero-vad"} (auto)`);
        }
      } else {
        consola.warn("VOICE SERVICE: stopped");
      }
    } catch {
      if (args.json) {
        console.log(JSON.stringify({ status: "stopped" }));
        return;
      }
      consola.warn("Server not running. Start with `vxllm serve`");
    }
  },
});
