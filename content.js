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

function findVoiceByURI(voiceURI) {
  return speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI) || null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveSpeechSettings(settings) {
  const overrides = settings.overrides || {};

  const rate = clamp((settings.rate ?? 1) * (overrides.rateMultiplier ?? 1), 0.5, 2);
  const pitch = clamp((settings.pitch ?? 1) + (overrides.pitchOffset ?? 0), 0, 2);
  const volume = clamp((settings.volume ?? 1) * (overrides.volumeMultiplier ?? 1), 0, 1);

  return {
    rate,
    pitch,
    volume
  };
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
  const text = currentQueue.shift();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = findVoiceByURI(settings.voiceURI);
  if (voice) utterance.voice = voice;

  const merged = resolveSpeechSettings(settings);
  utterance.rate = merged.rate;
  utterance.pitch = merged.pitch;
  utterance.volume = merged.volume;

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
    currentQueue = splitText(text);
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
