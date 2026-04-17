from fastapi import FastAPI

from app.config import settings
from app.metrics import metrics_response
from app.routers.health import router as health_router
from app.routers.tts import router as tts_router

app = FastAPI(title=settings.APP_NAME)
app.include_router(health_router)
app.include_router(tts_router)


@app.get("/metrics")
async def metrics():
    return metrics_response()
