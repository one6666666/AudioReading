// ============================================================
// AudioReading Background Service Worker
// Handles Edge TTS synthesis (not subject to page CORS restrictions)
// ============================================================

const EDGE_TTS_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';

function buildSSML(text, voiceName, rate, pitch) {
  const ratePercent = Math.round((rate - 1) * 100);
  const pitchPercent = Math.round((pitch - 1) * 100);
  const lang = voiceName.split('-').slice(0, 2).join('-');

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voiceName}">
    <prosody rate="${ratePercent >= 0 ? '+' : ''}${ratePercent}%" pitch="${pitchPercent >= 0 ? '+' : ''}${pitchPercent}Hz">
      ${escapedText}
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ---- SYNTHESIZE_EDGE_TTS ----
  if (message.type === 'SYNTHESIZE_EDGE_TTS') {
    const { text, voiceName, rate, pitch } = message.payload;
    const ssml = buildSSML(text, voiceName || 'zh-CN-XiaoxiaoNeural', rate || 1.0, pitch || 1.0);

    fetch(EDGE_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': UA
      },
      body: ssml
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Edge TTS returned ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        sendResponse({ ok: true, audioData: base64 });
      })
      .catch((err) => {
        console.error('Edge TTS background error:', err);
        sendResponse({ ok: false, message: err.message });
      });

    return true; // keep channel open for async
  }

  return false;
});
