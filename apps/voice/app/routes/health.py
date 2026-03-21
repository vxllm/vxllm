"""Health-check route."""

from __future__ import annotations

from fastapi import APIRouter

from app.engines.stt import stt_engine
from app.engines.tts import tts_engine
from app.engines.vad import vad_engine

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Return the readiness status of every engine."""
    return {
        "status": "ok",
        "engines": {
            "stt": {
                "loaded": stt_engine.is_loaded,
                "model": stt_engine.model_name,
                "backend": stt_engine.backend,
            },
            "tts": {
                "loaded": tts_engine.is_loaded,
                "backend": tts_engine.backend,
            },
            "vad": {
                "loaded": vad_engine.is_loaded,
            },
        },
    }
