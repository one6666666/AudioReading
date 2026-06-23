// ============================================================
// AudioReading Background Service Worker
// Edge TTS synthesis with dynamic Sec-MS-GEC authentication
// ============================================================

// --- Constants (from edge-tts Python library) ---
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = '143';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH_SEC = 11644473600; // diff between 1601-01-01 and 1970-01-01

const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const HTTP_URL = `https://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

// ============================================================
// Sec-MS-GEC token generation (edge-tts DRM algorithm)
// ============================================================

async function generateSecMSGEC() {
  // 1. Get current Unix timestamp (seconds)
  let ticks = Date.now() / 1000;

  // 2. Switch to Windows file time epoch (1601-01-01 00:00:00 UTC)
  ticks += WIN_EPOCH_SEC;

  // 3. Round down to nearest 5 minutes (300 seconds)
  ticks -= ticks % 300;

  // 4. Convert to 100-nanosecond intervals (Windows file time)
  ticks = Math.floor(ticks * 1e7); // (1e9 / 100) = 1e7

  // 5. Concatenate ticks + trusted client token
  const strToHash = `${ticks}${TRUSTED_CLIENT_TOKEN}`;

  // 6. SHA256 → uppercase hex digest
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(strToHash));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function generateConnectionId() {
  return crypto.randomUUID().replace(/-/g, '');
}

function generateMUID() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ============================================================
// SSML builder
// ============================================================

function buildSSML(text, voiceName, rate, pitch) {
  const lang = voiceName.split('-').slice(0, 2).join('-');

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${lang}">
  <voice name="${voiceName}">
    <prosody rate="${rate || '1.0'}" pitch="${pitch || '1.0'}">
      ${escaped}
    </prosody>
  </voice>
</speak>`;
}

// ============================================================
// Base64 encoding
// ============================================================

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============================================================
// HTTP POST synthesis (attempt first — simpler)
// ============================================================

async function synthesizeViaHTTP(ssml, voiceName) {
  const secMsGec = await generateSecMSGEC();
  const lang = voiceName.split('-').slice(0, 2).join('-');

  // Try with Sec-MS-GEC in URL and headers
  const url = `${HTTP_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${generateConnectionId()}`;

  console.log(`[AudioReading] HTTP POST: ${url.substring(0, 80)}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
        'Accept-Language': `${lang},en-US;q=0.9`,
        'Sec-MS-GEC': secMsGec,
        'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION
      },
      body: ssml,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[AudioReading] HTTP ${response.status}: ${errorText.substring(0, 300)}`);
      throw new Error(`HTTP ${response.status}${errorText ? ': ' + errorText.substring(0, 100) : ''}`);
    }

    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength < 100) {
      throw new Error('Edge TTS returned insufficient audio data');
    }

    console.log(`[AudioReading] HTTP success: ${buffer.byteLength} bytes`);
    return buffer;

  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// WebSocket synthesis (fallback if HTTP fails)
// ============================================================

async function synthesizeViaWebSocket(ssml, voiceName) {
  const secMsGec = await generateSecMSGEC();
  const connectionId = generateConnectionId();

  const wsUrl = `${WSS_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;

  console.log(`[AudioReading] WebSocket: ${wsUrl.substring(0, 80)}...`);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const audioChunks = [];
    let configSent = false;
    let timer = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket timeout'));
    }, 25000);

    ws.onopen = () => {
      console.log('[AudioReading] WebSocket connected');

      // Send speech.config
      const requestId = crypto.randomUUID().replace(/-/g, '');
      const configMsg = `X-RequestId:${requestId}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      ws.send(configMsg);
      configSent = true;

      // Send SSML
      const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    };

    ws.onmessage = (event) => {
      // Edge TTS sends: text frame (JSON headers) then binary frame (audio)
      if (typeof event.data === 'string') {
        // Text frame — could be turn.start, turn.end, or error
        if (event.data.includes('Path:turn.end')) {
          // Synthesis complete
          clearTimeout(timer);
          ws.close();
        } else if (event.data.includes('Path:turn.start')) {
          // Synthesis started
        }
        // Ignore other text frames (metadata)
      } else if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        // Audio data
        audioChunks.push(event.data);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      console.error('[AudioReading] WebSocket error:', err);
      reject(new Error('Edge TTS WebSocket connection failed'));
    };

    ws.onclose = () => {
      clearTimeout(timer);
      if (audioChunks.length > 0) {
        // Merge audio chunks
        const totalLength = audioChunks.reduce((acc, chunk) => {
          return acc + (chunk instanceof ArrayBuffer ? chunk.byteLength : chunk.size);
        }, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
          const data = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : new Uint8Array(chunk);
          merged.set(data, offset);
          offset += data.byteLength;
        }
        console.log(`[AudioReading] WebSocket success: ${totalLength} bytes`);
        resolve(merged.buffer);
      } else {
        reject(new Error('Edge TTS returned no audio data'));
      }
    };
  });
}

// ============================================================
// Main synthesis entry point
// ============================================================

async function synthesize(text, voiceName, rate, pitch) {
  const voice = voiceName || 'zh-CN-XiaoxiaoNeural';
  const ssml = buildSSML(text, voice, rate, pitch);

  console.log(`[AudioReading] Synthesizing: "${text.substring(0, 40)}..." voice=${voice}`);

  // Try HTTP POST first
  try {
    return await synthesizeViaHTTP(ssml, voice);
  } catch (httpErr) {
    console.warn(`[AudioReading] HTTP failed: ${httpErr.message}, trying WebSocket...`);
    // Fallback to WebSocket
    return await synthesizeViaWebSocket(ssml, voice);
  }
}

// ============================================================
// Message handler
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNTHESIZE_EDGE_TTS') {
    const { text, voiceName, rate, pitch } = message.payload;

    synthesize(text, voiceName, rate, pitch)
      .then((buffer) => {
        sendResponse({ ok: true, audioData: arrayBufferToBase64(buffer) });
      })
      .catch((err) => {
        console.error('[AudioReading] Fatal:', err.message);
        sendResponse({ ok: false, message: `语音合成失败：${err.message}` });
      });

    return true;
  }

  return false;
});
