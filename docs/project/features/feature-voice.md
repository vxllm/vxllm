---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Feature: Voice Pipeline (STT + TTS + VAD)

## Summary

Real-time voice input/output via Python voice service running faster-whisper (Speech-to-Text), Kokoro-82M (Text-to-Speech), and silero-vad (Voice Activity Detection). Enables hands-free voice chat with local LLMs through WebSocket streams, hold-to-talk UI, and OpenAI-compatible `/v1/audio/*` endpoints.

## Problem Statement

Text-only chat requires constant typing, which is slow and interrupts flow. Users need hands-free voice interaction — speak a question, hear the AI respond — while maintaining complete privacy (no cloud audio services like Google Speech-to-Text or Eleven Labs). Current local solutions either:
1. Lack real-time transcription (batch-only)
2. Have poor quality TTS (robotic, slow)
3. Require complex setup (multiple Python packages, CUDA tuning)
4. Don't support continuous speech detection

VxLLM must deliver a seamless voice experience: press button, speak naturally, see transcript appear in real-time, hear natural AI response read aloud.

## User Stories

- As a mobile/hands-free user, I want to hold a button and speak my message so I can interact with AI while my hands are busy or while driving.
- As an accessibility user, I want the AI response read aloud so I don't have to read long responses on screen.
- As a real-time user, I want to see my words appear as I speak so I know my speech is being captured and understood.
- As a user concerned about privacy, I want all voice processing (STT, TTS, VAD) to happen locally so no audio leaves my machine.
- As a developer, I want OpenAI-compatible `/v1/audio/transcriptions` and `/v1/audio/speech` endpoints so existing voice tools work with VxLLM.
- As a power user, I want to choose different TTS voices and STT model sizes so I can optimize for quality vs. speed based on my needs.
- As an always-listening user, I want continuous VAD mode so I can start speaking without pressing a button; the system auto-detects speech start/end.

## Scope

### In Scope
- **STT (Speech-to-Text)**: faster-whisper backend with multiple model sizes (tiny, base, small, medium)
  - File upload endpoint: POST `/v1/audio/transcriptions` (OpenAI compatible)
  - Real-time WebSocket: `WS /v1/audio/stream/transcribe` for live audio
  - Partial transcription display during speaking
  - Language detection and override
- **TTS (Text-to-Speech)**: Kokoro-82M with multiple voices
  - Streaming audio endpoint: POST `/v1/audio/speech` (OpenAI compatible)
  - Real-time generation (sentence-by-sentence)
  - Voice selector (multiple gender/age/tone options)
  - Speed control (0.5x — 2.0x)
  - Audio format: WAV 24kHz mono with streaming chunks
- **VAD (Voice Activity Detection)**: silero-vad
  - Real-time speech/silence classification on audio stream
  - End-of-speech detection (automatic input stop when silence > 500ms)
  - Confidence threshold configuration
- **Voice Chat Loop**: Full pipeline orchestration
  - WebSocket endpoint: `WS /v1/chat/voice` for full voice chat
  - Audio capture → STT → Message to LLM → TTS → Audio playback
  - Parallel TTS to LLM streaming (TTS starts while LLM generates)
  - Hold-to-talk UI button with visual feedback
  - Continuous VAD mode (optional)
- **UI Integration**:
  - Microphone input via Web Audio API
  - Audio playback via Web Audio API
  - Voice chat button with press/release or toggle
  - Visual waveform indicator during recording
  - Transcription display box (updating in real-time)
  - TTS voice selector dropdown
  - Whisper model size selector
  - Auto-play toggle for TTS output
- **OpenAI Compatibility**:
  - `/v1/audio/transcriptions`: POST file or raw audio
  - `/v1/audio/speech`: POST text, return streamed audio
  - Standard response formats matching OpenAI API

### Out of Scope
- Voice cloning (F5-TTS, Phase 2+)
- Speaker diarization (multi-speaker identification)
- Real-time translation (speech → different language)
- Audio file editing or processing
- Noise cancellation (preprocessing only, not filtering user audio)
- Custom wake words or hotword detection (Phase 2)
- Speech emotion detection
- Audio format conversion beyond WAV

## Requirements

