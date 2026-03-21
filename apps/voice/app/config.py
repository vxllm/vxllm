import os

PORT = int(os.getenv("VOICE_PORT", "11501"))
HOST = os.getenv("VOICE_HOST", "127.0.0.1")
STT_MODEL = os.getenv("STT_MODEL", "large-v3-turbo")
TTS_VOICE = os.getenv("TTS_VOICE", "af_sky")
MODELS_DIR = os.path.expanduser(os.getenv("MODELS_DIR", "~/.vxllm/models"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
