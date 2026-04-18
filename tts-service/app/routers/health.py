from fastapi import APIRouter

from app.config import get_config_issues, is_direct_usable, settings

router = APIRouter()


@router.get("/healthz")
async def healthz():
    return {"ok": True}


@router.get("/readyz")
async def readyz():
    issues = get_config_issues()
    return {
        "ready": is_direct_usable(),
        "direct_usable": is_direct_usable(),
        "mode": "mock" if issues and settings.ENABLE_LOCAL_MOCK_TTS else "cloud",
        "issues": issues,
    }
