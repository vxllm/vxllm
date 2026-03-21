import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VxLLM — Open Source Local AI Server",
    template: "%s | VxLLM",
  },
  description:
    "Self-hostable AI model server with LLM inference, voice I/O, and OpenAI-compatible API. Run AI models locally with no cloud dependency.",
  keywords: [
    "AI",
    "LLM",
    "local AI",
    "model server",
    "OpenAI API",
    "self-hosted",
    "open source",
    "voice AI",
    "TTS",
    "STT",
    "llama.cpp",
    "GGUF",
  ],
  authors: [{ name: "DataHase" }],
  creator: "DataHase",
  metadataBase: new URL("https://vxllm.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://vxllm.com",
    title: "VxLLM — Open Source Local AI Server",
    description:
      "Self-hostable AI model server with LLM inference, voice I/O, and OpenAI-compatible API.",
    siteName: "VxLLM",
  },
  twitter: {
    card: "summary_large_image",
    title: "VxLLM — Open Source Local AI Server",
    description:
      "Run AI models locally with voice I/O and OpenAI-compatible API.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
