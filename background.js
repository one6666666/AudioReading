// ============================================================
// AudioReading Background Service Worker
// Multi-provider TTS: StreamElements (Polly/Google WaveNet/Azure) + Google Translate
// Free, no authentication required, works in Chrome MV3
// 12 Chinese voices: 1 Polly, 4 Google WaveNet, 7 Azure
// ============================================================

// ============================================================
// Voice resolution: map voice IDs to provider + voice name
// ============================================================

// Backward compatibility: map old Edge TTS voice IDs → Polly voices
const EDGE_TO_POLLY = {
  // Chinese
  'zh-CN-XiaoxiaoNeural': 'Zhiyu', 'zh-CN-XiaoyiNeural': 'Zhiyu',
  'zh-CN-YunxiNeural': 'Zhiyu', 'zh-CN-YunyangNeural': 'Zhiyu',
  'zh-CN-XiaohanNeural': 'Zhiyu', 'zh-CN-XiaomoNeural': 'Zhiyu',
  'zh-CN-XiaoruiNeural': 'Zhiyu', 'zh-CN-XiaoxuanNeural': 'Zhiyu',
  'zh-CN-YunjianNeural': 'Zhiyu', 'zh-CN-YunxiaNeural': 'Zhiyu',
  'zh-CN-YunyeNeural': 'Zhiyu', 'zh-CN-liaoning-XiaobeiNeural': 'Zhiyu',
  // English US
  'en-US-JennyNeural': 'Joanna', 'en-US-AriaNeural': 'Salli',
  'en-US-GuyNeural': 'Matthew', 'en-US-DavisNeural': 'Joey',
  'en-US-AmberNeural': 'Kendra', 'en-US-AnaNeural': 'Ivy',
  'en-US-BrandonNeural': 'Justin', 'en-US-ChristopherNeural': 'Matthew',
  'en-US-EricNeural': 'Joey', 'en-US-MichelleNeural': 'Kendra',
  'en-US-RogerNeural': 'Matthew', 'en-US-SteffanNeural': 'Joey',
  // English UK
  'en-GB-LibbyNeural': 'Amy', 'en-GB-RyanNeural': 'Brian',
  'en-GB-SoniaNeural': 'Emma', 'en-GB-MaisieNeural': 'Amy',
  // English AU
  'en-AU-NatashaNeural': 'Nicole', 'en-AU-WilliamNeural': 'Russell',
  // Japanese
  'ja-JP-NanamiNeural': 'Mizuki', 'ja-JP-KeitaNeural': 'Takumi',
  'ja-JP-AoiNeural': 'Mizuki', 'ja-JP-DaichiNeural': 'Takumi',
  'ja-JP-MayuNeural': 'Mizuki',
  // Korean
  'ko-KR-SunHiNeural': 'Seoyeon', 'ko-KR-InJoonNeural': 'Seoyeon',
  'ko-KR-JiMinNeural': 'Seoyeon',
  // French
  'fr-FR-DeniseNeural': 'Lea', 'fr-FR-HenriNeural': 'Mathieu',
  // German
  'de-DE-KatjaNeural': 'Vicki', 'de-DE-ConradNeural': 'Hans',
  // Spanish
  'es-ES-ElviraNeural': 'Lucia', 'es-ES-AlvaroNeural': 'Enrique',
  'es-MX-DaliaNeural': 'Mia', 'es-MX-JorgeNeural': 'Miguel',
  // Portuguese
  'pt-BR-FranciscaNeural': 'Vitoria', 'pt-BR-AntonioNeural': 'Ricardo',
  // Italian
  'it-IT-ElsaNeural': 'Carla', 'it-IT-IsabellaNeural': 'Bianca',
  // Russian
  'ru-RU-SvetlanaNeural': 'Tatyana', 'ru-RU-DmitryNeural': 'Maxim',
  // Arabic
  'ar-SA-ZariyahNeural': 'Zeina', 'ar-SA-HamedNeural': 'Zeina',
};

// Known StreamElements voices (for direct matching — Polly + Google + Azure)
const STREAMELEMENTS_VOICES = new Set([
  // Polly voices
  'Zhiyu', 'Mizuki', 'Takumi', 'Seoyeon',
  'Joanna', 'Matthew', 'Joey', 'Kendra', 'Ivy', 'Kimberly', 'Salli', 'Justin',
  'Amy', 'Emma', 'Brian', 'Nicole', 'Russell', 'Aditi', 'Raveena',
  'Lea', 'Celine', 'Mathieu', 'Vicki', 'Marlene', 'Hans',
  'Lucia', 'Conchita', 'Enrique', 'Mia', 'Miguel', 'Penelope',
  'Vitoria', 'Ricardo', 'Camila', 'Ines', 'Cristiano',
  'Carla', 'Bianca', 'Giorgio',
  'Tatyana', 'Maxim',
  'Lotte', 'Ruben', 'Ewa', 'Jacek', 'Filiz', 'Astrid',
  'Naja', 'Mads', 'Liv', 'Gwyneth', 'Zeina',
  // Google WaveNet voices (Chinese)
  'cmn-CN-Wavenet-A', 'cmn-CN-Wavenet-B', 'cmn-CN-Wavenet-C', 'cmn-CN-Wavenet-D',
  // Azure voices (Chinese)
  'Huihui', 'Yaoyao', 'Kangkang', 'HanHan', 'Zhiwei', 'Tracy', 'Danny',
]);

