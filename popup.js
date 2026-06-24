// ============================================================
// AudioReading Popup - Multi-backend voice management
// ============================================================

// ---- DOM refs ----
const voiceListEl = document.getElementById('voiceList');
const rateInput = document.getElementById('rate');
const pitchInput = document.getElementById('pitch');
const volumeInput = document.getElementById('volume');
const emotionInput = document.getElementById('emotion');
const readingStyleSelect = document.getElementById('readingStyle');
const rateValue = document.getElementById('rateValue');
const pitchValue = document.getElementById('pitchValue');
const volumeValue = document.getElementById('volumeValue');
const emotionValue = document.getElementById('emotionValue');
const statusEl = document.getElementById('status');
const favoritesSection = document.getElementById('favoritesSection');
const favoritesListEl = document.getElementById('favoritesList');
const tabBtns = document.querySelectorAll('.tab-btn');
const settingsPanel = document.getElementById('settingsPanel');
const toggleSettingsBtn = document.getElementById('toggleSettings');
const cloudConfigSection = document.getElementById('cloudConfigSection');
const cloudTtsUrlInput = document.getElementById('cloudTtsUrl');
const cloudTtsApiKeyInput = document.getElementById('cloudTtsApiKey');
const cloudStatusEl = document.getElementById('cloudStatus');
const testCloudBtn = document.getElementById('testCloudBtn');
const voiceCountEl = document.getElementById('voiceCount');
const voiceSearchInput = document.getElementById('voiceSearch');

const SETTINGS_KEY = 'ttsSettings';
const FAVORITES_KEY = 'ttsFavorites';
const CLOUD_CONFIG_KEY = 'ttsCloudConfig';
const voiceOptionMap = new Map();
let currentTab = 'system';
let allSystemVoices = [];
let selectedVoiceId = null;
let isPreviewPlaying = false;

// ============================================================
// Natural Voice Catalog — StreamElements (Polly + Google WaveNet + Azure)
// All voices share the same API: GET /kappa/v2/speech?voice=X&text=Y
// Free, no API key required, 12 Chinese voices + 50+ languages
// ============================================================

