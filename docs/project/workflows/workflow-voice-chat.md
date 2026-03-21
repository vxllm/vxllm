---
Status: Draft
Version: 1.0
Owner: Rahul
Last Updated: 2026-03-20
---

# Workflow: Voice — Full Voice Chat Loop

## Summary
Orchestrates real-time voice conversation: user speaks, audio is streamed to Python voice service for speech-to-text (Silero VAD + Faster-Whisper), text is sent to LLM (node-llama-cpp), response text is converted to speech (Kokoro TTS), and audio is streamed back for playback. WebSocket maintains persistent connection between frontend and voice service.

## Trigger
- User clicks/holds voice input button in chat UI (hold-to-talk mode)
- User clicks toggle to enable Voice Activation Detection (VAD) mode
- User presses keyboard shortcut (e.g., spacebar) for push-to-talk

## Actors
- **Frontend** (React, WebRTC getUserMedia, Web Audio API)
- **Hono Server** (WebSocket proxy, inference orchestration)
- **Python Voice Service** (Silero VAD, Faster-Whisper STT, Kokoro TTS)
- **node-llama-cpp** (LLM inference)
- **Database** (messages table, audio storage)

## Preconditions
- Server is running with voice service enabled
- User has granted microphone permission (browser-level)
- Python voice service is alive and responding to health checks
- STT, LLM, and TTS models are downloaded and loaded
- WebSocket endpoint `/ws/chat` is configured on Hono server

## Happy Path

### Step 1: User Activates Voice Mode
- **Hold-to-Talk Mode**:
  - User presses and holds voice button in UI
  - Button shows visual feedback (e.g., "Listening..." + waveform animation)

- **VAD Mode** (continuous):
  - User clicks toggle in Settings to enable VAD
  - UI shows recording state with "Waiting for speech..." message

### Step 2: Request Microphone Access
- Frontend calls:
  ```js
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  });
  ```
- Browser shows permission prompt (if first time): "This site wants to use your microphone"
- User clicks "Allow" → microphone access granted
- User clicks "Block" → go to Failure Scenarios (Microphone Permission Denied)

