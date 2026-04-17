let currentQueue = [];
let speaking = false;
let paused = false;

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

  return {
    rate,
    pitch,
    volume
  };
}

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

  if (/["“”「」『』]/u.test(chunk)) {
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

function stopAll() {
  currentQueue = [];
  speaking = false;
  paused = false;
  speechSynthesis.cancel();
}

function speakQueue(settings) {
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
    speakQueue(settings);
  };

  utterance.onerror = () => {
    speakQueue(settings);
  };

  speechSynthesis.speak(utterance);
}

function getVoices() {
  const voices = speechSynthesis.getVoices();
  return voices.map((v) => ({
    name: v.name,
    lang: v.lang,
    default: v.default,
    voiceURI: v.voiceURI
  }));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_VOICES') {
    sendResponse({ voices: getVoices() });
    return true;
  }

  if (message.type === 'READ_PAGE') {
    const text = getCleanText();
    if (!text) {
      sendResponse({ ok: false, message: '未提取到可朗读文本' });
      return true;
    }

    stopAll();
    currentQueue = splitTextBySentence(text);
    paused = false;
    speakQueue(message.payload);

    sendResponse({ ok: true, length: text.length });
    return true;
  }

  if (message.type === 'TOGGLE_PAUSE') {
    if (!speaking) {
      sendResponse({ message: '当前未在朗读' });
      return true;
    }

    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      paused = false;
      sendResponse({ message: '已继续朗读' });
    } else {
      speechSynthesis.pause();
      paused = true;
      sendResponse({ message: '已暂停朗读' });
    }

    return true;
  }

  if (message.type === 'STOP_READING') {
    stopAll();
    sendResponse({ message: '已停止朗读' });
    return true;
  }

  return false;
});

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => {
    getVoices();
  };
}
