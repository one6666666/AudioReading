import base64
import time

from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.tts.v20190823 import models, tts_client

from app.config import settings
from app.providers.base import BaseTTSProvider
from app.schemas import TTSRequest


def map_speed_to_tencent(speed: float) -> float:
    if speed <= 1.0:
        return max(-2.0, (speed - 1.0) * 4.0)
    return min(4.0, (speed - 1.0) * 4.0)


class TencentTTSProvider(BaseTTSProvider):
    name = "tencent"

    def __init__(self):
        if not settings.TENCENT_SECRET_ID or not settings.TENCENT_SECRET_KEY:
            raise RuntimeError("Tencent credentials are empty")
        cred = credential.Credential(settings.TENCENT_SECRET_ID, settings.TENCENT_SECRET_KEY)
        self.client = tts_client.TtsClient(cred, settings.TENCENT_REGION)

    async def synthesize(self, req: TTSRequest) -> bytes:
        try:
            request = models.TextToVoiceRequest()
            request.Text = req.text
            request.SessionId = f"{settings.TENCENT_SESSION_ID_PREFIX}_{int(time.time() * 1000)}"
            request.ModelType = settings.TENCENT_MODEL_TYPE
            request.Volume = settings.TENCENT_VOLUME
            request.Speed = map_speed_to_tencent(req.speed)
            request.ProjectId = settings.TENCENT_PROJECT_ID

            voice_type = settings.TENCENT_PRIMARY_VOICE_TYPE
            if req.voice and str(req.voice).isdigit():
                voice_type = int(req.voice)
            request.VoiceType = voice_type
            request.Codec = "mp3" if req.format == "mp3" else "wav"

            resp = self.client.TextToVoice(request)
            if not getattr(resp, "Audio", None):
                raise RuntimeError(f"Tencent response missing Audio: {resp.to_json_string()}")

            return base64.b64decode(resp.Audio)
        except TencentCloudSDKException as e:
            raise RuntimeError(f"Tencent SDK error: {str(e)}") from e
        except Exception as e:
            raise RuntimeError(f"Tencent TTS failed: {str(e)}") from e
