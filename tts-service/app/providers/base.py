from abc import ABC, abstractmethod

from app.schemas import TTSRequest


class BaseTTSProvider(ABC):
    name: str

    @abstractmethod
    async def synthesize(self, req: TTSRequest) -> bytes:
        raise NotImplementedError
