const sourceLangEl = document.getElementById('sourceLang');
const targetLangEl = document.getElementById('targetLang');
const translateBtn = document.getElementById('translateBtn');
const statusEl = document.getElementById('status');

const STORAGE_KEY = 'translate_settings';

async function restoreSettings() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = data[STORAGE_KEY] || {};
  sourceLangEl.value = settings.sourceLang || 'auto';
  targetLangEl.value = settings.targetLang || 'zh-CN';
}

async function saveSettings() {
  await chrome.storage.sync.set({
    [STORAGE_KEY]: {
      sourceLang: sourceLangEl.value,
      targetLang: targetLangEl.value
    }
  });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b91c1c' : '#1f2937';
}

async function translatePage() {
  translateBtn.disabled = true;
  setStatus('正在翻译，请稍候...');

  try {
    await saveSettings();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error('未找到当前标签页');
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'TRANSLATE_PAGE',
      sourceLang: sourceLangEl.value,
      targetLang: targetLangEl.value
    });

    if (!response?.ok) {
      throw new Error(response?.error || '翻译失败');
    }

    setStatus('翻译完成，页面已显示译文。');
  } catch (error) {
    setStatus(error.message || '翻译失败，请重试。', true);
  } finally {
    translateBtn.disabled = false;
  }
}

translateBtn.addEventListener('click', translatePage);
restoreSettings();
