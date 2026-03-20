import { Check, Minus } from "lucide-react";

const features = [
  { name: "Open Source", vxllm: true, ollama: true, lmstudio: false },
  { name: "Voice (STT + TTS)", vxllm: true, ollama: false, lmstudio: false },
  { name: "Desktop GUI", vxllm: true, ollama: false, lmstudio: true },
  { name: "CLI", vxllm: true, ollama: true, lmstudio: false },
  { name: "Server Mode", vxllm: true, ollama: true, lmstudio: true },
  { name: "OpenAI-Compatible API", vxllm: true, ollama: true, lmstudio: true },
  { name: "Docker", vxllm: true, ollama: true, lmstudio: false },
  { name: "Real-time WebSocket", vxllm: true, ollama: false, lmstudio: false },
];

function Cell({ supported }: { supported: boolean }) {
  return supported ? (
    <Check className="mx-auto h-5 w-5 text-emerald-400" />
  ) : (
    <Minus className="mx-auto h-5 w-5 text-neutral-600" />
  );
}

export function Comparison() {
  return (
    <section className="bg-neutral-950 px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          How VxLLM Compares
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-neutral-400">
          VxLLM combines the best of local inference, voice, and deployment into
          one unified platform.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="px-4 py-3 text-sm font-medium text-neutral-400">
                  Feature
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-indigo-400">
                  VxLLM
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-neutral-400">
                  Ollama
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-neutral-400">
                  LM Studio
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr
                  key={feature.name}
                  className="border-b border-neutral-800/50"
                >
                  <td className="px-4 py-3 text-sm text-neutral-300">
                    {feature.name}
                  </td>
                  <td className="px-4 py-3">
                    <Cell supported={feature.vxllm} />
                  </td>
                  <td className="px-4 py-3">
                    <Cell supported={feature.ollama} />
                  </td>
                  <td className="px-4 py-3">
                    <Cell supported={feature.lmstudio} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
