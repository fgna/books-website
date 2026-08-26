// Android-only fuzzy duplicate finder, merge/edit and deletion UI.
(function () {
  if (!window.AndroidBookSource) return;
  const native = window.AndroidBookSource;

  function isGerman() { return ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de'; }
  function L() {
    return isGerman() ? {
      action:'Duplikate suchen', title:'Mögliche Duplikate', none:'Keine möglichen Duplikate gefunden.', groups:'Gruppen', removable:'zusätzliche Einträge', close:'Schließen',
      deleteSelected:'Ausgewählte löschen', confirmDelete:'Löschen bestätigen', mergeSelected:'Ausgewählte zusammenführen', edit:'Bearbeiten', save:'Speichern', cancel:'Abbrechen',
      confirmText:'Die ausgewählten Einträge werden dauerhaft aus dem lokalen Katalog gelöscht.', selected:'ausgewählt', entry:'Eintrag', year:'Jahr', language:'Sprache', enriched:'Metadaten vorhanden', yes:'ja', no:'nein', error:'Duplikate konnten nicht verarbeitet werden.',
      confidence:'Ähnlichkeit', reason:'Grund', mergeTitle:'Einträge zusammenführen', mergeHint:'Die vollständigsten Metadaten wurden vorausgewählt. Bitte vor dem Speichern prüfen.',
      titleField:'Titel', authorField:'Autor', genre:'Genre', summary:'Kurzbeschreibung', mainIdea:'Kernidee', series:'Reihe', originalTitle:'Originaltitel', originalLanguage:'Originalsprache'
    } : {
      action:'Find duplicates', title:'Possible duplicates', none:'No possible duplicates found.', groups:'groups', removable:'extra entries', close:'Close',
      deleteSelected:'Delete selected', confirmDelete:'Confirm deletion', mergeSelected:'Merge selected', edit:'Edit', save:'Save', cancel:'Cancel',
      confirmText:'The selected entries will be permanently removed from the local catalog.', selected:'selected', entry:'Entry', year:'Year', language:'Language', enriched:'Metadata present', yes:'yes', no:'no', error:'Duplicates could not be processed.',
      confidence:'Similarity', reason:'Reason', mergeTitle:'Merge entries', mergeHint:'The most complete metadata was preselected. Review it before saving.',
      titleField:'Title', authorField:'Author', genre:'Genre', summary:'Summary', mainIdea:'Main idea', series:'Series', originalTitle:'Original title', originalLanguage:'Original language'
    };
  }

  function esc(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function sheetBase(id, z) {
    const overlay=document.createElement('div'); overlay.id=id; overlay.style.cssText=`position:fixed;inset:0;z-index:${z||360};background:rgba(28,28,30,.36);display:flex;align-items:flex-end;`;
    const sheet=document.createElement('div'); sheet.style.cssText='width:100%;max-height:92vh;overflow:auto;background:var(--paper);border-top:1px solid var(--ink);padding:20px 18px calc(20px + var(--safe-bot));box-shadow:0 -18px 50px rgba(28,28,30,.16);';
    overlay.appendChild(sheet); document.body.appendChild(overlay); return {overlay,sheet};
  }
  function contextLine(entry,l){const p=[];if(entry.year_published!=null)p.push(`${l.year}: ${entry.year_published}`);if(entry.language)p.push(`${l.language}: ${entry.language}`);if(entry.openlibrary_work_id)p.push(`Open Library: ${entry.openlibrary_work_id}`);p.push(`${l.enriched}: ${entry.has_summary?l.yes:l.no}`);return p.join(' · ');}
  function empty(v){return v==null||v===''||(Array.isArray(v)&&!v.length);}
  function completeness(book){let n=0;Object.keys(book||{}).forEach(k=>{if(!empty(book[k]))n+=Array.isArray(book[k])?book[k].length+1:1;});return n;}
  function mergeCandidate(entries){
    const books=entries.map(e=>e.book||{}).sort((a,b)=>completeness(b)-completeness(a));
    const merged=JSON.parse(JSON.stringify(books[0]||{}));
    const keys=new Set(books.flatMap(b=>Object.keys(b)));
    keys.forEach(key=>{
      if(Array.isArray(merged[key])){
        const seen=new Set();const out=[];books.forEach(b=>(Array.isArray(b[key])?b[key]:[]).forEach(v=>{const k=JSON.stringify(v);if(!seen.has(k)){seen.add(k);out.push(v);}}));merged[key]=out;
      } else if(empty(merged[key])) {
        const found=books.map(b=>b[key]).find(v=>!empty(v)); if(found!==undefined) merged[key]=found;
      }
    });
    delete merged.confidence;
    return merged;
  }
  function field(label,id,value,multi){return `<label style="display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin:10px 0 5px">${esc(label)}</label>${multi?`<textarea id="${id}" rows="4" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:10px;font-family:var(--serif);font-size:15px;color:var(--ink)">${esc(value||'')}</textarea>`:`<input id="${id}" value="${esc(value||'')}" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:10px;font-family:var(--serif);font-size:15px;color:var(--ink)"/>`}`;}

  function openMerge(entries,onDone){
    const l=L(), candidate=mergeCandidate(entries), {overlay,sheet}=sheetBase('android-duplicate-merge',390), close=()=>overlay.remove();
    const genre=Array.isArray(candidate.genre)?candidate.genre.join(', '):candidate.genre||'';
    sheet.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div class="display" style="font-size:24px">${esc(l.mergeTitle)}</div><button id="merge-close" style="padding:8px">${esc(l.close)}</button></div><div style="font-family:var(--serif);font-size:14px;color:var(--ink-2);margin:10px 0 14px">${esc(l.mergeHint)}</div>
      ${field(l.titleField,'merge-title',candidate.title)}${field(l.authorField,'merge-author',candidate.author)}${field(l.originalTitle,'merge-original-title',candidate.original_title)}${field(l.genre,'merge-genre',genre)}${field(l.year,'merge-year',candidate.year_published)}${field(l.language,'merge-language',candidate.language)}${field(l.originalLanguage,'merge-original-language',candidate.original_language)}${field(l.series,'merge-series',candidate.series)}${field(l.summary,'merge-summary',candidate.summary,true)}${field(l.mainIdea,'merge-main-idea',candidate.main_idea,true)}
      <div id="merge-error" style="display:none;color:var(--oxblood);font-family:var(--serif);font-size:14px;padding:10px 0"></div><button id="merge-save" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood)">${esc(l.save)}</button><button id="merge-cancel" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px">${esc(l.cancel)}</button>`;
    sheet.querySelector('#merge-close').onclick=close;sheet.querySelector('#merge-cancel').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    sheet.querySelector('#merge-save').onclick=()=>{
      const value=id=>sheet.querySelector(id).value.trim();
      candidate.title=value('#merge-title');candidate.author=value('#merge-author');candidate.original_title=value('#merge-original-title')||null;candidate.genre=value('#merge-genre').split(',').map(x=>x.trim()).filter(Boolean);candidate.language=value('#merge-language');candidate.original_language=value('#merge-original-language')||null;candidate.series=value('#merge-series')||null;candidate.summary=value('#merge-summary');candidate.main_idea=value('#merge-main-idea')||null;
      const y=value('#merge-year');candidate.year_published=y&&Number.isFinite(Number(y))?Number(y):null;
      let result;try{result=JSON.parse(native.mergeBookEntries(JSON.stringify(entries.map(e=>Number(e.index))),JSON.stringify(candidate)));}catch(e){result={ok:false,error:String(e)}}
      if(!result.ok){const box=sheet.querySelector('#merge-error');box.style.display='block';box.textContent=result.error||l.error;return;}
      close();onDone();
    };
  }

  function openEdit(entry,onDone){
    const l=L(), candidate=JSON.parse(JSON.stringify(entry.book||{})), {overlay,sheet}=sheetBase('android-duplicate-edit',390), close=()=>overlay.remove();
    const genre=Array.isArray(candidate.genre)?candidate.genre.join(', '):candidate.genre||'';
    sheet.innerHTML=`<div class="display" style="font-size:24px;margin-bottom:12px">${esc(l.edit)}</div>${field(l.titleField,'edit-title',candidate.title)}${field(l.authorField,'edit-author',candidate.author)}${field(l.genre,'edit-genre',genre)}${field(l.year,'edit-year',candidate.year_published)}${field(l.language,'edit-language',candidate.language)}${field(l.summary,'edit-summary',candidate.summary,true)}${field(l.mainIdea,'edit-main-idea',candidate.main_idea,true)}<div id="edit-error" style="display:none;color:var(--oxblood);padding:10px 0"></div><button id="edit-save" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood)">${esc(l.save)}</button><button id="edit-cancel" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px">${esc(l.cancel)}</button>`;
    sheet.querySelector('#edit-cancel').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    sheet.querySelector('#edit-save').onclick=()=>{const v=id=>sheet.querySelector(id).value.trim();candidate.title=v('#edit-title');candidate.author=v('#edit-author');candidate.genre=v('#edit-genre').split(',').map(x=>x.trim()).filter(Boolean);candidate.language=v('#edit-language');candidate.summary=v('#edit-summary');candidate.main_idea=v('#edit-main-idea')||null;const y=v('#edit-year');candidate.year_published=y&&Number.isFinite(Number(y))?Number(y):null;let result;try{result=JSON.parse(native.updateBookEntry(Number(entry.index),JSON.stringify(candidate)));}catch(e){result={ok:false,error:String(e)}}if(!result.ok){const box=sheet.querySelector('#edit-error');box.style.display='block';box.textContent=result.error||l.error;return;}close();onDone();};
  }

  function openDuplicates(){
    const l=L();let result;try{result=JSON.parse(native.findDuplicateBooks());}catch(e){result={ok:false,error:String(e)}}
    const {overlay,sheet}=sheetBase('android-duplicates-overlay',360),close=()=>overlay.remove();overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    if(!result.ok||!Array.isArray(result.groups)||!result.groups.length){sheet.innerHTML=`<div class="display" style="font-size:24px;margin-bottom:18px">${esc(l.title)}</div><div style="font-family:var(--serif);font-size:17px;margin-bottom:22px">${esc(result.ok?l.none:(result.error||l.error))}</div><button id="dup-close" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left">${esc(l.close)}</button>`;sheet.querySelector('#dup-close').onclick=close;return;}

    const groups=result.groups;
    const html=groups.map((g,gi)=>`<section class="dup-group" data-group="${gi}" style="margin-bottom:28px"><div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3)">${esc(l.confidence)} ${Math.round((Number(g.confidence)||0)*100)}% · ${esc(g.reason||'')}</div><div class="display" style="font-size:20px;margin:5px 0 8px">${esc(g.title)}</div>${g.entries.map((e,ei)=>`<div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start;padding:11px 0;border-top:1px solid var(--rule)"><input type="checkbox" class="dup-check" data-group="${gi}" data-index="${Number(e.index)}" ${ei<2?'checked':''} style="width:18px;height:18px;margin-top:3px"/><div><div style="font-family:var(--serif);font-size:16px;line-height:1.25">${esc(e.title)}</div><div style="font-size:12px;color:var(--ink-2)">${esc(e.author)}</div><div style="font-family:var(--mono);font-size:9px;color:var(--ink-3);margin-top:4px">${esc(contextLine(e,l))}</div></div><button class="dup-edit" data-group="${gi}" data-entry="${ei}" style="font-family:var(--mono);font-size:9px;padding:6px">${esc(l.edit)}</button></div>`).join('')}<button class="dup-merge" data-group="${gi}" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:12px 2px;color:var(--oxblood)">${esc(l.mergeSelected)}</button></section>`).join('');
    sheet.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div class="display" style="font-size:24px">${esc(l.title)}</div><button id="dup-close" style="padding:8px">${esc(l.close)}</button></div><div style="font-family:var(--mono);font-size:9px;color:var(--ink-3);margin-bottom:20px">${Number(result.groupCount)} ${esc(l.groups)} · ${Number(result.duplicateCount)} ${esc(l.removable)}</div>${html}<div id="dup-confirm" style="display:none;border-top:1px solid var(--oxblood);padding:13px 2px;color:var(--oxblood);font-family:var(--serif);font-size:14px">${esc(l.confirmText)}</div><button id="dup-delete" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood)">${esc(l.deleteSelected)}</button><button id="dup-cancel" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px">${esc(l.cancel)}</button>`;
    sheet.querySelector('#dup-close').onclick=close;sheet.querySelector('#dup-cancel').onclick=close;
    const checks=()=>Array.from(sheet.querySelectorAll('.dup-check'));
    const selected=()=>checks().filter(c=>c.checked).map(c=>Number(c.dataset.index));
    sheet.querySelectorAll('.dup-edit').forEach(btn=>btn.onclick=()=>openEdit(groups[Number(btn.dataset.group)].entries[Number(btn.dataset.entry)],()=>{close();native.reloadLibrary();}));
    sheet.querySelectorAll('.dup-merge').forEach(btn=>btn.onclick=()=>{const gi=Number(btn.dataset.group), chosen=checks().filter(c=>c.checked&&Number(c.dataset.group)===gi).map(c=>groups[gi].entries.find(e=>Number(e.index)===Number(c.dataset.index))).filter(Boolean);if(chosen.length<2){btn.textContent=`${l.mergeSelected} (2+)`;return;}openMerge(chosen,()=>{close();native.reloadLibrary();});});
    let armed=false;const confirm=sheet.querySelector('#dup-confirm');sheet.querySelector('#dup-delete').onclick=()=>{const indices=selected();if(!indices.length)return;if(!armed){armed=true;confirm.style.display='block';return;}let r;try{r=JSON.parse(native.deleteBookEntries(JSON.stringify(indices)));}catch(e){r={ok:false,error:String(e)}}if(!r.ok){confirm.textContent=r.error||l.error;armed=false;return;}close();native.reloadLibrary();};
    checks().forEach(c=>c.addEventListener('change',()=>{armed=false;confirm.style.display='none';}));
  }

  function injectSettingsAction(){const overlay=document.getElementById('android-settings-overlay');if(!overlay||overlay.querySelector('#android-find-duplicates'))return;const anchor=overlay.querySelector('#android-export-json');if(!anchor)return;const button=document.createElement('button');button.id='android-find-duplicates';button.textContent=L().action;button.style.cssText='width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px;';button.onclick=()=>{overlay.remove();openDuplicates();};anchor.insertAdjacentElement('afterend',button);}
  const observer=new MutationObserver(injectSettingsAction);observer.observe(document.documentElement,{childList:true,subtree:true});injectSettingsAction();
})();
