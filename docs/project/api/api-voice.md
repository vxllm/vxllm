# API: Voice

**Status:** Draft
**Version:** 1.0
**Owner:** Rahul
**Last Updated:** 2026-03-20

## Overview

The Voice API provides endpoints for speech-to-text (STT), text-to-speech (TTS), and real-time conversational AI. All audio endpoints are raw Hono routes that proxy requests to a Python voice sidecar service at `VOICE_SIDECAR_URL`. The API supports both HTTP (file upload/response) and WebSocket (real-time streaming) transports.

**Auth:** API key required (localhost exempt)
**Sidecar:** Python FastAPI service at `process.env.VOICE_SIDECAR_URL`

---

## Endpoints Summary

| Method | Path | Purpose | Transport | Returns |
|--------|------|---------|-----------|---------|
| POST | `/v1/audio/transcriptions` | STT: audio → text | HTTP | JSON |
| POST | `/v1/audio/speech` | TTS: text → audio | HTTP | Audio stream |
| GET | `/v1/audio/voices` | List TTS voices | HTTP | JSON |
| WS | `/ws/audio/stream` | Real-time STT | WebSocket | JSON |
| WS | `/ws/chat` | Voice chat loop | WebSocket | JSON + audio |

---

## Detailed Endpoints

### POST /v1/audio/transcriptions

Transcribe audio file to text using speech-to-text model.

#### Request

