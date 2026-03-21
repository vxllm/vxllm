"""Text-to-speech synthesis route."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.engines.tts import tts_engine

router = APIRouter()


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str | None = Field(default=None, description="Voice ID (e.g. 'af_sky')")
    speed: float = Field(default=1.0, ge=0.25, le=4.0)


@router.post("/speak")
async def speak(body: SpeakRequest) -> StreamingResponse:
    """Synthesize speech from text and stream back audio/wav."""
    try:
        return StreamingResponse(
            tts_engine.synthesize_stream(
                text=body.text,
                voice=body.voice,
                speed=body.speed,
            ),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "inline; filename=\"speech.wav\"",
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
