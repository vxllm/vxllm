"""Model management routes for dynamic load/unload."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.engines.stt import stt_engine
from app.engines.tts import tts_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/models", tags=["models"])


class LoadModelRequest(BaseModel):
    type: str  # "stt" or "tts"
    model_path: str
    backend: str | None = None


class UnloadModelRequest(BaseModel):
    type: str  # "stt" or "tts"


@router.post("/load")
async def load_model(req: LoadModelRequest) -> dict:
    """Load a model by type. Unloads existing model of same type first."""
    if req.type == "stt":
        if stt_engine.is_loaded:
            await stt_engine.unload()
        await stt_engine.load(model_path=req.model_path, backend=req.backend)
        return {"success": True, "type": "stt", "model_name": stt_engine.model_name, "backend": stt_engine.backend}
    elif req.type == "tts":
        if tts_engine.is_loaded:
            tts_engine.unload()
        tts_engine.load(model_path=req.model_path, backend=req.backend)
        return {"success": True, "type": "tts", "backend": tts_engine.backend}
    else:
        return {"success": False, "error": f"Unknown type: {req.type}"}


@router.post("/unload")
async def unload_model(req: UnloadModelRequest) -> dict:
    """Unload a model by type."""
    if req.type == "stt":
        await stt_engine.unload()
        return {"success": True, "type": "stt"}
    elif req.type == "tts":
        tts_engine.unload()
        return {"success": True, "type": "tts"}
    else:
        return {"success": False, "error": f"Unknown type: {req.type}"}


@router.get("/status")
async def models_status() -> dict:
    """Return the load status of STT and TTS models."""
    return {
        "stt": {
            "loaded": stt_engine.is_loaded,
            "model_name": stt_engine.model_name if stt_engine.is_loaded else None,
            "backend": stt_engine.backend if stt_engine.is_loaded else None,
        },
        "tts": {
            "loaded": tts_engine.is_loaded,
            "backend": tts_engine.backend if tts_engine.is_loaded else None,
        },
    }
