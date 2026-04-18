import base64
import io
import math
import wave


def build_mock_wav(sample_rate: int = 24000, duration_seconds: float = 0.6, tone_hz: float = 660.0) -> bytes:
    frame_count = max(1, int(sample_rate * duration_seconds))
    amplitude = 0.2

    with io.BytesIO() as output:
        with wave.open(output, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)

            for idx in range(frame_count):
                t = idx / sample_rate
                sample = int(32767 * amplitude * math.sin(2 * math.pi * tone_hz * t))
                wav_file.writeframesraw(sample.to_bytes(2, byteorder="little", signed=True))

        return output.getvalue()


def build_mock_audio_url() -> str:
    wav_bytes = build_mock_wav()
    encoded = base64.b64encode(wav_bytes).decode("ascii")
    return f"data:audio/wav;base64,{encoded}"
