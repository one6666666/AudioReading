function pickMainContainer() {
  return document.querySelector('article, main') || document.body;
}

function collectTranslatableText(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent?.trim();
      if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;
      if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  return nodes;
}

function splitChunks(textList, maxChars = 1500) {
  const chunks = [];
  let current = [];
  let length = 0;

  for (const text of textList) {
    if (length + text.length > maxChars && current.length) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(text);
    length += text.length;
  }

  if (current.length) chunks.push(current);
  return chunks;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'TRANSLATE_PAGE') return;

  (async () => {
    try {
      const container = pickMainContainer();
      const textNodes = collectTranslatableText(container);

      if (!textNodes.length) {
        sendResponse({ ok: false, error: '未提取到可翻译文本' });
        return;
      }

      const rawTexts = textNodes.map((node) => node.textContent.trim());
      const chunks = splitChunks(rawTexts);

      let cursor = 0;
      for (const chunk of chunks) {
        const translatedTexts = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_BATCH',
          sourceLang: message.sourceLang,
          targetLang: message.targetLang,
          texts: chunk
        });

        if (!Array.isArray(translatedTexts) || translatedTexts.length !== chunk.length) {
          throw new Error('批量翻译返回结果异常');
        }

        for (let i = 0; i < translatedTexts.length; i += 1) {
          textNodes[cursor + i].textContent = translatedTexts[i];
        }
        cursor += translatedTexts.length;
      }

      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || '翻译过程中发生错误' });
    }
  })();

  return true;
});
