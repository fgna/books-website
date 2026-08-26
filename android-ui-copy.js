// Keep user-facing Android UI model-agnostic. Runtime/model details remain implementation concerns.
(function () {
  if (!window.AndroidBookSource) return;

  function isGerman() {
    return ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  }

  function replaceText(text) {
    if (!text || !/Gemma/i.test(text)) return text;
    if (isGerman()) {
      return text
        .replace(/Gemma\s*\.litertlm/gi, 'Lokales KI-Modell')
        .replace(/Gemma/gi, 'Lokale KI');
    }
    return text
      .replace(/Gemma\s*\.litertlm/gi, 'Local AI model')
      .replace(/Gemma/gi, 'Local AI');
  }

  function neutralize(root) {
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const next = replaceText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    if (root && root.nodeType === Node.ELEMENT_NODE) {
      for (const attr of ['aria-label', 'title', 'placeholder']) {
        const value = root.getAttribute && root.getAttribute(attr);
        if (value) root.setAttribute(attr, replaceText(value));
      }
    }
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const next = replaceText(node.nodeValue);
          if (next !== node.nodeValue) node.nodeValue = next;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          neutralize(node);
        }
      }
    }
  });

  if (document.body) {
    neutralize(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      neutralize(document.body);
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }
})();
