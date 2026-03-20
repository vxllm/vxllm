import { Cpu, Mic, Code, Monitor, Terminal, Container } from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "LLM Inference",
    description:
      "In-process via node-llama-cpp. Metal, CUDA, CPU auto-detected.",
  },
  {
    icon: Mic,
    title: "Voice I/O",
    description:
      "STT + TTS + VAD. Real-time transcription and speech synthesis.",
  },
  {
    icon: Code,
    title: "OpenAI-Compatible",
    description:
      "Drop-in replacement. Works with any OpenAI SDK or client library.",
  },
  {
    icon: Monitor,
    title: "Desktop App",
    description:
      "Tauri 2 native app. System tray, chat UI, model management.",
  },
  {
    icon: Terminal,
    title: "CLI",
    description:
      "serve, pull, run, list, ps, rm. Developer-friendly commands.",
  },
  {
    icon: Container,
    title: "Docker Ready",
    description:
      "docker compose up. Deploy server and voice sidecar anywhere.",
  },
];

export function Features() {
  return (
    <section className="bg-neutral-950 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Features
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-neutral-400">
          Everything you need to run AI models locally, from inference to voice
          to deployment.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700"
            >
              <div className="mb-4 inline-flex rounded-lg bg-indigo-600/10 p-3">
                <feature.icon className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="text-sm text-neutral-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