const EDGE_VOICES = [
  // ---- 🇨🇳 中文（普通话）Polly ----
  { id: 'Zhiyu', name: 'Zhiyu', lang: 'zh-CN', gender: 'female', label: 'Zhiyu（女·自然·Polly）', provider: 'polly', quality: 'premium' },

  // ---- 🇨🇳 中文（普通话）Google WaveNet ----
  { id: 'cmn-CN-Wavenet-A', name: 'Li Na', lang: 'zh-CN', gender: 'female', label: 'Li Na（女·温柔·WaveNet）', provider: 'google', quality: 'premium' },
  { id: 'cmn-CN-Wavenet-B', name: 'Wang', lang: 'zh-CN', gender: 'male', label: 'Wang（男·稳重·WaveNet）', provider: 'google', quality: 'premium' },
  { id: 'cmn-CN-Wavenet-C', name: 'Bai', lang: 'zh-CN', gender: 'male', label: 'Bai（男·标准·WaveNet）', provider: 'google', quality: 'premium' },
  { id: 'cmn-CN-Wavenet-D', name: 'Mingli', lang: 'zh-CN', gender: 'female', label: 'Mingli（女·清晰·WaveNet）', provider: 'google', quality: 'premium' },

  // ---- 🇨🇳 中文（普通话）Azure ----
  { id: 'Huihui', name: 'Huihui', lang: 'zh-CN', gender: 'female', label: 'Huihui（女·标准·Azure）', provider: 'azure', quality: 'premium' },
  { id: 'Yaoyao', name: 'Yaoyao', lang: 'zh-CN', gender: 'female', label: 'Yaoyao（女·甜美·Azure）', provider: 'azure', quality: 'premium' },
  { id: 'Kangkang', name: 'Kangkang', lang: 'zh-CN', gender: 'male', label: 'Kangkang（男·标准·Azure）', provider: 'azure', quality: 'premium' },

  // ---- 🇹🇼 中文（台湾国语）Azure ----
  { id: 'HanHan', name: 'HanHan', lang: 'zh-TW', gender: 'female', label: 'HanHan（女·台湾腔·Azure）', provider: 'azure', quality: 'premium' },
  { id: 'Zhiwei', name: 'Zhiwei', lang: 'zh-TW', gender: 'male', label: 'Zhiwei（男·台湾腔·Azure）', provider: 'azure', quality: 'premium' },

  // ---- 🇭🇰 中文（粤语）Azure ----
  { id: 'Tracy', name: 'Tracy', lang: 'zh-HK', gender: 'female', label: 'Tracy（女·粤语·Azure）', provider: 'azure', quality: 'premium' },
  { id: 'Danny', name: 'Danny', lang: 'zh-HK', gender: 'male', label: 'Danny（男·粤语·Azure）', provider: 'azure', quality: 'premium' },

  // ---- English (US) ----
  { id: 'Joanna', name: 'Joanna', lang: 'en-US', gender: 'female', label: 'Joanna (US·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Matthew', name: 'Matthew', lang: 'en-US', gender: 'male', label: 'Matthew (US·男·神经)', style: 'neural', quality: 'premium' },
  { id: 'Joey', name: 'Joey', lang: 'en-US', gender: 'male', label: 'Joey (US·男·神经)', style: 'neural', quality: 'premium' },
  { id: 'Kendra', name: 'Kendra', lang: 'en-US', gender: 'female', label: 'Kendra (US·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Ivy', name: 'Ivy', lang: 'en-US', gender: 'female', label: 'Ivy (US·女·童声)', style: 'neural', quality: 'premium' },
  { id: 'Kimberly', name: 'Kimberly', lang: 'en-US', gender: 'female', label: 'Kimberly (US·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Salli', name: 'Salli', lang: 'en-US', gender: 'female', label: 'Salli (US·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Justin', name: 'Justin', lang: 'en-US', gender: 'male', label: 'Justin (US·男·童声)', style: 'neural', quality: 'premium' },

  // ---- English (UK) ----
  { id: 'Amy', name: 'Amy', lang: 'en-GB', gender: 'female', label: 'Amy (UK·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Emma', name: 'Emma', lang: 'en-GB', gender: 'female', label: 'Emma (UK·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Brian', name: 'Brian', lang: 'en-GB', gender: 'male', label: 'Brian (UK·男·神经)', style: 'neural', quality: 'premium' },

  // ---- English (AU) ----
  { id: 'Nicole', name: 'Nicole', lang: 'en-AU', gender: 'female', label: 'Nicole (AU·女)', style: 'standard', quality: 'standard' },
  { id: 'Russell', name: 'Russell', lang: 'en-AU', gender: 'male', label: 'Russell (AU·男)', style: 'standard', quality: 'standard' },

  // ---- English (IN) ----
  { id: 'Raveena', name: 'Raveena', lang: 'en-IN', gender: 'female', label: 'Raveena (IN·女)', style: 'standard', quality: 'standard' },
  { id: 'Aditi', name: 'Aditi', lang: 'en-IN', gender: 'female', label: 'Aditi (IN·女)', style: 'standard', quality: 'standard' },

  // ---- Japanese ----
  { id: 'Mizuki', name: 'Mizuki', lang: 'ja-JP', gender: 'female', label: 'Mizuki（日文·女·神经）', style: 'neural', quality: 'premium' },
  { id: 'Takumi', name: 'Takumi', lang: 'ja-JP', gender: 'male', label: 'Takumi（日文·男·神经）', style: 'neural', quality: 'premium' },

  // ---- Korean ----
  { id: 'Seoyeon', name: 'Seoyeon', lang: 'ko-KR', gender: 'female', label: 'Seoyeon（韩文·女·神经）', style: 'neural', quality: 'premium' },

  // ---- French ----
  { id: 'Lea', name: 'Lea', lang: 'fr-FR', gender: 'female', label: 'Léa (FR·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Celine', name: 'Celine', lang: 'fr-FR', gender: 'female', label: 'Céline (FR·女)', style: 'standard', quality: 'standard' },
  { id: 'Mathieu', name: 'Mathieu', lang: 'fr-FR', gender: 'male', label: 'Mathieu (FR·男)', style: 'standard', quality: 'standard' },

  // ---- German ----
  { id: 'Vicki', name: 'Vicki', lang: 'de-DE', gender: 'female', label: 'Vicki (DE·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Marlene', name: 'Marlene', lang: 'de-DE', gender: 'female', label: 'Marlene (DE·女)', style: 'standard', quality: 'standard' },
  { id: 'Hans', name: 'Hans', lang: 'de-DE', gender: 'male', label: 'Hans (DE·男)', style: 'standard', quality: 'standard' },

  // ---- Spanish ----
  { id: 'Lucia', name: 'Lucia', lang: 'es-ES', gender: 'female', label: 'Lucía (ES·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Conchita', name: 'Conchita', lang: 'es-ES', gender: 'female', label: 'Conchita (ES·女)', style: 'standard', quality: 'standard' },
  { id: 'Enrique', name: 'Enrique', lang: 'es-ES', gender: 'male', label: 'Enrique (ES·男)', style: 'standard', quality: 'standard' },
  { id: 'Mia', name: 'Mia', lang: 'es-MX', gender: 'female', label: 'Mia (MX·女)', style: 'standard', quality: 'standard' },
  { id: 'Miguel', name: 'Miguel', lang: 'es-US', gender: 'male', label: 'Miguel (US西·男)', style: 'standard', quality: 'standard' },
  { id: 'Penelope', name: 'Penelope', lang: 'es-US', gender: 'female', label: 'Penélope (US西·女)', style: 'standard', quality: 'standard' },

  // ---- Portuguese ----
  { id: 'Vitoria', name: 'Vitoria', lang: 'pt-BR', gender: 'female', label: 'Vitória (BR·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Camila', name: 'Camila', lang: 'pt-BR', gender: 'female', label: 'Camila (BR·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Ricardo', name: 'Ricardo', lang: 'pt-BR', gender: 'male', label: 'Ricardo (BR·男)', style: 'standard', quality: 'standard' },
  { id: 'Ines', name: 'Ines', lang: 'pt-PT', gender: 'female', label: 'Inês (PT·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Cristiano', name: 'Cristiano', lang: 'pt-PT', gender: 'male', label: 'Cristiano (PT·男)', style: 'standard', quality: 'standard' },

  // ---- Italian ----
  { id: 'Carla', name: 'Carla', lang: 'it-IT', gender: 'female', label: 'Carla (IT·女·神经)', style: 'neural', quality: 'premium' },
  { id: 'Bianca', name: 'Bianca', lang: 'it-IT', gender: 'female', label: 'Bianca (IT·女)', style: 'standard', quality: 'standard' },
  { id: 'Giorgio', name: 'Giorgio', lang: 'it-IT', gender: 'male', label: 'Giorgio (IT·男)', style: 'standard', quality: 'standard' },

  // ---- Russian ----
  { id: 'Tatyana', name: 'Tatyana', lang: 'ru-RU', gender: 'female', label: 'Татьяна (RU·女)', style: 'standard', quality: 'standard' },
  { id: 'Maxim', name: 'Maxim', lang: 'ru-RU', gender: 'male', label: 'Максим (RU·男)', style: 'standard', quality: 'standard' },

  // ---- Dutch ----
  { id: 'Lotte', name: 'Lotte', lang: 'nl-NL', gender: 'female', label: 'Lotte (NL·女)', style: 'standard', quality: 'standard' },
  { id: 'Ruben', name: 'Ruben', lang: 'nl-NL', gender: 'male', label: 'Ruben (NL·男)', style: 'standard', quality: 'standard' },

  // ---- Polish ----
  { id: 'Ewa', name: 'Ewa', lang: 'pl-PL', gender: 'female', label: 'Ewa (PL·女)', style: 'standard', quality: 'standard' },
  { id: 'Jacek', name: 'Jacek', lang: 'pl-PL', gender: 'male', label: 'Jacek (PL·男)', style: 'standard', quality: 'standard' },

  // ---- Turkish ----
  { id: 'Filiz', name: 'Filiz', lang: 'tr-TR', gender: 'female', label: 'Filiz (TR·女)', style: 'standard', quality: 'standard' },

  // ---- Swedish ----
  { id: 'Astrid', name: 'Astrid', lang: 'sv-SE', gender: 'female', label: 'Astrid (SE·女)', style: 'standard', quality: 'standard' },

  // ---- Danish ----
  { id: 'Naja', name: 'Naja', lang: 'da-DK', gender: 'female', label: 'Naja (DK·女)', style: 'standard', quality: 'standard' },
  { id: 'Mads', name: 'Mads', lang: 'da-DK', gender: 'male', label: 'Mads (DK·男)', style: 'standard', quality: 'standard' },

  // ---- Norwegian ----
  { id: 'Liv', name: 'Liv', lang: 'nb-NO', gender: 'female', label: 'Liv (NO·女)', style: 'standard', quality: 'standard' },

  // ---- Welsh ----
  { id: 'Gwyneth', name: 'Gwyneth', lang: 'cy-GB', gender: 'female', label: 'Gwyneth (CY·女)', style: 'standard', quality: 'standard' },

  // ---- Arabic ----
  { id: 'Zeina', name: 'Zeina', lang: 'ar-SA', gender: 'female', label: 'Zeina (AR·女)', style: 'standard', quality: 'standard' },
];

