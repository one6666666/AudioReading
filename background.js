// ============================================================
// AudioReading Background Service Worker
// Edge TTS WebSocket protocol (free neural voices, no API key)
// Fallback: Web Speech API via content script
// ============================================================

// ============================================================
// Constants — Edge TTS protocol (matches edge-tts Python lib v7.2.8)
// ============================================================
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WIN_EPOCH = 11644473600; // seconds from 1601-01-01 to 1970-01-01
const CHROMIUM_MAJOR = '143';
const CHROMIUM_FULL = '143.0.3650.75';
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL}`;

// Voice name → Edge voice ID mapping (only verified working voices)
const VOICE_NAME_TO_EDGE_ID = {
  // Chinese Mandarin
  'Zhiyu':       'zh-CN-YunxiNeural',
  'zh-CN-YunxiNeural':        'zh-CN-YunxiNeural',
  'zh-CN-YunjianNeural':      'zh-CN-YunjianNeural',
  'zh-CN-XiaoxiaoNeural':     'zh-CN-XiaoxiaoNeural',
  'zh-CN-XiaoyiNeural':       'zh-CN-XiaoyiNeural',
  'zh-CN-YunyangNeural':      'zh-CN-YunyangNeural',
  'zh-CN-YunxiaNeural':       'zh-CN-YunxiaNeural',
  'zh-CN-liaoning-XiaobeiNeural': 'zh-CN-liaoning-XiaobeiNeural',
  'zh-CN-shaanxi-XiaoniNeural':   'zh-CN-shaanxi-XiaoniNeural',
  // Chinese Cantonese
  'zh-HK-HiuGaaiNeural':      'zh-HK-HiuGaaiNeural',
  'zh-HK-HiuMaanNeural':      'zh-HK-HiuMaanNeural',
  'zh-HK-WanLungNeural':      'zh-HK-WanLungNeural',
  // Chinese Taiwanese
  'zh-TW-HsiaoChenNeural':    'zh-TW-HsiaoChenNeural',
  'zh-TW-HsiaoYuNeural':      'zh-TW-HsiaoYuNeural',
  'zh-TW-YunJheNeural':       'zh-TW-YunJheNeural',
  // English
  'Joanna':    'en-US-JennyNeural',
  'Matthew':   'en-US-GuyNeural',
  'Joey':      'en-US-EricNeural',
  'Kendra':    'en-US-AriaNeural',
  'Ivy':       'en-US-AnaNeural',
  'Kimberly':  'en-US-AmberNeural',
  'Salli':     'en-US-AriaNeural',
  'Justin':    'en-US-ChristopherNeural',
  'Amy':       'en-GB-LibbyNeural',
  'Emma':      'en-GB-SoniaNeural',
  'Brian':     'en-GB-RyanNeural',
  'Nicole':    'en-AU-NatashaNeural',
  'Russell':   'en-AU-WilliamNeural',
  'Raveena':   'en-IN-NeerjaNeural',
  'Aditi':     'en-IN-NeerjaNeural',
  // Japanese
  'Mizuki':    'ja-JP-NanamiNeural',
  'Takumi':    'ja-JP-KeitaNeural',
  // Korean
  'Seoyeon':   'ko-KR-SunHiNeural',
  // French
  'Lea':       'fr-FR-DeniseNeural',
  'Celine':    'fr-FR-DeniseNeural',
  'Mathieu':   'fr-FR-HenriNeural',
  // German
  'Vicki':     'de-DE-KatjaNeural',
  'Marlene':   'de-DE-KatjaNeural',
  'Hans':      'de-DE-ConradNeural',
  // Spanish
  'Lucia':     'es-ES-ElviraNeural',
  'Conchita':  'es-ES-ElviraNeural',
  'Enrique':   'es-ES-AlvaroNeural',
  'Mia':       'es-MX-DaliaNeural',
  'Miguel':    'es-MX-JorgeNeural',
  'Penelope':  'es-MX-DaliaNeural',
  // Portuguese
  'Vitoria':   'pt-BR-FranciscaNeural',
  'Camila':    'pt-BR-FranciscaNeural',
  'Ricardo':   'pt-BR-AntonioNeural',
  'Ines':      'pt-PT-FernandaNeural',
  'Cristiano': 'pt-PT-DuarteNeural',
  // Italian
  'Carla':     'it-IT-ElsaNeural',
  'Bianca':    'it-IT-IsabellaNeural',
  'Giorgio':   'it-IT-DiegoNeural',
  // Russian
  'Tatyana':   'ru-RU-SvetlanaNeural',
  'Maxim':     'ru-RU-DmitryNeural',
  // Others
  'Lotte':     'nl-NL-FennaNeural',
  'Ruben':     'nl-NL-MaartenNeural',
  'Ewa':       'pl-PL-AgnieszkaNeural',
  'Jacek':     'pl-PL-MarekNeural',
  'Filiz':     'tr-TR-EmelNeural',
  'Astrid':    'sv-SE-SofieNeural',
  'Naja':      'da-DK-ChristelNeural',
  'Mads':      'da-DK-JeppeNeural',
  'Liv':       'nb-NO-PernilleNeural',
  'Gwyneth':   'cy-GB-NiaNeural',
  'Zeina':     'ar-SA-ZariyahNeural',
};

// ============================================================
// Crypto helpers
// ============================================================

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function uuidHex() {
  return crypto.randomUUID().replace(/-/g, '');
}

function dateToString() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

// ============================================================
// Sec-MS-GEC token generation (matches edge-tts Python lib exactly)
// ============================================================

async function generateSecMSGEC() {
  // 1. Current Unix timestamp (seconds, UTC)
  const nowSec = Math.floor(Date.now() / 1000);

  // 2. Convert to Windows file time epoch (1601-01-01)
  let ticks = nowSec + WIN_EPOCH;

  // 3. Round down to nearest 5 minutes (300 seconds)
  ticks -= ticks % 300;

  // 4. Convert to 100-nanosecond intervals (× 10^7)
  ticks = Math.floor(ticks * 1e7);

  // 5. Concatenate ticks + TRUSTED_CLIENT_TOKEN
  const strToHash = `${ticks}${TRUSTED_CLIENT_TOKEN}`;

  // 6. SHA256 → uppercase hex
  const hash = await sha256(strToHash);
  return hash.toUpperCase();
}

// ============================================================
// Build Edge TTS WebSocket messages
// ============================================================

function buildSpeechConfig() {
  const ts = dateToString();
  const json = JSON.stringify({
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: "false",
            wordBoundaryEnabled: "true"
          },
          outputFormat: "audio-24khz-48kbitrate-mono-mp3"
        }
      }
    }
  });
  return `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${json}\r\n`;
}

function buildSSML(text, voiceId, rate, pitch) {
  const rid = uuidHex();
  const ts = dateToString();

  // Convert "zh-CN-YunxiNeural" → "Microsoft Server Speech Text to Speech Voice (zh-CN, YunxiNeural)"
  const parts = voiceId.split('-');
  const lang = parts.slice(0, 2).join('-');
  const name = parts.slice(2).join('-');
  const msVoice = `Microsoft Server Speech Text to Speech Voice (${lang}, ${name})`;

  // Rate: "+0%", "-20%", etc.
  const rateSign = rate >= 1 ? '+' : '';
  const rateVal = Math.round((rate - 1) * 100);
  const rateStr = `${rateSign}${rateVal}%`;

  // Pitch: "+0Hz", "-10Hz", etc.
  const pitchSign = pitch >= 1 ? '+' : '';
  const pitchVal = Math.round((pitch - 1) * 50);
  const pitchStr = `${pitchSign}${pitchVal}Hz`;

  // XML-escape text
  const esc = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${msVoice}'><prosody pitch='${pitchStr}' rate='${rateStr}' volume='+0%'>${esc}</prosody></voice></speak>`;

  return `X-RequestId:${rid}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`;
}

