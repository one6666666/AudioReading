import hashlib
import json
import time
from collections import OrderedDict
from typing import Optional


class TTLCache:
    def __init__(self, max_items: int, ttl_seconds: int):
        self.max_items = max_items
        self.ttl_seconds = ttl_seconds
        self._store = OrderedDict()

    def _now(self) -> int:
        return int(time.time())

    def get(self, key: str) -> Optional[str]:
        item = self._store.get(key)
        if not item:
            return None
        value, expire_at = item
        if self._now() > expire_at:
            self._store.pop(key, None)
            return None
        self._store.move_to_end(key)
        return value

    def set(self, key: str, value: str):
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (value, self._now() + self.ttl_seconds)
        while len(self._store) > self.max_items:
            self._store.popitem(last=False)


def build_cache_key(payload: dict) -> str:
    normalized = {
        "text": payload.get("text", "").strip(),
        "voice": payload.get("voice", "default"),
        "speed": payload.get("speed", 1.0),
        "pitch": payload.get("pitch", 1.0),
        "format": payload.get("format", "mp3"),
        "sample_rate": payload.get("sample_rate", 24000),
    }
    raw = json.dumps(normalized, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
