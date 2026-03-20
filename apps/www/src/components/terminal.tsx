interface TerminalLine {
  type: "prompt" | "output" | "success" | "spacer";
  text?: string;
}

interface TerminalProps {
  title: string;
  lines: TerminalLine[];
  showCursor?: boolean;
  className?: string;
}

export function Terminal({
  title,
  lines,
  showCursor = false,
  className = "",
}: TerminalProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80 ${className}`}
      style={{ animation: "glow 4s ease-in-out infinite" }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-[#FF5F56]" />
          <span className="inline-block h-3 w-3 rounded-full bg-[#FFBD2E]" />
          <span className="inline-block h-3 w-3 rounded-full bg-[#27C93F]" />
        </div>
        <span className="ml-2 font-mono text-xs text-neutral-500">{title}</span>
      </div>

      {/* Terminal body */}
      <div className="p-4 font-mono text-sm leading-relaxed">
        {lines.map((line, i) => {
          if (line.type === "spacer") {
            return <div key={i} className="h-2" />;
          }

          const animDelay = `${i * 0.15}s`;

          if (line.type === "prompt") {
            return (
              <div
                key={i}
                className="opacity-0"
                style={{
                  animation: `slideIn 0.4s ease forwards`,
                  animationDelay: animDelay,
                }}
              >
                <span className="text-[#2EFAA0]">$</span>{" "}
                <span className="text-neutral-200">{line.text}</span>
              </div>
            );
          }

          if (line.type === "success") {
            return (
              <div
                key={i}
                className="opacity-0"
                style={{
                  animation: `slideIn 0.4s ease forwards`,
                  animationDelay: animDelay,
                }}
              >
                <span className="text-[#2EFAA0]">{"✓"}</span>{" "}
                <span className="text-neutral-400">{line.text}</span>
              </div>
            );
          }

          // output
          return (
            <div
              key={i}
              className="text-neutral-500 opacity-0"
              style={{
                animation: `slideIn 0.4s ease forwards`,
                animationDelay: animDelay,
              }}
            >
              {line.text}
            </div>
          );
        })}

        {showCursor && (
          <div
            className="mt-1 opacity-0"
            style={{
              animation: `slideIn 0.4s ease forwards`,
              animationDelay: `${lines.length * 0.15}s`,
            }}
          >
            <span className="text-[#2EFAA0]">$</span>{" "}
            <span
              className="inline-block h-4 w-2 bg-[#2EFAA0]"
              style={{ animation: "blink 1s step-end infinite" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