// ============================================================
// Parse binary WebSocket message from Edge TTS
// Format: [2-byte BE headerLen][headers \r\n-separated][\r\n][MP3 audio]
// ============================================================

function parseBinaryMessage(data) {
  if (!(data instanceof ArrayBuffer)) {
    return null;
  }

  const bytes = new Uint8Array(data);
  if (bytes.length < 2) {
    return null;
  }

  // First 2 bytes = header length (big-endian)
  const headerLen = (bytes[0] << 8) | bytes[1];
  if (headerLen + 2 > bytes.length) {
    return null;
  }

  // Parse headers
  const headerBytes = bytes.slice(2, 2 + headerLen);
  const headerStr = new TextDecoder('ascii').decode(headerBytes);
  const headers = {};
  for (const line of headerStr.split('\r\n')) {
    const ci = line.indexOf(':');
    if (ci > 0) {
      headers[line.slice(0, ci).trim()] = line.slice(ci + 1).trim();
    }
  }

  // Audio data starts after headers + \r\n separator
  const audioOffset = 2 + headerLen + 2;
  if (audioOffset >= bytes.length) {
    return { headers, audioData: new ArrayBuffer(0) };
  }

  const audioData = bytes.slice(audioOffset).buffer;
  return { headers, audioData };
}

// ============================================================
// Synthesize via Edge TTS WebSocket
// ============================================================

