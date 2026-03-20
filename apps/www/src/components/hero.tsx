import { ArrowRight, Github } from "lucide-react";

export function Hero() {
  return (
    <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-6 py-32 text-center">
      {/* Gradient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12)_0%,transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm text-neutral-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Open Source &middot; MIT License
        </div>

        <h1 className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Run AI Models{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Locally
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-neutral-400 sm:text-xl">
          Open source model server with LLM inference, voice I/O, and
          OpenAI-compatible API. Self-host on your hardware or deploy to the
          cloud.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/DataHase/vxllm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-6 py-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
          <a
            href="https://docs.vxllm.com"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
