// Android-only diagnostics and resilient retries for grounded metadata lookup.
(function () {
  if (!window.AndroidBookSource) return;

  const native = window.AndroidBookSource;
  let retryState = null;

  function decodePayload(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }

  function german() {
    return ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  }

  function metadataSources(result) {
    return result && Array.isArray(result._metadata_sources) ? result._metadata_sources : [];
  }

  function titleJoinVariants(title) {
    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return [];
    const variants = [];
    for (let i = words.length - 2; i >= 0; i -= 1) {
      const copy = words.slice();
      copy.splice(i, 2, copy[i] + copy[i + 1]);
      const candidate = copy.join(' ');
      if (candidate && candidate !== title && !variants.includes(candidate)) variants.push(candidate);
    }
    return variants;
  }

  function nextRetry(result) {
    if (!result || metadataSources(result).length > 0) {
      retryState = null;
      return null;
    }

    const title = String(result.title || '').trim();
    const author = String(result.author || '').trim();
    if (!title || !author) return null;

    if (!retryState) {
      retryState = {
        author,
        variants: titleJoinVariants(title),
      };
    }

    while (retryState.variants.length > 0) {
      const candidate = retryState.variants.shift();
      if (candidate) return { title: candidate, author: retryState.author };
    }
    retryState = null;
    return null;
  }

  function showDiagnostics(result) {
    if (!result || typeof result !== 'object') return;
    if (metadataSources(result).length > 0) return;

    const diagnostics = result._metadata_diagnostics || {};
    const openLibrary = String(diagnostics.open_library || 'unknown');
    const googleBooks = String(diagnostics.google_books || 'unknown');

    const old = document.getElementById('android-metadata-diagnostics');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'android-metadata-diagnostics';
    box.style.cssText = [
      'position:fixed',
      'left:18px',
      'right:18px',
      'bottom:calc(18px + var(--safe-bot))',
      'z-index:420',
      'background:var(--paper)',
      'border:1px solid var(--oxblood)',
      'box-shadow:0 8px 30px rgba(28,28,30,.18)',
      'padding:14px 15px',
      'font-family:var(--serif)',
      'font-size:14px',
      'line-height:1.4',
      'color:var(--ink)'
    ].join(';');

    const title = german() ? 'Keine Online-Metadaten gefunden' : 'No online metadata found';
    const hint = german()
      ? 'Automatische Titelvarianten wurden ebenfalls geprüft. Diagnose:'
      : 'Automatic title variants were also checked. Diagnostic:';

    box.innerHTML = `
      <div style="font-family:var(--sans);font-weight:600;margin-bottom:5px;color:var(--oxblood)">${title}</div>
      <div style="margin-bottom:8px">${hint}</div>
      <div style="font-family:var(--mono);font-size:10px;line-height:1.6;word-break:break-word">Open Library: ${escapeText(openLibrary)}<br>Google Books: ${escapeText(googleBooks)}</div>
      <button type="button" style="margin-top:10px;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--oxblood)">${german() ? 'Schließen' : 'Close'}</button>
    `;
    box.querySelector('button').onclick = () => box.remove();
    document.body.appendChild(box);
  }

  function escapeText(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function wrap(name, allowRetry) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function (base64, error) {
      if (!error && base64) {
        try {
          const result = decodePayload(base64);
          if (allowRetry) {
            const retry = nextRetry(result);
            if (retry) {
              try {
                native.enrichBookMetadata(retry.title, retry.author);
                return;
              } catch (e) {
                console.error('Metadata title-variant retry failed', e);
                retryState = null;
              }
            }
          }
          showDiagnostics(result);
        } catch (e) {
          retryState = null;
          console.error('Metadata diagnostic decode failed', e);
        }
      } else {
        retryState = null;
      }
      return original.apply(this, arguments);
    };
  }

  wrap('__bookMetadataResult', true);
  wrap('__bookScanResult', false);
})();
