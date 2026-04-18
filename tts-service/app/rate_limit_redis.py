import time

import redis.asyncio as redis
from redis.exceptions import RedisError
from fastapi import HTTPException, Request

from app.config import settings

rds = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def check_rate_limit(request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    window = settings.RATE_LIMIT_WINDOW_SECONDS
    slot = int(time.time() // window)
    key = f"rl:{ip}:{slot}"

    try:
        count = await rds.incr(key)
        if count == 1:
            await rds.expire(key, window + 2)
    except RedisError:
        # 零配置场景下允许无 Redis 启动；限流退化为关闭
        return

    if count > settings.RATE_LIMIT_REQUESTS:
        raise HTTPException(status_code=429, detail="Too Many Requests")
