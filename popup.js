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
// Natural Voice Catalog — Microsoft Edge TTS (neural, free)
// All voices are real Edge TTS ShortNames (zh-CN-XiaoxiaoNeural etc.)
// Uses WebSocket protocol via Service Worker — no API key needed
// 14 Chinese voices (8 Mandarin + 3 Taiwan + 3 Cantonese)
// ============================================================

const EDGE_VOICES = [
  // ---- 中文（普通话）8 种 ----
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao', lang: 'zh-CN', gender: 'female', label: '晓晓（女·温暖）', style: '新闻、小说' },
  { id: 'zh-CN-XiaoyiNeural', name: 'Xiaoyi', lang: 'zh-CN', gender: 'female', label: '晓伊（女·活泼）', style: '卡通、小说' },
  { id: 'zh-CN-YunjianNeural', name: 'Yunjian', lang: 'zh-CN', gender: 'male', label: '云健（男·激情）', style: '体育、小说' },
  { id: 'zh-CN-YunxiNeural', name: 'Yunxi', lang: 'zh-CN', gender: 'male', label: '云希（男·阳光）', style: '小说' },
  { id: 'zh-CN-YunxiaNeural', name: 'Yunxia', lang: 'zh-CN', gender: 'male', label: '云夏（男·可爱）', style: '卡通、小说' },
  { id: 'zh-CN-YunyangNeural', name: 'Yunyang', lang: 'zh-CN', gender: 'male', label: '云扬（男·专业）', style: '新闻' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: 'Xiaobei', lang: 'zh-CN', gender: 'female', label: '晓北（女·东北话·幽默）', style: '方言' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: 'Xiaoni', lang: 'zh-CN', gender: 'female', label: '晓妮（女·陕西话·明亮）', style: '方言' },

  // ---- 中文（粤语）3 种 ----
  { id: 'zh-HK-HiuGaaiNeural', name: 'HiuGaai', lang: 'zh-HK', gender: 'female', label: '曉佳（女·粤语·亲切）', style: '通用' },
  { id: 'zh-HK-HiuMaanNeural', name: 'HiuMaan', lang: 'zh-HK', gender: 'female', label: '曉曼（女·粤语·亲切）', style: '通用' },
  { id: 'zh-HK-WanLungNeural', name: 'WanLung', lang: 'zh-HK', gender: 'male', label: '雲龍（男·粤语·亲切）', style: '通用' },

  // ---- 中文（台湾国语）3 种 ----
  { id: 'zh-TW-HsiaoChenNeural', name: 'HsiaoChen', lang: 'zh-TW', gender: 'female', label: '曉臻（女·台湾国语·亲切）', style: '通用' },
  { id: 'zh-TW-HsiaoYuNeural', name: 'HsiaoYu', lang: 'zh-TW', gender: 'female', label: '曉雨（女·台湾国语·亲切）', style: '通用' },
  { id: 'zh-TW-YunJheNeural', name: 'YunJhe', lang: 'zh-TW', gender: 'male', label: '雲哲（男·台湾国语·亲切）', style: '通用' },

  // ---- English (US) ----
  { id: 'en-US-AriaNeural', name: 'Aria', lang: 'en-US', gender: 'female', label: 'Aria (US·女·神经)' },
  { id: 'en-US-JennyNeural', name: 'Jenny', lang: 'en-US', gender: 'female', label: 'Jenny (US·女·神经)' },
  { id: 'en-US-GuyNeural', name: 'Guy', lang: 'en-US', gender: 'male', label: 'Guy (US·男·神经)' },

  // ---- English (UK) ----
  { id: 'en-GB-SoniaNeural', name: 'Sonia', lang: 'en-GB', gender: 'female', label: 'Sonia (UK·女·神经)' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', lang: 'en-GB', gender: 'male', label: 'Ryan (UK·男·神经)' },
  { id: 'en-GB-LibbyNeural', name: 'Libby', lang: 'en-GB', gender: 'female', label: 'Libby (UK·女·神经)' },

  // ---- English (AU) ----
  { id: 'en-AU-NatashaNeural', name: 'Natasha', lang: 'en-AU', gender: 'female', label: 'Natasha (AU·女·神经)' },
  { id: 'en-AU-WilliamNeural', name: 'William', lang: 'en-AU', gender: 'male', label: 'William (AU·男·神经)' },

  // ---- Japanese ----
  { id: 'ja-JP-NanamiNeural', name: 'Nanami', lang: 'ja-JP', gender: 'female', label: 'Nanami（日文·女·神经）' },
  { id: 'ja-JP-KeitaNeural', name: 'Keita', lang: 'ja-JP', gender: 'male', label: 'Keita（日文·男·神经）' },

  // ---- Korean ----
  { id: 'ko-KR-SunHiNeural', name: 'SunHi', lang: 'ko-KR', gender: 'female', label: 'SunHi（韩文·女·神经）' },
  { id: 'ko-KR-InJoonNeural', name: 'InJoon', lang: 'ko-KR', gender: 'male', label: 'InJoon（韩文·男·神经）' },

  // ---- French ----
  { id: 'fr-FR-DeniseNeural', name: 'Denise', lang: 'fr-FR', gender: 'female', label: 'Denise (FR·女·神经)' },
  { id: 'fr-FR-HenriNeural', name: 'Henri', lang: 'fr-FR', gender: 'male', label: 'Henri (FR·男·神经)' },

  // ---- German ----
  { id: 'de-DE-KatjaNeural', name: 'Katja', lang: 'de-DE', gender: 'female', label: 'Katja (DE·女·神经)' },
  { id: 'de-DE-ConradNeural', name: 'Conrad', lang: 'de-DE', gender: 'male', label: 'Conrad (DE·男·神经)' },

  // ---- Spanish ----
  { id: 'es-ES-ElviraNeural', name: 'Elvira', lang: 'es-ES', gender: 'female', label: 'Elvira (ES·女·神经)' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro', lang: 'es-ES', gender: 'male', label: 'Álvaro (ES·男·神经)' },
  { id: 'es-MX-DaliaNeural', name: 'Dalia', lang: 'es-MX', gender: 'female', label: 'Dalia (MX·女·神经)' },

  // ---- Portuguese ----
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', lang: 'pt-BR', gender: 'female', label: 'Francisca (BR·女·神经)' },
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', lang: 'pt-BR', gender: 'male', label: 'Antônio (BR·男·神经)' },

  // ---- Italian ----
  { id: 'it-IT-ElsaNeural', name: 'Elsa', lang: 'it-IT', gender: 'female', label: 'Elsa (IT·女·神经)' },

  // ---- Russian ----
  { id: 'ru-RU-SvetlanaNeural', name: 'Svetlana', lang: 'ru-RU', gender: 'female', label: 'Svetlana (RU·女·神经)' },

  // ---- Other major languages ----
  { id: 'nl-NL-ColetteNeural', name: 'Colette', lang: 'nl-NL', gender: 'female', label: 'Colette (NL·女·神经)' },
  { id: 'pl-PL-AgnieszkaNeural', name: 'Agnieszka', lang: 'pl-PL', gender: 'female', label: 'Agnieszka (PL·女·神经)' },
  { id: 'sv-SE-SofieNeural', name: 'Sofie', lang: 'sv-SE', gender: 'female', label: 'Sofie (SE·女·神经)' },
  { id: 'tr-TR-EmelNeural', name: 'Emel', lang: 'tr-TR', gender: 'female', label: 'Emel (TR·女·神经)' },
  { id: 'ar-SA-ZariyahNeural', name: 'Zariyah', lang: 'ar-SA', gender: 'female', label: 'Zariyah (AR·女·神经)' },
  { id: 'hi-IN-SwaraNeural', name: 'Swara', lang: 'hi-IN', gender: 'female', label: 'Swara (HI·女·神经)' },
  { id: 'th-TH-PremwadeeNeural', name: 'Premwadee', lang: 'th-TH', gender: 'female', label: 'Premwadee (TH·女·神经)' },
  { id: 'vi-VN-HoaiMyNeural', name: 'HoaiMy', lang: 'vi-VN', gender: 'female', label: 'HoaiMy (VN·女·神经)' },
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

function getSourceBadge(source, voiceData) {
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
        ${getSourceBadge(source, voiceData)}
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
        style: v.style || ''
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
