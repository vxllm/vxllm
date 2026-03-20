"""Text-to-Speech engine.

Attempts to load Kokoro for high-quality neural TTS.  If Kokoro is
not installed, falls back to a silent placeholder so the rest of the
sidecar (STT, VAD, health checks) continues to work.
"""

from __future__ import annotations

import io
import logging
import struct
from typing import AsyncGenerator

from app.config import TTS_VOICE

logger = logging.getLogger(__name__)

# Available voices when Kokoro is loaded — will be populated dynamically.
_PLACEHOLDER_VOICES: list[dict] = [
    {"id": "af_sky", "name": "Sky (Female)", "language": "en"},
    {"id": "af_bella", "name": "Bella (Female)", "language": "en"},
    {"id": "am_adam", "name": "Adam (Male)", "language": "en"},
    {"id": "am_michael", "name": "Michael (Male)", "language": "en"},
]


def _build_wav_header(
    sample_rate: int = 24000,
    bits_per_sample: int = 16,
    num_channels: int = 1,
    data_size: int = 0,
) -> bytes:
    """Build a minimal WAV header for streaming."""
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,  # file size - 8
        b"WAVE",
        b"fmt ",
        16,  # chunk size
        1,  # PCM format
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header


class TTSEngine:
    """Lazy-loaded TTS wrapper.

    Tries Kokoro first; falls back to a placeholder that generates
    silence so callers always get a valid audio stream.
    """

    def __init__(self) -> None:
        self._pipeline: object | None = None
        self._loaded: bool = False
        self._backend: str = "none"
        self._default_voice: str = TTS_VOICE

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def backend(self) -> str:
        return self._backend

    async def load(self) -> None:
        """Attempt to load a TTS backend."""
        if self._loaded:
            return

        # --- Try Kokoro ---
        try:
            import kokoro  # noqa: F401

            logger.info("Kokoro package found — loading TTS pipeline …")
            pipeline = kokoro.KPipeline(lang_code="a")
            self._pipeline = pipeline
            self._backend = "kokoro"
            self._loaded = True
            logger.info("Kokoro TTS loaded successfully.")
            return
        except ImportError:
            logger.info("Kokoro not installed — will use placeholder TTS.")
        except Exception:
            logger.warning("Kokoro failed to initialize — falling back to placeholder.", exc_info=True)

        # --- Placeholder (silent audio) ---
        self._backend = "placeholder"
        self._loaded = True
        logger.info("Using placeholder TTS (returns silence).")

    def get_voices(self) -> list[dict]:
        """Return the list of available voices."""
        return list(_PLACEHOLDER_VOICES)

    async def synthesize_stream(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        """Generate WAV audio bytes for *text*.

        Yields the WAV header first, then PCM data chunks.
        """
        if not self._loaded:
            await self.load()

        voice = voice or self._default_voice

        if self._backend == "kokoro" and self._pipeline is not None:
            async for chunk in self._synthesize_kokoro(text, voice, speed):
                yield chunk
        else:
            async for chunk in self._synthesize_placeholder(text, speed):
                yield chunk

    # ---- Kokoro backend ------------------------------------------------

    async def _synthesize_kokoro(
        self,
        text: str,
        voice: str,
        speed: float,
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio from the Kokoro pipeline."""
        import numpy as np

        pipeline = self._pipeline
        sample_rate = 24000

        # Kokoro's generate() returns a generator of segments.
        all_audio: list[bytes] = []
        try:
            for _gs, _ps, audio_np in pipeline.generate(  # type: ignore[union-attr]
                text, voice=voice, speed=speed
            ):
                if audio_np is not None:
                    pcm = (audio_np * 32767).astype(np.int16).tobytes()
                    all_audio.append(pcm)
        except Exception:
            logger.exception("Kokoro synthesis failed")
            # Fall through to yield silence
            async for chunk in self._synthesize_placeholder(text, speed):
                yield chunk
            return

        data = b"".join(all_audio)
        yield _build_wav_header(sample_rate=sample_rate, data_size=len(data))
        # Yield data in 4 KB chunks for streaming
        chunk_size = 4096
        for i in range(0, len(data), chunk_size):
            yield data[i : i + chunk_size]

    # ---- Placeholder backend -------------------------------------------

    async def _synthesize_placeholder(
        self,
        text: str,
        speed: float,
    ) -> AsyncGenerator[bytes, None]:
        """Return a short silent WAV.  Useful for integration testing."""
        sample_rate = 24000
        # ~0.5 s of silence
        num_samples = int(sample_rate * 0.5 / max(speed, 0.1))
        data = b"\x00\x00" * num_samples  # 16-bit silence

        yield _build_wav_header(sample_rate=sample_rate, data_size=len(data))
        yield data


# Module-level singleton.
tts_engine = TTSEngine()
