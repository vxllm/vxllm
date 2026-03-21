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

    async def load(self, model_path: str | None = None) -> None:
        """Load the faster-whisper model.

        First checks if the model was pre-downloaded by the unified
        download manager into ``MODELS_DIR/stt/<model_name>/``.  If
        found, loads from that local path.  Otherwise falls back to
        faster-whisper's built-in download (cached under
        ``MODELS_DIR/whisper/``) for backward compatibility.
        """
        if self._loaded:
            return

        # If a specific path is provided, use it directly
        if model_path is not None:
            from faster_whisper import WhisperModel
            from pathlib import Path

            p = Path(model_path)
            if p.is_dir() and (p / "model.bin").exists():
                logger.info("Loading STT model from path: %s", model_path)
                self._model = WhisperModel(
                    str(p), device="cpu", compute_type="int8",
                )
            else:
                logger.info("Loading STT model: %s", model_path)
                self._model = WhisperModel(
                    model_path, device="cpu", compute_type="int8",
                )
            self._model_name = p.name if p.is_dir() else model_path
            self._loaded = True
            logger.info("STT model '%s' loaded successfully.", self._model_name)
            return

        try:
            from faster_whisper import WhisperModel

            # Check for model pre-downloaded by VxLLM's unified download manager
            # Try multiple possible folder names (registry name may differ from model name)
            possible_dirs = [
                Path(MODELS_DIR) / "stt" / self._model_name,
                Path(MODELS_DIR) / "stt" / f"whisper-{self._model_name}",
            ]
            # Also scan all subdirs in stt/ for a model.bin
            stt_dir = Path(MODELS_DIR) / "stt"
            if stt_dir.exists():
                for d in stt_dir.iterdir():
                    if d.is_dir() and d not in possible_dirs:
                        possible_dirs.append(d)

            local_model_dir = None
            for candidate in possible_dirs:
                if candidate.exists() and (candidate / "model.bin").exists():
                    local_model_dir = candidate
                    break

            if local_model_dir is not None:
                logger.info(
                    "Loading STT model '%s' from pre-downloaded path: %s",
                    self._model_name,
                    local_model_dir,
                )
                self._model = WhisperModel(
                    str(local_model_dir),
                    device="cpu",
                    compute_type="int8",
                )
            else:
                # Fallback: let faster-whisper auto-download into cache dir
                cache_dir = Path(MODELS_DIR) / "whisper"
                cache_dir.mkdir(parents=True, exist_ok=True)

                logger.info(
                    "Pre-downloaded STT model not found at %s, "
                    "falling back to auto-download for '%s'",
                    local_model_dir,
                    self._model_name,
                )
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
