const voiceSelect = document.getElementById('voiceSelect');
const rateInput = document.getElementById('rate');
const pitchInput = document.getElementById('pitch');
const volumeInput = document.getElementById('volume');
const rateValue = document.getElementById('rateValue');
const pitchValue = document.getElementById('pitchValue');
const volumeValue = document.getElementById('volumeValue');
const statusEl = document.getElementById('status');

const SETTINGS_KEY = 'ttsSettings';

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

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
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
    voiceURI: voiceSelect.value,
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
    if (!voices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '未检测到声音';
      voiceSelect.appendChild(option);
      setStatus('当前页面未返回可用声音，稍后重试', true);
      return;
    }

    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' - 默认' : ''}`;
      voiceSelect.appendChild(option);
    }

    const { [SETTINGS_KEY]: saved } = await chrome.storage.local.get(SETTINGS_KEY);
    if (saved?.voiceURI && voices.some(v => v.voiceURI === saved.voiceURI)) {
      voiceSelect.value = saved.voiceURI;
    }

    setStatus(`已加载 ${voices.length} 个声音`);
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

    const result = await sendMessage(tab, {
      type: 'READ_PAGE',
      payload: {
        voiceURI: voiceSelect.value,
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
