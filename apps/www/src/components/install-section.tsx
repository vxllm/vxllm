export function InstallSection() {
  return (
    <section className="bg-neutral-950 px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Get Started in Seconds
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-neutral-400">
          Three ways to start running AI models locally.
        </p>

        <div className="space-y-8">
          {/* CLI */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex rounded-md bg-indigo-600/10 px-2.5 py-1 text-xs font-medium text-indigo-400">
                CLI
              </span>
              <span className="text-sm text-neutral-400">
                Recommended for developers
              </span>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-4 text-sm text-neutral-300">
              <code>{`bun add -g vxllm
vxllm pull qwen2.5:7b
vxllm serve`}</code>
            </pre>
          </div>

          {/* Docker */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex rounded-md bg-emerald-600/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                Docker
              </span>
              <span className="text-sm text-neutral-400">
                For server deployment
              </span>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-4 text-sm text-neutral-300">
              <code>{`git clone https://github.com/DataHase/vxllm.git
cd vxllm && docker compose -f docker/docker-compose.yml up -d`}</code>
            </pre>
          </div>

          {/* Desktop */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex rounded-md bg-cyan-600/10 px-2.5 py-1 text-xs font-medium text-cyan-400">
                Desktop
              </span>
              <span className="text-sm text-neutral-400">
                For non-technical users
              </span>
            </div>
            <p className="text-sm text-neutral-300">
              Download the Tauri 2 desktop app from{" "}
              <a
                href="https://github.com/DataHase/vxllm/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
              >
                GitHub Releases
              </a>
              . Available for macOS, Windows, and Linux.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
