// ============================================================
// AudioReading Background Service Worker
// Handles Edge TTS synthesis via HTTP POST (bypasses CORS)
// ============================================================

const EDGE_TTS_ENDPOINTS = [
  // Primary: Bing Speech REST API (HTTP POST, returns MP3 directly)
  {
    url: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
    }
  },
  // Fallback: eastus Azure endpoint
  {
    url: 'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      'Ocp-Apim-Subscription-Key': '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
    }
  }
];

function buildSSML(text, voiceName, rate, pitch) {
  const ratePercent = Math.round((rate - 1) * 100);
  const pitchHz = Math.round(pitch * 100);
  const lang = voiceName.split('-').slice(0, 2).join('-');

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voiceName}">
    <prosody rate="${ratePercent >= 0 ? '+' : ''}${ratePercent}%" pitch="${pitchHz}Hz">
      ${escaped}
    </prosody>
  </voice>
</speak>`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Synthesize via HTTP POST — returns MP3 audio bytes directly
async function synthesizeViaHTTP(ssml) {
  let lastError = null;

  for (let i = 0; i < EDGE_TTS_ENDPOINTS.length; i++) {
    const endpoint = EDGE_TTS_ENDPOINTS[i];
    try {
      console.log(`[AudioReading] Trying Edge TTS endpoint ${i + 1}/${EDGE_TTS_ENDPOINTS.length}: ${endpoint.url.substring(0, 50)}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: endpoint.headers,
        body: ssml,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[AudioReading] Edge TTS endpoint ${i + 1} returned ${response.status}: ${errorText.substring(0, 200)}`);
        lastError = new Error(`Edge TTS HTTP ${response.status}`);
        continue; // try next endpoint
      }

      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength < 100) {
        console.warn(`[AudioReading] Edge TTS endpoint ${i + 1} returned empty/small audio (${buffer?.byteLength || 0} bytes)`);
        lastError = new Error('Edge TTS returned insufficient audio data');
        continue;
      }

      console.log(`[AudioReading] Edge TTS success via endpoint ${i + 1}: ${buffer.byteLength} bytes`);
      return buffer;

    } catch (err) {
      console.error(`[AudioReading] Edge TTS endpoint ${i + 1} failed:`, err.message);
      lastError = err;
      // continue to next endpoint
    }
  }

  throw lastError || new Error('All Edge TTS endpoints exhausted');
}

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNTHESIZE_EDGE_TTS') {
    const { text, voiceName, rate, pitch } = message.payload;
    const voice = voiceName || 'zh-CN-XiaoxiaoNeural';
    const ssml = buildSSML(text, voice, rate || 1.0, pitch || 1.0);

    console.log(`[AudioReading] Synthesizing: "${text.substring(0, 40)}..." with voice ${voice}`);

    synthesizeViaHTTP(ssml)
      .then((buffer) => {
        const base64 = arrayBufferToBase64(buffer);
        sendResponse({ ok: true, audioData: base64 });
      })
      .catch((err) => {
        console.error('[AudioReading] Edge TTS fatal error:', err.message);
        sendResponse({ ok: false, message: `语音合成失败：${err.message}` });
      });

    return true; // keep channel open for async
  }

  return false;
});