// Map StreamElements voice names → language codes (for Google Translate fallback)
const STREAMELEMENTS_VOICE_TO_LANG = {
  // Polly
  'Zhiyu': 'zh-CN',
  'Joanna': 'en-US', 'Matthew': 'en-US', 'Joey': 'en-US', 'Kendra': 'en-US',
  'Ivy': 'en-US', 'Kimberly': 'en-US', 'Salli': 'en-US', 'Justin': 'en-US',
  'Amy': 'en-GB', 'Emma': 'en-GB', 'Brian': 'en-GB',
  'Nicole': 'en-AU', 'Russell': 'en-AU',
  'Raveena': 'en-IN', 'Aditi': 'en-IN',
  'Mizuki': 'ja-JP', 'Takumi': 'ja-JP',
  'Seoyeon': 'ko-KR',
  'Lea': 'fr-FR', 'Celine': 'fr-FR', 'Mathieu': 'fr-FR',
  'Vicki': 'de-DE', 'Marlene': 'de-DE', 'Hans': 'de-DE',
  'Lucia': 'es-ES', 'Conchita': 'es-ES', 'Enrique': 'es-ES',
  'Mia': 'es-MX', 'Miguel': 'es-US', 'Penelope': 'es-US',
  'Vitoria': 'pt-BR', 'Camila': 'pt-BR', 'Ricardo': 'pt-BR',
  'Ines': 'pt-PT', 'Cristiano': 'pt-PT',
  'Carla': 'it-IT', 'Bianca': 'it-IT', 'Giorgio': 'it-IT',
  'Tatyana': 'ru-RU', 'Maxim': 'ru-RU',
  'Lotte': 'nl-NL', 'Ruben': 'nl-NL',
  'Ewa': 'pl-PL', 'Jacek': 'pl-PL',
  'Filiz': 'tr-TR',
  'Astrid': 'sv-SE',
  'Naja': 'da-DK', 'Mads': 'da-DK',
  'Liv': 'nb-NO',
  'Gwyneth': 'cy-GB',
  'Zeina': 'ar-SA',
  // Google WaveNet (Chinese)
  'cmn-CN-Wavenet-A': 'zh-CN',
  'cmn-CN-Wavenet-B': 'zh-CN',
  'cmn-CN-Wavenet-C': 'zh-CN',
  'cmn-CN-Wavenet-D': 'zh-CN',
  // Azure (Chinese)
  'Huihui': 'zh-CN',
  'Yaoyao': 'zh-CN',
  'Kangkang': 'zh-CN',
  'HanHan': 'zh-TW',
  'Zhiwei': 'zh-TW',
  'Tracy': 'zh-HK',
  'Danny': 'zh-HK',
};

function resolveVoice(voiceName) {
  const voice = voiceName || 'Zhiyu';

  // 1. Direct StreamElements voice match (e.g., "Zhiyu", "Huihui", "cmn-CN-Wavenet-A")
  if (STREAMELEMENTS_VOICES.has(voice)) {
    return { provider: 'streamelements', voice };
  }

  // 2. Backward compat: old Edge voice ID → StreamElements
  if (EDGE_TO_POLLY[voice]) {
    return { provider: 'streamelements', voice: EDGE_TO_POLLY[voice] };
  }

  // 3. Language-based fallback → StreamElements
  const langPrefix = voice.split('-')[0];
  const langFull = voice.split('-').slice(0, 2).join('-');

  const langToVoice = {
    'zh': 'Zhiyu', 'zh-TW': 'HanHan', 'zh-HK': 'Tracy',
    'ja': 'Mizuki', 'ko': 'Seoyeon',
    'en-US': 'Joanna', 'en-GB': 'Brian', 'en-AU': 'Nicole', 'en-IN': 'Raveena', 'en': 'Joanna',
    'fr': 'Lea', 'de': 'Vicki',
    'es-ES': 'Lucia', 'es-MX': 'Mia', 'es': 'Lucia',
    'pt-BR': 'Vitoria', 'pt-PT': 'Ines', 'pt': 'Vitoria',
    'it': 'Carla', 'ru': 'Tatyana',
    'nl': 'Lotte', 'pl': 'Ewa', 'tr': 'Filiz',
    'sv': 'Astrid', 'da': 'Naja', 'nb': 'Liv', 'cy': 'Gwyneth',
    'ar': 'Zeina',
  };

  if (langToVoice[langFull]) {
    return { provider: 'streamelements', voice: langToVoice[langFull] };
  }
  if (langToVoice[langPrefix]) {
    return { provider: 'streamelements', voice: langToVoice[langPrefix] };
  }

  // 4. Ultimate fallback: Google Translate with language code
  return { provider: 'gtts', voice: langPrefix || 'zh-CN' };
}