// Group Edge voices by language for display
function groupEdgeVoicesByLang() {
  const groups = {};
  for (const v of EDGE_VOICES) {
    // Separate Chinese dialects
    let langKey;
    if (v.lang === 'zh-TW') langKey = 'zh-TW';
    else if (v.lang === 'zh-HK') langKey = 'zh-HK';
    else langKey = v.lang.split('-')[0];
    if (!groups[langKey]) groups[langKey] = [];
    groups[langKey].push(v);
  }
  return groups;
}

// ============================================================
// Status helpers
// ============================================================

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

// ============================================================
// System voice helpers
// ============================================================

function isChineseVoice(voice) {
  if (!voice) return false;
  const lang = String(voice.lang || '').toLowerCase();
  if (lang.startsWith('zh')) return true;
  return /chinese|mandarin|cantonese|粤语|普通话|中文/.test(String(voice.name || '').toLowerCase());
}

// ============================================================
// Voice card rendering
// ============================================================

function getGenderIcon(gender) {
  return gender === 'female' ? '♀' : gender === 'male' ? '♂' : '';
}

function getQualityBadge(quality) {
  if (quality === 'premium') return '<span class="badge badge-premium">Premium</span>';
  return '';
}

const PROVIDER_BADGES = {
  polly: '<span class="badge badge-edge">Polly</span>',
  google: '<span class="badge badge-edge badge-google">WaveNet</span>',
  azure: '<span class="badge badge-edge badge-azure">Azure</span>',
};

