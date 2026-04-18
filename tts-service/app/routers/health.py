from fastapi import APIRouter

from app.config import get_config_issues

router = APIRouter()


@router.get("/healthz")
async def healthz():
    return {"ok": True}


@router.get("/readyz")
async def readyz():
    issues = get_config_issues()
    return {"ready": len(issues) == 0, "direct_usable": len(issues) == 0, "issues": issues}
