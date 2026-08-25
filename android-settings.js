// Android-only settings menu for JSON import/export.
(function () {
  if (!window.AndroidBookSource) return;

  const native = window.AndroidBookSource;

  function labels() {
    const de = ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
    return de ? {
      settings: 'Einstellungen',
      source: 'Datenquelle',
      imported: 'Importierte JSON-Datei',
      remote: 'Remote-Synchronisation',
      importJson: 'JSON importieren',
      exportJson: 'JSON exportieren',
      useRemote: 'Remote-Daten wieder verwenden',
      close: 'Schließen',
    } : {
      settings: 'Settings',
      source: 'Data source',
      imported: 'Imported JSON file',
      remote: 'Remote sync',
      importJson: 'Import JSON',
      exportJson: 'Export JSON',
      useRemote: 'Use remote data again',
      close: 'Close',
    };
  }

  function openSettings() {
    if (document.getElementById('android-settings-overlay')) return;
    const L = labels();
    const imported = !!native.isManualOverride();
    const overlay = document.createElement('div');
    overlay.id = 'android-settings-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(28,28,30,.36);display:flex;align-items:flex-end;';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;background:var(--paper);border-top:1px solid var(--ink);padding:20px 18px calc(20px + var(--safe-bot));box-shadow:0 -18px 50px rgba(28,28,30,.16);';
    sheet.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div class="display" style="font-size:24px">${L.settings}</div>
        <button id="android-settings-close" style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;padding:8px">${L.close}</button>
      </div>
      <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:5px">${L.source}</div>
      <div style="font-family:var(--serif);font-size:17px;margin-bottom:20px">${imported ? L.imported : L.remote}</div>
      <button id="android-import-json" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px">${L.importJson}</button>
      <button id="android-export-json" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px">${L.exportJson}</button>
      ${imported ? `<button id="android-use-remote" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px;color:var(--oxblood)">${L.useRemote}</button>` : ''}
    `;
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    sheet.querySelector('#android-settings-close').onclick = close;
    sheet.querySelector('#android-import-json').onclick = () => { close(); native.importBooks(); };
    sheet.querySelector('#android-export-json').onclick = () => { close(); native.exportBooks(); };
    const remote = sheet.querySelector('#android-use-remote');
    if (remote) remote.onclick = () => { close(); native.useRemoteBooks(); };
  }

  function attachButton() {
    const header = document.querySelector('#app header');
    if (!header || document.getElementById('android-settings-button')) return false;
    header.style.justifyContent = 'space-between';
    const button = document.createElement('button');
    button.id = 'android-settings-button';
    button.setAttribute('aria-label', labels().settings);
    button.style.cssText = 'width:36px;height:36px;display:grid;place-items:center;margin:-7px -7px -7px 8px;color:var(--ink);';
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.64 8.94a1.7 1.7 0 0 0-.34-1.88L4.24 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10.03 3H10V3h4v.08A1.7 1.7 0 0 0 15.03 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/></svg>';
    button.onclick = openSettings;
    header.appendChild(button);
    return true;
  }

  if (!attachButton()) {
    const observer = new MutationObserver(() => { if (attachButton()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
