"use client";

import { useState } from "react";
import { AnimateOnScroll } from "./animate-on-scroll";
import { ArrowDownToLine } from "lucide-react";

const RELEASES_URL = "https://github.com/datahase/vxllm/releases";

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="5" />
      <path d="M12 13v3" />
      <path d="M7 21l2.5-5h5L17 21" />
      <path d="M9.5 8.5c0-.5.5-1 1-1s1 .5 1 .5" />
      <path d="M12.5 8.5c0-.5.5-1 1-1s1 .5 1 .5" />
      <path d="M10 11c.5.5 1.5.5 2 .5s1.5 0 2-.5" />
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
    architectures: ["Apple Silicon", "Intel"],
    description: "Full Metal GPU acceleration. Native performance on Apple hardware.",
    hasArchSelector: true,
  },
  {
    name: "Linux",
    Icon: LinuxIcon,
    architectures: ["x86_64", "ARM64"],
    description: "CUDA, Vulkan, and CPU support. Docker image available.",
    hasArchSelector: false,
  },
  {
    name: "Windows",
    Icon: WindowsIcon,
    architectures: ["x86_64"],
    description: "CUDA and CPU inference. Native installer with system tray.",
    hasArchSelector: false,
  },
];

export function Download() {
  const [macArch, setMacArch] = useState("apple-silicon");

  return (
    <section id="download" className="relative overflow-hidden bg-black px-6 py-28">
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

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {platforms.map((platform, i) => (
            <AnimateOnScroll key={platform.name} delay={i * 120}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-8 transition-all duration-500 hover:border-[#2EFAA0]/20 hover:shadow-[0_0_60px_rgba(46,250,160,0.06)]">
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

                {/* Download action — consistent across all cards */}
                <div className="mt-auto flex flex-col gap-3">
                  {/* Architecture radio buttons for macOS only */}
                  {platform.hasArchSelector && (
                    <div className="flex gap-2">
                      {[
                        { value: "apple-silicon", label: "Apple Silicon" },
                        { value: "intel", label: "Intel" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setMacArch(opt.value)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 ${
                            macArch === opt.value
                              ? "border-[#2EFAA0]/30 bg-[#2EFAA0]/[0.08] text-[#2EFAA0]"
                              : "border-white/[0.06] bg-white/[0.02] text-neutral-500 hover:border-white/[0.12] hover:text-neutral-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Download button — same style for all */}
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-neutral-300 transition-all duration-300 hover:border-[#2EFAA0]/30 hover:bg-[#2EFAA0]/[0.06] hover:text-[#2EFAA0]"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Download for {platform.name}
                  </a>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