### Must Have
1. Python voice service (FastAPI) running separately from Hono server
2. Hono server proxies all `/v1/audio/*` and `/ws/*` voice routes to voice service via HTTP/WebSocket
3. STT file upload endpoint: POST `/v1/audio/transcriptions` accepting WAV/MP3/OGG, returning JSON with text
4. STT real-time WebSocket: `WS /v1/audio/stream/transcribe` accepting audio chunks, returning partial + final transcriptions
5. TTS endpoint: POST `/v1/audio/speech` accepting text + voice_id + speed, returning streaming WAV audio
6. VAD integration: Detect speech end on WebSocket stream; close input automatically after silence > 500ms
7. Voice chat WebSocket: `WS /v1/chat/voice` orchestrating full pipeline (audio → STT → LLM → TTS → audio)
8. Microphone UI: Hold-to-talk button in chat screen (Press = record, Release = send)
9. Audio playback: TTS output played automatically via Web Audio API with play/pause controls
10. Voice selector: Dropdown with Kokoro voice options (e.g., "af_heart", "am_adam", "bf_emma", etc.)
11. Whisper model selector: Dropdown (tiny, base, small, medium) with note on speed/accuracy trade-off
12. Transcription display: Text box showing live partial transcription while recording
13. Error handling: Graceful fallback if voice service unavailable; show "Voice features unavailable" message
14. Audio format: Input 16kHz mono PCM via Web Audio API, Whisper expects 16kHz, TTS output 24kHz mono WAV

