"""Speech-to-text transcription route."""

from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.engines.stt import stt_engine

router = APIRouter()


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str | None = Form(default=None, description="BCP-47 language hint"),
) -> dict:
    """Transcribe an uploaded audio file via faster-whisper.

    Accepts any format that ffmpeg/soundfile can decode (wav, mp3,
    webm, ogg, flac, etc.).
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Missing filename on upload.")

    suffix = Path(file.filename).suffix or ".wav"

    # Write uploaded bytes to a temp file so faster-whisper can read it.
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        result = await stt_engine.transcribe(tmp_path, language=language)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        # Clean up temp file.
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except NameError:
            pass
