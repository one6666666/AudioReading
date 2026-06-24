// ============================================================
// AudioReading Background Service Worker
// Provider: Microsoft Edge TTS (WebSocket, free, 14 Chinese voices)
// Protocol: WebSocket wss://speech.platform.bing.com/...
// Token: Pure client-side SHA256 (no auth required)
// ============================================================

// ============================================================
// Edge TTS WebSocket Protocol — Sec-MS-GEC token generation
// ============================================================

const WIN_EPOCH = 11644473600; // seconds from Unix epoch to Windows epoch (1601-01-01)
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=' + TRUSTED_CLIENT_TOKEN;
const SEC_MS_GEC_VERSION = '1-143.0.3536.0';

function generateSecMSGEC() {
  // 1. Current Unix timestamp (seconds)
  const unixTime = Math.floor(Date.now() / 1000);
  // 2. Convert to Windows file time epoch
  let ticks = unixTime + WIN_EPOCH;
  // 3. Round down to nearest 5 minutes (300 seconds)
  ticks -= ticks % 300;
  // 4. Convert to 100-nanosecond intervals (Windows file time)
  ticks = Math.floor(ticks * 1e7);
  // 5. Concatenate with trusted client token
  const str = ticks.toString() + TRUSTED_CLIENT_TOKEN;
  // 6. SHA256, uppercase hex
  return sha256Hex(str);
}

// Simple SHA256 implementation (works in Service Worker, no external libs needed)
async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function generateMUID() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function generateRequestId() {
  return crypto.randomUUID().replace(/-/g, '');
}

function dateToString() {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => String(n).padStart(2, '0');
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function removeBadChars(str) {
  // Remove control characters except \t \n \r
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

// ============================================================
// Edge TTS WebSocket — synthesize text → MP3 audio
// ============================================================

async function synthViaEdgeTTS(text, voice, rate, pitch) {
  const cleanedText = removeBadChars(text);
  const escaped = escapeXml(cleanedText);

  // Build SSML
  const ratePercent = rate ? Math.round((rate - 1) * 100) + '%' : '+0%';
  const pitchHz = pitch ? Math.round((pitch - 1) * 50) + 'Hz' : '+0Hz';
  const langMatch = voice.match(/^([a-z]{2}-[A-Z]{2})-/);
  const ssmlLang = langMatch ? langMatch[1] : 'zh-CN';

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${ssmlLang}'><voice name='${voice}'><prosody pitch='${pitchHz}' rate='${ratePercent}' volume='+0%'>${escaped}</prosody></voice></speak>`;

  console.log(`[AudioReading] Edge TTS: voice=${voice}, text="${text.substring(0, 50)}..."`);

  return new Promise(async (resolve, reject) => {
    try {
      const token = await generateSecMSGEC();
      const connectionId = generateRequestId();
      const wsUrl = `${WSS_URL}&ConnectionId=${connectionId}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

      const ws = new WebSocket(wsUrl);

      // IMPORTANT: set binaryType to arraybuffer for binary message parsing
      ws.binaryType = 'arraybuffer';

      const timestamp = dateToString();
      const requestId = generateRequestId();
      const audioChunks = [];
      let turnEnded = false;
      let hasError = false;

      ws.onopen = () => {
        console.log('[AudioReading] Edge TTS WebSocket connected');

        // Send config message
        const configMsg =
          `X-Timestamp:${timestamp}\r\n` +
          'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}';

        ws.send(configMsg);

        // Send SSML message
        const ssmlMsg =
          `X-RequestId:${requestId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `X-Timestamp:${timestamp}Z\r\n` +
          'Path:ssml\r\n\r\n' +
          ssml;

        ws.send(ssmlMsg);
        console.log('[AudioReading] Edge TTS SSML sent');
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          // Text message — check for turn.end
          if (event.data.includes('Path:turn.end')) {
            turnEnded = true;
            ws.close(1000);
          }
          // Ignore turn.start, response, audio.metadata
        } else if (event.data instanceof ArrayBuffer) {
          // Binary message: [2 bytes header_len (BE)] [headers\r\n\r\n] [MP3 audio]
          try {
            const data = new Uint8Array(event.data);
            if (data.length < 2) return;

            const headerLen = (data[0] << 8) | data[1];
            const headerEnd = 2 + headerLen;

            if (headerEnd + 4 > data.length) return; // Not enough data

            // Skip headers + \r\n\r\n separator
            const audioStart = headerEnd + 4;
            const audioData = data.slice(audioStart);

            if (audioData.length > 0) {
              audioChunks.push(audioData);
            }
          } catch (e) {
            console.warn('[AudioReading] Binary parse error:', e);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('[AudioReading] WebSocket error');
        hasError = true;
        ws.close();
      };

      ws.onclose = (event) => {
        console.log(`[AudioReading] WebSocket closed: code=${event.code}, reason=${event.reason}`);

        if (hasError) {
          reject(new Error('Edge TTS WebSocket connection failed'));
          return;
        }

        if (!turnEnded && audioChunks.length === 0) {
          reject(new Error('Edge TTS: no audio data received'));
          return;
        }

        if (audioChunks.length === 0) {
          reject(new Error('Edge TTS: no audio data in response'));
          return;
        }

        // Merge audio chunks
        const totalLen = audioChunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of audioChunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        console.log(`[AudioReading] Edge TTS success: ${totalLen} bytes`);
        resolve(merged.buffer);
      };

      // Timeout — 25 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          if (!hasError && audioChunks.length === 0) {
            reject(new Error('Edge TTS request timeout'));
          }
        }
      }, 25000);

    } catch (err) {
      console.error('[AudioReading] Edge TTS setup failed:', err);
      reject(err);
    }
  });
}

