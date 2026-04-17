const voiceSelect = document.getElementById('voiceSelect');
const rateInput = document.getElementById('rate');
const pitchInput = document.getElementById('pitch');
const volumeInput = document.getElementById('volume');
const rateValue = document.getElementById('rateValue');
const pitchValue = document.getElementById('pitchValue');
const volumeValue = document.getElementById('volumeValue');
const statusEl = document.getElementById('status');

const SETTINGS_KEY = 'ttsSettings';
const voiceOptionMap = new Map();

const CHINESE_VARIANTS = [
  {
    key: 'expressive_female',
    label: '情感女声（推荐）',
    rateMultiplier: 0.96,
    pitchOffset: 0.24,
    volumeMultiplier: 1,
    prosodyStyle: 'expressive',
    emotionIntensity: 0.9,
    keywords: ['xiaoxiao', 'xiaoyi', 'female', 'woman', '女']
  },
  {
    key: 'warm_female',
    label: '温柔女声',
    rateMultiplier: 0.9,
    pitchOffset: 0.18,
    volumeMultiplier: 1,
    keywords: ['xiaoxiao', 'xiaoyi', 'yunxi', 'female', 'woman', '女']
  },
  {
    key: 'crisp_female',
    label: '清甜女声',
    rateMultiplier: 1,
    pitchOffset: 0.3,
    volumeMultiplier: 1,
    keywords: ['xiaoxiao', 'xiaoyi', 'female', 'woman', '女']
  },
  {
    key: 'broadcast_host',
    label: '主播音',
    rateMultiplier: 1.08,
    pitchOffset: 0.05,
    volumeMultiplier: 1,
    keywords: ['yunyang', 'yunxi', 'xiaochen', 'xiaomo', 'male', 'female']
  },
  {
    key: 'steady_male',
    label: '沉稳男声',
    rateMultiplier: 0.95,
    pitchOffset: -0.2,
    volumeMultiplier: 1,
    keywords: ['yunyang', 'yunhao', 'male', 'man', '男']
  }
];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#d64c4c' : '#4b5563';
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('未找到当前标签页');
  }
  return tab;
}

function isInjectableUrl(url = '') {
  return /^https?:\/\//.test(url);
}

function isChineseVoice(voice) {
  if (!voice) return false;
  const lang = String(voice.lang || '').toLowerCase();
  if (lang.startsWith('zh')) return true;
  return /chinese|mandarin|cantonese|粤语|普通话|中文/.test(String(voice.name || '').toLowerCase());
}

function pickVariantsForVoice(voice) {
  const name = String(voice.name || '').toLowerCase();
  const matched = CHINESE_VARIANTS.filter((variant) => variant.keywords.some((keyword) => name.includes(keyword)));
  return matched.length ? matched : CHINESE_VARIANTS;
}

function buildVoiceOptions(voices) {
  const options = [];

  for (const voice of voices) {
    options.push({
      id: voice.voiceURI,
      name: `${voice.name} (${voice.lang})${voice.default ? ' - 默认' : ''}`,
      voiceURI: voice.voiceURI,
      baseName: voice.name,
      lang: voice.lang,
      source: 'system'
    });

    if (!isChineseVoice(voice)) {
      continue;
    }

    const variants = pickVariantsForVoice(voice);
    for (const variant of variants) {
      options.push({
        id: `${voice.voiceURI}::${variant.key}`,
        name: `中文·${variant.label}｜${voice.name}`,
        voiceURI: voice.voiceURI,
        baseName: voice.name,
        lang: voice.lang,
        source: 'zh-enhanced',
        overrides: {
          rateMultiplier: variant.rateMultiplier,
          pitchOffset: variant.pitchOffset,
          volumeMultiplier: variant.volumeMultiplier,
          prosodyStyle: variant.prosodyStyle || 'standard',
          emotionIntensity: variant.emotionIntensity || 0
        }
      });
    }
  }

  return options.sort((a, b) => {
    if (a.source === b.source) return a.name.localeCompare(b.name, 'zh-Hans-CN');
    if (a.source === 'zh-enhanced') return -1;
    if (b.source === 'zh-enhanced') return 1;
    return 0;
  });
}

async function loadSettings() {
  const { [SETTINGS_KEY]: saved } = await chrome.storage.local.get(SETTINGS_KEY);
  if (!saved) return;

  rateInput.value = saved.rate ?? '1';
  pitchInput.value = saved.pitch ?? '1';
  volumeInput.value = saved.volume ?? '1';
  rateValue.textContent = Number(rateInput.value).toFixed(1);
  pitchValue.textContent = Number(pitchInput.value).toFixed(1);
  volumeValue.textContent = Number(volumeInput.value).toFixed(1);
}

