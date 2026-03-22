"""WebSocket streaming route for real-time VAD + STT."""

from __future__ import annotations

import json
import logging
import tempfile
import wave
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.engines.stt import stt_engine
from app.engines.vad import VAD_SAMPLE_RATE, vad_engine

logger = logging.getLogger(__name__)

router = APIRouter()

# How many consecutive non-speech frames trigger end-of-utterance.
_SILENCE_FRAMES_THRESHOLD = 15

# Expected frame duration in ms for each incoming WebSocket message.
_FRAME_DURATION_MS = 30

# Bytes per frame: 16 kHz * 16-bit * 30 ms = 960 samples * 2 bytes = 1920.
_FRAME_BYTES = int(VAD_SAMPLE_RATE * _FRAME_DURATION_MS / 1000) * 2


@router.websocket("/stream")
async def stream(ws: WebSocket) -> None:
    """Bidirectional WebSocket for real-time voice transcription.

    **Client sends:** raw 16-bit LE PCM frames (mono, 16 kHz, ~30 ms each).

    **Server sends:** JSON messages::

        { "type": "transcription", "text": "...", "language": "en", ... }
        { "type": "vad", "is_speech": true }
        { "type": "error", "detail": "..." }
    """
    await ws.accept()

    # Make sure engines are ready.
    if not stt_engine.is_loaded:
        await ws.send_json({"type": "error", "detail": "STT model not loaded. Load one via the VxLLM API first."})
        await ws.close(code=1011)
        return

    try:
        if not vad_engine.is_loaded:
            await vad_engine.load()
    except Exception as exc:
        await ws.send_json({"type": "error", "detail": f"Engine load failed: {exc}"})
        await ws.close(code=1011)
        return

    vad_engine.reset()
    speech_buffer = bytearray()
    silence_count = 0
    is_speaking = False

    try:
        while True:
            data = await ws.receive_bytes()

            # Run VAD on the frame.
            try:
                speech = vad_engine.is_speech(data)
            except Exception:
                logger.exception("VAD error")
                speech = False

            if speech:
                silence_count = 0
                speech_buffer.extend(data)

                if not is_speaking:
                    is_speaking = True
                    await ws.send_json({"type": "vad", "is_speech": True})
            else:
                silence_count += 1

                if is_speaking:
                    speech_buffer.extend(data)

                    if silence_count >= _SILENCE_FRAMES_THRESHOLD:
                        # End of utterance — transcribe the buffered audio.
                        await ws.send_json({"type": "vad", "is_speech": False})
                        await _transcribe_and_send(ws, bytes(speech_buffer))
                        speech_buffer.clear()
                        is_speaking = False
                        vad_engine.reset()

    except WebSocketDisconnect:
        logger.debug("WebSocket client disconnected.")
    except Exception:
        logger.exception("Unexpected error in /stream WebSocket")
        try:
            await ws.send_json({"type": "error", "detail": "Internal server error"})
        except Exception:
            pass
    finally:
        # Transcribe any remaining buffered audio.
        if speech_buffer:
            try:
                await _transcribe_and_send(ws, bytes(speech_buffer))
            except Exception:
                pass


async def _transcribe_and_send(ws: WebSocket, pcm_data: bytes) -> None:
    """Write PCM to a temp WAV, transcribe, and send the result."""
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
            with wave.open(tmp, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(VAD_SAMPLE_RATE)
                wf.writeframes(pcm_data)

        result = await stt_engine.transcribe(tmp_path)

        if result["text"].strip():
            await ws.send_text(
                json.dumps(
                    {
                        "type": "transcription",
                        "text": result["text"],
                        "language": result["language"],
                        "confidence": result["confidence"],
                        "duration_seconds": result["duration_seconds"],
                    }
                )
            )
    except Exception:
        logger.exception("Transcription failed for buffered audio")
        try:
            await ws.send_json({"type": "error", "detail": "Transcription failed"})
        except Exception:
            pass
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
