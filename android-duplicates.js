// Android-only fuzzy duplicate finder, merge/edit and deletion UI.
(function () {
  if (!window.AndroidBookSource) return;
  const native = window.AndroidBookSource;

  const isGerman = () => ((window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'en') === 'de';
  const labels = () => isGerman() ? {
    action:'Duplikate suchen', title:'Mögliche Duplikate', none:'Keine möglichen Duplikate gefunden.', close:'Schließen',
    merge:'Ausgewählte zusammenführen', edit:'Bearbeiten', save:'Speichern', cancel:'Abbrechen', del:'Ausgewählte löschen', confirm:'Löschen bestätigen',
    similarity:'Ähnlichkeit', reason:'Grund', selected:'ausgewählt', error:'Duplikate konnten nicht verarbeitet werden.',
    mergeTitle:'Einträge zusammenführen', hint:'Die vollständigsten Metadaten wurden vorausgewählt. Bitte vor dem Speichern prüfen.',
    titleField:'Titel', authorField:'Autor', originalTitle:'Originaltitel', genre:'Genre', year:'Jahr', language:'Sprache', originalLanguage:'Originalsprache', series:'Reihe', summary:'Kurzbeschreibung', mainIdea:'Kernidee'
  } : {
    action:'Find duplicates', title:'Possible duplicates', none:'No possible duplicates found.', close:'Close',
    merge:'Merge selected', edit:'Edit', save:'Save', cancel:'Cancel', del:'Delete selected', confirm:'Confirm deletion',
    similarity:'Similarity', reason:'Reason', selected:'selected', error:'Duplicates could not be processed.',
    mergeTitle:'Merge entries', hint:'The most complete metadata was preselected. Review it before saving.',
    titleField:'Title', authorField:'Author', originalTitle:'Original title', genre:'Genre', year:'Year', language:'Language', originalLanguage:'Original language', series:'Series', summary:'Summary', mainIdea:'Main idea'
  };

  const esc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  function sheetBase(id,z) {
    document.getElementById(id)?.remove();
    const overlay=document.createElement('div');
    overlay.id=id;
    overlay.style.cssText=`position:fixed;inset:0;z-index:${z||360};background:rgba(28,28,30,.36);display:flex;align-items:flex-end;pointer-events:auto;`;
    const sheet=document.createElement('div');
    sheet.style.cssText='width:100%;max-height:92vh;overflow:auto;background:var(--paper);border-top:1px solid var(--ink);padding:20px 18px calc(20px + var(--safe-bot));box-shadow:0 -18px 50px rgba(28,28,30,.16);pointer-events:auto;';
    overlay.appendChild(sheet); document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{ if(e.target===overlay) overlay.remove(); });
    return {overlay,sheet};
  }
  const empty=v=>v==null||v===''||(Array.isArray(v)&&v.length===0);
  function completeness(book){let n=0;Object.keys(book||{}).forEach(k=>{if(!empty(book[k]))n+=Array.isArray(book[k])?book[k].length+1:1;});return n;}
  function mergeCandidate(entries){
    const books=entries.map(e=>e.book||{}).sort((a,b)=>completeness(b)-completeness(a));
    const merged=JSON.parse(JSON.stringify(books[0]||{}));
    const keys=new Set(); books.forEach(b=>Object.keys(b).forEach(k=>keys.add(k)));
    keys.forEach(key=>{
      if(Array.isArray(merged[key])) {
        const out=[], seen=new Set(); books.forEach(b=>(Array.isArray(b[key])?b[key]:[]).forEach(v=>{const k=JSON.stringify(v);if(!seen.has(k)){seen.add(k);out.push(v);}})); merged[key]=out;
      } else if(empty(merged[key])) {
        for(const b of books){ if(!empty(b[key])){ merged[key]=b[key]; break; } }
      }
    });
    delete merged.confidence; return merged;
  }
  function field(label,id,value,multi){
    const control=multi
      ? `<textarea id="${id}" rows="4" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:10px;font-family:var(--serif);font-size:15px;color:var(--ink)">${esc(value||'')}</textarea>`
      : `<input id="${id}" value="${esc(value||'')}" style="box-sizing:border-box;width:100%;border:1px solid var(--rule);background:transparent;padding:10px;font-family:var(--serif);font-size:15px;color:var(--ink)"/>`;
    return `<label style="display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin:10px 0 5px">${esc(label)}</label>${control}`;
  }

  function editSheet(entry,onDone){
    const L=labels(), b=JSON.parse(JSON.stringify(entry.book||{})), {overlay,sheet}=sheetBase('android-duplicate-edit',390);
    const genre=Array.isArray(b.genre)?b.genre.join(', '):(b.genre||'');
    sheet.innerHTML=`<div class="display" style="font-size:24px;margin-bottom:12px">${esc(L.edit)}</div>${field(L.titleField,'e-title',b.title)}${field(L.authorField,'e-author',b.author)}${field(L.genre,'e-genre',genre)}${field(L.year,'e-year',b.year_published)}${field(L.language,'e-language',b.language)}${field(L.summary,'e-summary',b.summary,true)}${field(L.mainIdea,'e-main',b.main_idea,true)}<div id="e-error" style="display:none;color:var(--oxblood);padding:10px 0"></div><button id="e-save" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood);pointer-events:auto">${esc(L.save)}</button><button id="e-cancel" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;pointer-events:auto">${esc(L.cancel)}</button>`;
    sheet.querySelector('#e-cancel').onclick=()=>overlay.remove();
    sheet.querySelector('#e-save').onclick=()=>{
      const v=id=>sheet.querySelector(id).value.trim();
      b.title=v('#e-title'); b.author=v('#e-author'); b.genre=v('#e-genre').split(',').map(x=>x.trim()).filter(Boolean); b.language=v('#e-language'); b.summary=v('#e-summary'); b.main_idea=v('#e-main')||null;
      const y=v('#e-year'); b.year_published=y&&Number.isFinite(Number(y))?Number(y):null;
      let r; try{r=JSON.parse(native.updateBookEntry(Number(entry.index),JSON.stringify(b)));}catch(e){r={ok:false,error:String(e)}}
      if(!r.ok){const box=sheet.querySelector('#e-error');box.style.display='block';box.textContent=r.error||L.error;return;}
      overlay.remove(); onDone();
    };
  }

  function mergeSheet(entries,onDone){
    const L=labels(), b=mergeCandidate(entries), {overlay,sheet}=sheetBase('android-duplicate-merge',390);
    const genre=Array.isArray(b.genre)?b.genre.join(', '):(b.genre||'');
    sheet.innerHTML=`<div class="display" style="font-size:24px">${esc(L.mergeTitle)}</div><div style="font-family:var(--serif);font-size:14px;color:var(--ink-2);margin:10px 0 14px">${esc(L.hint)}</div>${field(L.titleField,'m-title',b.title)}${field(L.authorField,'m-author',b.author)}${field(L.originalTitle,'m-original',b.original_title)}${field(L.genre,'m-genre',genre)}${field(L.year,'m-year',b.year_published)}${field(L.language,'m-language',b.language)}${field(L.originalLanguage,'m-original-language',b.original_language)}${field(L.series,'m-series',b.series)}${field(L.summary,'m-summary',b.summary,true)}${field(L.mainIdea,'m-main',b.main_idea,true)}<div id="m-error" style="display:none;color:var(--oxblood);padding:10px 0"></div><button id="m-save" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood);pointer-events:auto">${esc(L.save)}</button><button id="m-cancel" style="width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;pointer-events:auto">${esc(L.cancel)}</button>`;
    sheet.querySelector('#m-cancel').onclick=()=>overlay.remove();
    sheet.querySelector('#m-save').onclick=()=>{
      const v=id=>sheet.querySelector(id).value.trim();
      b.title=v('#m-title');b.author=v('#m-author');b.original_title=v('#m-original')||null;b.genre=v('#m-genre').split(',').map(x=>x.trim()).filter(Boolean);b.language=v('#m-language');b.original_language=v('#m-original-language')||null;b.series=v('#m-series')||null;b.summary=v('#m-summary');b.main_idea=v('#m-main')||null;
      const y=v('#m-year');b.year_published=y&&Number.isFinite(Number(y))?Number(y):null;
      let r;try{r=JSON.parse(native.mergeBookEntries(JSON.stringify(entries.map(e=>Number(e.index))),JSON.stringify(b)));}catch(e){r={ok:false,error:String(e)}}
      if(!r.ok){const box=sheet.querySelector('#m-error');box.style.display='block';box.textContent=r.error||L.error;return;}
      overlay.remove();onDone();
    };
  }

  function openDuplicates(){
    const L=labels(); let result;
    try{result=JSON.parse(native.findDuplicateBooks());}catch(e){result={ok:false,error:String(e)}}
    const {overlay,sheet}=sheetBase('android-duplicates-overlay',360);
    const groups=result&&Array.isArray(result.groups)?result.groups:[];
    if(!result.ok||!groups.length){sheet.innerHTML=`<div class="display" style="font-size:24px;margin-bottom:18px">${esc(L.title)}</div><div style="font-family:var(--serif);font-size:17px;margin-bottom:22px">${esc(result&&result.ok?L.none:((result&&result.error)||L.error))}</div><button id="d-close" style="width:100%;border-top:1px solid var(--rule);padding:15px 2px;text-align:left;pointer-events:auto">${esc(L.close)}</button>`;sheet.querySelector('#d-close').onclick=()=>overlay.remove();return;}
    const groupsHtml=groups.map((g,gi)=>`<section style="margin-bottom:28px"><div style="font-family:var(--mono);font-size:9px;color:var(--ink-3)">${esc(L.similarity)} ${Math.round((Number(g.confidence)||0)*100)}% · ${esc(g.reason||'')}</div><div class="display" style="font-size:20px;margin:5px 0 8px">${esc(g.title||'')}</div>${(g.entries||[]).map((e,ei)=>`<div style="display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start;padding:11px 0;border-top:1px solid var(--rule)"><input class="dup-check" type="checkbox" data-group="${gi}" data-index="${Number(e.index)}" ${ei<2?'checked':''} style="width:18px;height:18px;margin-top:3px;pointer-events:auto"/><div><div style="font-family:var(--serif);font-size:16px">${esc(e.title)}</div><div style="font-size:12px;color:var(--ink-2)">${esc(e.author)}</div></div><button class="dup-edit" data-group="${gi}" data-entry="${ei}" style="font-family:var(--mono);font-size:9px;padding:7px;pointer-events:auto">${esc(L.edit)}</button></div>`).join('')}<button class="dup-merge" data-group="${gi}" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:12px 2px;color:var(--oxblood);pointer-events:auto">${esc(L.merge)}</button></section>`).join('');
    sheet.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px"><div class="display" style="font-size:24px">${esc(L.title)}</div><button id="d-close" style="padding:8px;pointer-events:auto">${esc(L.close)}</button></div>${groupsHtml}<div id="d-confirm" style="display:none;color:var(--oxblood);padding:12px 0">${esc(L.confirm)}</div><button id="d-delete" style="width:100%;text-align:left;border-top:1px solid var(--ink);padding:15px 2px;color:var(--oxblood);pointer-events:auto">${esc(L.del)}</button>`;
    const close=()=>overlay.remove(); sheet.querySelector('#d-close').onclick=close;
    const checks=()=>Array.from(sheet.querySelectorAll('.dup-check'));
    sheet.querySelectorAll('.dup-edit').forEach(btn=>{btn.onclick=()=>{const e=groups[Number(btn.dataset.group)].entries[Number(btn.dataset.entry)];editSheet(e,()=>{close();native.reloadLibrary();});};});
    sheet.querySelectorAll('.dup-merge').forEach(btn=>{btn.onclick=()=>{const gi=Number(btn.dataset.group);const chosen=checks().filter(c=>c.checked&&Number(c.dataset.group)===gi).map(c=>groups[gi].entries.find(e=>Number(e.index)===Number(c.dataset.index))).filter(Boolean);if(chosen.length<2){btn.textContent=L.merge+' (2+)';return;}mergeSheet(chosen,()=>{close();native.reloadLibrary();});};});
    let armed=false;const confirm=sheet.querySelector('#d-confirm');sheet.querySelector('#d-delete').onclick=()=>{const indices=checks().filter(c=>c.checked).map(c=>Number(c.dataset.index));if(!indices.length)return;if(!armed){armed=true;confirm.style.display='block';return;}let r;try{r=JSON.parse(native.deleteBookEntries(JSON.stringify(indices)));}catch(e){r={ok:false,error:String(e)}}if(!r.ok){confirm.textContent=r.error||L.error;armed=false;return;}close();native.reloadLibrary();};
  }

  function injectSettingsAction(){
    const overlay=document.getElementById('android-settings-overlay');
    if(!overlay||overlay.querySelector('#android-find-duplicates')) return;
    const anchor=overlay.querySelector('#android-export-json');
    if(!anchor) return;
    const button=document.createElement('button');
    button.id='android-find-duplicates';button.type='button';button.textContent=labels().action;
    button.style.cssText='width:100%;text-align:left;border-top:1px solid var(--rule);padding:15px 2px;font-family:var(--sans);font-size:15px;pointer-events:auto;touch-action:manipulation;';
    button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();overlay.remove();window.setTimeout(openDuplicates,0);});
    anchor.insertAdjacentElement('afterend',button);
  }

  // Avoid a document-wide MutationObserver here. On some WebView builds it can interfere with touch handling while Settings is open.
  window.setInterval(injectSettingsAction,350);
  injectSettingsAction();
})();
