"""VxLLM Voice Sidecar — FastAPI application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, HOST, PORT
from app.engines.stt import stt_engine
from app.engines.tts import tts_engine
from app.engines.vad import vad_engine
from app.routes import health, speak, stream, transcribe, voices

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vxllm-voice")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Preload models on startup so the first request is fast."""
    logger.info("Starting VxLLM Voice Sidecar …")

    # Load engines — each handles its own errors gracefully.
    try:
        await stt_engine.load()
    except Exception:
        logger.warning("STT engine failed to preload — will retry on first request.")

    try:
        await tts_engine.load()
    except Exception:
        logger.warning("TTS engine failed to preload — will retry on first request.")

    try:
        await vad_engine.load()
    except Exception:
        logger.warning("VAD engine failed to preload — will retry on first request.")

    logger.info("Voice sidecar ready on http://%s:%d", HOST, PORT)
    yield
    logger.info("Shutting down Voice Sidecar.")


app = FastAPI(
    title="VxLLM Voice Sidecar",
    version="0.1.0",
    description="STT, TTS, and VAD services for VxLLM",
    lifespan=lifespan,
)

# CORS ------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes ----------------------------------------------------------------
app.include_router(health.router)
app.include_router(voices.router)
app.include_router(transcribe.router)
app.include_router(speak.router)
app.include_router(stream.router)


def start() -> None:
    """Entry point for ``vxllm-voice`` console script."""
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        log_level="info",
    )
