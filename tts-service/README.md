# TTS Service (FastAPI)

Production-oriented TTS gateway with:
- Aliyun as primary provider
- Tencent as fallback provider
- Redis rate limit
- OSS audio storage (returns `audio_url`)
- Prometheus metrics
- Monitoring stack with Prometheus + Grafana + Loki + Promtail

## Quick start

1. Copy environment file:

```bash
cp .env.example .env
```

2. Fill required secrets in `.env`.

3. Start service stack:

```bash
docker compose up -d --build
```

4. Start monitoring stack:

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `POST /api/tts/synthesize`

## Example request

```bash
curl -X POST "http://127.0.0.1:8000/api/tts/synthesize" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: replace_with_strong_secret" \
  -d '{"text":"你好，这是生产版TTS服务测试","voice":"longxiaochun","format":"mp3"}'
```
