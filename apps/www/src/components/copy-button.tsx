"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] p-2 text-neutral-400 transition-colors hover:border-[#2EFAA0]/20 hover:text-[#2EFAA0] ${className}`}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="h-4 w-4 text-[#2EFAA0]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
