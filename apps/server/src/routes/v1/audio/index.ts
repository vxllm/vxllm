import { Hono } from "hono";

import { createTranscriptionsRoute } from "./transcriptions";
import { createSpeechRoute } from "./speech";
import { createVoicesRoute } from "./voices";

/**
 * Combined audio routes mounted at /v1/audio.
 *
 * - POST /v1/audio/transcriptions — STT (proxies to voice service /transcribe)
 * - POST /v1/audio/speech — TTS (proxies to voice service /speak)
 * - GET  /v1/audio/voices — list available TTS voices
 */
export function createAudioRoutes() {
  const audio = new Hono();

  audio.route("", createTranscriptionsRoute());
  audio.route("", createSpeechRoute());
  audio.route("", createVoicesRoute());

  return audio;
}
