import { Zap, Mic, Plug, Monitor, Terminal, Container } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const features = [
  {
    icon: Zap,
    title: "LLM Inference",
    description:
      "In-process via node-llama-cpp. Metal, CUDA, and CPU auto-detected. No wrapper overhead.",
  },
  {
    icon: Mic,
    title: "Voice I/O",
    description:
      "STT (faster-whisper) + TTS (Kokoro) + VAD. Real-time transcription and speech synthesis via WebSocket.",
  },
  {
    icon: Plug,
    title: "OpenAI-Compatible API",
    description:
      "Drop-in replacement for /v1/chat/completions, /v1/embeddings, and more. Works with any OpenAI SDK.",
  },
  {
    icon: Monitor,
    title: "Desktop App",
    description:
      "Tauri 2 native app with system tray, chat UI, model management, and hardware dashboard.",
  },
  {
    icon: Terminal,
    title: "CLI",
    description:
      "vxllm serve, pull, run, list, ps, rm. Developer-friendly commands for every workflow.",
  },
  {
    icon: Container,
    title: "Docker Ready",
    description:
      "docker pull vxllm/vxllm. Deploy the server and voice service anywhere with one command.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-black px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll>
          <p className="mb-4 text-center text-sm font-semibold tracking-widest text-[#2EFAA0] uppercase">
            Features
          </p>
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need to run AI locally.
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-neutral-400">
            Fast inference, voice I/O, and a familiar API — all on your machine.
          </p>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <AnimateOnScroll key={feature.title} delay={i * 100}>
              <div className="group relative h-full rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-neutral-700">
                {/* Green top border glow on hover */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2EFAA0]/0 to-transparent transition-all duration-300 group-hover:via-[#2EFAA0]/60" />

                <div className="mb-4 inline-flex rounded-lg bg-[#2EFAA0]/10 p-3 transition-transform duration-300 group-hover:scale-110">
                  <feature.icon className="h-6 w-6 text-[#2EFAA0]" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-400">
                  {feature.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