### Should Have
1. Continuous VAD mode toggle: Auto-detect speech without holding button
2. Waveform visualization: Real-time audio level indicator during recording
3. Partial transcription: Show in-progress text before final transcription received
4. Sentence-by-sentence TTS: Generate and stream TTS in parallel with LLM token generation (don't wait for full response)
5. TTS speed control: Slider from 0.5x to 2.0x
6. Audio input device selector: Choose mic if multiple available
7. Audio output device selector: Choose speaker if multiple available
8. Confidence threshold for VAD: Allow adjustment (higher = require more speech before triggering)
9. Mute button: Disable microphone without interrupting chat
10. Voice indicators: Visual badge when recording (pulsing red), when processing (spinner), when playing audio (speaker icon)

### Nice to Have
1. Noise cancellation preprocessing (before sending to Whisper)
2. Custom wake words: "Hey Assistant" to auto-start recording
3. Audio file upload for batch transcription
4. Speech emotion detection (optional metadata)
5. Text-to-speech pitch control
6. Voice activity waveform display with threshold visualization
7. Microphone test/calibration tool
8. Audio quality metrics (noise level, echo, clipping)
9. Accent selection for TTS
10. Multi-language STT with auto-detection

## UX

### Voice Chat Mode Activation

**Button & State Indicators**
- Microphone button in chat input area (next to send button)
- Button states:
  - Idle: Gray microphone icon, tooltip "Hold to speak"
  - Recording: Red pulsing mic, "Recording... tap to stop"
  - Processing STT: Yellow spinner, "Transcribing..."
  - LLM generating: Green spinner, "Thinking..."
  - TTS playing: Speaker icon, "Playing response..."

**Hold-to-Talk Interaction**
- User presses/holds microphone button
- Microphone opens, red indicator shows active recording
- Real-time waveform visualizes audio level
- Partial transcription appears in text box below button (updating live)
- User releases button when done speaking
- System detects end-of-speech via VAD (silence > 500ms)
- Input automatically sends to LLM
- Response streams back and TTS plays simultaneously

**Continuous VAD Mode** (Toggle in Settings)
- User clicks microphone once to toggle "Listening" mode
- System continuously monitors for speech
- When speech detected, recording starts automatically
- When speech ends (VAD triggers), input sends
- User clicks microphone again to disable listening
- Reduces friction for hands-free operation

### Transcription Display
- **Live box**: Shows in-progress text while speaking
  - Format: User's spoken words as they appear
  - Color: Gray while partial, black when finalized
  - Auto-scroll if long
- **Chat message**: Final transcription appears as user message in chat after send

### TTS Playback
- **Auto-play**: Audio plays immediately after generation (if toggle enabled)
- **Manual control**: Play/pause buttons on audio element
- **Visual indicator**: Speaker icon pulsing while playing
- **Accessibility**: Subtitles shown for audio content (parallel to chat message)

### Settings Panel (Voice Section)
- **STT Model**: Dropdown (tiny, base, small, medium)
  - Info: "Larger = better accuracy, slower. tiny = 39ms per 10s audio"
- **Voice**: Dropdown with voice options
  - Grouped: Female (af_heart, bf_emma), Male (am_adam, bm_george), etc.
  - Preview button: Click to hear sample
- **TTS Speed**: Slider 0.5x — 2.0x
- **Auto-play**: Checkbox "Play TTS responses automatically"
- **VAD Mode**: Dropdown (Hold-to-talk, Continuous)
- **Microphone**: Dropdown to select input device
- **Speaker**: Dropdown to select output device
- **Confidence Threshold**: Slider (0.3 — 0.9) for VAD sensitivity

### Error States
- "Microphone not available. Check permissions."
- "Voice service not running. Restart app?"
- "Transcription failed: No speech detected. Try again?"
- "Audio playback failed. Check speaker or select different device."

### Empty States
- First time user opens voice mode: Show tutorial "Hold mic button and speak naturally. Try: 'Hello, how are you?'"
- No whisper models: Show download prompt "Download speech model (first run only). This is 100MB and takes ~30s."

## Business Rules

1. **Sidecar Requirement**: Voice features only available if Python voice service is running; check health on app start
2. **Model Downloads**: Whisper and Kokoro models downloaded on first voice feature use; auto-handled transparently
3. **Audio Format**: Web Audio API captures at 16kHz mono PCM; Whisper input expects 16kHz; TTS output 24kHz mono WAV
4. **WebSocket Proxy**: All voice WebSocket connections go through Hono → Sidecar proxy; Hono does no processing
5. **Concurrent Voice**: Only one active voice session per conversation (sequential, not parallel)
6. **VAD Sensitivity**: Default confidence 0.5; user can adjust; lower = more false positives but better for soft speech
7. **TTS Generation**: Sentence-by-sentence (split on `.`, `!`, `?`) to start playback before full response complete
8. **Audio Buffer**: Keep last 30s of audio in memory (for retry/re-transcribe if needed); don't persist
9. **Error Recovery**: If STT fails, return error; user can retry. If TTS fails, log error but continue chat.
10. **Latency Budget**:
    - STT: < 1s for 10s utterance (depends on whisper model size)
    - TTS: First audio chunk < 500ms
    - Full loop: < 3s end-to-end (speech → transcription → inference → TTS → playback start)

## Edge Cases

### Empty States
- **No voice models downloaded**: Show setup screen on voice button click "Download speech models (~500MB)?" with download button
- **Sidecar not running**: Show "Voice features unavailable. Restart the app?" with restart button
- **No microphone/permission denied**: Show "Microphone access required. Check browser permissions."
- **No speakers/audio output**: Graceful fallback to text-only mode; show message "Audio output unavailable"

### Boundary Conditions
- **Very long speech** (5+ minutes): Process in chunks (e.g., 30s chunks); show "Processing long audio... {progress}%"
- **Very short utterance** (< 100ms): VAD may not detect; user can manual retry or switch to hold-to-talk with manual release
- **Ambient noise only** (no speech): VAD rejects, show "No speech detected. Try again?"
- **Multiple simultaneous speakers**: Whisper transcribes all; not distinguished; note in UI
- **Very fast speech** (native speaker, rapid talking): May exceed expected throughput; VAD may split incorrectly; manual release button helps
- **Very slow speech** (deliberate, with long pauses): VAD triggers end-of-speech prematurely; user can press button again to continue

### Permissions & Access
- Microphone access: Requires browser permission; prompt on first use
- Audio output: No explicit permission required (browser assumption)
- Sidecar process: Runs as same user; no extra privilege required

### Concurrent Requests
- **User starts recording while previous response still playing**: Stop TTS playback, start new recording, clear transcription box
- **User sends text message while voice recording active**: Voice input takes priority; text input queued until voice completes
- **Rapid successive voice inputs** (user sends, immediately records again): Queue; process sequentially
- **Multiple browser tabs open**: Voice features work in only one tab at a time; other tabs disabled with message "Voice in use elsewhere"

### Network Conditions
- **WebSocket disconnect mid-speech**: Buffer audio locally (in browser memory); reconnect and re-send when connection restored
- **Sidecar crashes mid-STT**: WebSocket closes; return error "Transcription failed"; user can retry
- **Sidecar health check fails**: Disable voice features; show "Voice features unavailable"
- **High latency** (> 5s for STT): Show warning "Slow transcription"; continue buffering

### Data Integrity
- **Corrupted audio chunk on WebSocket**: Skip chunk, continue with next; don't crash
- **Invalid WAV file uploaded**: Return 400 Bad Request "Invalid audio format"
- **Whisper model corrupted**: Detect on load; re-download automatically
- **Kokoro model corrupted**: Detect on load; re-download automatically

### Time-Based
- **Long silence during recording** (> 2s): VAD triggers end-of-speech; input auto-sends
- **Very fast inference** (< 500ms response): TTS starts immediately; lag imperceptible
- **Very slow inference** (> 30s): TTS doesn't block; voice remains responsive, shows "Still thinking..."
- **Session idle** (user speaks, then does nothing): No timeout; conversation persists

## Success Criteria

1. **STT Latency**: Transcription of 10-second utterance appears in < 1 second (with base whisper model)
2. **TTS Latency**: First audio chunk received within 500ms of TTS request
3. **End-to-End Loop**: Full voice interaction (speak → transcription → LLM response → TTS playback start) < 3 seconds
4. **Accuracy**: STT accuracy matches Whisper on test set (> 94% WER for base model on clean speech)
5. **VAD Sensitivity**: Correctly detects end-of-speech within 300-800ms after speech ends (configurable)
6. **Quality**: TTS audio quality comparable to Kokoro reference implementation; naturalness subjectively good
7. **Reliability**: 100+ voice interactions without crashes; graceful error handling on all failure modes
8. **API Compatibility**: `/v1/audio/transcriptions` and `/v1/audio/speech` respond identically to OpenAI client libraries

## Dependencies

### Internal (Hono Server)
- Hono: HTTP server and WebSocket proxy
- HTTP client for voice service communication
- Web Audio API bridge (client-side, via browser)

### Internal (Python Sidecar)
- **FastAPI**: Web framework for voice service
- **faster-whisper**: STT backend (optimized Whisper via CTransformers)
- **Kokoro-82M**: TTS backend (text-to-speech generation)
- **silero-vad**: Voice Activity Detection
- **librosa**: Audio processing (load, resample, silence detection)
- **numpy**: Numerical operations
- **scipy**: Audio signal processing
- **PyYAML**: Configuration files

### External
- **Web Audio API**: Browser-native audio input/output (no npm package needed)
- **HuggingFace Hub**: Whisper and Kokoro model downloads (same as model-management)

### Runtime
- Python 3.10+ for voice service
- Node.js/Bun for Hono server
- Modern browser with Web Audio API support (Chrome, Firefox, Safari 14.1+)
- Microphone and speaker hardware

## Related Documentation

- **api-voice.md**: REST and WebSocket endpoints for voice features
- **schema-voice.md**: Database schema for voice profile storage (voice preferences, settings)
- **workflow-voice-chat.md**: End-to-end voice chat flow (recording → STT → LLM → TTS → playback)
- **workflow-voice-stт.md**: Detailed STT pipeline (audio capture, buffering, whisper inference)
- **workflow-voice-tts.md**: Detailed TTS pipeline (text generation, Kokoro inference, streaming audio)
- **workflow-voice-vad.md**: VAD detection and end-of-speech logic
- **feature-chat.md**: Chat UI that voice integrates with
- **feature-inference.md**: LLM inference that voice depends on

## Open Questions

1. **Voice Cloning (F5-TTS)**: Phase 2 — should we support user voice cloning for personalized TTS? Privacy/storage implications?
2. **Multi-Language STT**: Should auto-detection work, or require user selection? Current: auto-detect, with override option
3. **Real-Time Translation**: Phase 2 — speak English, respond in Spanish? Requires separate model.
4. **Speaker Diarization**: Should we identify different speakers in audio? (Probably out of scope; Phase 3+)
5. **Audio Compression**: Should WebSocket stream compress audio to reduce bandwidth? (Current: no; local only)
6. **Wake Words**: Should "Hey VxLLM" or similar activate recording? (Phase 2; requires always-listening mode)
7. **Audio Encryption**: Should audio be encrypted in browser memory? (Current: no; local-only assumption sufficient)
8. **Custom TTS Voices**: Should users be able to use third-party TTS (ElevenLabs, etc.) as alternatives? (Out of scope; privacy concern)

## Changelog

### v1.0 (2026-03-20) — Initial Draft
- Defined voice pipeline with STT, TTS, and VAD
- Specified hold-to-talk and continuous VAD modes
- Outlined WebSocket voice chat orchestration
- Detailed OpenAI audio API compatibility
- Covered all edge cases and success criteria
- Integrated with chat and inference features
