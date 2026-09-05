// Android-only editor for existing catalog entries.
(function () {
  if (!window.AndroidBookSource) return;
  const native = window.AndroidBookSource;

  const de = () => ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  const text = () => de() ? {
    edit: 'Bearbeiten', heading: 'Buch bearbeiten', save: 'Änderungen speichern', remove: 'Buch löschen', cancel: 'Abbrechen',
    title: 'Titel', originalTitle: 'Originaltitel', author: 'Autor', genres: 'Genres', language: 'Sprache', originalLanguage: 'Originalsprache',
    year: 'Erstveröffentlichung', keywords: 'Schlagwörter', summary: 'Kurzbeschreibung', mainIdea: 'Kernidee', period: 'Periode', country: 'Herkunftsland', rating: 'Bewertung', series: 'Reihe', read: 'Gelesen',
    yes: 'Ja', no: 'Nein', unknown: 'Unbekannt', deleteConfirm: 'Dieses Buch wirklich aus der Bibliothek löschen?', confirmDelete: 'Ja, Buch löschen', deleting: 'Buch wird gelöscht…', loadError: 'Buch konnte nicht geladen werden.'
  } : {
    edit: 'Edit', heading: 'Edit book', save: 'Save changes', remove: 'Delete book', cancel: 'Cancel',
    title: 'Title', originalTitle: 'Original title', author: 'Author', genres: 'Genres', language: 'Language', originalLanguage: 'Original language',
    year: 'First published', keywords: 'Keywords', summary: 'Summary', mainIdea: 'Main idea', period: 'Period', country: 'Country of origin', rating: 'Rating', series: 'Series', read: 'Read',
    yes: 'Yes', no: 'No', unknown: 'Unknown', deleteConfirm: 'Really delete this book from the library?', confirmDelete: 'Yes, delete book', deleting: 'Deleting book…', loadError: 'Could not load book.'
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function field(label, id, value, textarea) {
    const common = 'box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:11px;font-family:var(--serif);font-size:16px;color:var(--ink);';
    return `<label style="display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin:13px 0 5px">${esc(label)}</label>` +
      (textarea
        ? `<textarea id="${id}" rows="4" style="${common}resize:vertical">${esc(value)}</textarea>`
        : `<input id="${id}" value="${esc(value)}" style="${common}" />`);
  }

  function nullable(value) {
    const v = String(value == null ? '' : value).trim();
    return v ? v : null;
  }

  function list(value) {
    return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
  }

  async function loadRawBook(index) {
    const response = await fetch('books.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('books.json HTTP ' + response.status);
    const root = await response.json();
    if (!root || !Array.isArray(root.books) || !root.books[index]) throw new Error('Book index not found');
    return JSON.parse(JSON.stringify(root.books[index]));
  }

  async function openEditor(index) {
    if (document.getElementById('android-existing-book-editor')) return;
    const L = text();
    let book;
    try { book = await loadRawBook(index); }
    catch (e) { console.error(e); alert(L.loadError + '\n' + String(e)); return; }

    const overlay = document.createElement('div');
    overlay.id = 'android-existing-book-editor';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(28,28,30,.4);display:flex;align-items:flex-end;';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'box-sizing:border-box;width:100%;max-height:92vh;overflow:auto;background:var(--paper);border-top:2px solid var(--ink);padding:20px 18px calc(24px + var(--safe-bot));';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const genres = Array.isArray(book.genre) ? book.genre.join(', ') : '';
    const keywords = Array.isArray(book.keywords) ? book.keywords.join(', ') : '';
    const readValue = book.read === true ? 'true' : book.read === false ? 'false' : '';

    sheet.innerHTML = `
      <div class="display" style="font-size:25px;margin-bottom:5px">${esc(L.heading)}</div>
      ${field(L.title, 'abe-title', book.title)}
      ${field(L.originalTitle, 'abe-original-title', book.original_title)}
      ${field(L.author, 'abe-author', book.author)}
      ${field(L.genres, 'abe-genres', genres)}
      ${field(L.language, 'abe-language', book.language)}
      ${field(L.originalLanguage, 'abe-original-language', book.original_language)}
      ${field(L.year, 'abe-year', book.year_published)}
      ${field(L.keywords, 'abe-keywords', keywords)}
      ${field(L.summary, 'abe-summary', book.summary, true)}
      ${field(L.mainIdea, 'abe-main-idea', book.main_idea, true)}
      ${field(L.period, 'abe-period', book.period)}
      ${field(L.country, 'abe-country', book.country_of_origin)}
      ${field(L.rating, 'abe-rating', book.rating)}
      ${field(L.series, 'abe-series', book.series)}
      <label style="display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin:13px 0 5px">${esc(L.read)}</label>
      <select id="abe-read" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:var(--paper);padding:11px;font-family:var(--serif);font-size:16px;color:var(--ink)">
        <option value="" ${readValue === '' ? 'selected' : ''}>${esc(L.unknown)}</option>
        <option value="true" ${readValue === 'true' ? 'selected' : ''}>${esc(L.yes)}</option>
        <option value="false" ${readValue === 'false' ? 'selected' : ''}>${esc(L.no)}</option>
      </select>
      <div id="abe-error" style="display:none;margin-top:14px;color:var(--oxblood);font-family:var(--serif);font-size:14px"></div>
      <div id="abe-status" style="display:none;margin-top:14px;font-family:var(--serif);font-size:15px;color:var(--ink-2)"></div>
      <button id="abe-save" style="width:100%;border-top:1px solid var(--ink);margin-top:22px;padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px;color:var(--oxblood)">${esc(L.save)}</button>
      <button id="abe-delete" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px;color:var(--oxblood)">${esc(L.remove)}</button>
      <div id="abe-delete-confirm" style="display:none;border-top:1px solid var(--oxblood);padding:14px 0 2px">
        <div style="font-family:var(--serif);font-size:16px;line-height:1.4;color:var(--ink);margin-bottom:10px">${esc(L.deleteConfirm)}</div>
        <div style="display:flex;gap:10px">
          <button id="abe-delete-confirm-yes" style="flex:1;border:1px solid var(--oxblood);padding:11px 9px;font-family:var(--sans);font-size:14px;color:var(--oxblood)">${esc(L.confirmDelete)}</button>
          <button id="abe-delete-confirm-no" style="flex:1;border:1px solid var(--rule);padding:11px 9px;font-family:var(--sans);font-size:14px">${esc(L.cancel)}</button>
        </div>
      </div>
      <button id="abe-cancel" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px">${esc(L.cancel)}</button>
    `;

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    sheet.querySelector('#abe-cancel').onclick = close;

    sheet.querySelector('#abe-save').onclick = () => {
      const title = sheet.querySelector('#abe-title').value.trim();
      if (!title) { sheet.querySelector('#abe-title').focus(); return; }
      const updated = JSON.parse(JSON.stringify(book));
      updated.title = title;
      updated.original_title = nullable(sheet.querySelector('#abe-original-title').value);
      updated.author = sheet.querySelector('#abe-author').value.trim();
      updated.genre = list(sheet.querySelector('#abe-genres').value);
      updated.language = sheet.querySelector('#abe-language').value.trim();
      updated.original_language = nullable(sheet.querySelector('#abe-original-language').value);
      const year = sheet.querySelector('#abe-year').value.trim();
      updated.year_published = year === '' ? null : Number(year);
      updated.keywords = list(sheet.querySelector('#abe-keywords').value);
      updated.summary = sheet.querySelector('#abe-summary').value.trim();
      updated.main_idea = nullable(sheet.querySelector('#abe-main-idea').value);
      updated.period = nullable(sheet.querySelector('#abe-period').value);
      updated.country_of_origin = nullable(sheet.querySelector('#abe-country').value);
      const rating = sheet.querySelector('#abe-rating').value.trim();
      updated.rating = rating === '' ? null : Number(rating);
      updated.series = nullable(sheet.querySelector('#abe-series').value);
      const read = sheet.querySelector('#abe-read').value;
      updated.read = read === 'true' ? true : read === 'false' ? false : null;

      const error = sheet.querySelector('#abe-error');
      try {
        const result = JSON.parse(native.updateBookEntry(index, JSON.stringify(updated)));
        if (!result.ok) throw new Error(result.error || 'Save failed');
        close();
        native.reloadLibrary();
      } catch (e) {
        console.error(e);
        error.style.display = 'block';
        error.textContent = String(e);
      }
    };

    const deleteButton = sheet.querySelector('#abe-delete');
    const confirmBox = sheet.querySelector('#abe-delete-confirm');
    const confirmYes = sheet.querySelector('#abe-delete-confirm-yes');
    const confirmNo = sheet.querySelector('#abe-delete-confirm-no');

    deleteButton.onclick = () => {
      confirmBox.style.display = 'block';
      deleteButton.style.display = 'none';
      confirmBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    confirmNo.onclick = () => {
      confirmBox.style.display = 'none';
      deleteButton.style.display = 'block';
    };

    confirmYes.onclick = () => {
      const error = sheet.querySelector('#abe-error');
      const status = sheet.querySelector('#abe-status');
      const saveButton = sheet.querySelector('#abe-save');
      const cancelButton = sheet.querySelector('#abe-cancel');

      error.style.display = 'none';
      confirmBox.style.display = 'none';
      status.style.display = 'block';
      status.textContent = L.deleting;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      saveButton.style.opacity = '.45';
      cancelButton.style.opacity = '.45';

      window.setTimeout(() => {
        try {
          const result = JSON.parse(native.deleteBookEntries(JSON.stringify([index])));
          if (!result.ok) throw new Error(result.error || 'Delete failed');
          close();
          native.reloadLibrary();
        } catch (e) {
          console.error(e);
          status.style.display = 'none';
          error.style.display = 'block';
          error.textContent = String(e);
          deleteButton.style.display = 'block';
          saveButton.disabled = false;
          cancelButton.disabled = false;
          saveButton.style.opacity = '1';
          cancelButton.style.opacity = '1';
        }
      }, 30);
    };
  }

  function attachEditButton() {
    const closeButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === '✕');
    for (const close of closeButtons) {
      const actions = close.parentElement;
      const topbar = actions && actions.parentElement;
      if (!actions || !topbar || actions.querySelector('.android-edit-existing-book')) continue;
      const volume = topbar.querySelector('.mono');
      const match = volume && volume.textContent.match(/№\s*(\d+)/);
      if (!match) continue;
      const index = Math.max(0, parseInt(match[1], 10) - 1);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'android-edit-existing-book';
      button.textContent = text().edit;
      button.style.cssText = 'font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--oxblood);padding:6px 9px;border:1px solid var(--rule);';
      button.onclick = (event) => { event.preventDefault(); event.stopPropagation(); openEditor(index); };
      actions.insertBefore(button, close);
    }
  }

  const observer = new MutationObserver(attachEditButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  attachEditButton();
})();
