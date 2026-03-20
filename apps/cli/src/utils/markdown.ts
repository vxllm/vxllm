export function renderMarkdown(text: string): string {
  return text
    // Bold: **text** → ANSI bold
    .replace(/\*\*(.+?)\*\*/g, "\x1b[1m$1\x1b[0m")
    // Inline code: `code` → ANSI cyan
    .replace(/`([^`]+)`/g, "\x1b[36m$1\x1b[0m")
    // Code blocks: ```lang\n...\n``` → indented with header
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const header = lang ? `\x1b[2m── ${lang} ──\x1b[0m\n` : "";
      const indented = code
        .split("\n")
        .map((l: string) => `  ${l}`)
        .join("\n");
      return `\n${header}${indented}\n`;
    });
}