// ============================================================
// Provider 1: StreamElements (Polly + Google WaveNet + Azure voices)
// GET https://api.streamelements.com/kappa/v2/speech?voice=Zhiyu&text=你好
// Returns: MP3 audio (no auth, ~550 char limit, all 188 voices)
// ============================================================

async function synthesizeViaStreamElements(text, voice) {
  const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;

  console.log(`[AudioReading] StreamElements request: voice=${voice}, text="${text.substring(0, 50)}..."`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      referrer: 'https://streamelements.com/',
      referrerPolicy: 'no-referrer-when-downgrade'
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[AudioReading] StreamElements HTTP ${response.status}: ${errText.substring(0, 200)}`);
      throw new Error(`StreamElements HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength < 100) {
      throw new Error('StreamElements returned insufficient audio data');
    }

    console.log(`[AudioReading] StreamElements success: ${buffer.byteLength} bytes`);
    return buffer;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('StreamElements request timeout');
    }
    throw err;
  }
}

// ============================================================
// Provider 2: Google Translate TTS (fallback)
// GET https://translate.google.com/translate_tts?ie=UTF-8&q=TEXT&tl=zh-CN&client=tw-ob
// Returns: MP3 audio (no auth, ~200 char limit per request)
// ============================================================

async function synthesizeViaGoogleTranslate(text, lang) {
  // Split text into ≤190 char chunks (Google limit is ~200)
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    // Try to split at sentence boundary near 190 chars
    let end = Math.min(i + 190, text.length);
    if (end < text.length) {
      // Find last sentence boundary in range (i+50, end)
      const segment = text.slice(i, end);
      const match = segment.match(/.*[。！？!?；;…\.\n]/);
      if (match && match[0].length > 50) {
        end = i + match[0].length;
      }
    }
    chunks.push(text.slice(i, end));
    i = end;
  }

  console.log(`[AudioReading] Google Translate: lang=${lang}, ${chunks.length} chunk(s), text="${text.substring(0, 50)}..."`);

  const audioBuffers = [];

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Google Translate HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      if (buffer && buffer.byteLength > 0) {
        audioBuffers.push(buffer);
      }
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  if (!audioBuffers.length) {
    throw new Error('Google Translate returned no audio data');
  }

  // Merge audio buffers
  if (audioBuffers.length === 1) {
    console.log(`[AudioReading] Google Translate success: ${audioBuffers[0].byteLength} bytes`);
    return audioBuffers[0];
  }

  const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of audioBuffers) {
    merged.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  console.log(`[AudioReading] Google Translate success: ${totalLength} bytes (${audioBuffers.length} chunks merged)`);
  return merged.buffer;
}

// ============================================================
// Base64 encoding
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

// ============================================================
// Main synthesis entry point
// ============================================================

async function synthesize(text, voiceName, rate, pitch) {
  const resolved = resolveVoice(voiceName);
  // Get proper language code: use STREAMELEMENTS_VOICE_TO_LANG mapping for Google Translate fallback
  const lang = STREAMELEMENTS_VOICE_TO_LANG[resolved.voice] ||
               (voiceName || 'zh-CN').split('-').slice(0, 2).join('-');

  console.log(`[AudioReading] Synthesizing: provider=${resolved.provider}, voice=${resolved.voice}`);

  // Primary: StreamElements (Polly/Google/Azure)
  if (resolved.provider === 'streamelements') {
    try {
      return await synthesizeViaStreamElements(text, resolved.voice);
    } catch (SEErr) {
      console.warn(`[AudioReading] StreamElements failed: ${SEErr.message}, falling back to Google Translate...`);
      // Fallback: Google Translate
      try {
        return await synthesizeViaGoogleTranslate(text, lang);
      } catch (gtErr) {
        throw new Error(`语音合成失败：${gtErr.message}`);
      }
    }
  }

  // Direct Google Translate
  try {
    return await synthesizeViaGoogleTranslate(text, resolved.voice);
  } catch (gtErr) {
    throw new Error(`语音合成失败：${gtErr.message}`);
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
        console.error('[AudioReading] Synthesis failed:', err.message);
        sendResponse({ ok: false, message: err.message });
      });

    return true; // async response
  }

  return false;
});
