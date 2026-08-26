// Android-only duplicate finder and deletion UI.
(function () {
  if (!window.AndroidBookSource) return;
  const native = window.AndroidBookSource;

  function isGerman() {
    return ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  }

  function L() {
    return isGerman() ? {
      action: 'Duplikate suchen', title: 'Duplikate', none: 'Keine Duplikate gefunden.',
      groups: 'Gruppen', removable: 'zusätzliche Einträge', close: 'Schließen',
      deleteSelected: 'Ausgewählte löschen', confirmDelete: 'Löschen bestätigen', cancel: 'Abbrechen',
      confirmText: 'Die ausgewählten Einträge werden dauerhaft aus dem lokalen Katalog gelöscht.',
      selected: 'ausgewählt', entry: 'Eintrag', year: 'Jahr', language: 'Sprache', enriched: 'Metadaten vorhanden',
      yes: 'ja', no: 'nein', error: 'Duplikate konnten nicht verarbeitet werden.'
    } : {
      action: 'Find duplicates', title: 'Duplicates', none: 'No duplicates found.',
      groups: 'groups', removable: 'extra entries', close: 'Close',
      deleteSelected: 'Delete selected', confirmDelete: 'Confirm deletion', cancel: 'Cancel',
      confirmText: 'The selected entries will be permanently removed from the local catalog.',
      selected: 'selected', entry: 'Entry', year: 'Year', language: 'Language', enriched: 'Metadata present',
      yes: 'yes', no: 'no', error: 'Duplicates could not be processed.'
    };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function sheetBase(id) {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:360;background:rgba(28,28,30,.36);display:flex;align-items:flex-end;';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'width:100%;max-height:92vh;overflow:auto;background:var(--paper);border-top:1px solid var(--ink);padding:20px 18px calc(20px + var(--safe-bot));box-shadow:0 -18px 50px rgba(28,28,30,.16);';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    return { overlay, sheet };
  }

  function contextLine(entry, label) {
    const parts = [];
    if (entry.year_published != null) parts.push(`${label.year}: ${entry.year_published}`);
    if (entry.language) parts.push(`${label.language}: ${entry.language}`);
    if (entry.openlibrary_work_id) parts.push(`Open Library: ${entry.openlibrary_work_id}`);
    parts.push(`${label.enriched}: ${entry.has_summary ? label.yes : label.no}`);
    return parts.join(' · ');
  }

  function openDuplicates() {
    const label = L();
    let result;
    try { result = JSON.parse(native.findDuplicateBooks()); }
    catch (e) { result = { ok: false, error: String(e) }; }

    const { overlay, sheet } = sheetBase('android-duplicates-overlay');
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    if (!result.ok) {
      sheet.innerHTML = `
        <div class="display" style="font-size:24px;margin-bottom:18px">${escapeHtml(label.title)}</div>
        <div style="font-family:var(--serif);font-size:16px;line-height:1.45;margin-bottom:20px;color:var(--oxblood)">${escapeHtml(result.error || label.error)}</div>
        <button id="dup-close" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left">${escapeHtml(label.close)}</button>`;
      sheet.querySelector('#dup-close').onclick = close;
      return;
    }

    const groups = Array.isArray(result.groups) ? result.groups : [];
    if (!groups.length) {
      sheet.innerHTML = `
        <div class="display" style="font-size:24px;margin-bottom:18px">${escapeHtml(label.title)}</div>
        <div style="font-family:var(--serif);font-size:17px;margin-bottom:22px">${escapeHtml(label.none)}</div>
        <button id="dup-close" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left">${escapeHtml(label.close)}</button>`;
      sheet.querySelector('#dup-close').onclick = close;
      return;
    }

    const groupsHtml = groups.map((group, groupIndex) => {
      const entries = Array.isArray(group.entries) ? group.entries : [];
      const entriesHtml = entries.map((entry, entryIndex) => {
        const checked = entryIndex > 0 ? 'checked' : '';
        return `
          <label style="display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start;padding:12px 0;border-top:1px solid var(--rule)">
            <input type="checkbox" class="dup-check" data-index="${Number(entry.index)}" ${checked} style="width:18px;height:18px;margin-top:3px" />
            <div>
              <div style="font-family:var(--serif);font-size:16px;line-height:1.25">${escapeHtml(entry.title)}</div>
              <div style="font-family:var(--sans);font-size:12px;margin-top:2px;color:var(--ink-2)">${escapeHtml(entry.author)}</div>
              <div style="font-family:var(--mono);font-size:9px;line-height:1.5;margin-top:6px;color:var(--ink-3)">${escapeHtml(label.entry)} #${Number(entry.index) + 1} · ${escapeHtml(contextLine(entry, label))}</div>
            </div>
          </label>`;
      }).join('');
      return `
        <section style="margin:0 0 24px">
          <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:4px">${escapeHtml(label.title)} ${groupIndex + 1}</div>
          <div class="display" style="font-size:20px">${escapeHtml(group.title)}</div>
          <div style="font-family:var(--sans);font-size:13px;color:var(--ink-2);margin:3px 0 9px">${escapeHtml(group.author)}</div>
          ${entriesHtml}
        </section>`;
    }).join('');

    sheet.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="display" style="font-size:24px">${escapeHtml(label.title)}</div>
        <button id="dup-close" style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;padding:8px">${escapeHtml(label.close)}</button>
      </div>
      <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:22px">${Number(result.groupCount)} ${escapeHtml(label.groups)} · ${Number(result.duplicateCount)} ${escapeHtml(label.removable)}</div>
      ${groupsHtml}
      <div id="dup-confirm" style="display:none;border-top:1px solid var(--oxblood);padding:13px 2px;color:var(--oxblood);font-family:var(--serif);font-size:14px;line-height:1.45">${escapeHtml(label.confirmText)}</div>
      <button id="dup-delete" style="width:100%;border-top:1px solid var(--ink);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px;color:var(--oxblood)"></button>
      <button id="dup-cancel" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;font-family:var(--sans);font-size:15px">${escapeHtml(label.cancel)}</button>`;

    const deleteButton = sheet.querySelector('#dup-delete');
    const confirmBox = sheet.querySelector('#dup-confirm');
    const checks = Array.from(sheet.querySelectorAll('.dup-check'));
    let armed = false;

    function selectedIndices() {
      return checks.filter(c => c.checked).map(c => Number(c.dataset.index)).filter(Number.isInteger);
    }

    function updateButton() {
      const count = selectedIndices().length;
      deleteButton.disabled = count === 0;
      deleteButton.style.opacity = count === 0 ? '.4' : '1';
      deleteButton.textContent = `${armed ? label.confirmDelete : label.deleteSelected} (${count} ${label.selected})`;
    }

    checks.forEach(check => check.addEventListener('change', () => { armed = false; confirmBox.style.display = 'none'; updateButton(); }));
    sheet.querySelector('#dup-close').onclick = close;
    sheet.querySelector('#dup-cancel').onclick = close;
    updateButton();

    deleteButton.onclick = () => {
      const indices = selectedIndices();
      if (!indices.length) return;
      if (!armed) {
        armed = true;
        confirmBox.style.display = 'block';
        updateButton();
        confirmBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      let deleted;
      try { deleted = JSON.parse(native.deleteBookEntries(JSON.stringify(indices))); }
      catch (e) { deleted = { ok: false, error: String(e) }; }
      if (!deleted.ok) {
        confirmBox.style.display = 'block';
        confirmBox.textContent = deleted.error || label.error;
        armed = false;
        updateButton();
        return;
      }
      close();
      native.reloadLibrary();
    };
  }

  function injectSettingsAction() {
    const overlay = document.getElementById('android-settings-overlay');
    if (!overlay || overlay.querySelector('#android-find-duplicates')) return;
    const anchor = overlay.querySelector('#android-export-json');
    if (!anchor) return;
    const button = document.createElement('button');
    button.id = 'android-find-duplicates';
    button.textContent = L().action;
    button.style.cssText = 'width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px;';
    button.onclick = () => { overlay.remove(); openDuplicates(); };
    anchor.insertAdjacentElement('afterend', button);
  }

  const observer = new MutationObserver(injectSettingsAction);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  injectSettingsAction();
})();