function getSourceBadge(source, voiceData) {
  if (source === 'edge' && voiceData?.provider) {
    return PROVIDER_BADGES[voiceData.provider] || '<span class="badge badge-edge">自然</span>';
  }
  if (source === 'edge') return '<span class="badge badge-edge">自然</span>';
  if (source === 'cloud') return '<span class="badge badge-cloud">Cloud</span>';
  return '<span class="badge badge-system">系统</span>';
}

function renderVoiceCard(voiceData, source, isFavorite = false) {
  const isSelected = selectedVoiceId === voiceData.id;
  const card = document.createElement('div');
  card.className = `voice-card${isSelected ? ' selected' : ''}`;
  card.dataset.voiceId = voiceData.id;
  card.dataset.source = source;
  card.dataset.voiceData = JSON.stringify(voiceData);

  const langDisplay = voiceData.lang || '';
  const genderEmoji = voiceData.gender === 'female' ? '👩' : voiceData.gender === 'male' ? '👨' : '';

  card.innerHTML = `
    <div class="voice-card-main">
      <div class="voice-card-info">
        <span class="voice-card-name">${genderEmoji} ${voiceData.label || voiceData.name}</span>
        <span class="voice-card-lang">${langDisplay}</span>
      </div>
      <div class="voice-card-badges">
        ${getSourceBadge(source, voiceData)}
        ${voiceData.quality ? getQualityBadge(voiceData.quality) : ''}
      </div>
    </div>
    <div class="voice-card-actions">
      <button class="btn-icon btn-preview" title="试听" data-action="preview" data-voice-id="${voiceData.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <button class="btn-icon btn-fav ${isFavorite ? 'active' : ''}" title="${isFavorite ? '取消收藏' : '收藏'}" data-action="favorite" data-voice-id="${voiceData.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </button>
    </div>
  `;

  // Click on card to select
  card.querySelector('.voice-card-main').addEventListener('click', () => {
    selectVoice(voiceData, source);
  });

  // Preview button
  card.querySelector('[data-action="preview"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await previewVoice(voiceData, source, card);
  });

  // Favorite button
  card.querySelector('[data-action="favorite"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleFavorite(voiceData, source, card);
  });

  return card;
}

async function selectVoice(voiceData, source) {
  selectedVoiceId = voiceData.id;
  voiceOptionMap.set(voiceData.id, { ...voiceData, source });

  // Update visual selection
  document.querySelectorAll('.voice-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.voiceId === voiceData.id);
  });

  await persistSettings();
}

// ============================================================
// Voice preview
// ============================================================

