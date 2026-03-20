"use client";

import { AnimateOnScroll } from "./animate-on-scroll";
import { ArrowDownToLine, ChevronRight } from "lucide-react";

const RELEASES_URL = "https://github.com/DataHase/vxllm/releases";

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 448 512" fill="currentColor" className={className}>
      <path d="M220.8 123.3c1 .5 1.8 1.7 3 1.7 1.1 0 2.8-.4 2.9-1.5.2-1.4-1.9-2.3-3.2-2.9-1.7-.7-3.9-1-5.5-.1-.4.2-.8.7-.6 1.1.3 1.3 2.3 1.1 3.4 1.7zm-21.9 1.7c1.2 0 2-1.2 3-1.7 1.1-.6 3.1-.4 3.5-1.6.2-.4-.2-.9-.6-1.1-1.6-.9-3.8-.6-5.5.1-1.3.6-3.4 1.5-3.2 2.9.1 1 1.8 1.5 2.8 1.4zM420 403.8c-3.6-4-5.3-11.6-7.2-19.7-1.8-8.1-3.9-16.8-10.5-22.4-1.3-1.1-2.6-2.1-4-2.9-1.3-.8-2.7-1.5-4.1-2 9.2-27.3 5.6-54.5-3.7-79.1-11.4-30.1-31.3-56.4-46.5-74.4-17.1-21.5-33.7-41.9-33.4-72C311.1 85.4 315.7.1 234.8 0 132.4-.2 158 103.4 156.9 135.2c-1.7 23.4-6.4 41.8-22.5 64.7-18.9 22.5-45.5 58.8-58.1 96.7-6 17.9-8.8 36.1-6.2 53.3-6.5 5.8-11.4 14.7-16.6 20.2-4.2 4.3-10.3 5.9-17 8.3s-14 6-18.5 14.5c-2.1 3.9-2.8 8.1-2.8 12.4 0 3.9.6 7.9 1.2 11.8 1.2 8.1 2.6 15.2.8 20.8-5.2 14.4-5.9 24.4-2.2 31.7 3.8 7.1 11.4 10.4 20.7 12.8 17.7 4.5 42.3 4.6 52.7 15.2 17.2 17.3 35.4 17.9 48.2 12.6 6.9-2.6 12.4-7.2 16.2-13.2 2.4-3.7 4.2-8 5.4-12.7 1.4.4 2.9.7 4.4.8 3.3.3 6.7-.2 9.8-1.4 6.9-2.6 12.4-8.2 16-15.6 1.6 4.5 3.9 8.4 7 11.5 4.4 4.4 10.1 6.5 15.6 6.5 5.3-.1 10.5-2 14.3-5.8 4.2-4.2 6.6-10.4 7.3-18.3.6-7.5-.7-16.4-4.5-26.5 1.6-.5 3.1-1.1 4.5-1.9 5.3-2.9 8.2-7.6 10.2-12.7 2.3-5.7 3.6-12.2 5.1-18.5 1.5-6.2 3-12 5.8-16.2 3-4.6 8.6-8.4 16.7-8.4h.2c7.3.1 12.5 3.3 16.1 7.7 3.6 4.3 5.8 9.9 7.6 15.5 3.5 11.4 5.4 22.7 12.5 28.4 3.1 2.5 7.5 4.3 13.7 4.3 6.3 0 14.4-1.9 25.1-6.8 10.4-4.8 18-9.3 22.7-15.3 2.3-3 3.7-6.4 4.2-10.5.5-4.1-.1-8.8-1.8-14.5z" />
    </svg>
  );
}

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

const platforms = [
  {
    name: "macOS",
    Icon: AppleIcon,
    architectures: ["Apple Silicon (M1–M4)", "Intel (x86_64)"],
    description: "Full Metal GPU acceleration. Native performance on Apple hardware.",
    gradient: "from-white/[0.04] to-white/[0.01]",
  },
  {
    name: "Linux",
    Icon: LinuxIcon,
    architectures: ["x86_64", "ARM64"],
    description: "CUDA, Vulkan, and CPU support. Docker image available.",
    gradient: "from-white/[0.03] to-white/[0.01]",
  },
  {
    name: "Windows",
    Icon: WindowsIcon,
    architectures: ["x86_64"],
    description: "CUDA and CPU inference. Native installer with system tray.",
    gradient: "from-white/[0.03] to-white/[0.01]",
  },
];

export function Download() {
  return (
    <section id="download" className="relative overflow-hidden bg-black px-6 py-28">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(46,250,160,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(46,250,160,0.3) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <AnimateOnScroll>
          <p className="mb-4 text-center text-[11px] font-semibold tracking-[0.2em] text-[#2EFAA0] uppercase">
            Download
          </p>
          <h2 className="mb-3 text-center text-4xl font-bold tracking-tight text-white md:text-5xl">
            Available for every platform.
          </h2>
          <p className="mx-auto mb-16 max-w-md text-center text-lg text-neutral-500">
            Desktop app, CLI, or Docker — pick your way in.
          </p>
        </AnimateOnScroll>

        {/* Platform cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {platforms.map((platform, i) => (
            <AnimateOnScroll key={platform.name} delay={i * 120}>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-8 transition-all duration-500 hover:border-[#2EFAA0]/20 hover:shadow-[0_0_60px_rgba(46,250,160,0.06)]"
              >
                {/* Hover glow */}
                <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#2EFAA0]/0 transition-all duration-700 group-hover:bg-[#2EFAA0]/[0.04] group-hover:blur-3xl" />

                {/* Icon */}
                <div className="relative mb-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all duration-300 group-hover:border-[#2EFAA0]/20 group-hover:bg-[#2EFAA0]/[0.06]">
                    <platform.Icon className="h-7 w-7 text-neutral-300 transition-colors duration-300 group-hover:text-[#2EFAA0]" />
                  </div>
                </div>

                {/* Title */}
                <h3 className="mb-1 text-xl font-semibold text-white">
                  {platform.name}
                </h3>

                {/* Description */}
                <p className="mb-5 text-[13px] leading-relaxed text-neutral-500">
                  {platform.description}
                </p>

                {/* Architecture tags */}
                <div className="mb-6 flex flex-wrap gap-2">
                  {platform.architectures.map((arch) => (
                    <span
                      key={arch}
                      className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-mono text-[11px] text-neutral-400 transition-colors duration-300 group-hover:border-[#2EFAA0]/10 group-hover:text-neutral-300"
                    >
                      {arch}
                    </span>
                  ))}
                </div>

                {/* Download button */}
                <div className="mt-auto flex items-center gap-2 text-sm font-medium text-neutral-400 transition-all duration-300 group-hover:text-[#2EFAA0]">
                  <ArrowDownToLine className="h-4 w-4" />
                  <span>Download for {platform.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 translate-x-0 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </a>
            </AnimateOnScroll>
          ))}
        </div>

      </div>
    </section>
  );
}
