"""Speech-to-Text engine using faster-whisper."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from app.config import MODELS_DIR, STT_MODEL

logger = logging.getLogger(__name__)


class STTEngine:
    """Lazy-loaded faster-whisper wrapper.

    The model is downloaded and loaded on the first call to ``load()``
    (or implicitly on the first ``transcribe()`` call).  This keeps
    import-time overhead minimal.
    """

    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_name: str = STT_MODEL
        self._loaded: bool = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def model_name(self) -> str:
        return self._model_name

    async def load(self) -> None:
        """Load the faster-whisper model.

        The model binary is cached under ``MODELS_DIR/whisper/``.
        If the model is not present it will be downloaded automatically
        by faster-whisper from HuggingFace on first use.
        """
        if self._loaded:
            return

        try:
            from faster_whisper import WhisperModel

            cache_dir = Path(MODELS_DIR) / "whisper"
            cache_dir.mkdir(parents=True, exist_ok=True)

            logger.info("Loading STT model '%s' …", self._model_name)
            self._model = WhisperModel(
                self._model_name,
                device="cpu",
                compute_type="int8",
                download_root=str(cache_dir),
            )
            self._loaded = True
            logger.info("STT model '%s' loaded successfully.", self._model_name)
        except Exception:
            logger.exception("Failed to load STT model '%s'", self._model_name)
            raise

    async def transcribe(
        self,
        audio_path: str | Path,
        language: str | None = None,
    ) -> dict:
        """Transcribe an audio file and return structured results.

        Parameters
        ----------
        audio_path:
            Path to the audio file (wav, mp3, etc.).
        language:
            Optional BCP-47 language hint (e.g. ``"en"``).

        Returns
        -------
        dict with keys ``text``, ``language``, ``confidence``,
        ``duration_seconds``, and ``segments``.
        """
        if not self._loaded:
            await self.load()

        assert self._model is not None

        start = time.perf_counter()

        kwargs: dict[str, Any] = {}
        if language:
            kwargs["language"] = language

        segments_iter, info = self._model.transcribe(
            str(audio_path),
            beam_size=5,
            **kwargs,
        )

        segments: list[dict] = []
        full_text_parts: list[str] = []

        for seg in segments_iter:
            segments.append(
                {
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "text": seg.text.strip(),
                    "avg_logprob": round(seg.avg_logprob, 4),
                }
            )
            full_text_parts.append(seg.text.strip())

        elapsed = time.perf_counter() - start
        full_text = " ".join(full_text_parts)

        avg_confidence = 0.0
        if segments:
            import math

            avg_logprob = sum(s["avg_logprob"] for s in segments) / len(segments)
            avg_confidence = round(math.exp(avg_logprob), 4)

        return {
            "text": full_text,
            "language": info.language,
            "confidence": avg_confidence,
            "duration_seconds": round(info.duration, 3),
            "processing_seconds": round(elapsed, 3),
            "segments": segments,
        }


# Module-level singleton — instantiated but NOT loaded until first use.
stt_engine = STTEngine()
