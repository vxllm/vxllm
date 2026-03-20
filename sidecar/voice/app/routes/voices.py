"""Voice listing route."""

from __future__ import annotations

from fastapi import APIRouter

from app.engines.tts import tts_engine

router = APIRouter()


@router.get("/voices")
async def list_voices() -> dict:
    """Return available TTS voices."""
    return {
        "voices": tts_engine.get_voices(),
    }
