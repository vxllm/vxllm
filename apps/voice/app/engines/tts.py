"""Text-to-Speech engine.

Attempts to load Kokoro for high-quality neural TTS.  If Kokoro is
not installed, falls back to a silent placeholder so the rest of the
voice service (STT, VAD, health checks) continues to work.
"""

from __future__ import annotations

import io
import logging
from typing import AsyncGenerator

import numpy as np
import soundfile as sf

from app.config import TTS_VOICE

logger = logging.getLogger(__name__)

KOKORO_VOICES: list[dict] = [
    {"id": "af_heart", "name": "Heart (Female)", "language": "en-US"},
    {"id": "af_sky", "name": "Sky (Female)", "language": "en-US"},
    {"id": "am_michael", "name": "Michael (Male)", "language": "en-US"},
    {"id": "bf_emma", "name": "Emma (Female)", "language": "en-GB"},
]


class TTSEngine:
    """Lazy-loaded TTS wrapper.

    Tries Kokoro first; falls back to a placeholder that generates
    silence so callers always get a valid audio stream.
    """

    def __init__(self) -> None:
        self.pipeline: object | None = None
        self._loaded: bool = False
        self._backend: str = "none"
        self._default_voice: str = TTS_VOICE

    def load(self, lang_code: str = "a") -> None:
        """Attempt to load the Kokoro TTS backend."""
        if self._loaded:
            return

        logger.info("Loading Kokoro TTS pipeline...")
        try:
            from kokoro import KPipeline

            self.pipeline = KPipeline(lang_code=lang_code)
            self._loaded = True
            self._backend = "kokoro"
            logger.info("Kokoro TTS loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load Kokoro: {e}. Using placeholder.")
            self._loaded = True
            self._backend = "placeholder"

    def is_loaded(self) -> bool:
        """Return whether any TTS backend has been loaded."""
        return self._loaded

    def get_backend(self) -> str:
        """Return the name of the active backend."""
        return self._backend

    def get_voices(self) -> list[dict]:
        """Return the list of available voices."""
        return KOKORO_VOICES

    async def synthesize_stream(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        """Generate WAV audio bytes for *text*.

        Yields complete WAV chunks — one per sentence when using
        Kokoro, or a single silent WAV when using the placeholder.
        """
        if not self._loaded:
            self.load()

        voice = voice or self._default_voice

        if self._backend == "placeholder" or self.pipeline is None:
            yield self._generate_silence()
            return

        try:
            for _, _, audio in self.pipeline(  # type: ignore[operator]
                text, voice=voice, speed=speed, split_pattern=r"[.!?]"
            ):
                buf = io.BytesIO()
                sf.write(buf, audio, 24000, format="WAV")
                buf.seek(0)
                yield buf.read()
        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            yield self._generate_silence()

    def _generate_silence(self) -> bytes:
        """Return a 1-second silent WAV at 24 kHz."""
        buf = io.BytesIO()
        silence = np.zeros(24000, dtype=np.float32)
        sf.write(buf, silence, 24000, format="WAV")
        buf.seek(0)
        return buf.read()


# Module-level singleton.
tts_engine = TTSEngine()
