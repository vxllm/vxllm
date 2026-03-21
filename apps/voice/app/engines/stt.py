"""Speech-to-Text engine using faster-whisper."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from app.config import STT_MODEL

logger = logging.getLogger(__name__)


class STTEngine:
    """Stateless faster-whisper wrapper.

    Models are loaded only via explicit ``load(model_path=...)`` calls
    from the Bun server.  No auto-download logic — VxLLM manages
    model downloads.
    """

    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_name: str = STT_MODEL
        self._loaded: bool = False
        self._backend: str = "unknown"

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def backend(self) -> str:
        return self._backend

    async def load(self, model_path: str | None = None, backend: str | None = None) -> None:
        """Load the faster-whisper model from an explicit path.

        Parameters
        ----------
        model_path:
            Absolute path to the model directory or file.  Required.
        backend:
            Optional backend hint (currently only ``"faster-whisper"``
            is supported).
        """
        if self._loaded:
            return

        if model_path is None:
            raise ValueError("model_path is required — VxLLM manages model downloads")

        p = Path(model_path)
        if not p.exists():
            raise FileNotFoundError(f"Model path does not exist: {model_path}")

        # Detect or confirm backend
        detected_backend = backend or "faster-whisper"
        if not backend:
            if p.is_dir() and (p / "model.bin").exists():
                detected_backend = "faster-whisper"
            elif p.suffix == ".nemo":
                raise NotImplementedError("NeMo backend is not yet supported. Supported: faster-whisper")
            else:
                detected_backend = "faster-whisper"  # Default

        if detected_backend == "nemo":
            raise NotImplementedError("NeMo backend is not yet supported. Supported: faster-whisper")

        # Load with faster-whisper
        from faster_whisper import WhisperModel

        logger.info("Loading STT model: %s (backend: %s)", model_path, detected_backend)
        model_size_or_path = str(p)
        self._model = WhisperModel(
            model_size_or_path,
            device="cpu",
            compute_type="int8",
        )
        self._loaded = True
        self._backend = detected_backend
        self._model_name = p.name if p.is_dir() else model_path
        logger.info("STT model '%s' loaded successfully.", self._model_name)

    async def unload(self) -> None:
        """Unload the current STT model and free resources."""
        if not self._loaded:
            return
        self._model = None
        self._loaded = False
        logger.info("STT model '%s' unloaded.", self._model_name)

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
