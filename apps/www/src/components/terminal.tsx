"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const commands = lines
      .filter((l) => l.type === "prompt")
      .map((l) => l.text)
      .join("\n");
    navigator.clipboard.writeText(commands);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80 ${className}`}
      style={{ animation: "glow 4s ease-in-out infinite" }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#FF5F56]" />
            <span className="inline-block h-3 w-3 rounded-full bg-[#FFBD2E]" />
            <span className="inline-block h-3 w-3 rounded-full bg-[#27C93F]" />
          </div>
          <span className="ml-2 font-mono text-xs text-neutral-500">
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-[#2EFAA0]"
          aria-label={copied ? "Copied" : "Copy commands"}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#2EFAA0]" />
              <span className="text-[#2EFAA0]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
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