async function previewVoice(voiceData, source, cardElement) {
  if (isPreviewPlaying) {
    setStatus('请等待当前试听结束', true);
    return;
  }

  isPreviewPlaying = true;
  const previewBtn = cardElement?.querySelector('[data-action="preview"]');
  if (previewBtn) {
    previewBtn.classList.add('playing');
    previewBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3"/><circle cx="12" cy="12" r="6"/></svg>';
  }

  const sampleTexts = {
    'zh': '你好，这是一段自然语音预览。天气晴朗，微风徐徐，适合出门散步。',
    'zh-CN': '你好，这是一段自然语音预览。天气晴朗，微风徐徐，适合出门散步。',
    'zh-TW': '你好，這是一段台灣國語的自然語音預覽。今天天氣很好，適合出去走走。',
    'zh-HK': '你好，呢段係粵語嘅自然語音預覽。今日天氣好好，好適合出去行下。',
    'ja': 'こんにちは、これは自然な音声プレビューです。',
    'ko': '안녕하세요, 자연스러운 음성 미리보기입니다.',
    'en': 'Hello, this is a natural voice preview. The weather is lovely today.',
    'fr': 'Bonjour, ceci est un aperçu vocal naturel.',
    'de': 'Hallo, dies ist eine natürliche Sprachvorschau.',
    'es': 'Hola, esta es una vista previa de voz natural.',
    'pt': 'Olá, esta é uma pré-visualização de voz natural.',
    'it': 'Ciao, questa è un\'anteprima vocale naturale.',
    'ru': 'Здравствуйте, это предварительный просмотр естественного голоса.',
    'ar': 'مرحباً، هذه معاينة صوتية طبيعية.',
    'nl': 'Hallo, dit is een natuurlijke stemvoorbeeld.',
    'pl': 'Cześć, to jest naturalny podgląd głosu.',
    'tr': 'Merhaba, bu doğal bir ses önizlemesidir.',
    'sv': 'Hej, detta är en naturlig röstförhandsgranskning.',
    'da': 'Hej, dette er en naturlig stemmeeksempel.',
    'nb': 'Hei, dette er en naturlig stemmeforhåndsvisning.',
    'cy': 'Helo, dymagolwg llais naturiol.'
  };

  const lang = (voiceData.lang || 'zh');
  // For zh-TW / zh-HK, use the full locale code to get the right sample text
  const langKey = (lang === 'zh-TW' || lang === 'zh-HK') ? lang : lang.split('-')[0];
  const sampleText = sampleTexts[langKey] || sampleTexts[lang.split('-')[0]] || sampleTexts['zh'];

  try {
    if (source === 'edge') {
      const tab = await getCurrentTab();
      const result = await sendMessage(tab, {
        type: 'PREVIEW_EDGE_VOICE',
        payload: { voiceName: voiceData.id, sampleText }
      });

      if (!result?.ok) {
        setStatus(`试听失败：${result?.message || '未知错误'}`, true);
      } else {
        setStatus(`正在试听 ${voiceData.label || voiceData.name}`);
      }
    } else if (source === 'system') {
      // For system voices, use speechSynthesis in popup if available
      if (typeof speechSynthesis !== 'undefined') {
        const utterance = new SpeechSynthesisUtterance(sampleText);
        const voices = speechSynthesis.getVoices();
        const match = voices.find((v) => v.voiceURI === voiceData.voiceURI);
        if (match) utterance.voice = match;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        await new Promise((resolve) => {
          utterance.onend = resolve;
          utterance.onerror = resolve;
          speechSynthesis.speak(utterance);
        });
      }
      setStatus(`正在试听 ${voiceData.label || voiceData.name}`);
    }
  } catch (err) {
    const tab = await getCurrentTab().catch(() => ({ url: '' }));
    setStatus(`试听失败：${formatMessagingError(err, tab)}`, true);
  }

  // Reset preview button after a short delay
  setTimeout(() => {
    isPreviewPlaying = false;
    if (previewBtn) {
      previewBtn.classList.remove('playing');
      previewBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
  }, 1500);
}

// ============================================================
// Favorites
// ============================================================

async function getFavorites() {
  const { [FAVORITES_KEY]: favs } = await chrome.storage.local.get(FAVORITES_KEY);
  return favs || [];
}

async function toggleFavorite(voiceData, source, cardElement) {
  const favs = await getFavorites();
  const idx = favs.findIndex((f) => f.id === voiceData.id && f.source === source);

  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.unshift({ ...voiceData, source });
  }

  await chrome.storage.local.set({ [FAVORITES_KEY]: favs });

  // Update card button
  const favBtn = cardElement?.querySelector('[data-action="favorite"]');
  if (favBtn) {
    const isFav = idx < 0;
    favBtn.classList.toggle('active', isFav);
    const svg = favBtn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
    favBtn.title = isFav ? '取消收藏' : '收藏';
  }

  renderFavorites();
}

