import oss2

from app.config import settings


def _build_bucket() -> oss2.Bucket:
    if not settings.OSS_ENDPOINT or not settings.OSS_BUCKET:
        raise RuntimeError("OSS 未配置完整：缺少 OSS_ENDPOINT 或 OSS_BUCKET")
    if not settings.OSS_ACCESS_KEY_ID or not settings.OSS_ACCESS_KEY_SECRET:
        raise RuntimeError("OSS 未配置完整：缺少 OSS_ACCESS_KEY_ID 或 OSS_ACCESS_KEY_SECRET")

    auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
    return oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET)


def upload_audio_bytes(object_key: str, data: bytes, content_type: str) -> str:
    bucket = _build_bucket()
    bucket.put_object(
        object_key,
        data,
        headers={"Content-Type": content_type, "Cache-Control": "public, max-age=31536000"},
    )
    return f"{settings.OSS_PUBLIC_BASE_URL}/{object_key}"
