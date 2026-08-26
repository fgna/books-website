// Keep user-facing Android UI model-agnostic and hide obsolete remote-reset controls.
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

  function removeObsoleteControls(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const remoteReset = scope.querySelector && scope.querySelector('#android-use-remote');
    if (remoteReset) remoteReset.remove();
    if (root && root.id === 'android-use-remote') root.remove();
  }

  function neutralize(root) {
    removeObsoleteControls(root);
    if (!root || !root.ownerDocument && root !== document.body) return;

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
    removeObsoleteControls(document);
  });

  function start() {
    neutralize(document.body);
    removeObsoleteControls(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
