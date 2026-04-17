import base64

import httpx

from app.config import settings
from app.providers.base import BaseTTSProvider
from app.schemas import TTSRequest


class AliyunTTSProvider(BaseTTSProvider):
    name = "aliyun"

    async def synthesize(self, req: TTSRequest) -> bytes:
        headers = {
            "Authorization": f"Bearer {settings.ALIYUN_API_KEY}",
            "Content-Type": "application/json",
        }

        body = {
            "model": settings.ALIYUN_MODEL,
            "input": {"text": req.text},
            "parameters": {
                "voice": req.voice,
                "format": req.format,
                "sample_rate": req.sample_rate,
                "speed": req.speed,
                "pitch": req.pitch,
            },
        }

        async with httpx.AsyncClient(timeout=settings.ALIYUN_TIMEOUT_SECONDS) as client:
            resp = await client.post(settings.ALIYUN_TTS_URL, headers=headers, json=body)

        if resp.status_code >= 400:
            raise RuntimeError(f"Aliyun TTS failed: {resp.status_code} {resp.text}")

        data = resp.json()
        audio_b64 = (
            data.get("output", {}).get("audio", {}).get("data")
            or data.get("data", {}).get("audio")
            or data.get("audio")
        )
        if not audio_b64:
            raise RuntimeError(f"Aliyun response missing audio field: {data}")

        return base64.b64decode(audio_b64)
