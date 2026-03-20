import { AnimateOnScroll } from "./animate-on-scroll";
import { Terminal } from "./terminal";

const RELEASES_URL = "https://github.com/DataHase/vxllm/releases";

const platforms = [
  {
    name: "macOS",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-8 w-8 text-white"
      >
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    title: "Download for macOS",
    subtitle: "Apple Silicon & Intel \u00B7 .dmg",
    button: "Download .dmg",
  },
  {
    name: "Linux",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-8 w-8 text-white"
      >
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.564.777.2 1.605.065 2.272-.464.146-.115.04-.36.04-.36-.186-.243-.387-.6-.59-.746-.19-.145-.42-.2-.6-.334-.18-.135-.27-.42-.36-.601-.165-.265-.241-.666-.278-1.07a.57.57 0 00-.183-.39c-.093-.135-.161-.335-.191-.6-.069-.501.08-.965.235-1.399.156-.435.326-.87.317-1.4-.01-.465-.14-.865-.455-1.266l-.003-.004c-.253-.19-.38-.487-.432-.734-.09-.3-.07-.6-.077-.9 0-.132-.015-.265-.025-.399-.042-.39-.126-.725-.254-1-.135-.298-.325-.465-.59-.475a.24.24 0 00-.146-.003c.006-.032.015-.065.015-.098-.01-1.132-.4-1.87-.9-2.47a5.76 5.76 0 00-1.29-1.2 3.13 3.13 0 01-.655-.6c-.191-.254-.254-.6-.18-1.065.045-.268.105-.6.075-.87-.03-.265-.171-.534-.39-.664a.626.626 0 00-.36-.088c-.196 0-.38.078-.48.225-.13.18-.161.465-.126.721.03.199.075.39.045.54-.03.135-.12.21-.27.24-.141.03-.271-.015-.39-.075a1.08 1.08 0 01-.29-.21c-.2-.196-.42-.522-.66-.666a.855.855 0 00-.42-.132c-.24 0-.455.102-.63.237l-.007.007A4.957 4.957 0 009.74 4.47c-.03.264.011.534.075.8.09.335.24.635.45.885.21.25.484.465.8.585a.38.38 0 01.205.19c.04.07.06.145.05.225-.016.072-.05.144-.106.18-.087.067-.2.067-.29.033a1.99 1.99 0 01-.5-.266 3.2 3.2 0 01-.75-.79 2.85 2.85 0 01-.34-.935 2.2 2.2 0 01.015-.87c-.205.03-.405.09-.585.21-.266.175-.434.434-.524.77-.094.337-.11.735-.05 1.13.059.396.178.793.352 1.13.174.334.402.603.685.77.14.083.296.137.458.166a.285.285 0 01.224.178c.021.06.018.12-.006.18-.05.098-.141.16-.24.197a1.08 1.08 0 01-.45.065 2.297 2.297 0 01-1.073-.44c.064.64.272 1.183.602 1.598.33.413.766.686 1.26.79.301.06.613.061.89.02a.285.285 0 01.278.12c.035.055.04.12.023.185-.017.06-.055.11-.11.148-.296.203-.7.31-1.12.264C7.96 11.22 7.35 10.773 7 9.943c-.06.197-.09.4-.09.6 0 .398.09.8.27 1.13.176.33.431.6.76.765.33.166.72.24 1.16.195a.279.279 0 01.27.15c.022.06.016.125-.016.18-.036.058-.09.1-.16.125-.39.142-.845.135-1.26-.03a2.82 2.82 0 01-.89-.6 2.955 2.955 0 01-.465-.75c.006.215.038.432.1.64.1.34.267.666.495.945.23.28.52.51.856.676.337.166.72.265 1.13.265a.28.28 0 01.245.186c.018.06.006.126-.03.18a.28.28 0 01-.15.107c-.445.11-.948.039-1.37-.188a3.2 3.2 0 01-.96-.83c.168.44.436.84.79 1.153.357.316.795.534 1.276.614a2.57 2.57 0 001.41-.15.271.271 0 01.272.07c.04.05.055.114.04.178a.275.275 0 01-.118.17c-.416.262-.93.36-1.425.28a3.08 3.08 0 01-1.23-.515c.225.38.54.712.918.966.38.253.822.413 1.297.466.477.054.97-.004 1.434-.18a.265.265 0 01.268.084c.037.05.048.115.03.175a.27.27 0 01-.125.16 3.545 3.545 0 01-1.56.465" />
      </svg>
    ),
    title: "Download for Linux",
    subtitle: "x64 & ARM64 \u00B7 .AppImage / .deb",
    button: "Download .AppImage",
  },
  {
    name: "Windows",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-8 w-8 text-white"
      >
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
      </svg>
    ),
    title: "Download for Windows",
    subtitle: "x64 \u00B7 .exe / .msi",
    button: "Download .exe",
  },
];

const cliInstallLines = [
  {
    type: "prompt" as const,
    text: "curl -fsSL https://vxllm.com/install.sh | sh",
  },
  { type: "success" as const, text: "VxLLM installed successfully" },
];

export function Download() {
  return (
    <section id="download" className="bg-black px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll>
          <p className="mb-4 text-center text-sm font-semibold tracking-widest text-[#2EFAA0] uppercase">
            Download
          </p>
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Available for every platform.
          </h2>
        </AnimateOnScroll>

        {/* Platform cards */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {platforms.map((platform, i) => (
            <AnimateOnScroll key={platform.name} delay={i * 100}>
              <div className="flex h-full flex-col items-center rounded-xl border border-neutral-800 bg-neutral-900/50 p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-neutral-700">
                <div className="mb-5">{platform.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {platform.title}
                </h3>
                <p className="mb-6 text-sm text-neutral-400">
                  {platform.subtitle}
                </p>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center rounded-lg border border-neutral-700 bg-transparent px-5 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:border-[#2EFAA0]/50 hover:text-white"
                >
                  {platform.button}
                </a>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        {/* CLI install */}
        <AnimateOnScroll delay={400}>
          <div className="mt-12 text-center">
            <p className="mb-4 text-sm text-neutral-400">
              Or install via CLI:
            </p>
            <div className="mx-auto max-w-lg">
              <Terminal title="Terminal" lines={cliInstallLines} />
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
