from typing import Optional, Tuple

from app.config import settings
from app.providers.aliyun_tts import AliyunTTSProvider
from app.providers.tencent_tts import TencentTTSProvider
from app.schemas import TTSRequest


class ProviderRouter:
    def __init__(self):
        self.primary = AliyunTTSProvider()
        self.fallback: Optional[TencentTTSProvider] = None

        if settings.ENABLE_TENCENT_FALLBACK:
            try:
                self.fallback = TencentTTSProvider()
            except Exception:
                self.fallback = None

    async def synthesize(self, req: TTSRequest) -> Tuple[bytes, str]:
        try:
            audio = await self.primary.synthesize(req)
            return audio, self.primary.name
        except Exception as primary_err:
            if self.fallback:
                audio = await self.fallback.synthesize(req)
                return audio, self.fallback.name
            raise primary_err
