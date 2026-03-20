import { Button } from "@vxllm/ui/components/button";
import { Loader2, Mic, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { env } from "@vxllm/env/web";

type RecorderState = "idle" | "recording" | "transcribing";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  onTranscription,
  disabled,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((t) => t.stop());
        setState("transcribing");

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");

        try {
          const serverUrl = env.VITE_SERVER_URL;
          const res = await fetch(`${serverUrl}/v1/audio/transcriptions`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.text) {
            onTranscription(data.text);
          }
        } catch (err) {
          console.error("[VoiceRecorder] Transcription failed:", err);
        }

        setState("idle");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");
    } catch (err) {
      console.error("[VoiceRecorder] Microphone access denied:", err);
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const handleClick = useCallback(() => {
    if (state === "idle") startRecording();
    else if (state === "recording") stopRecording();
  }, [state, startRecording, stopRecording]);

  return (
    <Button
      variant={state === "recording" ? "destructive" : "ghost"}
      size="icon"
      onClick={handleClick}
      disabled={disabled || state === "transcribing"}
      type="button"
      title={
        state === "idle"
          ? "Start recording"
          : state === "recording"
            ? "Stop recording"
            : "Transcribing..."
      }
    >
      {state === "idle" && <Mic className="size-4" />}
      {state === "recording" && <Square className="size-3 animate-pulse" />}
      {state === "transcribing" && <Loader2 className="size-4 animate-spin" />}
    </Button>
  );
}
