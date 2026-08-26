// Android-only fuzzy duplicate finder, merge/edit and deletion UI.
(function () {
  if (!window.AndroidBookSource) return;
  const native = window.AndroidBookSource;
  const IGNORE_KEY = 'library.duplicateIgnorePairs.v1';
  let catalogChanged = false;
  const ignoredSession = new Set();

  const isGerman = () => ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  const labels = () => isGerman() ? {
    action:'Duplikate suchen', searching:'Duplikate werden gesucht…', title:'Mögliche Duplikate', none:'Keine möglichen Duplikate gefunden.', close:'Schließen',
    merge:'Ausgewählte zusammenführen', edit:'Bearbeiten', save:'Speichern', cancel:'Abbrechen', del:'Ausgewählte löschen', confirm:'Löschen bestätigen', notDuplicate:'Kein Duplikat',
    similarity:'Ähnlichkeit', error:'Duplikate konnten nicht verarbeitet werden.', mergeTitle:'Einträge zusammenführen',
    hint:'Die vollständigsten Metadaten wurden vorausgewählt. Bitte vor dem Speichern prüfen.', titleField:'Titel', authorField:'Autor', originalTitle:'Originaltitel',
    genre:'Genre', year:'Jahr', language:'Sprache', originalLanguage:'Originalsprache', series:'Reihe', summary:'Kurzbeschreibung', mainIdea:'Kernidee'
  } : {
    action:'Find duplicates', searching:'Searching for duplicates…', title:'Possible duplicates', none:'No possible duplicates found.', close:'Close',
    merge:'Merge selected', edit:'Edit', save:'Save', cancel:'Cancel', del:'Delete selected', confirm:'Confirm deletion', notDuplicate:'Not a duplicate',
    similarity:'Similarity', error:'Duplicates could not be processed.', mergeTitle:'Merge entries',
    hint:'The most complete metadata was preselected. Review it before saving.', titleField:'Title', authorField:'Author', originalTitle:'Original title',
    genre:'Genre', year:'Year', language:'Language', originalLanguage:'Original language', series:'Series', summary:'Summary', mainIdea:'Main idea'
  };

  const esc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');

  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
    return JSON.stringify(value == null ? null : value);
  }
  function fingerprint(entry) {
    const b = entry && entry.book ? entry.book : entry || {};
    return stable(b);
  }
  function pairKey(a,b) {
    const aa=fingerprint(a), bb=fingerprint(b);
    return aa < bb ? aa+'\u001f'+bb : bb+'\u001f'+aa;
  }
  function ignoredPairs() {
    const out = new Set(ignoredSession);
    try {
      const v=JSON.parse(localStorage.getItem(IGNORE_KEY)||'[]');
      if (Array.isArray(v)) v.forEach(key => out.add(key));
    } catch (_) {}
    return out;
  }
  function saveIgnored(set) {
    set.forEach(key => ignoredSession.add(key));
    try { localStorage.setItem(IGNORE_KEY, JSON.stringify(Array.from(set))); } catch (_) {}
  }
  function groupIgnored(group,set) {
    const entries=(group&&group.entries)||[];
    if(entries.length<2) return false;
    for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) if(!set.has(pairKey(entries[i],entries[j]))) return false;
    return true;
  }
  function ignoreGroup(group) {
    const set=ignoredPairs(), entries=(group&&group.entries)||[];
    for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) set.add(pairKey(entries[i],entries[j]));
    saveIgnored(set);
  }

  function sheetBase(id,z) {
    document.getElementById(id)?.remove();
    const overlay=document.createElement('div'); overlay.id=id;
    overlay.style.cssText=`position:fixed;inset:0;z-index:${z||360};background:rgba(28,28,30,.36);display:flex;align-items:flex-end;pointer-events:auto;touch-action:none;`;
    const sheet=document.createElement('div');
    sheet.style.cssText='width:100%;height:92vh;max-height:92vh;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;background:var(--paper);border-top:1px solid var(--ink);padding:20px 18px calc(20px + var(--safe-bot));box-shadow:0 -18px 50px rgba(28,28,30,.16);pointer-events:auto;';
    overlay.appendChild(sheet); document.body.appendChild(overlay); return {overlay,sheet};
  }
  function busyScreen() {
    document.getElementById('android-duplicates-busy')?.remove();
    const L=labels(), busy=document.createElement('div'); busy.id='android-duplicates-busy';
    busy.style.cssText='position:fixed;inset:0;z-index:355;background:rgba(248,246,241,.96);display:grid;place-items:center;padding:30px;text-align:center;color:var(--ink);';
    busy.innerHTML=`<div><div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:12px">${isGerman()?'Bibliothek':'Library'}</div><div style="font-family:var(--serif);font-size:18px">${esc(L.searching)}</div></div>`;
    document.body.appendChild(busy); return busy;
  }

  const empty=v=>v==null||v===''||(Array.isArray(v)&&v.length===0);
  function completeness(book){let n=0;Object.keys(book||{}).forEach(k=>{if(!empty(book[k]))n+=Array.isArray(book[k])?book[k].length+1:1;});return n;}
  function mergeCandidate(entries){
    const books=entries.map(e=>e.book||{}).sort((a,b)=>completeness(b)-completeness(a));
    const merged=JSON.parse(JSON.stringify(books[0]||{})), keys=new Set(); books.forEach(b=>Object.keys(b).forEach(k=>keys.add(k)));
    keys.forEach(key=>{if(Array.isArray(merged[key])){const out=[],seen=new Set();books.forEach(b=>(Array.isArray(b[key])?b[key]:[]).forEach(v=>{const k=JSON.stringify(v);if(!seen.has(k)){seen.add(k);out.push(v);}}));merged[key]=out;}else if(empty(merged[key])){for(const b of books){if(!empty(b[key])){merged[key]=b[key];break;}}}});
    delete merged.confidence; return merged;
  }
  function field(label,id,value,multi){const control=multi?`<textarea id="${id}" rows="4" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:10px;font-family:var(--serif);font-size:15px;color:var(--ink)">${esc(value||'')}</textarea>`:`<input id="${id}" value="${esc(value||'')}" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:10px;font-family:var(--serif);font-size:15px;color:var(--ink)"/>`;return `<label style="display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin:10px 0 5px">${esc(label)}</label>${control}`;}

  function editSheet(entry,onDone){
    const L=labels(),b=JSON.parse(JSON.stringify(entry.book||{})),{overlay,sheet}=sheetBase('android-duplicate-edit',390),genre=Array.isArray(b.genre)?b.genre.join(', '):(b.genre||'');
    sheet.innerHTML=`<div class="display" style="font-size:24px;margin-bottom:12px">${esc(L.edit)}</div>${field(L.titleField,'e-title',b.title)}${field(L.authorField,'e-author',b.author)}${field(L.genre,'e-genre',genre)}${field(L.year,'e-year',b.year_published)}${field(L.language,'e-language',b.language)}${field(L.summary,'e-summary',b.summary,true)}${field(L.mainIdea,'e-main',b.main_idea,true)}<div id="e-error" style="display:none;color:var(--oxblood);padding:10px 0"></div><button id="e-save" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood);touch-action:manipulation">${esc(L.save)}</button><button id="e-cancel" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;touch-action:manipulation">${esc(L.cancel)}</button>`;
    sheet.querySelector('#e-cancel').onclick=()=>overlay.remove();
    sheet.querySelector('#e-save').onclick=()=>{const v=id=>sheet.querySelector(id).value.trim();b.title=v('#e-title');b.author=v('#e-author');b.genre=v('#e-genre').split(',').map(x=>x.trim()).filter(Boolean);b.language=v('#e-language');b.summary=v('#e-summary');b.main_idea=v('#e-main')||null;const y=v('#e-year');b.year_published=y&&Number.isFinite(Number(y))?Number(y):null;let r;try{r=JSON.parse(native.updateBookEntry(Number(entry.index),JSON.stringify(b)));}catch(e){r={ok:false,error:String(e)}}if(!r.ok){const box=sheet.querySelector('#e-error');box.style.display='block';box.textContent=r.error||L.error;return;}catalogChanged=true;overlay.remove();onDone();};
  }

  function mergeSheet(entries,onDone){
    const L=labels(),b=mergeCandidate(entries),{overlay,sheet}=sheetBase('android-duplicate-merge',390),genre=Array.isArray(b.genre)?b.genre.join(', '):(b.genre||'');
    sheet.innerHTML=`<div class="display" style="font-size:24px">${esc(L.mergeTitle)}</div><div style="font-family:var(--serif);font-size:14px;color:var(--ink-2);margin:10px 0 14px">${esc(L.hint)}</div>${field(L.titleField,'m-title',b.title)}${field(L.authorField,'m-author',b.author)}${field(L.originalTitle,'m-original',b.original_title)}${field(L.genre,'m-genre',genre)}${field(L.year,'m-year',b.year_published)}${field(L.language,'m-language',b.language)}${field(L.originalLanguage,'m-original-language',b.original_language)}${field(L.series,'m-series',b.series)}${field(L.summary,'m-summary',b.summary,true)}${field(L.mainIdea,'m-main',b.main_idea,true)}<div id="m-error" style="display:none;color:var(--oxblood);padding:10px 0"></div><button id="m-save" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood);touch-action:manipulation">${esc(L.save)}</button><button id="m-cancel" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;touch-action:manipulation">${esc(L.cancel)}</button>`;
    sheet.querySelector('#m-cancel').onclick=()=>overlay.remove();
    sheet.querySelector('#m-save').onclick=()=>{const v=id=>sheet.querySelector(id).value.trim();b.title=v('#m-title');b.author=v('#m-author');b.original_title=v('#m-original')||null;b.genre=v('#m-genre').split(',').map(x=>x.trim()).filter(Boolean);b.language=v('#m-language');b.original_language=v('#m-original-language')||null;b.series=v('#m-series')||null;b.summary=v('#m-summary');b.main_idea=v('#m-main')||null;const y=v('#m-year');b.year_published=y&&Number.isFinite(Number(y))?Number(y):null;let r;try{r=JSON.parse(native.mergeBookEntries(JSON.stringify(entries.map(e=>Number(e.index))),JSON.stringify(b)));}catch(e){r={ok:false,error:String(e)}}if(!r.ok){const box=sheet.querySelector('#m-error');box.style.display='block';box.textContent=r.error||L.error;return;}catalogChanged=true;overlay.remove();onDone();};
  }

  function searchResult(){let result;try{result=JSON.parse(native.findDuplicateBooks());}catch(e){result={ok:false,error:String(e)}}if(result&&Array.isArray(result.groups)){const ignored=ignoredPairs();result.groups=result.groups.filter(g=>!groupIgnored(g,ignored));result.groupCount=result.groups.length;result.duplicateCount=result.groups.reduce((n,g)=>n+Math.max(0,(g.entries||[]).length-1),0);}return result;}

  function renderDuplicates(overlay,sheet){
    const previousScroll=sheet.scrollTop;
    const L=labels(),result=searchResult(),groups=result&&Array.isArray(result.groups)?result.groups:[];
    const close=()=>{overlay.remove();if(catalogChanged){catalogChanged=false;native.reloadLibrary();}};
    if(!result||!result.ok||!groups.length){sheet.innerHTML=`<div class="display" style="font-size:24px;margin-bottom:18px">${esc(L.title)}</div><div style="font-family:var(--serif);font-size:17px;margin-bottom:22px">${esc(result&&result.ok?L.none:((result&&result.error)||L.error))}</div><button id="d-close" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;touch-action:manipulation">${esc(L.close)}</button>`;sheet.querySelector('#d-close').onclick=close;return;}
    const html=groups.map((g,gi)=>`<section class="dup-group" data-group="${gi}" style="margin-bottom:28px"><div style="font-family:var(--mono);font-size:9px;color:var(--ink-3)">${esc(L.similarity)} ${Math.round((Number(g.confidence)||0)*100)}% · ${esc(g.reason||'')}</div><div class="display" style="font-size:20px;margin:5px 0 8px">${esc(g.title||'')}</div>${(g.entries||[]).map((e,ei)=>`<div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start;padding:11px 0;border-top:1px solid var(--rule)"><input class="dup-check" type="checkbox" data-group="${gi}" data-index="${Number(e.index)}" ${ei<2?'checked':''} style="width:18px;height:18px;margin-top:3px;touch-action:manipulation"/><div><div style="font-family:var(--serif);font-size:16px">${esc(e.title)}</div><div style="font-size:12px;color:var(--ink-2)">${esc(e.author)}</div></div><button class="dup-edit" data-group="${gi}" data-entry="${ei}" style="font-family:var(--mono);font-size:9px;padding:7px;touch-action:manipulation">${esc(L.edit)}</button></div>`).join('')}<button class="dup-merge" data-group="${gi}" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:12px 2px;color:var(--oxblood);touch-action:manipulation">${esc(L.merge)}</button><button class="dup-not" data-group="${gi}" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:12px 2px;touch-action:manipulation">${esc(L.notDuplicate)}</button></section>`).join('');
    sheet.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px"><div class="display" style="font-size:24px">${esc(L.title)}</div><button id="d-close" style="padding:8px;touch-action:manipulation">${esc(L.close)}</button></div>${html}<div id="d-confirm" style="display:none;color:var(--oxblood);padding:12px 0">${esc(L.confirm)}</div><button id="d-delete" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood);touch-action:manipulation">${esc(L.del)}</button>`;
    sheet.scrollTop=Math.min(previousScroll,Math.max(0,sheet.scrollHeight-sheet.clientHeight));
    sheet.querySelector('#d-close').onclick=close;
    const checks=()=>Array.from(sheet.querySelectorAll('.dup-check'));
    sheet.querySelectorAll('.dup-edit').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const entry=groups[Number(btn.dataset.group)].entries[Number(btn.dataset.entry)];editSheet(entry,()=>renderDuplicates(overlay,sheet));}));
    sheet.querySelectorAll('.dup-merge').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const gi=Number(btn.dataset.group),chosen=checks().filter(c=>c.checked&&Number(c.dataset.group)===gi).map(c=>groups[gi].entries.find(item=>Number(item.index)===Number(c.dataset.index))).filter(Boolean);if(chosen.length<2){btn.textContent=L.merge+' (2+)';return;}mergeSheet(chosen,()=>renderDuplicates(overlay,sheet));}));
    sheet.querySelectorAll('.dup-not').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const gi=Number(btn.dataset.group);const section=btn.closest('.dup-group');ignoreGroup(groups[gi]);if(section){section.style.display='none';window.setTimeout(()=>renderDuplicates(overlay,sheet),0);}else renderDuplicates(overlay,sheet);}));
    let armed=false,confirm=sheet.querySelector('#d-confirm');sheet.querySelector('#d-delete').onclick=()=>{const indices=checks().filter(c=>c.checked).map(c=>Number(c.dataset.index));if(!indices.length)return;if(!armed){armed=true;confirm.style.display='block';return;}let r;try{r=JSON.parse(native.deleteBookEntries(JSON.stringify(indices)));}catch(e){r={ok:false,error:String(e)}}if(!r.ok){confirm.textContent=r.error||L.error;armed=false;return;}catalogChanged=true;renderDuplicates(overlay,sheet);};
  }

  function openDuplicates(){const busy=busyScreen();window.setTimeout(()=>{let shell=document.getElementById('android-duplicates-overlay');if(!shell){const created=sheetBase('android-duplicates-overlay',360);shell=created.overlay;shell.addEventListener('click',e=>{if(e.target===shell){shell.remove();if(catalogChanged){catalogChanged=false;native.reloadLibrary();}}});renderDuplicates(created.overlay,created.sheet);}else{renderDuplicates(shell,shell.firstElementChild);}busy.remove();},40);}

  function injectSettingsAction(){const overlay=document.getElementById('android-settings-overlay');if(!overlay||overlay.querySelector('#android-find-duplicates'))return;const anchor=overlay.querySelector('#android-export-json');if(!anchor)return;const button=document.createElement('button');button.id='android-find-duplicates';button.type='button';button.textContent=labels().action;button.style.cssText='width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px;pointer-events:auto;touch-action:manipulation;';button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();overlay.remove();openDuplicates();});anchor.insertAdjacentElement('afterend',button);}
  window.setInterval(injectSettingsAction,350); injectSettingsAction();
})();
