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


def get_config_issues() -> list[str]:
    issues: list[str] = []

    if settings.INTERNAL_API_KEY in {"", "change_me", "replace_with_strong_secret"}:
        issues.append("INTERNAL_API_KEY 未配置为安全值")

    if not settings.ALIYUN_API_KEY or settings.ALIYUN_API_KEY == "your_aliyun_api_key":
        issues.append("ALIYUN_API_KEY 缺失")

    if not settings.ALIYUN_TTS_URL:
        issues.append("ALIYUN_TTS_URL 缺失")

    if not settings.OSS_ENDPOINT:
        issues.append("OSS_ENDPOINT 缺失")

    if not settings.OSS_ACCESS_KEY_ID:
        issues.append("OSS_ACCESS_KEY_ID 缺失")

    if not settings.OSS_ACCESS_KEY_SECRET:
        issues.append("OSS_ACCESS_KEY_SECRET 缺失")

    if not settings.OSS_BUCKET or settings.OSS_BUCKET == "your_bucket_name":
        issues.append("OSS_BUCKET 缺失")

    if not settings.OSS_PUBLIC_BASE_URL or "your_bucket_name" in settings.OSS_PUBLIC_BASE_URL:
        issues.append("OSS_PUBLIC_BASE_URL 缺失")

    if settings.ENABLE_TENCENT_FALLBACK:
        if not settings.TENCENT_SECRET_ID:
            issues.append("ENABLE_TENCENT_FALLBACK=true 但 TENCENT_SECRET_ID 缺失")
        if not settings.TENCENT_SECRET_KEY:
            issues.append("ENABLE_TENCENT_FALLBACK=true 但 TENCENT_SECRET_KEY 缺失")

    return issues