function renderFavorites() {
  getFavorites().then((favs) => {
    if (!favs.length) {
      favoritesSection.style.display = 'none';
      return;
    }

    favoritesSection.style.display = 'block';
    favoritesListEl.innerHTML = '';

    for (const fav of favs.slice(0, 6)) {
      const tag = document.createElement('span');
      tag.className = 'fav-tag';
      tag.textContent = fav.label || fav.name;
      tag.title = `${fav.lang || ''} · ${fav.source}`;
      tag.addEventListener('click', () => {
        selectVoice(fav, fav.source);
        // Switch to the correct tab
        if (fav.source === 'edge' && currentTab !== 'edge') {
          switchTab('edge');
        } else if (fav.source === 'system' && currentTab !== 'system') {
          switchTab('system');
        } else if (fav.source === 'cloud' && currentTab !== 'cloud') {
          switchTab('cloud');
        }
      });
      favoritesListEl.appendChild(tag);
    }
  });
}

// ============================================================
// Tab switching
// ============================================================

function switchTab(tab) {
  currentTab = tab;
  tabBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  voiceSearchInput.value = '';

  // Show/hide cloud config
  cloudConfigSection.style.display = tab === 'cloud' ? 'block' : 'none';

  renderVoiceList();
}

// ============================================================
// Voice list rendering
// ============================================================

async function renderVoiceList() {
  const searchTerm = voiceSearchInput.value.toLowerCase().trim();

  voiceListEl.innerHTML = '';
  const favorites = await getFavorites();
  const favIds = new Set(favorites.map((f) => `${f.source}:${f.id}`));

  if (currentTab === 'system') {
    renderSystemVoices(searchTerm, favIds);
  } else if (currentTab === 'edge') {
    renderEdgeVoices(searchTerm, favIds);
  } else if (currentTab === 'cloud') {
    renderCloudVoices(searchTerm, favIds);
  }

  updateVoiceCount();
}

function updateVoiceCount() {
  const count = voiceListEl.querySelectorAll('.voice-card').length;
  voiceCountEl.textContent = `${count} 个声音`;
}

function renderSystemVoices(searchTerm, favIds) {
  let voices = allSystemVoices;

  if (searchTerm) {
    voices = voices.filter((v) =>
      v.name.toLowerCase().includes(searchTerm) ||
      v.lang.toLowerCase().includes(searchTerm)
    );
  }

  if (!voices.length) {
    voiceListEl.innerHTML = '<div class="empty-hint">未找到匹配的声音</div>';
    updateVoiceCount();
    return;
  }

  for (const voice of voices) {
    const voiceData = {
      id: voice.voiceURI,
      name: voice.name,
      label: `${voice.name} (${voice.lang})${voice.default ? ' · 默认' : ''}`,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
      gender: isChineseVoice(voice) && /female|woman|女/i.test(voice.name) ? 'female' :
              isChineseVoice(voice) && /male|man|男/i.test(voice.name) ? 'male' : ''
    };
    const isFav = favIds.has(`system:${voiceData.id}`);
    voiceListEl.appendChild(renderVoiceCard(voiceData, 'system', isFav));
  }
}

function renderEdgeVoices(searchTerm, favIds) {
  let voices = EDGE_VOICES;

  if (searchTerm) {
    voices = voices.filter((v) =>
      v.label.toLowerCase().includes(searchTerm) ||
      v.name.toLowerCase().includes(searchTerm) ||
      v.lang.toLowerCase().includes(searchTerm) ||
      v.id.toLowerCase().includes(searchTerm)
    );
  }

  if (!voices.length) {
    voiceListEl.innerHTML = '<div class="empty-hint">未找到匹配的声音</div>';
    updateVoiceCount();
    return;
  }

  // Group by language (with dialect separation)
  const groups = {};
  for (const v of voices) {
    // Group zh-CN/zh-TW/zh-HK separately
    let langKey;
    if (v.lang === 'zh-TW') langKey = 'zh-TW';
    else if (v.lang === 'zh-HK') langKey = 'zh-HK';
    else langKey = v.lang.split('-')[0];

    if (!groups[langKey]) groups[langKey] = [];
    groups[langKey].push(v);
  }

  const langNames = {
    'zh': '中文（普通话）', 'zh-TW': '中文（台湾国语）', 'zh-HK': '中文（粤语）',
    'en': 'English', 'ja': '日本語', 'ko': '한국어',
    'fr': 'Français', 'de': 'Deutsch', 'es': 'Español',
    'pt': 'Português', 'it': 'Italiano', 'ru': 'Русский', 'ar': 'العربية',
    'nl': 'Nederlands', 'pl': 'Polski', 'tr': 'Türkçe',
    'sv': 'Svenska', 'da': 'Dansk', 'nb': 'Norsk', 'cy': 'Cymraeg'
  };

  for (const [langKey, langVoices] of Object.entries(groups)) {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'voice-group-header';
    groupHeader.textContent = `${langNames[langKey] || langKey} (${langVoices.length})`;
    voiceListEl.appendChild(groupHeader);

    for (const v of langVoices) {
      const voiceData = {
        id: v.id,
        name: v.name,
        label: v.label,
        lang: v.lang,
        gender: v.gender,
        quality: v.quality,
        style: v.style,
        provider: v.provider || 'polly'
      };
      const isFav = favIds.has(`edge:${voiceData.id}`);
      voiceListEl.appendChild(renderVoiceCard(voiceData, 'edge', isFav));
    }
  }
}

