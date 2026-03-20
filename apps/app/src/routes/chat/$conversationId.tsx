import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { useChatWithPersistence } from "@/hooks/use-chat-persistence";
import { orpc } from "@/utils/orpc";
import { env } from "@vxllm/env/web";

const conversationSearchSchema = z.object({
  prompt: z.string().optional(),
});

export const Route = createFileRoute("/chat/$conversationId")({
  component: ConversationPage,
  validateSearch: conversationSearchSchema,
});

/**
 * Play TTS audio for the given text via the server's speech endpoint.
 * Wrapped in try/catch to handle browser autoplay restrictions gracefully.
 */
async function playTTS(text: string): Promise<void> {
  try {
    const serverUrl = env.VITE_SERVER_URL;
    const res = await fetch(`${serverUrl}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kokoro:v1.0",
        input: text,
        voice: "af_sky",
      }),
    });

    if (!res.ok) {
      console.error("[TTS] Speech request failed:", res.status);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch (err) {
    // Browser autoplay policy may block this — log but don't crash
    console.error("[TTS] Playback failed:", err);
  }
}

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { prompt } = Route.useSearch();
  const navigate = useNavigate();
  const chat = useChatWithPersistence(conversationId);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>();
  const [voiceOutput, setVoiceOutput] = useState(false);
  const prevStatusRef = useRef(chat.status);
  const promptSentRef = useRef(false);

  // Auto-send the prompt from search params (used by example prompt cards)
  useEffect(() => {
    if (prompt && !promptSentRef.current && chat.status === "ready") {
      promptSentRef.current = true;
      chat.sendMessage({ text: prompt });
      // Clear the search param to avoid re-sending on re-render
      navigate({
        to: "/chat/$conversationId",
        params: { conversationId },
        search: {},
        replace: true,
      });
    }
  }, [prompt, chat, conversationId, navigate]);

  const conversationQuery = useQuery(
    orpc.chat.getConversation.queryOptions({
      input: { id: conversationId },
    }),
  );

  const title = conversationQuery.data?.title;

  // Auto-play TTS when voice output is enabled and assistant finishes streaming
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = chat.status;

    if (!voiceOutput) return;

    const wasStreaming = prevStatus === "streaming" || prevStatus === "submitted";
    const isReady = chat.status === "ready";

    if (wasStreaming && isReady) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg?.role === "assistant") {
        const text = lastMsg.parts
          .filter(
            (p): p is Extract<(typeof lastMsg.parts)[number], { type: "text" }> =>
              p.type === "text",
          )
          .map((p) => p.text)
          .join("");

        if (text) {
          playTTS(text);
        }
      }
    }
  }, [chat.status, chat.messages, voiceOutput]);

  const handleSend = useCallback(
    (text: string) => {
      chat.sendMessage({ text });
    },
    [chat],
  );

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        conversationId={conversationId}
        title={title}
        selectedModelId={selectedModelId}
        onModelChange={setSelectedModelId}
        voiceOutput={voiceOutput}
        onVoiceOutputChange={setVoiceOutput}
      />

      <ChatMessages
        messages={chat.messages}
        status={chat.status}
        onRegenerate={() => chat.regenerate()}
      />

      <ChatInput
        onSend={handleSend}
        status={chat.status}
        onStop={chat.stop}
      />
    </div>
  );
}
