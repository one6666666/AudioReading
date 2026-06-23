// ============================================================
// AudioReading Background Service Worker
// Handles Edge TTS synthesis via WebSocket (bypasses CORS)
// ============================================================

const EDGE_TTS_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

function uuid() {
  return crypto.randomUUID().replace(/-/g, '');
}

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

// Synthesize via WebSocket (proper Edge TTS protocol)
function synthesizeViaWebSocket(ssml) {
  return new Promise((resolve, reject) => {
    const requestId = uuid();
    const audioChunks = [];
    let done = false;

    const ws = new WebSocket(EDGE_TTS_URL);

    ws.onopen = () => {
      // Step 1: send speech config
      const config = JSON.stringify({
        context: {
          system: {
            name: 'SpeechSDK',
            version: '1.33.0',
            build: '20240701',
            lang: 'JavaScript'
          },
          os: {
            platform: 'Win32',
            name: 'Windows',
            version: '10.0.19045'
          }
        }
      });
      ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/json\r\nPath:speech.config\r\n\r\n${config}`);

      // Step 2: send SSML request
      ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`);
    };

    ws.onmessage = (event) => {
      if (done) return;

      // Text messages (json) — watch for turn.end
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end') || event.data.includes('Path:turn.start')) {
          // Start/end markers
        }
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'audio' && data?.data) {
            // base64‑encoded audio inline
            const binary = atob(data.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            audioChunks.push(bytes);
          }
        } catch (_) {}
        return;
      }

      // Binary message — strip text headers, keep audio
      if (event.data instanceof ArrayBuffer) {
        const raw = new Uint8Array(event.data);
        // Look for \r\n\r\n separator between headers and audio body
        let sep = -1;
        for (let i = 0; i < raw.length - 3; i++) {
          if (raw[i] === 13 && raw[i + 1] === 10 && raw[i + 2] === 13 && raw[i + 3] === 10) {
            sep = i + 4;
            break;
          }
        }
        if (sep > 0 && sep < raw.length) {
          audioChunks.push(raw.slice(sep));
        } else {
          audioChunks.push(raw);
        }
      }
    };

    ws.onclose = (event) => {
      if (done) return;
      done = true;

      if (audioChunks.length > 0) {
        // Concatenate all chunks
        const total = audioChunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of audioChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(merged.buffer);
      } else {
        reject(new Error(`WebSocket closed (${event.code}), no audio received`));
      }
    };

    ws.onerror = () => {
      if (done) return;
      done = true;
      reject(new Error('Edge TTS WebSocket connection failed'));
    };

    // Timeout after 30s
    setTimeout(() => {
      if (done) return;
      done = true;
      try { ws.close(); } catch (_) {}
      reject(new Error('Edge TTS synthesis timed out'));
    }, 30000);
  });
}

// Message handler
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNTHESIZE_EDGE_TTS') {
    const { text, voiceName, rate, pitch } = message.payload;
    const ssml = buildSSML(text, voiceName || 'zh-CN-XiaoxiaoNeural', rate || 1.0, pitch || 1.0);

    synthesizeViaWebSocket(ssml)
      .then((buffer) => {
        const base64 = arrayBufferToBase64(buffer);
        sendResponse({ ok: true, audioData: base64 });
      })
      .catch((err) => {
        console.error('Edge TTS error:', err.message);
        sendResponse({ ok: false, message: err.message });
      });

    return true; // keep channel open for async
  }

  return false;
});
