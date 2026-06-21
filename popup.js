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
// Edge TTS Voice Catalog (curated, free, high-quality natural voices)
// ============================================================

const EDGE_VOICES = [
  // ---- 中文普通话 ----
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', lang: 'zh-CN', gender: 'female', label: '晓晓（女·活泼）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', lang: 'zh-CN', gender: 'female', label: '晓伊（女·温柔）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-YunxiNeural', name: '云希', lang: 'zh-CN', gender: 'male', label: '云希（男·清新）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', lang: 'zh-CN', gender: 'male', label: '云扬（男·新闻）', style: 'news', quality: 'premium' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵', lang: 'zh-CN', gender: 'female', label: '晓涵（女·知性）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨', lang: 'zh-CN', gender: 'female', label: '晓墨（女·沉稳）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-XiaoruiNeural', name: '晓睿', lang: 'zh-CN', gender: 'female', label: '晓睿（女·睿智）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', lang: 'zh-CN', gender: 'female', label: '晓萱（女·自信）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-YunjianNeural', name: '云健', lang: 'zh-CN', gender: 'male', label: '云健（男·运动）', style: 'sports', quality: 'premium' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏', lang: 'zh-CN', gender: 'male', label: '云夏（男·少年）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-YunyeNeural', name: '云野', lang: 'zh-CN', gender: 'male', label: '云野（男·成熟）', style: 'general', quality: 'premium' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '晓北', lang: 'zh-CN', gender: 'female', label: '晓北（东北话·女）', style: 'dialect', quality: 'premium' },

  // ---- 中文粤语 ----
  { id: 'zh-HK-HiuMaanNeural', name: '曉曼', lang: 'zh-HK', gender: 'female', label: '曉曼（粤语·女）', style: 'general', quality: 'premium' },
  { id: 'zh-HK-HiuGaaiNeural', name: '曉佳', lang: 'zh-HK', gender: 'female', label: '曉佳（粤语·女）', style: 'general', quality: 'premium' },
  { id: 'zh-HK-WanLungNeural', name: '雲龍', lang: 'zh-HK', gender: 'male', label: '雲龍（粤语·男）', style: 'general', quality: 'premium' },

  // ---- 中文台湾 ----
  { id: 'zh-TW-HsiaoChenNeural', name: '曉臻', lang: 'zh-TW', gender: 'female', label: '曉臻（台湾·女）', style: 'general', quality: 'premium' },
  { id: 'zh-TW-HsiaoYuNeural', name: '曉雨', lang: 'zh-TW', gender: 'female', label: '曉雨（台湾·女）', style: 'general', quality: 'premium' },
  { id: 'zh-TW-YunJheNeural', name: '雲哲', lang: 'zh-TW', gender: 'male', label: '雲哲（台湾·男）', style: 'general', quality: 'premium' },

  // ---- English (US) ----
  { id: 'en-US-JennyNeural', name: 'Jenny', lang: 'en-US', gender: 'female', label: 'Jenny (US·Female)', style: 'general', quality: 'premium' },
  { id: 'en-US-AriaNeural', name: 'Aria', lang: 'en-US', gender: 'female', label: 'Aria (US·Female)', style: 'general', quality: 'premium' },
  { id: 'en-US-GuyNeural', name: 'Guy', lang: 'en-US', gender: 'male', label: 'Guy (US·Male)', style: 'general', quality: 'premium' },
  { id: 'en-US-DavisNeural', name: 'Davis', lang: 'en-US', gender: 'male', label: 'Davis (US·Male)', style: 'general', quality: 'premium' },
  { id: 'en-US-AmberNeural', name: 'Amber', lang: 'en-US', gender: 'female', label: 'Amber (US·Female)', style: 'general', quality: 'premium' },
  { id: 'en-US-AnaNeural', name: 'Ana', lang: 'en-US', gender: 'female', label: 'Ana (US·Female·Child)', style: 'general', quality: 'premium' },
  { id: 'en-US-BrandonNeural', name: 'Brandon', lang: 'en-US', gender: 'male', label: 'Brandon (US·Male)', style: 'general', quality: 'premium' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', lang: 'en-US', gender: 'male', label: 'Christopher (US·Male)', style: 'general', quality: 'premium' },
  { id: 'en-US-EricNeural', name: 'Eric', lang: 'en-US', gender: 'male', label: 'Eric (US·Male)', style: 'general', quality: 'premium' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', lang: 'en-US', gender: 'female', label: 'Michelle (US·Female)', style: 'general', quality: 'premium' },
  { id: 'en-US-RogerNeural', name: 'Roger', lang: 'en-US', gender: 'male', label: 'Roger (US·Male)', style: 'general', quality: 'premium' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', lang: 'en-US', gender: 'male', label: 'Steffan (US·Male)', style: 'general', quality: 'premium' },

  // ---- English (UK) ----
  { id: 'en-GB-LibbyNeural', name: 'Libby', lang: 'en-GB', gender: 'female', label: 'Libby (UK·Female)', style: 'general', quality: 'premium' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', lang: 'en-GB', gender: 'male', label: 'Ryan (UK·Male)', style: 'general', quality: 'premium' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', lang: 'en-GB', gender: 'female', label: 'Sonia (UK·Female)', style: 'general', quality: 'premium' },
  { id: 'en-GB-MaisieNeural', name: 'Maisie', lang: 'en-GB', gender: 'female', label: 'Maisie (UK·Female)', style: 'general', quality: 'premium' },

  // ---- English (AU) ----
  { id: 'en-AU-NatashaNeural', name: 'Natasha', lang: 'en-AU', gender: 'female', label: 'Natasha (AU·Female)', style: 'general', quality: 'premium' },
  { id: 'en-AU-WilliamNeural', name: 'William', lang: 'en-AU', gender: 'male', label: 'William (AU·Male)', style: 'general', quality: 'premium' },

  // ---- Japanese ----
  { id: 'ja-JP-NanamiNeural', name: '七海', lang: 'ja-JP', gender: 'female', label: '七海（日文·女）', style: 'general', quality: 'premium' },
  { id: 'ja-JP-KeitaNeural', name: '慶太', lang: 'ja-JP', gender: 'male', label: '慶太（日文·男）', style: 'general', quality: 'premium' },
  { id: 'ja-JP-AoiNeural', name: '碧', lang: 'ja-JP', gender: 'female', label: '碧（日文·女）', style: 'general', quality: 'premium' },
  { id: 'ja-JP-DaichiNeural', name: '大地', lang: 'ja-JP', gender: 'male', label: '大地（日文·男）', style: 'general', quality: 'premium' },
  { id: 'ja-JP-MayuNeural', name: '真夕', lang: 'ja-JP', gender: 'female', label: '真夕（日文·女）', style: 'general', quality: 'premium' },

  // ---- Korean ----
  { id: 'ko-KR-SunHiNeural', name: '선히', lang: 'ko-KR', gender: 'female', label: '선히（韩文·女）', style: 'general', quality: 'premium' },
  { id: 'ko-KR-InJoonNeural', name: '인준', lang: 'ko-KR', gender: 'male', label: '인준（韩文·男）', style: 'general', quality: 'premium' },
  { id: 'ko-KR-JiMinNeural', name: '지민', lang: 'ko-KR', gender: 'female', label: '지민（韩文·女）', style: 'general', quality: 'premium' },

  // ---- French ----
  { id: 'fr-FR-DeniseNeural', name: 'Denise', lang: 'fr-FR', gender: 'female', label: 'Denise (FR·Female)', style: 'general', quality: 'premium' },
  { id: 'fr-FR-HenriNeural', name: 'Henri', lang: 'fr-FR', gender: 'male', label: 'Henri (FR·Male)', style: 'general', quality: 'premium' },

  // ---- German ----
  { id: 'de-DE-KatjaNeural', name: 'Katja', lang: 'de-DE', gender: 'female', label: 'Katja (DE·Female)', style: 'general', quality: 'premium' },
  { id: 'de-DE-ConradNeural', name: 'Conrad', lang: 'de-DE', gender: 'male', label: 'Conrad (DE·Male)', style: 'general', quality: 'premium' },

  // ---- Spanish ----
  { id: 'es-ES-ElviraNeural', name: 'Elvira', lang: 'es-ES', gender: 'female', label: 'Elvira (ES·Female)', style: 'general', quality: 'premium' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro', lang: 'es-ES', gender: 'male', label: 'Alvaro (ES·Male)', style: 'general', quality: 'premium' },
  { id: 'es-MX-DaliaNeural', name: 'Dalia', lang: 'es-MX', gender: 'female', label: 'Dalia (MX·Female)', style: 'general', quality: 'premium' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge', lang: 'es-MX', gender: 'male', label: 'Jorge (MX·Male)', style: 'general', quality: 'premium' },

  // ---- Portuguese ----
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', lang: 'pt-BR', gender: 'female', label: 'Francisca (BR·Female)', style: 'general', quality: 'premium' },
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', lang: 'pt-BR', gender: 'male', label: 'Antonio (BR·Male)', style: 'general', quality: 'premium' },

  // ---- Italian ----
  { id: 'it-IT-ElsaNeural', name: 'Elsa', lang: 'it-IT', gender: 'female', label: 'Elsa (IT·Female)', style: 'general', quality: 'premium' },
  { id: 'it-IT-IsabellaNeural', name: 'Isabella', lang: 'it-IT', gender: 'female', label: 'Isabella (IT·Female)', style: 'general', quality: 'premium' },

  // ---- Russian ----
  { id: 'ru-RU-SvetlanaNeural', name: 'Светлана', lang: 'ru-RU', gender: 'female', label: 'Светлана (RU·Female)', style: 'general', quality: 'premium' },
  { id: 'ru-RU-DmitryNeural', name: 'Дмитрий', lang: 'ru-RU', gender: 'male', label: 'Дмитрий (RU·Male)', style: 'general', quality: 'premium' },

  // ---- Arabic ----
  { id: 'ar-SA-ZariyahNeural', name: 'زارية', lang: 'ar-SA', gender: 'female', label: 'زارية (SA·Female)', style: 'general', quality: 'premium' },
  { id: 'ar-SA-HamedNeural', name: 'حامد', lang: 'ar-SA', gender: 'male', label: 'حامد (SA·Male)', style: 'general', quality: 'premium' },
];

// Group Edge voices by language for display
function groupEdgeVoicesByLang() {
  const groups = {};
  for (const v of EDGE_VOICES) {
    const langKey = v.lang.split('-')[0];
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

function getSourceBadge(source) {
  if (source === 'edge') return '<span class="badge badge-edge">Edge</span>';
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
        ${getSourceBadge(source)}
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
    'ja': 'こんにちは、これは自然な音声プレビューです。',
    'ko': '안녕하세요, 자연스러운 음성 미리보기입니다.',
    'en': 'Hello, this is a natural voice preview. The weather is lovely today.',
    'fr': 'Bonjour, ceci est un aperçu vocal naturel.',
    'de': 'Hallo, dies ist eine natürliche Sprachvorschau.',
    'es': 'Hola, esta es una vista previa de voz natural.',
    'pt': 'Olá, esta é uma pré-visualização de voz natural.',
    'it': 'Ciao, questa è un\'anteprima vocale naturale.',
    'ru': 'Здравствуйте, это предварительный просмотр естественного голоса.',
    'ar': 'مرحباً، هذه معاينة صوتية طبيعية.'
  };

  const langPrefix = (voiceData.lang || 'zh').split('-')[0];
  const sampleText = sampleTexts[langPrefix] || sampleTexts['zh'];

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

  // Group by language
  const groups = {};
  for (const v of voices) {
    const langKey = v.lang.split('-')[0];
    if (!groups[langKey]) groups[langKey] = [];
    groups[langKey].push(v);
  }

  const langNames = {
    'zh': '中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어',
    'fr': 'Français', 'de': 'Deutsch', 'es': 'Español',
    'pt': 'Português', 'it': 'Italiano', 'ru': 'Русский', 'ar': 'العربية'
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
        style: v.style
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

async function onRead() {
  try {
    const tab = await getCurrentTab();
    await persistSettings();

    const voiceData = voiceOptionMap.get(selectedVoiceId);
    const source = voiceData?.source || currentTab;

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

    const result = await sendMessage(tab, {
      type: 'READ_PAGE',
      payload
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

  setStatus(`就绪${sysCount ? ` · ${sysCount} 个系统语音 + ${EDGE_VOICES.length} 个 Edge 自然语音` : ''}`);
}

init();
