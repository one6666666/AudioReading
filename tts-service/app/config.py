from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    APP_NAME: str = "tts-service"
    APP_ENV: str = "prod"
    LOG_LEVEL: str = "INFO"
    PORT: int = 8000
    WORKERS: int = 2

    INTERNAL_API_KEY: str = "change_me"

    # Aliyun
    ALIYUN_API_KEY: str
    ALIYUN_TTS_URL: str
    ALIYUN_MODEL: str = "cosyvoice-v1"
    ALIYUN_TIMEOUT_SECONDS: int = 20

    # Tencent fallback
    ENABLE_TENCENT_FALLBACK: bool = True
    TENCENT_SECRET_ID: str = ""
    TENCENT_SECRET_KEY: str = ""
    TENCENT_REGION: str = "ap-guangzhou"
    TENCENT_SESSION_ID_PREFIX: str = "tts_sess"
    TENCENT_MODEL_TYPE: int = 1
    TENCENT_VOLUME: int = 0
    TENCENT_SPEED: float = 0
    TENCENT_PROJECT_ID: int = 0
    TENCENT_PRIMARY_VOICE_TYPE: int = 101001

    # Redis
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    RATE_LIMIT_REQUESTS: int = 60
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # OSS
    OSS_ENDPOINT: str
    OSS_ACCESS_KEY_ID: str
    OSS_ACCESS_KEY_SECRET: str
    OSS_BUCKET: str
    OSS_PUBLIC_BASE_URL: str

    # Local URL cache
    CACHE_MAX_ITEMS: int = 5000
    CACHE_TTL_SECONDS: int = 86400


settings = Settings()
