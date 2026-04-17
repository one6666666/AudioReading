import oss2

from app.config import settings

auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
bucket = oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET)


def upload_audio_bytes(object_key: str, data: bytes, content_type: str) -> str:
    bucket.put_object(
        object_key,
        data,
        headers={"Content-Type": content_type, "Cache-Control": "public, max-age=31536000"},
    )
    return f"{settings.OSS_PUBLIC_BASE_URL}/{object_key}"
