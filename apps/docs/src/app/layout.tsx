import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import "./global.css";

export const metadata: Metadata = {
  title: {
    default: "VxLLM Documentation",
    template: "%s | VxLLM Docs",
  },
  description:
    "Documentation for VxLLM — open-source, self-hostable AI model server with LLM inference, voice I/O, and OpenAI-compatible API.",
  metadataBase: new URL("https://docs.vxllm.com"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://docs.vxllm.com",
    title: "VxLLM Documentation",
    description: "Documentation for VxLLM — open-source local AI model server.",
    siteName: "VxLLM Docs",
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
