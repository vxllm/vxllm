"""Voice Activity Detection engine using the silero-vad package."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Silero VAD expects 16 kHz mono audio.
VAD_SAMPLE_RATE = 16000


class VADEngine:
    """Lazy-loaded silero-vad wrapper.

    Uses the ``silero_vad`` pip package (``silero-vad >= 5.1``).
    Only CPU inference is used — no CUDA required.
    """

    def __init__(self) -> None:
        self._model: Any | None = None
        self._loaded: bool = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    async def load(self) -> None:
        """Load the silero-vad model."""
        if self._loaded:
            return

        try:
            from silero_vad import load_silero_vad

            logger.info("Loading silero-vad model …")
            model = load_silero_vad()
            self._model = model
            self._loaded = True
            logger.info("silero-vad loaded successfully.")
        except Exception:
            logger.exception("Failed to load silero-vad")
            raise

    def is_speech(self, audio_chunk: bytes, sample_rate: int = VAD_SAMPLE_RATE) -> bool:
        """Return ``True`` if *audio_chunk* contains speech.

        Parameters
        ----------
        audio_chunk:
            Raw 16-bit little-endian PCM bytes (mono, 16 kHz).
        sample_rate:
            Sample rate of the audio (default 16 000).
        """
        if not self._loaded or self._model is None:
            raise RuntimeError("VAD model not loaded — call load() first.")

        import torch

        # Convert raw PCM bytes -> float32 tensor in [-1, 1].
        audio_np = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
        audio_tensor = torch.from_numpy(audio_np)

        confidence: float = self._model(audio_tensor, sample_rate).item()
        return confidence > 0.5

    def reset(self) -> None:
        """Reset the VAD model's internal state between utterances."""
        if self._model is not None:
            self._model.reset_states()


# Module-level singleton.
vad_engine = VADEngine()