function renderCloudVoices(searchTerm, favIds) {
  if (!cloudTtsUrlInput.value.trim()) {
    voiceListEl.innerHTML = '<div class="empty-hint">请先配置云端 TTS 服务地址</div>';
    updateVoiceCount();
    return;
  }

  voiceListEl.innerHTML = '<div class="empty-hint">配置完成后，点击"测试连接"获取云端声音列表</div>';
  updateVoiceCount();
}

// ============================================================
// Settings persistence
// ============================================================

async function loadSettings() {
  const { [SETTINGS_KEY]: saved } = await chrome.storage.local.get(SETTINGS_KEY);
  if (!saved) return;

  rateInput.value = saved.rate ?? '1';
  pitchInput.value = saved.pitch ?? '1';
  volumeInput.value = saved.volume ?? '1';
  emotionInput.value = saved.emotion ?? '0.8';
  readingStyleSelect.value = saved.readingStyle || 'standard';
  rateValue.textContent = Number(rateInput.value).toFixed(1);
  pitchValue.textContent = Number(pitchInput.value).toFixed(1);
  volumeValue.textContent = Number(volumeInput.value).toFixed(1);
  emotionValue.textContent = Number(emotionInput.value).toFixed(1);

  if (saved.selectedVoiceId) selectedVoiceId = saved.selectedVoiceId;
}

async function loadCloudConfig() {
  const { [CLOUD_CONFIG_KEY]: config } = await chrome.storage.local.get(CLOUD_CONFIG_KEY);
  if (config) {
    cloudTtsUrlInput.value = config.url || '';
    cloudTtsApiKeyInput.value = config.apiKey || '';
  }
}

async function persistSettings() {
  const voiceData = voiceOptionMap.get(selectedVoiceId);
  const settings = {
    selectedVoiceId,
    voiceSource: voiceData?.source || currentTab,
    voiceURI: voiceData?.voiceURI || selectedVoiceId,
    edgeVoiceName: voiceData?.id || '',
    cloudVoiceId: voiceData?.id || '',
    rate: Number(rateInput.value),
    pitch: Number(pitchInput.value),
    volume: Number(volumeInput.value),
    emotion: Number(emotionInput.value),
    readingStyle: readingStyleSelect.value
  };

  if (voiceData?.source === 'cloud') {
    settings.cloudTtsUrl = cloudTtsUrlInput.value.trim();
    settings.cloudTtsApiKey = cloudTtsApiKeyInput.value.trim();
  }

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function persistCloudConfig() {
  await chrome.storage.local.set({
    [CLOUD_CONFIG_KEY]: {
      url: cloudTtsUrlInput.value.trim(),
      apiKey: cloudTtsApiKeyInput.value.trim()
    }
  });
}

// ============================================================
// System voice loading
// ============================================================

async function loadSystemVoices() {
  try {
    const tab = await getCurrentTab();
    const response = await sendMessage(tab, { type: 'GET_VOICES' });
    allSystemVoices = response?.voices ?? [];

    if (allSystemVoices.length) {
      // Load saved selection
      const { [SETTINGS_KEY]: saved } = await chrome.storage.local.get(SETTINGS_KEY);
      if (saved?.selectedVoiceId) {
        selectedVoiceId = saved.selectedVoiceId;
      }
    }

    return allSystemVoices.length;
  } catch (error) {
    const tab = await getCurrentTab().catch(() => ({ url: '' }));
    setStatus(`加载系统声音失败：${formatMessagingError(error, tab)}`, true);
    return 0;
  }
}

// ============================================================
// Messaging helpers
// ============================================================

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

// ============================================================
// Cloud TTS
// ============================================================

async function testCloudConnection() {
  const url = cloudTtsUrlInput.value.trim();
  if (!url) {
    cloudStatusEl.textContent = '请输入服务地址';
    cloudStatusEl.style.color = '#d64c4c';
    return;
  }

  cloudStatusEl.textContent = '正在连接...';
  cloudStatusEl.style.color = '#4b5563';

  try {
    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      headers: { 'X-API-Key': cloudTtsApiKeyInput.value.trim() }
    });

    if (response.ok) {
      cloudStatusEl.textContent = '连接成功';
      cloudStatusEl.style.color = '#16a34a';
      await persistCloudConfig();
    } else {
      cloudStatusEl.textContent = `连接失败 (${response.status})`;
      cloudStatusEl.style.color = '#d64c4c';
    }
  } catch (err) {
    cloudStatusEl.textContent = `无法连接: ${err.message}`;
    cloudStatusEl.style.color = '#d64c4c';
  }
}

