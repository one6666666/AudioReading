async function translateByGoogle(texts, sourceLang, targetLang) {
  const query = texts.map((text) => `q=${encodeURIComponent(text)}`).join('&');
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}` +
    `&tl=${encodeURIComponent(targetLang)}&dt=t&${query}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`翻译请求失败: ${resp.status}`);
  }

  const data = await resp.json();
  if (!Array.isArray(data)) {
    throw new Error('翻译响应格式错误');
  }

  const normalized = Array.isArray(data[0]?.[0]) ? data : [data];
  return normalized.map((item) => {
    if (!Array.isArray(item[0])) {
      throw new Error('翻译结果结构异常');
    }
    return item[0].map((seg) => seg[0]).join('');
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'TRANSLATE_BATCH') return;

  (async () => {
    try {
      const result = await translateByGoogle(
        message.texts,
        message.sourceLang || 'auto',
        message.targetLang || 'zh-CN'
      );
      sendResponse(result);
    } catch (error) {
      sendResponse({ error: error.message || '翻译失败' });
    }
  })();

  return true;
});
