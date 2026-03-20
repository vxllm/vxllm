"use client";

import { useEffect, useState } from "react";
import { Github } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Compare", href: "#compare" },
  { label: "Docker", href: "#docker" },
  { label: "Docs", href: "https://docs.vxllm.com", external: true },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-neutral-800/50 bg-black/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2EFAA0]" />
          <span className="font-mono text-sm font-bold text-white">VxLLM</span>
        </a>

        {/* Center links */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="group relative text-sm text-neutral-400 transition-colors hover:text-white"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#2EFAA0] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/datahase/vxllm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-transparent px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="https://docs.vxllm.com"
            className="inline-flex items-center rounded-lg bg-[#2EFAA0] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#2EFAA0]/90"
          >
            Get Started
          </a>
        </div>
      </nav>
    </header>
  );
}
