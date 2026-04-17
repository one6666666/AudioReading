import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from app.cache import TTLCache, build_cache_key
from app.config import settings
from app.deps import verify_api_key
from app.metrics import CACHE_HIT_COUNT, FALLBACK_COUNT, REQUEST_COUNT, ObserveLatency
from app.providers.router import ProviderRouter
from app.rate_limit_redis import check_rate_limit
from app.schemas import TTSRequest, TTSResponse
from app.storage_oss import upload_audio_bytes

router = APIRouter(prefix="/api/tts", tags=["tts"])
provider_router = ProviderRouter()
cache = TTLCache(max_items=settings.CACHE_MAX_ITEMS, ttl_seconds=settings.CACHE_TTL_SECONDS)


@router.post("/synthesize", response_model=TTSResponse, dependencies=[Depends(verify_api_key)])
async def synthesize(req: TTSRequest, request: Request):
    await check_rate_limit(request)

    try:
        key = build_cache_key(req.model_dump())
        cached_url = cache.get(key)
        if cached_url:
            CACHE_HIT_COUNT.inc()
            REQUEST_COUNT.labels(provider="cache", status="success").inc()
            return TTSResponse(provider="cache", cache_hit=True, audio_url=cached_url)

        audio, provider = await provider_router.synthesize(req)
        with ObserveLatency(provider=provider):
            ext = "mp3" if req.format == "mp3" else "wav"
            content_type = "audio/mpeg" if ext == "mp3" else "audio/wav"
            date_prefix = datetime.datetime.utcnow().strftime("%Y%m%d")
            object_key = f"tts/{date_prefix}/{key}.{ext}"
            audio_url = upload_audio_bytes(object_key, audio, content_type)

        if provider == "tencent":
            FALLBACK_COUNT.inc()

        REQUEST_COUNT.labels(provider=provider, status="success").inc()
        cache.set(key, audio_url)
        return TTSResponse(provider=provider, cache_hit=False, audio_url=audio_url)
    except Exception as e:
        REQUEST_COUNT.labels(provider="unknown", status="fail").inc()
        raise HTTPException(status_code=500, detail=str(e))
