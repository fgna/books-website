// Android-only books.json transport. In a normal browser this is a no-op.
(function () {
  if (!window.AndroidBookSource) return;

  const native = window.AndroidBookSource;
  const originalFetch = window.fetch.bind(window);
  const pending = new Map();
  let nextId = 1;

  window.__bookSourceResolve = function (requestId, base64, error) {
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);

    if (error) {
      entry.reject(new Error(error));
      return;
    }

    try {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const json = new TextDecoder('utf-8').decode(bytes);
      entry.resolve(new Response(json, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }));
    } catch (e) {
      entry.reject(e);
    }
  };

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url !== 'books.json' && !String(url || '').endsWith('/books.json')) {
      return originalFetch(input, init);
    }

    const configured = (window.LIB_CONFIG && window.LIB_CONFIG.booksUrl) || native.getDefaultBooksUrl() || '';
    const requestId = String(nextId++);
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      native.requestBooks(String(configured), requestId);
    }).catch(() => originalFetch(input, init));
  };
})();