async function persistSettings() {
  const settings = {
    voiceOptionId: voiceSelect.value,
    voiceURI: voiceOptionMap.get(voiceSelect.value)?.voiceURI || voiceSelect.value,
    rate: Number(rateInput.value),
    pitch: Number(pitchInput.value),
    volume: Number(volumeInput.value)
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function loadVoices() {
  try {
    const tab = await getCurrentTab();
    const response = await sendMessage(tab, { type: 'GET_VOICES' });
    const voices = response?.voices ?? [];

    voiceSelect.innerHTML = '';
    voiceOptionMap.clear();

    if (!voices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '未检测到声音';
      voiceSelect.appendChild(option);
      setStatus('当前页面未返回可用声音，稍后重试', true);
      return;
    }

    const options = buildVoiceOptions(voices);
    for (const voiceOption of options) {
      voiceOptionMap.set(voiceOption.id, voiceOption);
      const option = document.createElement('option');
      option.value = voiceOption.id;
      option.textContent = voiceOption.name;
      voiceSelect.appendChild(option);
    }

    const enhancedCount = options.filter((item) => item.source === 'zh-enhanced').length;

    const { [SETTINGS_KEY]: saved } = await chrome.storage.local.get(SETTINGS_KEY);
    if (saved?.voiceOptionId && voiceOptionMap.has(saved.voiceOptionId)) {
      voiceSelect.value = saved.voiceOptionId;
    } else if (saved?.voiceURI && voiceOptionMap.has(saved.voiceURI)) {
      voiceSelect.value = saved.voiceURI;
    }

    setStatus(`已加载 ${voices.length} 个基础声音 + ${enhancedCount} 个中文增强音色`);
  } catch (error) {
    const tab = await getCurrentTab().catch(() => ({ url: '' }));
    setStatus(`加载声音失败：${formatMessagingError(error, tab)}`, true);
  }
}

function wireRange(input, label) {
  input.addEventListener('input', () => {
    label.textContent = Number(input.value).toFixed(1);
    persistSettings();
  });
}

async function onRead() {
  try {
    const tab = await getCurrentTab();
    await persistSettings();

    const selectedOption = voiceOptionMap.get(voiceSelect.value);

    const result = await sendMessage(tab, {
      type: 'READ_PAGE',
      payload: {
        voiceURI: selectedOption?.voiceURI || voiceSelect.value,
        voiceName: selectedOption?.name || '',
        overrides: selectedOption?.overrides || null,
        rate: Number(rateInput.value),
        pitch: Number(pitchInput.value),
        volume: Number(volumeInput.value)
      }
    });

    if (result?.ok) {
      setStatus(`开始朗读，共 ${result.length} 个字符`);
    } else {
      setStatus(result?.message || '朗读失败', true);
    }
  } catch (error) {
    const tab = await getCurrentTab().catch(() => ({ url: '' }));
    setStatus(`朗读失败：${formatMessagingError(error, tab)}`, true);
  }
}

function shouldRetryWithInjection(error) {
  const message = String(error?.message || error || '');
  return message.includes('Receiving end does not exist');
}

function formatMessagingError(error, tab) {
  if (shouldRetryWithInjection(error) && !isInjectableUrl(tab.url)) {
    return '当前页面不支持朗读（例如 chrome://、扩展页、新标签页或 PDF 预览）。请切换到普通网页后重试。';
  }
  return error?.message || String(error);
}

async function sendMessage(tab, payload) {
  try {
    return await chrome.tabs.sendMessage(tab.id, payload);
  } catch (error) {
    if (!shouldRetryWithInjection(error)) {
      throw error;
    }

    if (!isInjectableUrl(tab.url)) {
      throw error;
    }

    await injectContentScript(tab.id);
    return chrome.tabs.sendMessage(tab.id, payload);
  }
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function onPauseResume() {
  try {
    const tab = await getCurrentTab();
    const result = await sendMessage(tab, { type: 'TOGGLE_PAUSE' });
    setStatus(result?.message || '已切换状态');
  } catch (error) {
    const tab = await getCurrentTab().catch(() => ({ url: '' }));
    setStatus(`操作失败：${formatMessagingError(error, tab)}`, true);
  }
}

async function onStop() {
  try {
    const tab = await getCurrentTab();
    const result = await sendMessage(tab, { type: 'STOP_READING' });
    setStatus(result?.message || '已停止');
  } catch (error) {
    const tab = await getCurrentTab().catch(() => ({ url: '' }));
    setStatus(`停止失败：${formatMessagingError(error, tab)}`, true);
  }
}

async function init() {
  await loadSettings();
  await loadVoices();

  wireRange(rateInput, rateValue);
  wireRange(pitchInput, pitchValue);
  wireRange(volumeInput, volumeValue);

  voiceSelect.addEventListener('change', persistSettings);
  document.getElementById('readBtn').addEventListener('click', onRead);
  document.getElementById('pauseBtn').addEventListener('click', onPauseResume);
  document.getElementById('stopBtn').addEventListener('click', onStop);
}

init();
