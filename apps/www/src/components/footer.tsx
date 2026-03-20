import { Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-950 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-6">
          <span className="font-mono text-sm font-semibold text-neutral-300">
            VxLLM
          </span>
          <a
            href="https://github.com/DataHase/vxllm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 transition-colors hover:text-neutral-300"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>

        <nav className="flex items-center gap-6">
          <a
            href="https://docs.vxllm.dev"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Docs
          </a>
          <a
            href="https://github.com/DataHase/vxllm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            GitHub
          </a>
        </nav>

        <p className="text-sm text-neutral-600">
          MIT License &middot; Built by{" "}
          <a
            href="https://github.com/DataHase"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 transition-colors hover:text-neutral-300"
          >
            DataHase
          </a>
        </p>
      </div>
    </footer>
  );
}
