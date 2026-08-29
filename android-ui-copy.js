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

  function showDuplicateSearchProgress() {
    document.getElementById('android-duplicate-search-progress')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'android-duplicate-search-progress';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:350;background:rgba(248,246,241,.97);display:grid;place-items:center;padding:30px;text-align:center;color:var(--ink);pointer-events:auto;';
    overlay.innerHTML = `<div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:12px">${isGerman() ? 'Bibliothek' : 'Library'}</div><div style="font-family:var(--serif);font-size:18px">${isGerman() ? 'Duplikate werden gesucht…' : 'Searching for duplicates…'}</div><div class="boot-bar" style="margin-top:18px"></div></div>`;
    document.body.appendChild(overlay);

    let checks = 0;
    const timer = window.setInterval(() => {
      checks += 1;
      if (document.getElementById('android-duplicates-overlay') || checks > 120) {
        window.clearInterval(timer);
        overlay.remove();
      }
    }, 100);
  }

  document.addEventListener('click', event => {
    const target = event.target && event.target.closest ? event.target.closest('#android-find-duplicates') : null;
    if (target) showDuplicateSearchProgress();
  }, true);

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
