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

from app.config import MODELS_DIR, TTS_VOICE

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

    def load(self, lang_code: str = "a", model_path: str | None = None) -> None:
        """Attempt to load the Kokoro TTS backend.

        First checks if a model was pre-downloaded by the unified
        download manager into ``MODELS_DIR/tts/``.  If a ``.pth``
        checkpoint is found there, it is passed to Kokoro.  Otherwise
        falls back to Kokoro's default model resolution for backward
        compatibility.
        """
        if self._loaded:
            return

        # If a specific model path is provided, use it directly
        if model_path is not None:
            try:
                from kokoro import KPipeline
                logger.info("Loading TTS model from path: %s", model_path)
                self.pipeline = KPipeline(lang_code=lang_code, model=model_path)
                self._loaded = True
                self._backend = "kokoro"
                logger.info("Kokoro TTS loaded from %s", model_path)
            except Exception as e:
                logger.warning(f"Failed to load Kokoro from {model_path}: {e}. Using placeholder.")
                self._loaded = True
                self._backend = "placeholder"
            return

        logger.info("Loading Kokoro TTS pipeline...")
        try:
            from kokoro import KPipeline
            from pathlib import Path

            # Check for a pre-downloaded model in MODELS_DIR/tts/
            tts_dir = Path(MODELS_DIR) / "tts"
            local_model: str | None = None
            if tts_dir.exists():
                pth_files = list(tts_dir.glob("*.pth"))
                if pth_files:
                    local_model = str(pth_files[0])
                    logger.info(
                        "Found pre-downloaded TTS model: %s", local_model
                    )

            if local_model:
                self.pipeline = KPipeline(
                    lang_code=lang_code, model=local_model
                )
            else:
                logger.info(
                    "No pre-downloaded TTS model found in %s, "
                    "using Kokoro default model resolution",
                    tts_dir,
                )
                self.pipeline = KPipeline(lang_code=lang_code)

            self._loaded = True
            self._backend = "kokoro"
            logger.info("Kokoro TTS loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load Kokoro: {e}. Using placeholder.")
            self._loaded = True
            self._backend = "placeholder"

    def unload(self) -> None:
        """Unload the current TTS model and free resources."""
        if not self._loaded:
            return
        self.pipeline = None
        self._loaded = False
        self._backend = "none"
        logger.info("TTS model unloaded.")

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