### Step 3: Open WebSocket Connection
- Frontend opens WebSocket to Hono server:
  ```js
  const ws = new WebSocket(`ws://${host}:${port}/ws/chat`);
  ws.onopen = () => {
    console.log("Voice WS connected");
  };
  ```
- Hono server accepts connection, proxies to Python voice service
- On error → go to Failure Scenarios (Sidecar Unavailable)

### Step 4: Send Configuration Message
- Frontend sends initial config message:
  ```json
  {
    "type": "config",
    "sttModel": "base",
    "llmModel": "llama3.1:8b",
    "ttsModel": "kokoro-en",
    "voice": "am",
    "language": "en"
  }
  ```
- Python voice service receives config and validates:
  - Check if STT model (Faster-Whisper "base") is loaded
  - Check if TTS model (Kokoro "am" voice) is loaded
  - If missing, load from disk
  - Return ACK message: `{"type": "config_ack", "ready": true}`
- Frontend receives ACK, displays "Ready to speak"

### Step 5: Capture Audio & Start Streaming
- **Hold-to-Talk Mode**: While button held:
  - Capture audio from microphone stream using Web Audio API
  - Create AudioContext and ScriptProcessorNode:
    ```js
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    ```
  - Resample to 16 kHz, 16-bit PCM mono (required by Silero VAD)
  - Collect audio chunks (typically 20-40ms frames) in buffer

- **VAD Mode**: Continuously:
  - Capture audio frames from microphone
  - Send to voice service for VAD processing (Step 6)
  - Once speech detected, proceed with streaming

### Step 6: VAD Processing (Silero VAD)
- For each incoming audio chunk, Python voice service runs:
  ```python
  vad = VoiceActivityDetector()
  is_speech = vad(audio_chunk)  # Binary: True/False
  confidence = vad.get_speech_confidence()  # 0.0-1.0
  ```
- VAD threshold: 0.5 confidence default (configurable)
- Sidecar tracks speech state:
  - Before speech: silence_frames = 0
  - During speech: is_speech=True, confidence > 0.5 → accumulate frames
  - After speech: is_speech=False for 20+ consecutive frames (0.5s) → end of speech detected

### Step 7: Partial STT Streaming
- While user is speaking, Python voice service streams partial transcriptions:
  ```json
  {
    "type": "stt_partial",
    "text": "Hello how are",
    "confidence": 0.89,
    "isFinal": false
  }
  ```
- Faster-Whisper generates partial output every 1-2 seconds while listening
- Frontend receives and displays partial text in italics: *"Hello how are"*
- User sees real-time feedback of what's being transcribed

### Step 8: End of Speech Detection
- VAD detects silence (20+ frames with is_speech=False) after speech period
- Python voice service sends final STT message:
  ```json
  {
    "type": "stt_final",
    "text": "Hello, how are you doing today?",
    "confidence": 0.92,
    "isFinal": true,
    "duration_ms": 3420
  }
  ```
- Frontend receives stt_final, stops showing VAD indicator
- Final transcript is now confirmed and displayed in normal (non-italic) text

### Step 9: Send Transcript to LLM Server
- Hono server receives stt_final message
- Converts to user message and adds to conversation history:
  ```js
  userMessage = {
    role: "user",
    content: "Hello, how are you doing today?"
  }
  messages.push(userMessage);
  ```
- Invokes node-llama-cpp via AI SDK streamText():
  ```js
  const response = streamText({
    model: llm,
    system: systemPrompt,
    messages: messages,
    temperature: 0.7,
    max_tokens: 512
  });
  ```
- LLM begins generating response tokens

### Step 10: Stream LLM Response Tokens
- As LLM generates tokens, Hono server streams back to voice service:
  ```json
  {
    "type": "llm_token",
    "text": "I'm",
    "isFinal": false
  }
  ```
- Python voice service buffers tokens and detects sentence boundaries
- When complete sentence detected (period, question mark, or 10+ words):
  - Accumulate sentence text
  - Send to TTS for processing

### Step 11: TTS Synthesis in Sidecar
- Python voice service runs Kokoro TTS on complete sentence:
  ```python
  tts = KokoroTTS(model="kokoro-en", voice="am")
  audio_bytes, sr = tts.synthesize("I'm doing great, thank you for asking!")
  ```
- Kokoro generates audio at 24 kHz, converts to 16 kHz PCM 16-bit
- Audio generated incrementally (not waiting for full sentence to complete)
- Sidecar sends audio chunks as binary WebSocket frames:
  ```
  <binary frame: PCM audio chunk (640 bytes)>
  <binary frame: PCM audio chunk (640 bytes)>
  ...
  ```

### Step 12: Stream Audio to Frontend
- Frontend receives binary WebSocket frames
- Decode PCM frames and queue for playback:
  ```js
  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      const audioData = new Float32Array(event.data);
      audioQueue.push(audioData);
      schedulePlayback();
    }
  };
  ```
- Use Web Audio API AudioContext to play audio in real-time:
  ```js
  const audioContext = new AudioContext();
  const source = audioContext.createBufferSource();
  const buffer = audioContext.createBuffer(1, audioData.length, 16000);
  buffer.getChannelData(0).set(audioData);
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
  ```
- Audio plays back as it arrives (low-latency streaming)
- User hears TTS response in real-time as LLM generates

### Step 13: Continue LLM Generation & TTS
- Steps 10-12 happen concurrently:
  - LLM continues generating more tokens
  - TTS synthesizes sentences as they complete
  - Audio streams to frontend for playback
  - Frontend continues receiving and queuing audio
- Process continues until LLM reaches end (finish_reason="stop" or max_tokens)

### Step 14: End of Turn Signal
- When both LLM generation AND TTS are complete:
  ```json
  {
    "type": "turn_end",
    "llmTokens": 47,
    "ttsCharacters": 156,
    "durationMs": 4230
  }
  ```
- Frontend receives turn_end:
  - Stops "generating" spinner
  - Re-enables voice button for next turn
  - Shows duration stats (optional)

### Step 15: Save Conversation to Database
- After turn completes, save messages to DB:
  ```js
  await db.insert(messages).values([
    {
      id: uuid(),
      role: "user",
      content: "Hello, how are you doing today?",
      timestamp: now(),
      model: null,
      audioPath: "/messages/audio/{uuid}_user.wav"
    },
    {
      id: uuid(),
      role: "assistant",
      content: "I'm doing great, thank you for asking! How can I help you?",
      timestamp: now(),
      model: "llama3.1:8b",
      audioPath: "/messages/audio/{uuid}_assistant.wav"
    }
  ]);
  ```
- If enabled, save audio files to disk:
  - Microphone recording: `/messages/audio/{uuid}_user.wav`
  - TTS output: `/messages/audio/{uuid}_assistant.wav`

### Step 16: Ready for Next Turn
- Reset state for next message
- User can speak again (hold button or continuous VAD)
- UI re-enables voice input

## Alternative Paths

### Hold-to-Talk Mode (Push-to-Talk)
1. User presses voice button, holds it down
2. Audio is only captured while button is held
3. Release button → VAD detects end of speech, proceeds to STT (Step 8)
4. More explicit control, no accidental recordings
5. Recommended for noisy environments

### Continuous VAD Mode
1. User enables VAD toggle in Settings
2. Audio captured continuously from microphone
3. Sidecar runs VAD in background
4. When speech detected (confidence > threshold):
   - Auto-start STT
   - Show "Listening..." visual feedback
5. When silence detected → auto-send to LLM
6. More hands-free, but risk of accidental triggers

### Manual STT Confirmation
1. After stt_final received, don't auto-send to LLM
2. Show user: "Did you say: {transcript}?"
3. User clicks "Send" → proceed to Step 9
4. User clicks "Retry" → re-record audio
5. User clicks "Edit" → manually edit transcript text

### Custom TTS Voice Selection
1. User selects different voice in Settings (e.g., "am" → "bf")
2. Voice preference stored in database
3. Include `voice` parameter in config message (Step 4)
4. Sidecar loads different voice model if needed
5. Response audio uses selected voice

### Multi-Turn Context
1. Previous user messages automatically included in `messages` array
2. LLM generates responses considering conversation history
3. Each turn adds to conversation, not reset after each message
4. User can ask follow-up questions with full context

### Background Audio (System Audio, Music)
1. If user is playing music during voice chat:
   - Frontend's `echoCancellation: true` reduces playback audio
   - VAD may still detect music as speech (false positive)
2. Solution: Show warning "Music detected, may affect speech recognition"
3. Recommend user mute audio or pause music

## Failure Scenarios

### Microphone Permission Denied
- **Symptom**: getUserMedia() throws NotAllowedError
- **Detection**: Exception in Step 2
- **Response**:
  - Show error dialog: "Microphone access denied"
  - Display troubleshooting:
    ```
    ✗ Microphone access denied

    To use voice chat, allow microphone access:
    1. Click the lock/settings icon in your browser address bar
    2. Set "Microphone" to "Allow"
    3. Refresh the page and try again

    Or try a different browser.
    ```
  - Disable voice button until permission granted
- **Recovery**:
  - User grants microphone permission in browser settings
  - User refreshes page
  - Retry voice activation

### Microphone Not Available
- **Symptom**: getUserMedia() throws NotFoundError (no audio device)
- **Detection**: Exception in Step 2
- **Response**:
  - Show error: "No microphone found"
  - Disable voice button permanently (until restart)
  - Suggestion: "Plug in a microphone or use a device with built-in audio"

### Voice Service Unavailable
- **Symptom**: WebSocket connection fails or voice service crashes
- **Detection**: WebSocket onerror event or config_ack never received (timeout 5s)
- **Response**:
  - Show banner: "Voice is unavailable — please try text chat"
  - Log error with timestamp
  - Disable voice button, show setup link: "Enable voice in Settings"
  - Check voice service health on server:
    ```
    GET /health/voice
    Response: {"status": "down", "lastSeen": "2026-03-20T10:23:15Z"}
    ```
  - Alert admin if voice service is down

- **Recovery**:
  - Admin restarts Python voice service
  - User waits 10 seconds and retries
  - If still down, suggest fallback to text chat

### STT Model Not Loaded
- **Symptom**: Python voice service cannot load Faster-Whisper model (corrupted file, OOM)
- **Detection**: voice service returns error in config_ack: `{"ready": false, "error": "STT model not found"}`
- **Response**:
  - Show warning: "Voice unavailable: Speech-to-text model missing"
  - Return to text-only chat
  - Log error: require re-download of voice models via CLI

### TTS Model Not Loaded
- **Symptom**: Kokoro TTS model not available or corrupted
- **Detection**: Sidecar crashes during tts.synthesize() or returns error
- **Response**:
  - LLM response text shown to user (fall back to text-only)
  - No audio generated or sent
  - Log error: "TTS synthesis failed"
  - Show message: "Response generated but audio unavailable"

### WebSocket Connection Lost Mid-Stream
- **Symptom**: Network interruption, voice service crash, browser tab backgrounded
- **Detection**: ws.onclose or ws.onerror event
- **Response**:
  - Stop audio capture (close microphone stream)
  - Stop audio playback (silence any queued audio)
  - Show reconnection indicator: "Reconnecting... (attempt 1/5)"
  - Attempt auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, 16s)
  - Max 5 reconnect attempts
- **Recovery**:
  - On successful reconnect: auto-resend config (Step 4)
  - User can resume voice chat
  - If all reconnects fail after 16s: show "Voice disconnected. Please refresh the page."

### Audio Capture Failure (getUserMedia Stream Error)
- **Symptom**: Microphone stream closes unexpectedly during recording
- **Detection**: stream.onended event or error in audio capture loop
- **Response**:
  - Stop voice input immediately
  - Show warning: "Microphone stream disconnected"
  - Clean up Web Audio resources
  - Disable voice button
- **Recovery**:
  - User unplugs/replugs microphone (if USB)
  - User checks device audio settings
  - User retries voice activation

### Audio Playback Failure
- **Symptom**: Web Audio API fails to play TTS audio (AudioContext error)
- **Detection**: AudioContext throws error or buffers never connect
- **Response**:
  - Log error: "Audio playback failed"
  - Fallback: Display text response instead of audio
  - Show message to user: "Response generated, but audio playback unavailable"
  - User still sees text transcript (audio skipped gracefully)
- **Recovery**:
  - Check browser audio permissions and volume
  - Ensure AudioContext is not suspended (browser autoplay policy)
  - User tries again; AudioContext may recover

### Speech Not Detected (Silence)
- **Symptom**: User holds button or enables VAD, but doesn't speak (silence)
- **Detection**: VAD never triggers speech=True
- **Response**:
  - In Hold-to-Talk: after 30s silence, auto-stop recording
  - In VAD mode: after 15s silence, show prompt: "No speech detected. Please try again."
  - Timeout without sending to LLM (avoid empty messages)
- **Recovery**:
  - User speaks clearly and tries again
  - Check microphone is working (test in system audio settings)

### Truncated Audio / Dropouts
- **Symptom**: Network drops some WebSocket frames (packet loss)
- **Detection**: Audio playback has gaps or stuttering
- **Response**:
  - Web Audio API may not be able to recover lost frames
  - Audio playback may have minor gaps
  - Log packet loss rate
  - No user-facing error (audio degradation is subtle)
- **Recovery**:
  - Improve network connection
  - User may retry next turn
  - Consider increasing buffer size for more resilience

### LLM Inference Crash During Voice Response
- **Symptom**: node-llama-cpp crashes mid-generation during voice response
- **Detection**: llm_token stream stops abruptly, no finish_reason sent
- **Response**:
  - Sidecar detects LLM connection loss
  - Send error message to user in chat: "Response generation failed. Please try again."
  - Cancel TTS synthesis
  - Send turn_end with error flag
  - Do NOT send partial audio (incomplete sentence)
- **Recovery**:
  - Server auto-recovers LLM and restarts model (Step 4 of workflow-inference-chat)
  - User retries their message

### Concurrent Voice Sessions
- **Symptom**: Two simultaneous WebSocket connections from same user
- **Detection**: Multiple /ws/chat connections from same session_id
- **Response**:
  - First connection: normal operation
  - Second connection: reject with 409 Conflict, message "Voice already active in another window"
  - User must close other voice session first
- **Recovery**:
  - User closes duplicate tab/window
  - User retries voice input

### VAD False Positives (Background Noise)
- **Symptom**: VAD triggers on background noise (dogs, traffic, keyboard clicks)
- **Detection**: stt_final received but transcript is gibberish or unrelated
- **Response**:
  - Transcript is sent to LLM anyway (no validation)
  - LLM processes nonsensical input, produces garbage response
  - Show response to user
  - Log event for future VAD tuning
- **Recovery**:
  - User manually edits transcript before sending (manual confirmation mode)
  - User retries in quieter environment
  - Admin can tune VAD threshold (lower = fewer false positives, fewer real detections)

### Database Save Failure
- **Symptom**: db.insert() fails for messages table in Step 15
- **Detection**: Exception when persisting conversation
- **Response**:
  - Log error: "Failed to save voice message to database"
  - Still show message to user (conversation not lost, just not persistent)
  - Show notification: "Chat saved locally but not to database (try again later)"
- **Recovery**:
  - Retry save on next message
  - If persistent: admin checks database connection
  - Conversation is still available in current session (not lost)

## Permissions
- **Microphone**: Requires browser permission (getUserMedia)
- **Audio Output**: Requires implicit browser permission (usually granted)
- **API Key**: If server mode, Bearer token required in WebSocket handshake

## Exit Conditions
- **Normal End**: turn_end received, audio playback complete, user ready for next message
- **User Cancel**: User releases voice button (hold-to-talk) or stops speaking (VAD mode)
- **Network Disconnect**: ws.onclose → attempt auto-reconnect or show error
- **Timeout**: Silence for 30s (hold-to-talk) or 15s (VAD) → stop listening, no LLM call
- **Error**: Sidecar unavailable or LLM crash → show error, fall back to text chat

## Data Changes

### Tables Written
- **messages**
  - Insert: user message (from STT transcript) with audioPath (if saved)
  - Insert: assistant message (from LLM) with audioPath (TTS output)

### Files Written
- **{message_dir}/audio/{uuid}_user.wav** (microphone recording, optional)
- **{message_dir}/audio/{uuid}_assistant.wav** (TTS output, optional)

### Tables Read
- **settings** (voice model preferences, audio storage location)
- **models** (check if TTS/STT models loaded)

### In-Memory State
- **WebSocket**: Persistent connection from frontend to voice service
- **Audio Buffers**: PCM frames queued in Web Audio API
- **Message History**: conversation context passed to LLM

## Related Documentation
- `/docs/voice/setup.md` — Voice service installation and configuration
- `/docs/voice/models.md` — STT, TTS model options and downloads
- `/docs/api/websocket.md` — WebSocket protocol for voice endpoint
- `workflow-inference-chat.md` — LLM inference (called from within voice loop)
- `workflow-settings-update.md` — Voice preference configuration

## Changelog
- **v1.0** (2026-03-20): Initial workflow documentation
  - Real-time speech-to-text streaming (Silero VAD + Faster-Whisper)
  - Concurrent LLM inference and TTS synthesis
  - WebSocket-based low-latency audio streaming
  - Hold-to-talk and continuous VAD modes
  - Comprehensive failure scenarios and fallbacks
