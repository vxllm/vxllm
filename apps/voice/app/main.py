"""VxLLM Voice Service — FastAPI application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, HOST, PORT
from app.engines.vad import vad_engine
from app.routes import health, speak, stream, transcribe, voices
from app.routes.models import router as models_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vxllm-voice")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Start voice service — only VAD is preloaded eagerly."""
    logger.info("Starting VxLLM Voice Service …")
    # VAD is an internal dependency — load eagerly
    try:
        await vad_engine.load()
    except Exception:
        logger.warning("VAD engine failed to preload — will retry on first request.")
    logger.info("Voice service ready (waiting for model load requests from VxLLM)")
    yield
    logger.info("Voice service shutting down")


app = FastAPI(
    title="VxLLM Voice Service",
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
app.include_router(models_router)


def start() -> None:
    """Entry point for ``vxllm-voice`` console script."""
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        log_level="info",
    )
