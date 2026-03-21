"""Text-to-Speech engine.

Loads a Kokoro TTS model from an explicit path provided by the Bun
server.  No auto-download or placeholder fallback — if the model is
not loaded, synthesis requests will fail with a clear error.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import AsyncGenerator

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
    """Stateless TTS wrapper.

    Models are loaded only via explicit ``load(model_path=...)`` calls
    from the Bun server.  No auto-download logic — VxLLM manages
    model downloads.
    """

    def __init__(self) -> None:
        self.pipeline: object | None = None
        self._loaded: bool = False
        self._backend: str = "none"
        self._default_voice: str = TTS_VOICE

    @property
    def backend(self) -> str:
        """Return the active TTS backend name."""
        return self._backend

    def load(self, lang_code: str = "a", model_path: str | None = None, backend: str | None = None) -> None:
        """Load the Kokoro TTS model from an explicit path.

        Parameters
        ----------
        lang_code:
            Language code for Kokoro (default ``"a"`` for American English).
        model_path:
            Absolute path to the model file or directory.  Required.
        backend:
            Optional backend hint (currently only ``"kokoro"`` is supported).
        """
        if self._loaded:
            return

        if model_path is None:
            raise ValueError("model_path is required — VxLLM manages model downloads")

        p = Path(model_path)
        if not p.exists():
            raise FileNotFoundError(f"Model path does not exist: {model_path}")

        # Find the .pth model file
        if p.is_dir():
            pth_files = list(p.glob("*.pth"))
            if not pth_files:
                raise FileNotFoundError(f"No .pth model file found in directory: {model_path}")
            model_file = str(pth_files[0])
        else:
            model_file = str(p)

        try:
            from kokoro import KPipeline
            logger.info("Loading TTS model from path: %s", model_file)
            self.pipeline = KPipeline(lang_code=lang_code, model=model_file)
            self._loaded = True
            self._backend = "kokoro"
            logger.info("Kokoro TTS loaded successfully")
        except ImportError:
            raise ImportError("Kokoro TTS package not installed. Run: pip install kokoro")
        except Exception as e:
            raise RuntimeError(f"Failed to load TTS model: {e}") from e

    def unload(self) -> None:
        """Unload the current TTS model and free resources."""
        if not self._loaded:
            return
        self.pipeline = None
        self._loaded = False
        self._backend = "none"
        logger.info("TTS model unloaded.")

    @property
    def is_loaded(self) -> bool:
        """Return whether any TTS backend has been loaded."""
        return self._loaded

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

        Yields complete WAV chunks — one per sentence when using Kokoro.
        Raises ``RuntimeError`` if no model is loaded.
        """
        if not self._loaded or self.pipeline is None:
            raise RuntimeError("TTS model not loaded. Load a model first via the API.")

        voice = voice or self._default_voice

        for _, _, audio in self.pipeline(  # type: ignore[operator]
            text, voice=voice, speed=speed, split_pattern=r"[.!?]"
        ):
            buf = io.BytesIO()
            sf.write(buf, audio, 24000, format="WAV")
            buf.seek(0)
            yield buf.read()


# Module-level singleton.
tts_engine = TTSEngine()
