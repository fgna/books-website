// Android-only diagnostics for grounded metadata lookup.
(function () {
  if (!window.AndroidBookSource) return;

  function decodePayload(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }

  function german() {
    return ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  }

  function showDiagnostics(result) {
    if (!result || typeof result !== 'object') return;
    const sources = Array.isArray(result._metadata_sources) ? result._metadata_sources : [];
    if (sources.length > 0) return;

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
      ? 'Bitte diese Diagnose für den nächsten Test notieren:'
      : 'Please note this diagnostic for the next test:';

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

  function wrap(name) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function (base64, error) {
      if (!error && base64) {
        try { showDiagnostics(decodePayload(base64)); }
        catch (e) { console.error('Metadata diagnostic decode failed', e); }
      }
      return original.apply(this, arguments);
    };
  }

  wrap('__bookMetadataResult');
  wrap('__bookScanResult');
})();