// ============================================================
// Voice resolution — map voice names to Edge TTS ShortName
// ============================================================

// Known Edge TTS voices (for direct matching)
const EDGE_VOICE_IDS = new Set([
  // Chinese (Mandarin)
  'zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'zh-CN-YunjianNeural',
  'zh-CN-YunxiNeural', 'zh-CN-YunxiaNeural', 'zh-CN-YunyangNeural',
  'zh-CN-liaoning-XiaobeiNeural', 'zh-CN-shaanxi-XiaoniNeural',
  // Chinese (Cantonese)
  'zh-HK-HiuGaaiNeural', 'zh-HK-HiuMaanNeural', 'zh-HK-WanLungNeural',
  // Chinese (Taiwan Mandarin)
  'zh-TW-HsiaoChenNeural', 'zh-TW-HsiaoYuNeural', 'zh-TW-YunJheNeural',
  // English
  'en-US-AriaNeural', 'en-US-JennyNeural', 'en-US-GuyNeural',
  'en-US-AnaNeural', 'en-US-ChristopherNeural', 'en-US-EricNeural',
  'en-US-MichelleNeural', 'en-US-RogerNeural', 'en-US-SteffanNeural',
  'en-GB-SoniaNeural', 'en-GB-RyanNeural', 'en-GB-LibbyNeural',
  'en-AU-NatashaNeural', 'en-AU-WilliamNeural',
  'en-IN-NeerjaNeural', 'en-IN-PrabhatNeural',
  'en-IE-EmilyNeural', 'en-IE-ConnorNeural',
  'en-NZ-MollyNeural', 'en-NZ-MitchellNeural',
  'en-ZA-LeahNeural', 'en-ZA-LukeNeural',
  'en-CA-ClaraNeural', 'en-CA-LiamNeural',
  'en-PH-RosaNeural', 'en-PH-JamesNeural',
  'en-SG-LunaNeural', 'en-SG-WayneNeural',
  'en-HK-SamNeural', 'en-HK-YanNeural',
  'en-KE-AsiliaNeural', 'en-KE-ChilembaNeural',
  'en-NG-EzinneNeural', 'en-NG-AbeoNeural',
  'en-TZ-ImaniNeural', 'en-TZ-ElimuNeural',
  // Japanese
  'ja-JP-NanamiNeural', 'ja-JP-KeitaNeural',
  // Korean
  'ko-KR-SunHiNeural', 'ko-KR-InJoonNeural',
  // French
  'fr-FR-DeniseNeural', 'fr-FR-HenriNeural',
  'fr-CA-SylvieNeural', 'fr-CA-JeanNeural',
  'fr-CH-ArianeNeural', 'fr-CH-FabriceNeural',
  'fr-BE-CharlineNeural', 'fr-BE-GerardNeural',
  // German
  'de-DE-KatjaNeural', 'de-DE-ConradNeural',
  'de-AT-IngridNeural', 'de-AT-JonasNeural',
  'de-CH-LeniNeural', 'de-CH-JanNeural',
  // Spanish
  'es-ES-ElviraNeural', 'es-ES-AlvaroNeural',
  'es-MX-DaliaNeural', 'es-MX-JorgeNeural',
  'es-AR-ElenaNeural', 'es-AR-TomasNeural',
  'es-CO-SalomeNeural', 'es-CO-GonzaloNeural',
  'es-CL-CatalinaNeural', 'es-CL-LorenzoNeural',
  'es-US-PalomaNeural', 'es-US-AlonsoNeural',
  // Portuguese
  'pt-BR-FranciscaNeural', 'pt-BR-AntonioNeural',
  'pt-PT-RaquelNeural', 'pt-PT-DuarteNeural',
  // Italian
  'it-IT-ElsaNeural', 'it-IT-IsabellaNeural',
  // Russian
  'ru-RU-SvetlanaNeural', 'ru-RU-DmitryNeural',
  // Dutch
  'nl-NL-ColetteNeural', 'nl-NL-FennaNeural',
  'nl-BE-DenaNeural', 'nl-BE-ArnaudNeural',
  // Polish
  'pl-PL-AgnieszkaNeural', 'pl-PL-MarekNeural',
  // Swedish
  'sv-SE-SofieNeural', 'sv-SE-MattiasNeural',
  // Norwegian
  'nb-NO-PernilleNeural', 'nb-NO-FinnNeural',
  // Danish
  'da-DK-ChristelNeural', 'da-DK-JeppeNeural',
  // Finnish
  'fi-FI-NooraNeural', 'fi-FI-SelmaNeural',
  // Turkish
  'tr-TR-EmelNeural', 'tr-TR-AhmetNeural',
  // Arabic
  'ar-SA-ZariyahNeural', 'ar-SA-HamedNeural',
  'ar-EG-SalmaNeural', 'ar-EG-ShakirNeural',
  'ar-MA-MounaNeural', 'ar-MA-JamalNeural',
  // Hindi
  'hi-IN-SwaraNeural', 'hi-IN-MadhurNeural',
  // Thai
  'th-TH-PremwadeeNeural', 'th-TH-NiwatNeural',
  // Vietnamese
  'vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural',
  // Indonesian
  'id-ID-GadisNeural', 'id-ID-ArdiNeural',
  // Malay
  'ms-MY-YasminNeural', 'ms-MY-OsmanNeural',
  // Filipino
  'fil-PH-BlessicaNeural', 'fil-PH-AngeloNeural',
  // Other
  'af-ZA-AdriNeural', 'af-ZA-WillemNeural',
  'am-ET-MekdesNeural', 'am-ET-AmehaNeural',
  'az-AZ-BanuNeural', 'az-AZ-BabakNeural',
  'bg-BG-KalinaNeural', 'bg-BG-BorislavNeural',
  'bn-BD-NabanitaNeural', 'bn-BD-PradeepNeural',
  'bn-IN-TanishaaNeural', 'bn-IN-BashkarNeural',
  'bs-BA-VesnaNeural', 'bs-BA-GoranNeural',
  'ca-ES-JoanaNeural', 'ca-ES-EnricNeural',
  'cs-CZ-VlastaNeural', 'cs-CZ-AntoninNeural',
  'cy-GB-NiaNeural', 'cy-GB-AledNeural',
  'el-GR-AthinaNeural', 'el-GR-NestorasNeural',
  'et-EE-AnuNeural', 'et-EE-KertNeural',
  'eu-ES-AinhoaNeural', 'eu-ES-AnderNeural',
  'fa-IR-DilaraNeural', 'fa-IR-FaridNeural',
  'gl-ES-SabelaNeural', 'gl-ES-RoiNeural',
  'gu-IN-DhwaniNeural', 'gu-IN-NiranjanNeural',
  'he-IL-HilaNeural', 'he-IL-AvriNeural',
  'hr-HR-GabrijelaNeural', 'hr-HR-SreckoNeural',
  'hu-HU-NoemiNeural', 'hu-HU-TamasNeural',
  'is-IS-GudrunNeural', 'is-IS-GunnarNeural',
  'jv-ID-SitiNeural', 'jv-ID-DimasNeural',
  'ka-GE-EkaNeural', 'ka-GE-GiorgiNeural',
  'kk-KZ-AigulNeural', 'kk-KZ-DauletNeural',
  'km-KH-SreymomNeural', 'km-KH-PisethNeural',
  'kn-IN-SapnaNeural', 'kn-IN-GaganNeural',
  'lo-LA-KeomanyNeural', 'lo-LA-ChanthavongNeural',
  'lt-LT-OnaNeural', 'lt-LT-LeonasNeural',
  'lv-LV-EveritaNeural', 'lv-LV-NilsNeural',
  'mk-MK-MarijaNeural', 'mk-MK-AleksandarNeural',
  'ml-IN-SobhanaNeural', 'ml-IN-MidhunNeural',
  'mn-MN-YesuiNeural', 'mn-MN-BataaNeural',
  'mr-IN-AarohiNeural', 'mr-IN-ManoharNeural',
  'mt-MT-GraceNeural', 'mt-MT-JosephNeural',
  'my-MM-NilarNeural', 'my-MM-ThihaNeural',
  'ne-NP-HemkalaNeural', 'ne-NP-SagarNeural',
  'ps-AF-LatifaNeural', 'ps-AF-GulNawazNeural',
  'ro-RO-AlinaNeural', 'ro-RO-EmilNeural',
  'si-LK-ThiliniNeural', 'si-LK-SameeraNeural',
  'sk-SK-ViktoriaNeural', 'sk-SK-LukasNeural',
  'sl-SI-PetraNeural', 'sl-SI-RokNeural',
  'so-SO-UbaxNeural', 'so-SO-AbdalleNeural',
  'sq-AL-AnilaNeural', 'sq-AL-IlirNeural',
  'sr-RS-SophieNeural', 'sr-RS-NicholasNeural',
  'su-ID-TutiNeural', 'su-ID-JajangNeural',
  'sw-KE-ZuriNeural', 'sw-KE-RafikiNeural',
  'ta-IN-PallaviNeural', 'ta-IN-ValluvarNeural',
  'ta-MY-KaniNeural', 'ta-MY-SuryaNeural',
  'ta-SG-VenbaNeural', 'ta-SG-AnbuNeural',
  'ta-LK-SaranyaNeural', 'ta-LK-KumarNeural',
  'te-IN-ShrutiNeural', 'te-IN-MohanNeural',
  'uk-UA-PolinaNeural', 'uk-UA-OstapNeural',
  'ur-IN-GulNeural', 'ur-IN-SalmanNeural',
  'ur-PK-UzmaNeural', 'ur-PK-AsadNeural',
  'uz-UZ-MadinaNeural', 'uz-UZ-SardorNeural',
  'zu-ZA-ThandoNeural', 'zu-ZA-ThembaNeural',
]);