// ============================================================
// Range input wiring
// ============================================================

function wireRange(input, label) {
  input.addEventListener('input', () => {
    label.textContent = Number(input.value).toFixed(1);
    persistSettings();
  });
}

// ============================================================
// Actions
// ============================================================

function getReadSource() {
  const checked = document.querySelector('input[name="readSource"]:checked');
  return checked ? checked.value : 'page';
}

async function onRead() {
  try {
    const tab = await getCurrentTab();
    await persistSettings();

    const voiceData = voiceOptionMap.get(selectedVoiceId);
    const source = voiceData?.source || currentTab;
    const readSource = getReadSource();

    const payload = {
      voiceSource: source,
      voiceURI: voiceData?.voiceURI || selectedVoiceId,
      voiceName: voiceData?.name || '',
      edgeVoiceName: source === 'edge' ? (voiceData?.id || selectedVoiceId) : 'zh-CN-XiaoxiaoNeural',
      overrides: voiceData?.overrides || null,
      rate: Number(rateInput.value),
      pitch: Number(pitchInput.value),
      volume: Number(volumeInput.value),
      emotion: Number(emotionInput.value),
      readingStyle: readingStyleSelect.value,
      cloudTtsUrl: cloudTtsUrlInput.value.trim(),
      cloudTtsApiKey: cloudTtsApiKeyInput.value.trim(),
      cloudVoiceId: voiceData?.id || ''
    };

    const messageType = readSource === 'selection' ? 'READ_SELECTION' : 'READ_PAGE';
    const result = await sendMessage(tab, {
      type: messageType,
      payload
    });

    if (result?.ok) {
      const label = readSource === 'selection' ? '选中文字' : '全文';
      setStatus(`开始朗读${label}，共 ${result.length} 个字符`);
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

// ============================================================
// Init
// ============================================================

async function init() {
  await loadSettings();
  await loadCloudConfig();

  // Load system voices first
  const sysCount = await loadSystemVoices();

  // Render initial voice list
  await renderVoiceList();

  // Switch to saved tab or default
  const { [SETTINGS_KEY]: saved } = await chrome.storage.local.get(SETTINGS_KEY);
  if (saved?.voiceSource) {
    switchTab(saved.voiceSource);
  }

  // Wire range inputs
  wireRange(rateInput, rateValue);
  wireRange(pitchInput, pitchValue);
  wireRange(volumeInput, volumeValue);
  wireRange(emotionInput, emotionValue);

  // Tab buttons
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Settings toggle
  toggleSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('collapsed');
  });

  // Voice search
  voiceSearchInput.addEventListener('input', () => renderVoiceList());

  // Cloud config
  cloudTtsUrlInput.addEventListener('change', persistCloudConfig);
  cloudTtsApiKeyInput.addEventListener('change', persistCloudConfig);
  testCloudBtn.addEventListener('click', testCloudConnection);

  // Reading style change
  readingStyleSelect.addEventListener('change', persistSettings);

  // Action buttons
  document.getElementById('readBtn').addEventListener('click', onRead);
  document.getElementById('pauseBtn').addEventListener('click', onPauseResume);
  document.getElementById('stopBtn').addEventListener('click', onStop);

  // Render favorites
  renderFavorites();

  // Reselect saved voice in UI
  if (selectedVoiceId && voiceOptionMap.has(selectedVoiceId)) {
    const data = voiceOptionMap.get(selectedVoiceId);
    const cards = document.querySelectorAll('.voice-card');
    cards.forEach((card) => {
      if (card.dataset.voiceId === selectedVoiceId) {
        card.classList.add('selected');
      }
    });
  }

  setStatus(`就绪${sysCount ? ` · ${sysCount} 个系统语音 + ${EDGE_VOICES.length} 个自然语音` : ''}`);
}

init();