Multipart form data (same as OpenAI's format).

```typescript
interface TranscriptionRequest {
  /**
   * Audio file (required).
   * Formats: WAV, MP3, M4A, FLAC, OGG.
   * Max size: 25 MB.
   */
  file: File;

  /**
   * STT model (optional).
   * @default "whisper:large-v3-turbo"
   * @example "whisper:large-v3-turbo", "whisper:base", "whisper:small"
   */
  model?: string;

  /**
   * Language code (ISO 639-1).
   * If omitted, auto-detect.
   * @example "en", "es", "fr", "de"
   */
  language?: string;

  /**
   * Prompt text (optional).
   * Helps guide transcription for domain-specific terms.
   */
  prompt?: string;

  /**
   * Temperature for sampling (0.0–1.0).
   * @default 0.0 (deterministic)
   */
  temperature?: number;
}
```

#### Response

```typescript
interface TranscriptionResponse {
  /**
   * Transcribed text.
   */
  text: string;

  /**
   * Language code detected.
   */
  language?: string;

  /**
   * Duration of audio in seconds.
   */
  duration?: number;
}
```

#### Example Request

```bash
curl -X POST http://localhost:8000/v1/audio/transcriptions \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@audio.mp3" \
  -F "model=whisper:large-v3-turbo" \
  -F "language=en"
```

#### Example Response

```json
{
  "text": "Hello, this is a test of the speech recognition system.",
  "language": "en",
  "duration": 5.2
}
```

#### Error Response

```json
{
  "error": {
    "message": "Audio file is too large. Maximum size is 25 MB.",
    "code": "file_too_large"
  }
}
```

---

### POST /v1/audio/speech

Convert text to speech audio stream.

#### Request Body

```typescript
interface SpeechRequest {
  /**
   * TTS model (optional).
   * @default "kokoro:v1.1"
   * @example "kokoro:v1.1", "tts-1-hd"
   */
  model?: string;

  /**
   * Text to synthesize (required).
   * Max length: 4096 characters.
   */
  input: string;

  /**
   * Voice ID (optional).
   * @default "af_sky"
   * @example "af_sky", "am_adam", "bf_bella", "bm_george"
   */
  voice?: string;

  /**
   * Speech speed (0.5–2.0).
   * @default 1.0
   */
  speed?: number;

  /**
   * Output audio format.
   * @default "wav"
   */
  response_format?: "wav" | "mp3" | "pcm";
}
```

#### Response

Binary audio stream with appropriate MIME type.

- `response_format: "wav"` → `audio/wav`
- `response_format: "mp3"` → `audio/mpeg`
- `response_format: "pcm"` → `audio/pcm`

#### Example Request

```bash
curl -X POST http://localhost:8000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_KEY>" \
  -d '{
    "model": "kokoro:v1.1",
    "input": "Hello, this is a test of text-to-speech.",
    "voice": "af_sky",
    "speed": 1.0,
    "response_format": "wav"
  }' \
  -o output.wav
```

#### Example Response

Binary WAV audio file (streamed).

#### Error Response

```json
{
  "error": {
    "message": "Text input is too long. Maximum is 4096 characters.",
    "code": "input_too_long"
  }
}
```

---

### GET /v1/audio/voices

List all available TTS voices.

#### Query Parameters

None.

#### Response

```typescript
interface VoicesListResponse {
  /**
   * Array of available voice objects.
   */
  voices: Array<Voice>;
}

interface Voice {
  /**
   * Voice ID (unique identifier).
   * @example "af_sky", "am_adam", "bf_bella"
   */
  id: string;

  /**
   * Human-readable voice name.
   */
  name: string;

  /**
   * Language code (ISO 639-1).
   * @example "en"
   */
  language: string;

  /**
   * Gender: "male" | "female" | "neutral".
   */
  gender?: string;

  /**
   * Preview audio URL (if available).
   */
  preview_url?: string;

  /**
   * Additional metadata.
   */
  metadata?: Record<string, string>;
}
```

#### Example Request

```bash
curl -X GET http://localhost:8000/v1/audio/voices \
  -H "Authorization: Bearer <API_KEY>"
```

#### Example Response

```json
{
  "voices": [
    {
      "id": "af_sky",
      "name": "Sky (Female)",
      "language": "en",
      "gender": "female",
      "preview_url": "https://example.com/voices/af_sky.wav",
      "metadata": {
        "age": "adult",
        "accent": "neutral"
      }
    },
    {
      "id": "am_adam",
      "name": "Adam (Male)",
      "language": "en",
      "gender": "male",
      "preview_url": "https://example.com/voices/am_adam.wav",
      "metadata": {
        "age": "adult",
        "accent": "neutral"
      }
    }
  ]
}
```

---

## WebSocket Endpoints

### WS /ws/audio/stream

Real-time speech-to-text streaming. Client sends raw PCM audio; server streams back partial and final transcriptions.

#### Connection

```typescript
const ws = new WebSocket("ws://localhost:8000/ws/audio/stream");
```

#### Audio Format

- **Codec:** PCM (Linear PCM)
- **Sample rate:** 16 kHz (16000 Hz)
- **Bit depth:** 16-bit signed integer (S16)
- **Channels:** Mono (1 channel)
- **Byte order:** Little-endian

Each audio chunk should be ~320 bytes (10ms of audio at 16kHz, 16-bit).

#### Client → Server: Audio Messages

Send raw binary frames containing PCM audio data.

```javascript
const audioBuffer = new Uint8Array(320); // 10ms of 16kHz, 16-bit PCM
ws.send(audioBuffer);
```

#### Server → Client: Transcript Messages

```typescript
interface AudioStreamMessage {
  /**
   * Message type.
   */
  type: "partial" | "final" | "error";

  /**
   * Transcribed text (for "partial" and "final").
   */
  text?: string;

  /**
   * Confidence score (0.0–1.0) for "final" messages.
   */
  confidence?: number;

  /**
   * Error message (for "type: error").
   */
  error?: string;

  /**
   * Timestamp (ISO 8601).
   */
  timestamp: string;
}
```

#### Example Message Flow

```javascript
// Client: send PCM audio
const audioData = new Uint8Array([...pcmBytes]);
ws.send(audioData);

// Server: partial transcript
{"type":"partial","text":"hello","timestamp":"2026-03-20T10:30:00Z"}

// Client: send more audio
ws.send(audioData);

// Server: updated partial
{"type":"partial","text":"hello world","timestamp":"2026-03-20T10:30:01Z"}

// Client: silence or stop
ws.close();

// Server: final transcript
{"type":"final","text":"hello world","confidence":0.98,"timestamp":"2026-03-20T10:30:02Z"}
```

#### Example Implementation

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/audio/stream");

ws.onopen = () => {
  console.log("Connected to audio stream");
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "partial") {
    console.log("Partial:", msg.text);
  } else if (msg.type === "final") {
    console.log("Final:", msg.text, `(confidence: ${msg.confidence})`);
  } else if (msg.type === "error") {
    console.error("Error:", msg.error);
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

// Send audio chunks
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioContext.createMediaStreamSource(mediaStream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (event) => {
  const audioData = event.inputBuffer.getChannelData(0);
  const pcm = convertToInt16PCM(audioData);
  ws.send(pcm);
};

source.connect(processor);
processor.connect(audioContext.destination);
```

---

### WS /ws/chat

Full voice conversation loop. Client sends audio; server responds with transcript, LLM tokens, and TTS audio.

#### Connection

```typescript
const ws = new WebSocket("ws://localhost:8000/ws/chat");
```

#### Message Flow

1. **Client sends config** (once, at start)
2. **Client sends audio chunks** (PCM, 16kHz, 16-bit mono)
3. **Server sends events:** transcript, LLM response, TTS audio
4. **Client sends more audio** (or close to end)

#### Client → Server: Config Message (Initial)

```typescript
interface ChatConfigMessage {
  type: "config";

  /**
   * Model ID for LLM inference.
   */
  model: string;

  /**
   * System prompt for the LLM.
   */
  systemPrompt?: string;

  /**
   * STT model.
   * @default "whisper:large-v3-turbo"
   */
  sttModel?: string;

  /**
   * TTS model.
   * @default "kokoro:v1.1"
   */
  ttsModel?: string;

  /**
   * TTS voice ID.
   * @default "af_sky"
   */
  voice?: string;

  /**
   * Conversation ID (to continue existing conversation).
   */
  conversationId?: string;

  /**
   * Language code for STT.
   */
  language?: string;
}
```

#### Client → Server: Audio Messages

```typescript
interface ChatAudioMessage {
  type: "audio";

  /**
   * Raw PCM audio (16kHz, 16-bit, mono).
   */
  audio: Uint8Array;
}
```

#### Server → Client: Event Messages

```typescript
interface ChatEventMessage {
  /**
   * Event type.
   */
  type: "transcript" | "llm_start" | "llm_token" | "llm_end" | "audio" | "error";

  // For "transcript": STT result
  text?: string;
  isFinal?: boolean;

  // For "llm_token": streaming LLM token
  token?: string;

  // For "audio": TTS audio chunk
  audio?: Uint8Array;

  // For "error"
  error?: string;

  // Metadata
  timestamp: string;
  conversationId?: string;
  messageId?: string;
}
```

#### Example Message Flow

```javascript
// Client: send config
{
  "type": "config",
  "model": "mistral-7b-instruct",
  "systemPrompt": "You are a helpful assistant.",
  "voice": "af_sky"
}

// Client: send audio
{"type": "audio", "audio": <Uint8Array of PCM>}

// Server: partial transcript
{
  "type": "transcript",
  "text": "what is",
  "isFinal": false,
  "timestamp": "2026-03-20T10:30:00Z"
}

// Server: final transcript
{
  "type": "transcript",
  "text": "what is quantum computing",
  "isFinal": true,
  "timestamp": "2026-03-20T10:30:01Z"
}

// Server: LLM streaming tokens
{"type": "llm_token", "token": "Quantum", "timestamp": "2026-03-20T10:30:02Z"}
{"type": "llm_token", "token": " computing", "timestamp": "2026-03-20T10:30:02Z"}
{"type": "llm_token", "token": " is", "timestamp": "2026-03-20T10:30:02Z"}
...

// Server: LLM end
{
  "type": "llm_end",
  "messageId": "msg_xyz",
  "timestamp": "2026-03-20T10:30:05Z"
}

// Server: TTS audio chunks
{
  "type": "audio",
  "audio": <Uint8Array of WAV>,
  "timestamp": "2026-03-20T10:30:06Z"
}

// Client: send more audio or close
{"type": "audio", "audio": <Uint8Array>}
// or
ws.close();
```

#### Example Implementation

```javascript
const ws = new WebSocket("ws://localhost:8000/ws/chat");

// Send config on connect
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "config",
    model: "mistral-7b-instruct",
    systemPrompt: "You are a helpful assistant.",
    voice: "af_sky"
  }));
};

