import { Check, Minus } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

type CellValue = true | false | string;

interface ComparisonRow {
  name: string;
  vxllm: CellValue;
  ollama: CellValue;
  lmstudio: CellValue;
}

const rows: ComparisonRow[] = [
  { name: "Open Source", vxllm: true, ollama: true, lmstudio: false },
  { name: "Voice (STT + TTS)", vxllm: true, ollama: false, lmstudio: false },
  { name: "WebSocket Voice", vxllm: true, ollama: false, lmstudio: false },
  { name: "Desktop GUI", vxllm: true, ollama: true, lmstudio: true },
  { name: "CLI", vxllm: true, ollama: true, lmstudio: false },
  { name: "OpenAI-Compatible API", vxllm: true, ollama: true, lmstudio: true },
  {
    name: "In-Process Inference",
    vxllm: true,
    ollama: "Go wrapper",
    lmstudio: false,
  },
  { name: "Docker Hub", vxllm: true, ollama: true, lmstudio: false },
  { name: "Prometheus Metrics", vxllm: true, ollama: false, lmstudio: false },
  { name: "Dashboard", vxllm: true, ollama: false, lmstudio: true },
  { name: "Tool Calling", vxllm: true, ollama: true, lmstudio: true },
  { name: "Structured Output", vxllm: true, ollama: true, lmstudio: true },
];

function CellContent({ value }: { value: CellValue }) {
  if (value === true) {
    return <Check className="mx-auto h-5 w-5 text-[#2EFAA0]" />;
  }
  if (value === false) {
    return <Minus className="mx-auto h-5 w-5 text-neutral-600" />;
  }
  // String value (e.g. "Go wrapper")
  return (
    <span className="mx-auto block text-center text-xs text-amber-400">
      {value}
    </span>
  );
}

export function Comparison() {
  return (
    <section id="compare" className="bg-black px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <AnimateOnScroll>
          <p className="mb-4 text-center text-sm font-semibold tracking-widest text-[#2EFAA0] uppercase">
            Compare
          </p>
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            How VxLLM stacks up.
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-neutral-400">
            VxLLM combines local inference, voice, and deployment into one
            unified platform.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={200}>
          <div className="overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="px-5 py-4 text-sm font-medium text-neutral-400">
                    Feature
                  </th>
                  <th className="bg-[#2EFAA0]/5 px-5 py-4 text-center text-sm font-semibold text-[#2EFAA0]">
                    VxLLM
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-medium text-neutral-400">
                    Ollama
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-medium text-neutral-400">
                    LM Studio
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-neutral-800/50 transition-colors hover:bg-neutral-900/50"
                  >
                    <td className="px-5 py-3.5 text-sm text-neutral-300">
                      {row.name}
                    </td>
                    <td className="bg-[#2EFAA0]/5 px-5 py-3.5">
                      <CellContent value={row.vxllm} />
                    </td>
                    <td className="px-5 py-3.5">
                      <CellContent value={row.ollama} />
                    </td>
                    <td className="px-5 py-3.5">
                      <CellContent value={row.lmstudio} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
