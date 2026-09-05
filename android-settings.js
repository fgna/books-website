// Android-only settings, JSON import/export and central LLM-backed book capture.
(function () {
  if (!window.AndroidBookSource) return;

  const native = window.AndroidBookSource;
  const nativeLanguage = (() => {
    try { return String(native.getLanguage ? native.getLanguage() : '').toLowerCase(); }
    catch (_) { return ''; }
  })();
  if ((nativeLanguage === 'en' || nativeLanguage === 'de') && window.LIB_CONFIG) {
    window.LIB_CONFIG.lang = nativeLanguage;
  }

  function isGerman() {
    return ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  }

  function labels() {
    return isGerman() ? {
      settings: 'Einstellungen', language: 'Sprache', source: 'Datenquelle', imported: 'Lokaler Katalog', remote: 'Remote-Synchronisation',
      importJson: 'JSON importieren', exportJson: 'JSON exportieren', useRemote: 'Remote-Daten wieder verwenden', close: 'Schließen',
      localAi: 'Android LLM Service', serviceReady: 'Modell bereit', serviceUnavailable: 'Service oder Modell nicht bereit',
      scan: 'Buch fotografieren', openingCamera: 'Kamera wird geöffnet…', scanning: 'Buch wird lokal erkannt…', checking: 'Titel und Autor werden geprüft…', enriching: 'Metadaten werden ergänzt…',
      identityReview: 'Buch identifizieren', identityHint: 'Titel oder Autor konnten nicht sicher bestätigt werden. Bitte prüfen oder korrigieren.', visibleNames: 'Auf dem Buch erkannte Namen', searchMetadata: 'Metadaten suchen',
      review: 'Erkanntes Buch prüfen', title: 'Titel', author: 'Autor', confidence: 'Sicherheit', add: 'Zur Bibliothek hinzufügen', addAnyway: 'Trotzdem hinzufügen', cancel: 'Abbrechen',
      metadata: 'Metadaten', genre: 'Genre', year: 'Erstveröffentlichung', languageValue: 'Sprache', originalLanguage: 'Originalsprache', series: 'Reihe', summary: 'Kurzbeschreibung', mainIdea: 'Kernidee', openLibrary: 'Open Library',
      duplicate: 'Ein ähnlicher Eintrag existiert bereits.', saved: 'Buch hinzugefügt.'
    } : {
      settings: 'Settings', language: 'Language', source: 'Data source', imported: 'Local catalog', remote: 'Remote sync',
      importJson: 'Import JSON', exportJson: 'Export JSON', useRemote: 'Use remote data again', close: 'Close',
      localAi: 'Android LLM Service', serviceReady: 'Model ready', serviceUnavailable: 'Service or model not ready',
      scan: 'Photograph book', openingCamera: 'Opening camera…', scanning: 'Recognizing book locally…', checking: 'Checking title and author…', enriching: 'Enriching metadata…',
      identityReview: 'Identify book', identityHint: 'Title or author could not be confirmed reliably. Please review or correct them.', visibleNames: 'Names recognized on the book', searchMetadata: 'Find metadata',
      review: 'Review recognized book', title: 'Title', author: 'Author', confidence: 'Confidence', add: 'Add to library', addAnyway: 'Add anyway', cancel: 'Cancel',
      metadata: 'Metadata', genre: 'Genre', year: 'First published', languageValue: 'Language', originalLanguage: 'Original language', series: 'Series', summary: 'Summary', mainIdea: 'Main idea', openLibrary: 'Open Library',
      duplicate: 'A similar entry already exists.', saved: 'Book added.'
    };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function decodePayload(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }

  function sheetBase(id) {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:240;background:rgba(28,28,30,.36);display:flex;align-items:flex-end;';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-height:88vh;overflow:auto;background:var(--paper);border-top:1px solid var(--ink);padding:20px 18px calc(20px + var(--safe-bot));box-shadow:0 -18px 50px rgba(28,28,30,.16);';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    return { overlay, sheet };
  }

  function readServiceStatus() {
    try {
      const ready = !!native.isLlmServiceReady();
      const modelName = ready && native.getLlmServiceModelName ? String(native.getLlmServiceModelName() || '') : '';
      return { ready, modelName };
    } catch (e) {
      console.error('Android LLM Service status check failed', e);
      return { ready: false, modelName: '' };
    }
  }

  function openSettings() {
    if (document.getElementById('android-settings-overlay')) return;
    const L = labels();
    const imported = !!native.isManualOverride();
    const service = readServiceStatus();
    const currentLang = isGerman() ? 'de' : 'en';
    const { overlay, sheet } = sheetBase('android-settings-overlay');

    sheet.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div class="display" style="font-size:24px">${L.settings}</div>
        <button id="android-settings-close" style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;padding:8px">${L.close}</button>
      </div>
      <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:8px">${L.language}</div>
      <div style="display:flex;border:1px solid var(--ink);width:fit-content;margin-bottom:24px">
        <button id="android-lang-en" style="padding:8px 16px;font-family:var(--mono);font-size:10px;letter-spacing:.12em;background:${currentLang === 'en' ? 'var(--ink)' : 'var(--paper)'};color:${currentLang === 'en' ? 'var(--paper)' : 'var(--ink)'}">EN</button>
        <button id="android-lang-de" style="padding:8px 16px;border-left:1px solid var(--ink);font-family:var(--mono);font-size:10px;letter-spacing:.12em;background:${currentLang === 'de' ? 'var(--ink)' : 'var(--paper)'};color:${currentLang === 'de' ? 'var(--paper)' : 'var(--ink)'}">DE</button>
      </div>
      <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:5px">${L.source}</div>
      <div style="font-family:var(--serif);font-size:17px;margin-bottom:20px">${imported ? L.imported : L.remote}</div>
      <button id="android-import-json" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px">${L.importJson}</button>
      <button id="android-export-json" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px">${L.exportJson}</button>
      ${imported ? `<button id="android-use-remote" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px;color:var(--oxblood)">${L.useRemote}</button>` : ''}
      <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin:24px 0 5px">${L.localAi}</div>
      <div id="android-model-status" style="font-family:var(--serif);font-size:15px;margin-bottom:8px">${service.ready ? `${L.serviceReady}${service.modelName ? ` · ${escapeHtml(service.modelName)}` : ''}` : L.serviceUnavailable}</div>
    `;

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    sheet.querySelector('#android-settings-close').onclick = close;
    sheet.querySelector('#android-lang-en').onclick = () => { if (currentLang !== 'en') native.setLanguage('en'); };
    sheet.querySelector('#android-lang-de').onclick = () => { if (currentLang !== 'de') native.setLanguage('de'); };
    sheet.querySelector('#android-import-json').onclick = () => { close(); native.importBooks(); };
    sheet.querySelector('#android-export-json').onclick = () => { close(); native.exportBooks(); };
    const remote = sheet.querySelector('#android-use-remote');
    if (remote) remote.onclick = () => { close(); native.useRemoteBooks(); };
  }

  function showBusy(text) {
    removeBusy();
    const busy = document.createElement('div');
    busy.id = 'android-book-busy';
    busy.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(248,246,241,.94);display:grid;place-items:center;padding:30px;text-align:center;font-family:var(--serif);font-size:18px;color:var(--ink);';
    busy.innerHTML = `<div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:12px">Local AI</div>${escapeHtml(text)}</div>`;
    document.body.appendChild(busy);
  }

  function removeBusy() {
    const busy = document.getElementById('android-book-busy');
    if (busy) busy.remove();
  }

  function startScan(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const L = labels();
    const service = readServiceStatus();
    if (!service.ready) {
      openSettings();
      return;
    }
    showBusy(L.openingCamera);
    try {
      native.captureBook();
      window.setTimeout(removeBusy, 1200);
    } catch (e) {
      removeBusy();
      console.error('Camera launch failed', e);
      openSettings();
    }
  }

  function openIdentityReview(result) {
    const L = labels();
    const old = document.getElementById('android-book-identity');
    if (old) old.remove();
    const { overlay, sheet } = sheetBase('android-book-identity');
    const candidates = Array.isArray(result._author_candidates) ? result._author_candidates.filter(Boolean) : [];
    const confidence = Math.round((Number(result.confidence) || 0) * 100);

    sheet.innerHTML = `
      <div class="display" style="font-size:24px;margin-bottom:10px">${L.identityReview}</div>
      <div style="font-family:var(--serif);font-size:14px;line-height:1.45;color:var(--ink-2);margin-bottom:18px">${L.identityHint}</div>
      <label style="display:block;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:6px">${L.title}</label>
      <input id="android-identity-title" value="${escapeHtml(result.title || '')}" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:12px;font-family:var(--serif);font-size:17px;margin-bottom:15px;color:var(--ink)" />
      <label style="display:block;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:6px">${L.author}</label>
      <input id="android-identity-author" value="${escapeHtml(result.author || '')}" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:12px;font-family:var(--serif);font-size:17px;margin-bottom:10px;color:var(--ink)" />
      ${candidates.length ? `<div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin:4px 0 5px">${L.visibleNames}</div><div id="android-visible-names" style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px">${candidates.map(name => `<button type="button" data-author="${escapeHtml(name)}" style="border:1px solid var(--rule);padding:7px 9px;font-family:var(--serif);font-size:13px">${escapeHtml(name)}</button>`).join('')}</div>` : ''}
      <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:18px">${L.confidence}: ${confidence}%</div>
      <button id="android-search-metadata" style="width:100%;border-top:1px solid var(--ink);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px;color:var(--oxblood)">${L.searchMetadata}</button>
      <button id="android-identity-cancel" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px">${L.cancel}</button>
    `;

    const titleInput = sheet.querySelector('#android-identity-title');
    const authorInput = sheet.querySelector('#android-identity-author');
    sheet.querySelectorAll('[data-author]').forEach(button => {
      button.onclick = () => { authorInput.value = button.getAttribute('data-author') || ''; };
    });

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    sheet.querySelector('#android-identity-cancel').onclick = close;
    sheet.querySelector('#android-search-metadata').onclick = () => {
      const title = titleInput.value.trim();
      const author = authorInput.value.trim();
      if (!title) {
        titleInput.focus();
        return;
      }
      close();
      showBusy(L.enriching);
      try {
        native.enrichBookMetadata(title, author);
      } catch (e) {
        removeBusy();
        console.error(e);
        alert(String(e));
      }
    };
  }

  function metadataRow(label, value) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return '';
    const text = Array.isArray(value) ? value.join(' · ') : value;
    return `<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;padding:7px 0;border-top:1px solid var(--rule);font-size:13px"><div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3)">${escapeHtml(label)}</div><div style="font-family:var(--serif);line-height:1.35">${escapeHtml(text)}</div></div>`;
  }

  function openReview(result) {
    const L = labels();
    const { overlay, sheet } = sheetBase('android-book-review');
    const confidence = Math.round((Number(result.confidence) || 0) * 100);
    const metadata = [
      metadataRow(L.genre, result.genre),
      metadataRow(L.year, result.year_published),
      metadataRow(L.languageValue, result.language),
      metadataRow(L.originalLanguage, result.original_language),
      metadataRow(L.series, result.series),
      metadataRow(L.openLibrary, result.openlibrary_work_id),
      metadataRow(L.summary, result.summary),
      metadataRow(L.mainIdea, result.main_idea),
    ].join('');

    sheet.innerHTML = `
      <div class="display" style="font-size:24px;margin-bottom:18px">${L.review}</div>
      <label style="display:block;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:6px">${L.title}</label>
      <input id="android-book-title" value="${escapeHtml(result.title)}" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:12px;font-family:var(--serif);font-size:17px;margin-bottom:15px;color:var(--ink)" />
      <label style="display:block;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:6px">${L.author}</label>
      <input id="android-book-author" value="${escapeHtml(result.author)}" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:12px;font-family:var(--serif);font-size:17px;margin-bottom:12px;color:var(--ink)" />
      <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:18px">${L.confidence}: ${confidence}%</div>
      ${metadata ? `<div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin:4px 0 6px">${L.metadata}</div>${metadata}<div style="height:16px"></div>` : ''}
      <div id="android-book-duplicate" style="display:none;border-top:1px solid var(--oxblood);padding:12px 2px;font-family:var(--serif);font-size:14px;line-height:1.45;color:var(--oxblood)"></div>
      <button id="android-book-add" style="width:100%;border-top:1px solid var(--ink);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px;color:var(--oxblood)">${L.add}</button>
      <button id="android-book-cancel" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px">${L.cancel}</button>
    `;

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    sheet.querySelector('#android-book-cancel').onclick = close;
    const addButton = sheet.querySelector('#android-book-add');
    const duplicateBox = sheet.querySelector('#android-book-duplicate');
    let forceDuplicate = false;
    addButton.onclick = () => {
      const title = sheet.querySelector('#android-book-title').value.trim();
      const author = sheet.querySelector('#android-book-author').value.trim();
      if (!title) return;
      let saved;
      try { saved = JSON.parse(native.addRecognizedBook(title, author, forceDuplicate)); }
      catch (e) {
        console.error(e);
        duplicateBox.style.display = 'block';
        duplicateBox.textContent = String(e);
        return;
      }
      if (saved.duplicate) {
        const details = [saved.existingTitle, saved.existingAuthor].filter(Boolean).join(' · ');
        duplicateBox.style.display = 'block';
        duplicateBox.innerHTML = `${escapeHtml(L.duplicate)}${details ? `<br><strong>${escapeHtml(details)}</strong>` : ''}`;
        forceDuplicate = true;
        addButton.textContent = L.addAnyway;
        return;
      }
      if (!saved.ok) {
        duplicateBox.style.display = 'block';
        duplicateBox.textContent = saved.error || 'Save failed';
        return;
      }
      close();
      native.reloadLibrary();
    };
  }

  window.__bookScanStatus = function (status) {
    if (status === 'running') showBusy(labels().scanning);
    if (status === 'checking') showBusy(labels().checking);
    if (status === 'enriching') showBusy(labels().enriching);
  };

  window.__bookIdentityResult = function (base64, error) {
    removeBusy();
    if (error) { console.error(error); alert(error); return; }
    try { openIdentityReview(decodePayload(base64)); }
    catch (e) { console.error(e); alert(String(e)); }
  };

  window.__bookMetadataResult = function (base64, error) {
    removeBusy();
    if (error) { console.error(error); alert(error); return; }
    try { openReview(decodePayload(base64)); }
    catch (e) { console.error(e); alert(String(e)); }
  };

  window.__bookScanResult = function (base64, error) {
    removeBusy();
    if (error) { console.error(error); alert(error); return; }
    try { openReview(decodePayload(base64)); }
    catch (e) { console.error(e); alert(String(e)); }
  };

  function attachButtons() {
    const header = document.querySelector('#app header');
    if (!header || document.getElementById('android-settings-button')) return false;
    header.style.justifyContent = 'space-between';

    const actions = document.createElement('div');
    actions.id = 'android-header-actions';
    actions.style.cssText = 'display:flex;align-items:center;margin:-7px -7px -7px 8px;position:relative;z-index:2;pointer-events:auto;';

    const scan = document.createElement('button');
    scan.id = 'android-scan-book-button';
    scan.type = 'button';
    scan.setAttribute('aria-label', labels().scan);
    scan.style.cssText = 'width:42px;height:42px;display:grid;place-items:center;color:var(--ink);font-size:24px;line-height:1;position:relative;z-index:3;pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;';
    scan.textContent = '+';
    scan.addEventListener('click', startScan, { passive: false });

    const settings = document.createElement('button');
    settings.id = 'android-settings-button';
    settings.type = 'button';
    settings.setAttribute('aria-label', labels().settings);
    settings.style.cssText = 'width:42px;height:42px;display:grid;place-items:center;color:var(--ink);position:relative;z-index:3;pointer-events:auto;touch-action:manipulation;';
    settings.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.64 8.94a1.7 1.7 0 0 0-.34-1.88L4.24 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10.03 3H10V3h4v.08A1.7 1.7 0 0 0 15.03 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/></svg>';
    settings.onclick = openSettings;

    actions.appendChild(scan);
    actions.appendChild(settings);
    header.appendChild(actions);
    return true;
  }

  if (!attachButtons()) {
    const observer = new MutationObserver(() => { if (attachButtons()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
