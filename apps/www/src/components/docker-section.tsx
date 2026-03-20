import { AnimateOnScroll } from "./animate-on-scroll";
import { Terminal } from "./terminal";

const dockerLines = [
  { type: "prompt" as const, text: "docker pull datahase/vxllm" },
  { type: "success" as const, text: "Image pulled (latest)" },
  { type: "spacer" as const },
  { type: "prompt" as const, text: "docker run -p 11500:11500 datahase/vxllm" },
  {
    type: "success" as const,
    text: "VxLLM running at http://localhost:11500",
  },
];

export function DockerSection() {
  return (
    <section id="docker" className="relative bg-black px-6 py-24">
      {/* Green radial glow behind terminal */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(46,250,160,0.06)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <AnimateOnScroll>
          <p className="mb-4 text-center text-sm font-semibold tracking-widest text-[#2EFAA0] uppercase">
            Docker
          </p>
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Deploy anywhere with Docker.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-neutral-400">
            Pull the official image and start serving models in seconds.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={200}>
          <div className="mx-auto max-w-2xl">
            <Terminal title="docker — Terminal" lines={dockerLines} />
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
