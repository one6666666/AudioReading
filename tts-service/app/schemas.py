from typing import Literal, Optional
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: Optional[str] = "longxiaochun"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    pitch: float = Field(default=1.0, ge=0.5, le=2.0)
    format: Literal["mp3", "wav"] = "mp3"
    sample_rate: int = 24000


class TTSResponse(BaseModel):
    provider: str
    cache_hit: bool
    audio_url: str