function resolveVoice(voiceName) {
  const voice = voiceName || 'zh-CN-XiaoxiaoNeural';

  // 1. Direct Edge TTS voice match (e.g., "zh-CN-XiaoxiaoNeural")
  if (EDGE_VOICE_IDS.has(voice)) {
    return voice;
  }

  // 2. Language-based fallback
  const parts = voice.split('-');
  const langPrefix = parts[0];

  const langFallbacks = {
    'zh': 'zh-CN-XiaoxiaoNeural',
    'zh-TW': 'zh-TW-HsiaoChenNeural',
    'zh-HK': 'zh-HK-HiuGaaiNeural',
    'ja': 'ja-JP-NanamiNeural',
    'ko': 'ko-KR-SunHiNeural',
    'en': 'en-US-AriaNeural',
    'fr': 'fr-FR-DeniseNeural',
    'de': 'de-DE-KatjaNeural',
    'es': 'es-ES-ElviraNeural',
    'pt': 'pt-BR-FranciscaNeural',
    'it': 'it-IT-ElsaNeural',
    'ru': 'ru-RU-SvetlanaNeural',
    'nl': 'nl-NL-ColetteNeural',
    'pl': 'pl-PL-AgnieszkaNeural',
    'sv': 'sv-SE-SofieNeural',
    'da': 'da-DK-ChristelNeural',
    'nb': 'nb-NO-PernilleNeural',
    'fi': 'fi-FI-NooraNeural',
    'tr': 'tr-TR-EmelNeural',
    'ar': 'ar-SA-ZariyahNeural',
    'hi': 'hi-IN-SwaraNeural',
    'th': 'th-TH-PremwadeeNeural',
    'vi': 'vi-VN-HoaiMyNeural',
    'id': 'id-ID-GadisNeural',
    'ms': 'ms-MY-YasminNeural',
    'ta': 'ta-IN-PallaviNeural',
    'te': 'te-IN-ShrutiNeural',
    'mr': 'mr-IN-AarohiNeural',
    'bn': 'bn-IN-TanishaaNeural',
    'gu': 'gu-IN-DhwaniNeural',
    'kn': 'kn-IN-SapnaNeural',
    'ml': 'ml-IN-SobhanaNeural',
    'ur': 'ur-IN-GulNeural',
    'uk': 'uk-UA-PolinaNeural',
    'cs': 'cs-CZ-VlastaNeural',
    'sk': 'sk-SK-ViktoriaNeural',
    'hu': 'hu-HU-NoemiNeural',
    'ro': 'ro-RO-AlinaNeural',
    'bg': 'bg-BG-KalinaNeural',
    'el': 'el-GR-AthinaNeural',
    'he': 'he-IL-HilaNeural',
    'fa': 'fa-IR-DilaraNeural',
    'sw': 'sw-KE-ZuriNeural',
    'cy': 'cy-GB-NiaNeural',
    'ca': 'ca-ES-JoanaNeural',
  };

  const langFull = parts.slice(0, 2).join('-');
  if (langFallbacks[langFull]) return langFallbacks[langFull];
  if (langFallbacks[langPrefix]) return langFallbacks[langPrefix];

  // Ultimate fallback
  return 'en-US-AriaNeural';
}

// ============================================================
// Speech synthesis (main entry point)
// ============================================================

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

async function synthesize(text, voiceName, rate, pitch) {
  const voice = resolveVoice(voiceName);
  console.log(`[AudioReading] Synthesizing: voice=${voice}`);
  return synthViaEdgeTTS(text, voice, rate, pitch);
}

// ============================================================
// Message handler
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNTHESIZE_EDGE_TTS' || message.type === 'PREVIEW_EDGE_VOICE') {
    const payload = message.payload || {};
    const text = payload.text || payload.sampleText || '';
    const voiceName = payload.voiceName || payload.edgeVoiceName || 'zh-CN-XiaoxiaoNeural';
    const rate = payload.rate || 1;
    const pitch = payload.pitch || 1;

    // Normalize: PREVIEW_EDGE_VOICE uses {voiceName, sampleText}
    // SYNTHESIZE_EDGE_TTS may use either format

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