ws.onmessage = (event) => {
  // Check if binary (audio) or text (JSON)
  if (event.data instanceof ArrayBuffer) {
    // Audio chunk (TTS)
    playAudio(new Uint8Array(event.data));
  } else {
    const msg = JSON.parse(event.data);
    if (msg.type === "transcript") {
      console.log("Transcript:", msg.text, msg.isFinal ? "(final)" : "(partial)");
    } else if (msg.type === "llm_token") {
      console.log("LLM:", msg.token);
    } else if (msg.type === "audio") {
      playAudio(msg.audio);
    }
  }
};

// Capture audio and send
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(mediaStream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (event) => {
  const audioData = event.inputBuffer.getChannelData(0);
  const pcm = convertToInt16PCM(audioData);
  ws.send(JSON.stringify({
    type: "audio",
    audio: Array.from(pcm) // or send binary
  }));
};

source.connect(processor);
processor.connect(audioContext.destination);
```

---

## Error Responses

### HTTP Error Format

```typescript
interface AudioErrorResponse {
  error: {
    message: string;
    code: string;
  };
}
```

### WebSocket Error Format

```typescript
interface WebSocketErrorMessage {
  type: "error";
  error: string;
  timestamp: string;
}
```

### Common Error Codes

| Code | HTTP Status | Message |
|------|-------------|---------|
| `file_too_large` | 413 | Audio file exceeds maximum size. |
| `unsupported_format` | 400 | Audio format not supported. |
| `model_not_found` | 404 | STT or TTS model not found. |
| `sidecar_unavailable` | 503 | Voice sidecar service is unavailable. |
| `invalid_request` | 400 | Invalid request parameters. |

---

## Audio Format Conversion

### JavaScript: Convert Float32 to Int16 PCM

```javascript
function convertToInt16PCM(float32Array) {
  const pcm = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  return pcm;
}
```

### Python: Capture and Send Audio

```python
import pyaudio
import struct
import json
import asyncio
import websockets

SAMPLE_RATE = 16000
CHUNK_SIZE = 4096

async def stream_audio():
    uri = "ws://localhost:8000/ws/audio/stream"
    async with websockets.connect(uri) as websocket:
        # Initialize audio capture
        p = pyaudio.PyAudio()
        stream = p.open(format=pyaudio.paInt16, channels=1,
                        rate=SAMPLE_RATE, input=True,
                        frames_per_buffer=CHUNK_SIZE)

        try:
            while True:
                data = stream.read(CHUNK_SIZE)
                await websocket.send(data)

                # Check for transcription message
                try:
                    msg = await asyncio.wait_for(
                        websocket.recv(), timeout=0.1
                    )
                    event = json.loads(msg)
                    if event["type"] == "final":
                        print(f"Final: {event['text']}")
                except asyncio.TimeoutError:
                    pass
        finally:
            stream.stop_stream()
            stream.close()
            p.terminate()
```

---

## Related Documentation

- [API: Chat](./api-chat.md)
- [API: Inference](./api-inference.md)
- [Architecture Overview](../architecture.md)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-20 | 1.0 | Initial draft. Full voice API with STT, TTS, and real-time WebSocket chat. |
