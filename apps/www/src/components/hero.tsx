import { ArrowRight, Github } from "lucide-react";
import { Terminal } from "./terminal";

const terminalLines = [
  { type: "prompt" as const, text: "vxllm pull qwen2.5:7b" },
  { type: "output" as const, text: "Downloading qwen2.5-7b-instruct-q4_k_m.gguf..." },
  { type: "success" as const, text: "Model downloaded (4.4 GB)" },
  { type: "spacer" as const },
  { type: "prompt" as const, text: "vxllm serve" },
  { type: "success" as const, text: "Server running at http://localhost:11500" },
  { type: "spacer" as const },
  { type: "prompt" as const, text: 'vxllm run "Explain quantum computing briefly"' },
  {
    type: "output" as const,
    text: "Quantum computing uses qubits that can exist in superposition,",
  },
  {
    type: "output" as const,
    text: "allowing parallel computation for certain problems...",
  },
];

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-6 pt-24 pb-16">
      {/* Background gradient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(46,250,160,0.08)_0%,transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-4 py-1.5 text-sm text-neutral-400"
          style={{ animation: "float 3s ease-in-out infinite" }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full bg-[#2EFAA0]"
            style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
          />
          Open Source &middot; MIT Licensed
        </div>

        {/* Title */}
        <h1
          className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          style={{
            opacity: 0,
            animation: "fadeUp 0.8s ease forwards 0.2s",
          }}
        >
          <span className="text-white">Run AI models</span>
          <br />
          <span
            className="bg-gradient-to-r from-[#2EFAA0] via-cyan-400 to-[#2EFAA0] bg-[length:200%_auto] bg-clip-text text-transparent"
            style={{ animation: "gradientShift 4s ease infinite" }}
          >
            on your hardware.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="mx-auto mb-10 max-w-2xl text-lg text-neutral-400 sm:text-xl"
          style={{
            opacity: 0,
            animation: "fadeUp 0.8s ease forwards 0.4s",
          }}
        >
          Self-hostable model server with LLM inference, voice I/O, and a
          drop-in OpenAI-compatible API.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          style={{
            opacity: 0,
            animation: "fadeUp 0.8s ease forwards 0.6s",
          }}
        >
          <a
            href="https://github.com/DataHase/vxllm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-transparent px-6 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <Github className="h-4 w-4" />
            View on GitHub
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="https://docs.vxllm.com"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2EFAA0] px-6 py-3 text-sm font-medium text-black transition-all hover:bg-[#2EFAA0]/90 hover:shadow-[0_0_30px_rgba(46,250,160,0.3)]"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Terminal mockup */}
      <div
        className="relative z-10 mx-auto mt-16 w-full max-w-2xl"
        style={{
          opacity: 0,
          animation: "fadeUp 0.8s ease forwards 0.8s",
        }}
      >
        <Terminal
          title="vxllm — Terminal"
          lines={terminalLines}
          showCursor
        />
      </div>
    </section>
  );
}
