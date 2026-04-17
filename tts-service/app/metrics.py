import time

from fastapi import Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

REQUEST_COUNT = Counter("tts_requests_total", "Total TTS requests", ["provider", "status"])
REQUEST_LATENCY = Histogram(
    "tts_request_latency_seconds",
    "TTS request latency",
    ["provider"],
    buckets=(0.1, 0.3, 0.5, 1, 2, 3, 5, 8, 13, 21, 34),
)
FALLBACK_COUNT = Counter("tts_fallback_total", "Total fallback count from primary to fallback")
CACHE_HIT_COUNT = Counter("tts_cache_hit_total", "TTS cache hit count")
INFLIGHT = Gauge("tts_inflight_requests", "Current in-flight TTS requests")


def metrics_response() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


class ObserveLatency:
    def __init__(self, provider: str):
        self.provider = provider
        self.start = None

    def __enter__(self):
        self.start = time.time()
        INFLIGHT.inc()
        return self

    def __exit__(self, exc_type, exc, tb):
        REQUEST_LATENCY.labels(provider=self.provider).observe(time.time() - self.start)
        INFLIGHT.dec()
