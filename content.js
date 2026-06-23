// ============================================================
// AudioReading Content Script
// Multi-backend TTS engine: Web Speech API + Edge TTS + Cloud TTS
// ============================================================

let currentQueue = [];
let speaking = false;
let paused = false;
let currentSettings = null;
let activeAudioElement = null;

// ---- Text extraction ----

function getCleanText() {
  const root = document.querySelector('article, main') || document.body;
  const text = root?.innerText || '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function splitText(text, size = 180) {
  if (!text) return [];
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

function splitTextBySentence(text, maxChunkLength = 220) {
  if (!text) return [];
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[。！？!?；;…\.])\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return splitText(normalized, maxChunkLength);
  }

  const chunks = [];
  let buffer = '';
  for (const sentence of sentences) {
    if ((buffer + sentence).length <= maxChunkLength) {
      buffer += sentence;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      buffer = '';
    }

    if (sentence.length > maxChunkLength) {
      chunks.push(...splitText(sentence, maxChunkLength));
    } else {
      buffer = sentence;
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks;
}

// ---- Voice resolution ----

function findVoiceByURI(voiceURI) {
  return speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI) || null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveSpeechSettings(settings) {
  const overrides = settings.overrides || {};
  const style = settings.readingStyle || 'standard';
  const styleMap = {
    standard: { rateMultiplier: 1, pitchOffset: 0, volumeMultiplier: 1 },
    story: { rateMultiplier: 0.96, pitchOffset: 0.08, volumeMultiplier: 1 },
    dialogue: { rateMultiplier: 1, pitchOffset: 0.12, volumeMultiplier: 1 },
    news: { rateMultiplier: 0.98, pitchOffset: -0.05, volumeMultiplier: 1 },
    calm: { rateMultiplier: 0.88, pitchOffset: -0.08, volumeMultiplier: 0.95 }
  };
  const stylePreset = styleMap[style] || styleMap.standard;

  const rate = clamp(
    (settings.rate || 1) * (overrides.rateMultiplier || 1) * (stylePreset.rateMultiplier || 1),
    0.5,
    2
  );
  const pitch = clamp((settings.pitch || 1) + (overrides.pitchOffset || 0) + (stylePreset.pitchOffset || 0), 0, 2);
  const volume = clamp(
    (settings.volume || 1) * (overrides.volumeMultiplier || 1) * (stylePreset.volumeMultiplier || 1),
    0,
    1
  );

  return { rate, pitch, volume };
}

// ---- Prosody / emotion adjustments ----

function getProsodyAdjustments(text, settings) {
  const overrides = settings.overrides || {};
  const style = settings.readingStyle || overrides.prosodyStyle || 'standard';
  const voiceIntensity = clamp(Number(overrides.emotionIntensity || 0), 0, 1);
  const userIntensity = clamp(Number(settings.emotion ?? 0.8), 0, 1);
  const intensity = clamp((voiceIntensity || 0.65) * userIntensity, 0, 1);

  if (intensity <= 0) {
    return { rateDelta: 0, pitchDelta: 0, volumeDelta: 0 };
  }

  const chunk = String(text || '');
  let rateDelta = 0;
  let pitchDelta = 0;
  let volumeDelta = 0;

  if (/[！？!?]/u.test(chunk)) {
    rateDelta += 0.04 * intensity;
    pitchDelta += 0.14 * intensity;
    volumeDelta += 0.06 * intensity;
  }

  if (/[，、；;]/u.test(chunk)) {
    rateDelta -= 0.03 * intensity;
  }

  if (/[。.…]/u.test(chunk)) {
    rateDelta -= 0.02 * intensity;
    pitchDelta -= 0.04 * intensity;
  }

  if (/(开心|高兴|喜欢|期待|激动|惊喜|太棒|真好)/u.test(chunk)) {
    pitchDelta += 0.1 * intensity;
    volumeDelta += 0.03 * intensity;
  }

  if (/(难过|抱歉|遗憾|悲伤|失望|担心|害怕|辛苦)/u.test(chunk)) {
    rateDelta -= 0.05 * intensity;
    pitchDelta -= 0.09 * intensity;
  }

  if (/(请|拜托|谢谢|麻烦|劳驾)/u.test(chunk)) {
    rateDelta -= 0.02 * intensity;
    pitchDelta += 0.03 * intensity;
  }

  if (/(真的|太|非常|超级|特别|一定|绝对)/u.test(chunk)) {
    rateDelta += 0.01 * intensity;
    pitchDelta += 0.05 * intensity;
  }

  if (/(嗯|啊|呀|吧|呢|啦|嘛|哇)/u.test(chunk)) {
    pitchDelta += 0.03 * intensity;
  }

  if (/["""「」『』]/u.test(chunk)) {
    pitchDelta += 0.04 * intensity;
    rateDelta += 0.02 * intensity;
  }

  if (style === 'news') {
    rateDelta -= 0.02 * intensity;
    pitchDelta -= 0.05 * intensity;
    volumeDelta += 0.01 * intensity;
  } else if (style === 'story') {
    pitchDelta += 0.04 * intensity;
  } else if (style === 'dialogue') {
    rateDelta += 0.02 * intensity;
    pitchDelta += 0.06 * intensity;
  } else if (style === 'calm') {
    rateDelta -= 0.07 * intensity;
    pitchDelta -= 0.06 * intensity;
    volumeDelta -= 0.04 * intensity;
  } else if (style === 'standard' && overrides.prosodyStyle !== 'expressive') {
    rateDelta *= 0.7;
    pitchDelta *= 0.7;
    volumeDelta *= 0.7;
  }

  return { rateDelta, pitchDelta, volumeDelta };
}

// ---- Stop / cleanup ----

function stopAll() {
  currentQueue = [];
  speaking = false;
  paused = false;
  speechSynthesis.cancel();
  if (activeAudioElement) {
    activeAudioElement.pause();
    activeAudioElement.src = '';
    activeAudioElement = null;
  }
}

// ---- Web Speech API playback ----

function speakQueueWebSpeech(settings) {
  if (!currentQueue.length) {
    speaking = false;
    return;
  }

  speaking = true;
  const chunk = currentQueue.shift();
  const utterance = new SpeechSynthesisUtterance(chunk);
  const voice = findVoiceByURI(settings.voiceURI);
  if (voice) utterance.voice = voice;

  const merged = resolveSpeechSettings(settings);
  const prosody = getProsodyAdjustments(chunk, settings);
  utterance.rate = clamp(merged.rate + prosody.rateDelta, 0.5, 2);
  utterance.pitch = clamp(merged.pitch + prosody.pitchDelta, 0, 2);
  utterance.volume = clamp(merged.volume + prosody.volumeDelta, 0, 1);

  utterance.onend = () => {
    if (paused) return;
    speakQueueWebSpeech(settings);
  };

  utterance.onerror = () => {
    speakQueueWebSpeech(settings);
  };

  speechSynthesis.speak(utterance);
}

// ---- Edge TTS playback (via background service worker, bypasses CORS) ----

async function synthesizeEdgeTTS(text, voiceName, rate, pitch) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'SYNTHESIZE_EDGE_TTS',
        payload: { text, voiceName, rate, pitch }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error(response?.message || 'Edge TTS synthesis failed'));
          return;
        }
        resolve(response.audioData);
      }
    );
  });
}

function playAudioBuffer(data, onEnd, onError) {
  let blob;
  if (typeof data === 'string') {
    // base64 → blob
    const byteChars = atob(data);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: 'audio/mpeg' });
  } else {
    blob = new Blob([data], { type: 'audio/mpeg' });
  }
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  activeAudioElement = audio;

  audio.onended = () => {
    URL.revokeObjectURL(url);
    activeAudioElement = null;
    if (onEnd) onEnd();
  };

  audio.onerror = (e) => {
    URL.revokeObjectURL(url);
    activeAudioElement = null;
    console.error('Audio playback error:', e);
    if (onError) onError();
  };

  audio.play().catch((e) => {
    URL.revokeObjectURL(url);
    activeAudioElement = null;
    console.error('Audio play() rejected:', e);
    if (onError) onError();
  });
}

async function speakQueueEdgeTTS(settings) {
  if (!currentQueue.length) {
    speaking = false;
    return;
  }

  const chunk = currentQueue.shift();
  const voiceName = settings.edgeVoiceName || 'zh-CN-XiaoxiaoNeural';
  const merged = resolveSpeechSettings(settings);

  try {
    const audioData = await synthesizeEdgeTTS(chunk, voiceName, merged.rate, merged.pitch);

    if (paused) {
      currentQueue.unshift(chunk);
      return;
    }

    playAudioBuffer(
      audioData,
      () => {
        if (!paused) speakQueueEdgeTTS(settings);
      },
      () => {
        // On error, try next chunk
        if (!paused) speakQueueEdgeTTS(settings);
      }
    );
  } catch (err) {
    console.error('Edge TTS synthesis error:', err);
    // Fallback: skip this chunk and continue
    if (!paused) speakQueueEdgeTTS(settings);
  }
}

// ---- Cloud TTS (backend) playback ----

async function speakQueueCloudTTS(settings) {
  if (!currentQueue.length) {
    speaking = false;
    return;
  }

  const chunk = currentQueue.shift();
  const merged = resolveSpeechSettings(settings);

  try {
    const response = await fetch(`${settings.cloudTtsUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': settings.cloudTtsApiKey || ''
      },
      body: JSON.stringify({
        text: chunk,
        voice: settings.cloudVoiceId || 'longxiaochun',
        speed: merged.rate,
        pitch: merged.pitch,
        format: 'mp3',
        sample_rate: 24000
      })
    });

    if (!response.ok) {
      throw new Error(`Cloud TTS returned ${response.status}`);
    }

    const result = await response.json();
    const audioUrl = result.audio_url;

    if (!audioUrl) {
      throw new Error('No audio URL in response');
    }

    if (paused) {
      currentQueue.unshift(chunk);
      return;
    }

    const audio = new Audio(audioUrl);
    activeAudioElement = audio;

    audio.onended = () => {
      activeAudioElement = null;
      if (!paused) speakQueueCloudTTS(settings);
    };

    audio.onerror = () => {
      activeAudioElement = null;
      if (!paused) speakQueueCloudTTS(settings);
    };

    audio.play();
  } catch (err) {
    console.error('Cloud TTS error:', err);
    if (!paused) speakQueueCloudTTS(settings);
  }
}

// ---- Voice preview for Edge TTS ----

async function previewEdgeVoice(voiceName, sampleText) {
  try {
    const audioData = await synthesizeEdgeTTS(sampleText, voiceName, 1.0, 1.0);
    return new Promise((resolve, reject) => {
      playAudioBuffer(
        audioData,
        () => resolve({ ok: true }),
        (err) => reject(err || new Error('Preview playback failed'))
      );
    });
  } catch (err) {
    throw err;
  }
}

// ---- Voice list ----

function getVoices() {
  const voices = speechSynthesis.getVoices();
  return voices.map((v) => ({
    name: v.name,
    lang: v.lang,
    default: v.default,
    voiceURI: v.voiceURI
  }));
}

function waitForVoices(timeoutMs = 3000) {
  const existing = getVoices();
  if (existing.length) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;

    const finish = (voices) => {
      if (settled) return;
      settled = true;
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      clearTimeout(timer);
      resolve(voices);
    };

    const onVoicesChanged = () => {
      const voices = getVoices();
      if (voices.length) {
        finish(voices);
      }
    };

    const timer = setTimeout(() => {
      finish(getVoices());
    }, timeoutMs);

    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
  });
}

// ---- Unified speak dispatcher ----

function speakQueue(settings) {
  const source = settings.voiceSource || 'system';

  switch (source) {
    case 'edge':
      speakQueueEdgeTTS(settings);
      break;
    case 'cloud':
      speakQueueCloudTTS(settings);
      break;
    case 'system':
    default:
      speakQueueWebSpeech(settings);
      break;
  }
}

// ---- Message handler ----

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ---- GET_VOICES ----
  if (message.type === 'GET_VOICES') {
    waitForVoices()
      .then((voices) => {
        sendResponse({ voices });
      })
      .catch(() => {
        sendResponse({ voices: getVoices() });
      });
    return true;
  }

  // ---- PREVIEW_EDGE_VOICE ----
  if (message.type === 'PREVIEW_EDGE_VOICE') {
    const { voiceName, sampleText } = message.payload;
    previewEdgeVoice(voiceName, sampleText || '你好，这是一段语音预览测试。')
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ ok: false, message: err.message }));
    return true;
  }

  // ---- READ_PAGE ----
  if (message.type === 'READ_PAGE') {
    const text = getCleanText();
    if (!text) {
      sendResponse({ ok: false, message: '未提取到可朗读文本' });
      return true;
    }

    stopAll();
    currentSettings = message.payload;
    currentQueue = splitTextBySentence(text);
    paused = false;
    speakQueue(message.payload);

    sendResponse({ ok: true, length: text.length });
    return true;
  }

  // ---- READ_SELECTION ----
  if (message.type === 'READ_SELECTION') {
    const selection = window.getSelection();
    const text = (selection && !selection.isCollapsed)
      ? selection.toString().trim()
      : '';

    if (!text) {
      sendResponse({ ok: false, message: '未检测到选中文字，请先在页面中选中要朗读的内容' });
      return true;
    }

    stopAll();
    currentSettings = message.payload;
    currentQueue = splitTextBySentence(text);
    paused = false;
    speakQueue(message.payload);

    sendResponse({ ok: true, length: text.length });
    return true;
  }

  // ---- TOGGLE_PAUSE ----
  if (message.type === 'TOGGLE_PAUSE') {
    if (!speaking) {
      sendResponse({ message: '当前未在朗读' });
      return true;
    }

    const source = currentSettings?.voiceSource || 'system';

    if (source === 'system') {
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
        paused = false;
        sendResponse({ message: '已继续朗读' });
      } else {
        speechSynthesis.pause();
        paused = true;
        sendResponse({ message: '已暂停朗读' });
      }
    } else if (source === 'edge' || source === 'cloud') {
      if (paused) {
        paused = false;
        speakQueue(currentSettings);
        sendResponse({ message: '已继续朗读' });
      } else {
        paused = true;
        if (activeAudioElement) {
          activeAudioElement.pause();
        }
        sendResponse({ message: '已暂停朗读' });
      }
    }

    return true;
  }

  // ---- STOP_READING ----
  if (message.type === 'STOP_READING') {
    stopAll();
    sendResponse({ message: '已停止朗读' });
    return true;
  }

  return false;
});

// ---- Voice change listener ----

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => {
    getVoices();
  };
}
