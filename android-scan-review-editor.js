// Android-only editable final review for scanned books.
(function () {
  if (!window.AndroidBookSource) return;

  const native = window.AndroidBookSource;

  function decodePayload(base64) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }

  function german() {
    return ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function labelText() {
    return german() ? {
      title: 'Titel', author: 'Autor', genre: 'Genre', year: 'Erstveröffentlichung', language: 'Sprache',
      summary: 'Kurzbeschreibung', mainIdea: 'Kernidee', source: 'Quellenreferenz', confidence: 'Sicherheit',
      add: 'Zur Bibliothek hinzufügen', addAnyway: 'Trotzdem hinzufügen', cancel: 'Abbrechen',
      duplicate: 'Ein ähnlicher Eintrag existiert bereits.', saveFailed: 'Speichern fehlgeschlagen',
      review: 'Erkanntes Buch prüfen', hint: 'Alle Felder können vor dem Speichern korrigiert werden.',
      genresHint: 'Mehrere Genres mit Komma trennen.'
    } : {
      title: 'Title', author: 'Author', genre: 'Genre', year: 'First published', language: 'Language',
      summary: 'Summary', mainIdea: 'Main idea', source: 'Source reference', confidence: 'Confidence',
      add: 'Add to library', addAnyway: 'Add anyway', cancel: 'Cancel',
      duplicate: 'A similar entry already exists.', saveFailed: 'Save failed',
      review: 'Review recognized book', hint: 'All fields can be corrected before saving.',
      genresHint: 'Separate multiple genres with commas.'
    };
  }

  function inputStyle(multiline) {
    return [
      'box-sizing:border-box','width:100%','border:1px solid var(--rule)','background:transparent',
      'padding:11px 12px','font-family:var(--serif)','font-size:16px','color:var(--ink)',
      multiline ? 'min-height:96px' : '', multiline ? 'line-height:1.4' : ''
    ].filter(Boolean).join(';');
  }

  function field(label, id, value, multiline, extra) {
    const control = multiline
      ? `<textarea id="${id}" style="${inputStyle(true)}">${escapeHtml(value || '')}</textarea>`
      : `<input id="${id}" value="${escapeHtml(value || '')}" ${extra || ''} style="${inputStyle(false)}" />`;
    return `<label style="display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.11em;color:var(--ink-3);margin:13px 0 5px">${escapeHtml(label)}</label>${control}`;
  }

  function cleanForCatalog(result) {
    const book = JSON.parse(JSON.stringify(result || {}));
    Object.keys(book).forEach(key => {
      if (key.startsWith('_')) delete book[key];
    });
    delete book.confidence;
    return book;
  }

  async function replaceJustAddedBook(editedBook) {
    const response = await fetch('books.json', { cache: 'no-store' });
    const root = await response.json();
    const books = Array.isArray(root.books) ? root.books : [];
    if (!books.length) throw new Error('Added book was not found in the local catalog.');
    const index = books.length - 1;
    const update = JSON.parse(native.updateBookEntry(index, JSON.stringify(editedBook)));
    if (!update.ok) throw new Error(update.error || 'Could not persist edited metadata.');
  }

  function openEditableReview(result) {
    const L = labelText();
    const old = document.getElementById('android-book-review');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'android-book-review';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:245;background:rgba(28,28,30,.36);display:flex;align-items:flex-end;';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-height:91vh;overflow:auto;background:var(--paper);border-top:1px solid var(--ink);padding:20px 18px calc(20px + var(--safe-bot));box-shadow:0 -18px 50px rgba(28,28,30,.16);';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const genres = Array.isArray(result.genre) ? result.genre.join(', ') : String(result.genre || '');
    const confidence = Math.round((Number(result.confidence) || 0) * 100);
    const sourceParts = [];
    if (result.openlibrary_work_id) sourceParts.push(`Open Library ${result.openlibrary_work_id}`);
    if (Array.isArray(result._metadata_sources) && result._metadata_sources.length) sourceParts.push(result._metadata_sources.join(' · '));

    sheet.innerHTML = `
      <div class="display" style="font-size:24px;margin-bottom:7px">${L.review}</div>
      <div style="font-family:var(--serif);font-size:13px;color:var(--ink-3);margin-bottom:15px">${L.hint}</div>
      ${field(L.title, 'scan-edit-title', result.title, false)}
      ${field(L.author, 'scan-edit-author', result.author, false)}
      ${field(L.genre, 'scan-edit-genre', genres, false)}
      <div style="font-family:var(--serif);font-size:11px;color:var(--ink-3);margin-top:4px">${L.genresHint}</div>
      ${field(L.year, 'scan-edit-year', result.year_published == null ? '' : result.year_published, false, 'inputmode="numeric"')}
      ${field(L.language, 'scan-edit-language', result.language, false)}
      ${field(L.summary, 'scan-edit-summary', result.summary, true)}
      ${field(L.mainIdea, 'scan-edit-mainidea', result.main_idea, true)}
      <div style="margin-top:15px;border-top:1px solid var(--rule);padding-top:8px;display:grid;grid-template-columns:120px 1fr;gap:10px;font-size:12px">
        <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3)">${L.source}</div>
        <div style="font-family:var(--serif)">${escapeHtml(sourceParts.join(' · ') || '—')}</div>
      </div>
      <div style="padding:8px 0 14px;display:grid;grid-template-columns:120px 1fr;gap:10px;font-size:12px">
        <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3)">${L.confidence}</div>
        <div style="font-family:var(--serif)">${confidence}%</div>
      </div>
      <div id="scan-edit-error" style="display:none;border-top:1px solid var(--oxblood);padding:12px 2px;font-family:var(--serif);font-size:14px;line-height:1.45;color:var(--oxblood)"></div>
      <button id="scan-edit-add" style="width:100%;border-top:1px solid var(--ink);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px;color:var(--oxblood)">${L.add}</button>
      <button id="scan-edit-cancel" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px">${L.cancel}</button>
    `;

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    sheet.querySelector('#scan-edit-cancel').onclick = close;
    const addButton = sheet.querySelector('#scan-edit-add');
    const errorBox = sheet.querySelector('#scan-edit-error');
    let forceDuplicate = false;

    addButton.onclick = async () => {
      const title = sheet.querySelector('#scan-edit-title').value.trim();
      const author = sheet.querySelector('#scan-edit-author').value.trim();
      if (!title) {
        sheet.querySelector('#scan-edit-title').focus();
        return;
      }

      const edited = cleanForCatalog(result);
      edited.title = title;
      edited.author = author;
      edited.genre = sheet.querySelector('#scan-edit-genre').value
        .split(/[,;·]/).map(v => v.trim()).filter(Boolean).slice(0, 3);
      const yearText = sheet.querySelector('#scan-edit-year').value.trim();
      const year = Number.parseInt(yearText, 10);
      edited.year_published = Number.isFinite(year) && year > 0 ? year : null;
      edited.language = sheet.querySelector('#scan-edit-language').value.trim();
      edited.summary = sheet.querySelector('#scan-edit-summary').value.trim();
      edited.main_idea = sheet.querySelector('#scan-edit-mainidea').value.trim() || null;

      addButton.disabled = true;
      errorBox.style.display = 'none';
      try {
        const saved = JSON.parse(native.addRecognizedBook(title, author, forceDuplicate));
        if (saved.duplicate) {
          const details = [saved.existingTitle, saved.existingAuthor].filter(Boolean).join(' · ');
          errorBox.style.display = 'block';
          errorBox.innerHTML = `${escapeHtml(L.duplicate)}${details ? `<br><strong>${escapeHtml(details)}</strong>` : ''}`;
          forceDuplicate = true;
          addButton.textContent = L.addAnyway;
          return;
        }
        if (!saved.ok) throw new Error(saved.error || L.saveFailed);
        await replaceJustAddedBook(edited);
        close();
        native.reloadLibrary();
      } catch (e) {
        console.error(e);
        errorBox.style.display = 'block';
        errorBox.textContent = `${L.saveFailed}: ${String(e && e.message || e)}`;
      } finally {
        addButton.disabled = false;
      }
    };
  }

  window.__bookMetadataResult = function (base64, error) {
    const busy = document.getElementById('android-book-busy');
    if (busy) busy.remove();
    if (error) { alert(error); return; }
    try { openEditableReview(decodePayload(base64)); }
    catch (e) { console.error(e); alert(String(e)); }
  };

  window.__bookScanResult = function (base64, error) {
    const busy = document.getElementById('android-book-busy');
    if (busy) busy.remove();
    if (error) { alert(error); return; }
    try { openEditableReview(decodePayload(base64)); }
    catch (e) { console.error(e); alert(String(e)); }
  };
})();
