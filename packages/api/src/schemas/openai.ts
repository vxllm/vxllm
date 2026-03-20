import { z } from "zod";

// ── Chat Completion Message ─────────────────────────────────────────────────
export const ChatCompletionMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});
export type ChatCompletionMessage = z.infer<typeof ChatCompletionMessageSchema>;

// ── Chat Completion Request ─────────────────────────────────────────────────
export const ChatCompletionRequestSchema = z.object({
  messages: z.array(ChatCompletionMessageSchema).min(1),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.array(z.string()).optional(),
  n: z.number().int().positive().optional(),
  user: z.string().optional(),
});
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

// ── Usage ───────────────────────────────────────────────────────────────────
const UsageSchema = z.object({
  prompt_tokens: z.number().int(),
  completion_tokens: z.number().int(),
  total_tokens: z.number().int(),
});

// ── Chat Completion Response ────────────────────────────────────────────────
export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion"),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(
    z.object({
      message: ChatCompletionMessageSchema.extend({
        role: z.literal("assistant"),
      }),
      finish_reason: z.string().nullable(),
      index: z.number().int(),
    }),
  ),
  usage: UsageSchema,
});
export type ChatCompletionResponse = z.infer<
  typeof ChatCompletionResponseSchema
>;

// ── Chat Completion Chunk (Streaming) ───────────────────────────────────────
export const ChatCompletionChunkSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(
    z.object({
      delta: z.object({
        role: z.enum(["assistant"]).optional(),
        content: z.string().optional(),
      }),
      finish_reason: z.string().nullable(),
      index: z.number().int(),
    }),
  ),
  usage: UsageSchema.optional(),
});
export type ChatCompletionChunk = z.infer<typeof ChatCompletionChunkSchema>;

// ── Embedding Request ───────────────────────────────────────────────────────
export const EmbeddingRequestSchema = z.object({
  input: z.union([z.string(), z.array(z.string())]),
  model: z.string(),
  encoding_format: z.enum(["float", "base64"]).optional(),
});
export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;

// ── Embedding Response ──────────────────────────────────────────────────────
export const EmbeddingResponseSchema = z.object({
  object: z.literal("list"),
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number().int(),
      object: z.literal("embedding"),
    }),
  ),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number().int(),
    total_tokens: z.number().int(),
  }),
});
export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;

// ── Audio Transcription Request ─────────────────────────────────────────────
export const AudioTranscriptionRequestSchema = z.object({
  model: z.string(),
  language: z.string().optional(),
  prompt: z.string().optional(),
  response_format: z
    .enum(["json", "text", "srt", "verbose_json", "vtt"])
    .optional(),
  temperature: z.number().min(0).max(1).optional(),
});
export type AudioTranscriptionRequest = z.infer<
  typeof AudioTranscriptionRequestSchema
>;

// ── Audio Speech Request ────────────────────────────────────────────────────
export const AudioSpeechRequestSchema = z.object({
  model: z.string(),
  input: z.string(),
  voice: z.string(),
  response_format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm"]).optional(),
  speed: z.number().min(0.25).max(4).optional(),
});
export type AudioSpeechRequest = z.infer<typeof AudioSpeechRequestSchema>;

// ── Model Object ────────────────────────────────────────────────────────────
export const ModelObjectSchema = z.object({
  id: z.string(),
  object: z.literal("model"),
  created: z.number().int(),
  owned_by: z.string(),
});
export type ModelObject = z.infer<typeof ModelObjectSchema>;

// ── Model List Response ─────────────────────────────────────────────────────
export const ModelListResponseSchema = z.object({
  object: z.literal("list"),
  data: z.array(ModelObjectSchema),
});
export type ModelListResponse = z.infer<typeof ModelListResponseSchema>;

// ── OpenAI Error ────────────────────────────────────────────────────────────
export const OpenAIErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    code: z.string().nullable().optional(),
    param: z.string().nullable().optional(),
  }),
});
export type OpenAIError = z.infer<typeof OpenAIErrorSchema>;
