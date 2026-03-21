export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-black px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <img src="/logo-no-bg.png" alt="VxLLM" className="h-7 w-7" />
          <span className="font-mono text-sm text-neutral-400">
            VxLLM &middot; MIT License
          </span>
        </div>

        <nav className="flex items-center gap-6">
          <a
            href="https://github.com/vxllm/vxllm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            GitHub
          </a>
          <a
            href="https://docs.vxllm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            Docs
          </a>
          <a
            href="https://github.com/datahase"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            vxllm
          </a>
        </nav>
      </div>
    </footer>
  );
}
