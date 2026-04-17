from fastapi import Header, HTTPException

from app.config import settings


async def verify_api_key(x_api_key: str = Header(default="")):
    if x_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