async function synthesizeViaEdgeTTS(text, voiceName, rate, pitch) {
  const voiceId = VOICE_NAME_TO_EDGE_ID[voiceName] || voiceName;

  // If voiceName looks like a language code (e.g., "zh-CN") rather than a voice name,
  // use default Chinese voice
  const effectiveVoiceId = voiceId.includes('Neural') ? voiceId : 'zh-CN-YunxiNeural';

  console.log(`[AudioReading] Edge TTS: voice=${effectiveVoiceId}, text="${String(text).substring(0, 50)}..."`);

  const secMsGec = await generateSecMSGEC();
  const connId = uuidHex();
  const fullUrl = `${WSS_URL}&ConnectionId=${connId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  console.log(`[AudioReading] Edge TTS connecting to wss://speech.platform.bing.com/...`);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(fullUrl);
    const audioChunks = [];
    let resolved = false;

    const finish = (ok, result) => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch (_) {}
      if (ok) resolve(result);
      else reject(new Error(result));
    };

    ws.onopen = () => {
      console.log('[AudioReading] Edge TTS WebSocket connected');
      // Send speech.config
      ws.send(buildSpeechConfig());
      // Send SSML
      ws.send(buildSSML(text, effectiveVoiceId, rate, pitch));
      console.log('[AudioReading] Edge TTS sent config + SSML');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // Text message — check for turn.end
        const hEnd = event.data.indexOf('\r\n\r\n');
        if (hEnd >= 0) {
          const hLines = event.data.slice(0, hEnd).split('\r\n');
          const h = {};
          for (const l of hLines) {
            const ci = l.indexOf(':');
            if (ci > 0) h[l.slice(0, ci).trim()] = l.slice(ci + 1).trim();
          }
          if (h['Path'] === 'turn.end') {
            console.log('[AudioReading] Edge TTS turn.end received');
            ws.close(1000, 'Done');
          }
        }
      } else if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        // Binary message — extract audio
        let buf;
        if (event.data instanceof Blob) {
          // Blob: read as ArrayBuffer (rare in WS, but handle)
          const reader = new FileReader();
          reader.onload = () => {
            processBinary(reader.result);
          };
          reader.readAsArrayBuffer(event.data);
          return;
        } else {
          buf = event.data;
        }
        processBinary(buf);
      }

      function processBinary(buf) {
        const parsed = parseBinaryMessage(buf);
        if (!parsed) {
          console.warn('[AudioReading] Edge TTS: failed to parse binary message');
          return;
        }

        if (parsed.headers['Path'] === 'audio') {
          const contentType = parsed.headers['Content-Type'] || '';
          if (contentType === 'audio/mpeg' || contentType === '') {
            if (parsed.audioData.byteLength > 0) {
              audioChunks.push(parsed.audioData);
            }
          }
        }
      }
    };

    ws.onerror = (event) => {
      console.error('[AudioReading] Edge TTS WebSocket error', event);
      // Don't reject immediately — wait for onclose
    };

    ws.onclose = (event) => {
      console.log(`[AudioReading] Edge TTS WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`);

      if (resolved) return;

      if (audioChunks.length > 0) {
        // Merge audio chunks
        const totalLen = audioChunks.reduce((s, c) => s + c.byteLength, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of audioChunks) {
          merged.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
        console.log(`[AudioReading] Edge TTS SUCCESS: ${totalLen} bytes`);
        finish(true, merged.buffer);
      } else if (event.code === 1000 || event.code === 1001) {
        // Normal closure but no audio — unusual
        finish(false, 'Edge TTS returned no audio data');
      } else {
        finish(false, `Edge TTS connection failed (code=${event.code})`);
      }
    };

    // Timeout after 20 seconds
    setTimeout(() => {
      finish(false, 'Edge TTS request timeout (20s)');
    }, 20000);
  });
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
// Resolve voice: map user-facing name → Edge voice ID
// ============================================================

function resolveVoice(voiceName) {
  // Direct Edge voice ID match (e.g., "zh-CN-YunxiNeural")
  if (voiceName && voiceName.includes('Neural')) {
    return { voiceId: voiceName };
  }

  // Mapped voice name (e.g., "Zhiyu" → "zh-CN-YunxiNeural")
  if (VOICE_NAME_TO_EDGE_ID[voiceName]) {
    return { voiceId: VOICE_NAME_TO_EDGE_ID[voiceName] };
  }

  // Default: Chinese female voice
  return { voiceId: 'zh-CN-YunxiNeural' };
}

// ============================================================
// Main synthesis entry point (with retry for rate limiting)
// ============================================================

async function synthesize(text, voiceName, rate, pitch) {
  const resolved = resolveVoice(voiceName);
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await synthesizeViaEdgeTTS(text, resolved.voiceId, rate || 1.0, pitch || 1.0);
      return result;
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      console.warn(`[AudioReading] Attempt ${attempt}/${maxRetries} failed: ${msg}`);

      // Only retry on connection errors (rate limiting)
      if (msg.includes('connection failed') || msg.includes('timeout') || msg.includes('no audio')) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 6000);
          console.log(`[AudioReading] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError || new Error('Edge TTS synthesis failed after retries');
}

// ============================================================
// Message handler
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNTHESIZE_EDGE_TTS' || message.type === 'SYNTHESIZE_TTS') {
    const { text, voiceName, rate, pitch } = message.payload || {};

    synthesize(text, voiceName, rate, pitch)
      .then((buffer) => {
        sendResponse({ ok: true, audioData: arrayBufferToBase64(buffer) });
      })
      .catch((err) => {
        console.error('[AudioReading] Synthesis failed:', err.message);
        sendResponse({ ok: false, message: err.message });
      });

    return true; // async response
  }

  return false;
});
