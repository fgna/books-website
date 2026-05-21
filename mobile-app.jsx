// Mobile app
const { useState, useEffect, useMemo, useRef } = React;

function MobileApp() {
  const [lang, setLang] = useState(() => (window.LIB_CONFIG && window.LIB_CONFIG.lang) || localStorage.getItem('lib.lang') || 'en');
  const [grouping, setGrouping] = useState('family');
  const [filters, setFilters] = useState({ search: '' });
  const [selected, setSelected] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const L = window.T(lang);
  useEffect(() => { localStorage.setItem('lib.lang', lang); }, [lang]);

  const baseBooks = window.LIB.books;

  const books = useMemo(() => {
    const f = filters;
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = norm((f.search || '').trim());
    return baseBooks.filter(b => {
      if (f.family?.length && !f.family.includes(b.family)) return false;
      if (f.language?.length && !f.language.includes(b.language)) return false;
      if (f.originalLanguage?.length && !f.originalLanguage.includes(b.originalLanguage)) return false;
      if (f.era?.length && !f.era.includes(b.era)) return false;
      if (f.author?.length && !f.author.includes(b.author)) return false;
      if (f.mood?.length && !f.mood.some(m => b.mood?.includes(m))) return false;
      if (f.country?.length && !f.country.includes(b.country)) return false;
      if (f.period?.length && !f.period.includes(b.period)) return false;
      if (f.genres?.length && !f.genres.some(g => b.genres.includes(g))) return false;
      if (f.keywords?.length) {
        const bk = new Set(b.keywords.map(k => norm(k)));
        if (!f.keywords.some(k => bk.has(norm(k)))) return false;
      }
      if (q) {
        const hay = norm(b.title + ' ' + b.author + ' ' + b.keywords.join(' ') + ' ' + b.genres.join(' ') + ' ' + b.summary);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseBooks, filters]);

  const activeCount = Object.entries(filters).reduce((s, [k, v]) => s + (k === 'search' ? (v ? 1 : 0) : (v?.length || 0)), 0);

  const g = window.LIB.GROUPINGS[grouping];
  const isUnknown = (n) => /^(Unbekannt|Unknown|Andere|Other|Andere Autoren|Other authors|Andere Sprachen|Other languages|Unklassifiziert|Unclassified)$/i.test(String(n));
  const groups = useMemo(() => {
    const m = new Map();
    for (const b of books) {
      const k = g.groupOf(b);
      if (!m.has(k)) m.set(k, { name: k, items: [], color: g.colorOf(b) });
      m.get(k).items.push(b);
    }
    let arr = Array.from(m.values());
    if (g.order) {
      arr.sort((a,b) => {
        const ua = isUnknown(a.name), ub = isUnknown(b.name);
        if (ua !== ub) return ua ? 1 : -1;
        const ia = g.order.indexOf(a.name); const ib = g.order.indexOf(b.name);
        if (ia === -1 && ib === -1) return b.items.length - a.items.length;
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
    } else {
      arr.sort((a,b) => {
        const ua = isUnknown(a.name), ub = isUnknown(b.name);
        if (ua !== ub) return ua ? 1 : -1;
        return b.items.length - a.items.length;
      });
    }
    return arr;
  }, [books, grouping]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bot)' }}>
      <MobileHeader L={L} />
      <MobileSearchAndCount books={books} baseBooks={baseBooks} L={L} filters={filters} setFilters={setFilters} activeCount={activeCount} onOpenFilters={() => setFilterOpen(true)} />
      <MobileGroupBar grouping={grouping} setGrouping={setGrouping} L={L} />
      <ActiveFilterChips filters={filters} setFilters={setFilters} lang={lang} L={L} />
      <main style={{ flex: 1, padding: '4px 0 80px' }}>
        {groups.length === 0 && <EmptyState L={L} />}
        {groups.map(gr => <GroupBand key={gr.name} group={gr} grouping={grouping} lang={lang} onSelectBook={setSelected} />)}
      </main>
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} setFilters={setFilters} books={books} lang={lang} L={L} />
      <BookDetailMobile
        book={selected} onClose={() => setSelected(null)} lang={lang} L={L} filters={filters}
        activeKeywords={filters.keywords || []} activeAuthors={filters.author || []}
        onAddKeyword={(k) => setFilters(f => { const cur = new Set(f.keywords || []); if (cur.has(k)) cur.delete(k); else cur.add(k); return { ...f, keywords: Array.from(cur) }; })}
        onAddAuthor={(a) => setFilters(f => { const cur = new Set(f.author || []); if (cur.has(a)) cur.delete(a); else cur.add(a); return { ...f, author: Array.from(cur) }; })}
        onAddFilter={(key, val) => setFilters(f => { const cur = new Set(f[key] || []); if (cur.has(val)) cur.delete(val); else cur.add(val); return { ...f, [key]: Array.from(cur) }; })}
      />
    </div>
  );
}

function MobileHeader({ L }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 10px', borderBottom: '1px solid var(--ink)', background: 'var(--paper)', position: 'sticky', top: 0, zIndex: 30 }}>
      <div className="display" style={{ fontSize: 22 }}>{(window.LIB_CONFIG && window.LIB_CONFIG.name) || 'the Library'}</div>
    </header>
  );
}

function MobileSearchAndCount({ books, baseBooks, L, filters, setFilters, activeCount, onOpenFilters }) {
  return (
    <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--rule)', background: 'var(--paper)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <span className="display" style={{ fontSize: 18 }}>{books.length}</span>
          <span className="mono" style={{ marginLeft: 6 }}>{L.ofVolumes(baseBooks.length)}</span>
        </div>
        <button onClick={onOpenFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--ink)', background: activeCount > 0 ? 'var(--ink)' : 'var(--paper)', color: activeCount > 0 ? 'var(--paper)' : 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 2h9M2.5 5.5h6M4 9h3"/></svg>
          {L.filter}
          {activeCount > 0 && <span style={{ background: 'var(--oxblood)', color: 'var(--paper)', padding: '1px 5px', borderRadius: 6, fontSize: 9 }}>{activeCount}</span>}
        </button>
      </div>
      <input type="text" value={filters.search || ''} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} placeholder={L.search} style={{ width: '100%', background: 'var(--paper-2)', border: '1px solid var(--rule)', padding: '10px 12px', fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)', outline: 'none' }} />
    </div>
  );
}

const SHORT_LABEL_KEYS_M = { family: 'familyShort', language: 'readLangShort', period: 'periodShort', country: 'countryShort' };

function MobileGroupBar({ grouping, setGrouping, L }) {
  const populated = window.LIB.populated || {};
  const keys = ['family', 'language'];
  if (populated.period) keys.push('period');
  if (populated.country) keys.push('country');
  return (
    <div style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper)', padding: '8px 16px' }}>
      <div style={{ display: 'flex', border: '1px solid var(--ink)', width: 'fit-content' }}>
        {keys.map((k, i) => (
          <button key={k} onClick={() => setGrouping(k)} style={{ padding: '7px 14px', background: grouping === k ? 'var(--ink)' : 'var(--paper)', color: grouping === k ? 'var(--paper)' : 'var(--ink)', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--ink)', fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
            {L[SHORT_LABEL_KEYS_M[k]] || k}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActiveFilterChips({ filters, setFilters, lang, L }) {
  const chips = [];
  for (const key of ['family','language','originalLanguage','era','author','genres','keywords','mood','country','period']) {
    for (const v of (filters[key] || [])) chips.push({ key, value: v });
  }
  if (chips.length === 0) return null;
  const KIND_OF = { family: 'family', language: 'language', originalLanguage: 'language', era: 'era', country: null, period: null, mood: null };
  const remove = (key, value) => setFilters(f => ({ ...f, [key]: (f[key] || []).filter(v => v !== value) }));
  return (
    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--rule)', background: 'var(--paper)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {chips.map((c, i) => {
        const display = KIND_OF[c.key] ? window.tr(KIND_OF[c.key], c.value, lang) : c.value;
        return (
          <button key={c.key+'|'+c.value+'|'+i} onClick={() => remove(c.key, c.value)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ink)', color: 'var(--paper)', padding: '4px 9px', fontSize: 12, fontFamily: 'var(--sans)' }}>
            <span>{display}</span><span style={{ color: 'var(--paper-3)', fontFamily: 'var(--mono)' }}>×</span>
          </button>
        );
      })}
      <button onClick={() => setFilters({ search: '' })} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--oxblood)', textTransform: 'uppercase', letterSpacing: '0.14em', marginLeft: 'auto' }}>{L.clearAll}</button>
    </div>
  );
}

function GroupBand({ group, grouping, lang, onSelectBook }) {
  const KIND_OF = { family: 'family', genre: 'genre', language: 'language' };
  const kind = KIND_OF[grouping];
  const displayName = kind ? window.tr(kind, group.name, lang) : group.name;
  return (
    <section style={{ marginBottom: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 10px' }}>
        <span style={{ width: 14, height: 14, background: group.color, flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink)' }}>{displayName}</h2>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{group.items.length}</span>
      </header>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory', padding: '2px 16px 16px', scrollbarWidth: 'none', scrollPaddingLeft: 16 }}>
        <style>{`section > div::-webkit-scrollbar { display: none; }`}</style>
        {group.items.map(b => <BookCard key={b.id} book={b} color={group.color} onClick={() => onSelectBook(b)} />)}
      </div>
    </section>
  );
}

function BookCard({ book, color, onClick }) {
  const year = book.yearPublished != null ? (book.yearPublished < 0 ? `${-book.yearPublished} BCE` : String(book.yearPublished)) : '';
  return (
    <button onClick={onClick} style={{ width: 200, minWidth: 200, height: 253, flexShrink: 0, background: color, color: 'var(--paper)', padding: '16px 15px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', scrollSnapAlign: 'start', cursor: 'pointer', overflow: 'hidden', border: 'none', borderRadius: 2, boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 8px 24px -8px rgba(28,28,30,0.3)' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.01em', color: 'var(--paper)', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 6, overflow: 'hidden', textWrap: 'pretty' }}>{book.title}</div>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'rgba(232,232,229,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{book.author}</div>
        {year && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(232,232,229,0.55)' }}>{year}</div>}
      </div>
    </button>
  );
}

function EmptyState({ L }) {
  return <div style={{ padding: '60px 32px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{L.noMatches}</div>;
}

function FilterSheet({ open, onClose, filters, setFilters, books, lang, L }) {
  const facets = window.LIB.facets;
  const populated = window.LIB.populated || {};
  if (!open) return null;
  const sections = [
    { id: 'family', label: L.genreFamily, values: facets.family, kind: 'family' },
    { id: 'language', label: L.readingLanguage, values: facets.language, kind: 'language' },
    { id: 'originalLanguage', label: L.originalLanguage, values: facets.originalLanguage.slice(0, 14), kind: 'language' },
    { id: 'era', label: L.era, values: facets.era, kind: 'era' },
    { id: 'genres', label: 'Genre', values: facets.genres.slice(0, 40), kind: 'genre' },
    { id: 'author', label: L.authors3plus, values: facets.author.filter(f => f.count >= 3), kind: null },
  ];
  if (populated.read) sections.push({ id: 'read', label: lang === 'de' ? 'Gelesen' : 'Read', values: facets.read, kind: null, displayOf: (v) => v === true ? (lang === 'de' ? 'Gelesen' : 'Read') : v === false ? (lang === 'de' ? 'Ungelesen' : 'Unread') : (lang === 'de' ? 'Unbekannt' : 'Unknown') });
  if (populated.mood) sections.push({ id: 'mood', label: lang === 'de' ? 'Stimmung' : 'Mood', values: facets.mood.slice(0, 16), kind: null });
  if (populated.country) sections.push({ id: 'country', label: lang === 'de' ? 'Herkunftsland' : 'Country', values: facets.country.slice(0, 12), kind: null });
  if (populated.period) sections.push({ id: 'period', label: lang === 'de' ? 'Periode' : 'Period', values: facets.period, kind: null });
  if (populated.rating) sections.push({ id: 'rating', label: lang === 'de' ? 'Bewertung' : 'Rating', values: facets.rating, kind: null, displayOf: (v) => v != null ? '★'.repeat(Math.round(v)) + '☆'.repeat(Math.max(0, 5 - Math.round(v))) : '—' });
  const isUnknown = (n) => /^(Unbekannt|Unknown|Andere|Other|Andere Autoren|Other authors|Andere Sprachen|Other languages|Unklassifiziert|Unclassified)$/i.test(String(n));
  const sortVals = (vals) => vals.slice().sort((a,b) => { const ua = isUnknown(a.value), ub = isUnknown(b.value); if (ua !== ub) return ua ? 1 : -1; return b.count - a.count; });
  const toggle = (key, val) => setFilters(f => { const cur = new Set(f[key] || []); if (cur.has(val)) cur.delete(val); else cur.add(val); return { ...f, [key]: Array.from(cur) }; });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', animation: 'fadeIn .2s ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <button onClick={onClose} aria-label="close" style={{ flex: 1, background: 'rgba(28,28,30,0.45)', cursor: 'pointer' }}/>
      <div style={{ background: 'var(--paper)', borderTop: '1px solid var(--ink)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', animation: 'sheetUp .25s ease-out', paddingBottom: 'var(--safe-bot)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--rule)' }}>
          <span className="label">{L.filter}</span>
          <button onClick={onClose} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', padding: '4px 8px' }}>{lang === 'de' ? 'fertig' : 'done'}</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 16px 24px' }}>
          {sections.map(s => <FilterSheetSection key={s.id} section={{ ...s, values: sortVals(s.values) }} active={filters[s.id] || []} onToggle={(v) => toggle(s.id, v)} lang={lang} L={L} />)}
          <button onClick={() => setFilters({ search: '' })} style={{ margin: '14px auto 0', display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--oxblood)', textTransform: 'uppercase', letterSpacing: '0.14em', padding: '8px 14px', border: '1px solid var(--oxblood)' }}>{L.clearAll}</button>
        </div>
      </div>
    </div>
  );
}

function FilterSheetSection({ section, active, onToggle, lang, L }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const cap = 6;
  const list = showAll ? section.values : section.values.slice(0, cap);
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink)' }}>
        <span>{section.label}</span>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {list.map(v => {
            const isActive = active.includes(v.value);
            const display = section.displayOf ? section.displayOf(v.value) : section.kind ? window.tr(section.kind, v.value, lang) : v.value;
            return <button key={v.value} onClick={() => onToggle(v.value)} style={{ padding: '7px 11px', background: isActive ? 'var(--oxblood)' : 'var(--paper-2)', color: isActive ? 'var(--paper)' : 'var(--ink-2)', border: '1px solid '+(isActive?'var(--oxblood)':'var(--rule)'), fontFamily: 'var(--sans)', fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{display}<span style={{ fontFamily: 'var(--mono)', fontSize: 9, marginLeft: 6, color: isActive?'var(--paper-3)':'var(--ink-3)' }}>{v.count}</span></button>;
          })}
          {section.values.length > cap && <button onClick={() => setShowAll(s => !s)} style={{ padding: '7px 11px', border: '1px dashed var(--rule)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{showAll ? L.showLess : L.moreCount(section.values.length - cap)}</button>}
        </div>
      )}
    </div>
  );
}

function BookDetailMobile({ book, onClose, lang, L, filters, onAddKeyword, onAddAuthor, onAddFilter, activeKeywords, activeAuthors }) {
  if (!book) return null;
  const activeSet = new Set((activeKeywords || []).map(k => k.toLowerCase()));
  const authorActive = (activeAuthors || []).includes(book.author);
  const trLang = (v) => window.tr('language', v, lang);
  const isActive = (key, val) => ((filters || {})[key] || []).includes(val);
  const toggleFilter = (key, val) => onAddFilter && onAddFilter(key, val);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column' }}>
      <style>{`.m-kw-chip{font-family:var(--mono);font-size:11px;text-transform:capitalize;padding:5px 11px;border:1px solid var(--rule);color:var(--ink-2);background:transparent;letter-spacing:0.02em;cursor:pointer}.m-kw-chip.active{background:var(--oxblood);color:var(--paper);border-color:var(--oxblood)}.m-author-link{font-family:var(--serif);font-size:20px;font-style:italic;color:var(--ink-2);text-decoration:underline;text-decoration-color:var(--rule);text-underline-offset:3px;padding:0;cursor:pointer}.m-author-link.active{color:var(--oxblood);text-decoration-color:var(--oxblood);font-weight:500}`}</style>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(28,28,30,0.5)', cursor: 'pointer' }}/>
      <div style={{ background: 'var(--paper)', borderTop: '2px solid var(--ink)', height: '62vh', display: 'flex', flexDirection: 'column', paddingBottom: 'var(--safe-bot)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 12px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
          <div className="mono">{L.vol} №{String(book.id+1).padStart(3,'0')}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {book.read === true && <button onClick={() => toggleFilter('read', true)} style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--paper)', background: isActive('read',true)?'var(--oxblood-dk)':'var(--oxblood)', border: 'none', padding: '3px 8px', cursor: 'pointer' }}>{L.read}</button>}
            {book.read === false && <button onClick={() => toggleFilter('read', false)} style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: isActive('read',false)?'var(--paper)':'var(--ink-2)', background: isActive('read',false)?'var(--ink)':'none', border: '1px solid var(--ink-3)', padding: '2px 7px', cursor: 'pointer' }}>{lang==='de'?'ungelesen':'unread'}</button>}
            <button onClick={onClose} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '0.14em', padding: '6px 10px', border: '1px solid var(--rule)' }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '18px 20px 28px', flex: 1 }}>
          <h1 className="display" style={{ fontSize: 30, margin: '0 0 6px', textWrap: 'pretty', lineHeight: 1.1 }}>{book.title}</h1>
          {book.originalTitle && <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-3)', marginBottom: 6 }}>{L.originalTitle}: {book.originalTitle}</div>}
          <div style={{ marginBottom: 16 }}>
            <button className={'m-author-link'+(authorActive?' active':'')} onClick={() => onAddAuthor && onAddAuthor(book.author)}>{book.author}</button>
            {book.yearPublished != null && <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', marginLeft: 8 }}>· {book.yearPublished < 0 ? `${-book.yearPublished} BCE` : book.yearPublished}</span>}
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--rule)', margin: '0 0 14px' }}/>
          {book.genres.length > 0 && <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{L.genre}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{book.genres.map(g => <button key={g} className={'m-kw-chip'+(isActive('genres',g)?' active':'')} onClick={() => toggleFilter('genres',g)}>{g}</button>)}</div></div>}
          <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{L.language}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}><button className={'m-kw-chip'+(isActive('language',book.language)?' active':'')} onClick={() => toggleFilter('language',book.language)}>{trLang(book.language)}</button>{book.translated && <button className={'m-kw-chip'+(isActive('originalLanguage',book.originalLanguage)?' active':'')} onClick={() => toggleFilter('originalLanguage',book.originalLanguage)}>← {trLang(book.originalLanguage)}</button>}</div></div>
          <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{L.era}</div><button className={'m-kw-chip'+(isActive('era',book.era)?' active':'')} onClick={() => toggleFilter('era',book.era)}>{book.era}</button></div>
          {book.mood && book.mood.length > 0 && <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{lang==='de'?'Stimmung':'Mood'}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{book.mood.map(m => <button key={m} className={'m-kw-chip'+(isActive('mood',m)?' active':'')} onClick={() => toggleFilter('mood',m)}>{m}</button>)}</div></div>}
          {book.period && <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{lang==='de'?'Periode':'Period'}</div><button className={'m-kw-chip'+(isActive('period',book.period)?' active':'')} onClick={() => toggleFilter('period',book.period)}>{book.period}</button></div>}
          {book.country && <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{lang==='de'?'Herkunftsland':'Country'}</div><button className={'m-kw-chip'+(isActive('country',book.country)?' active':'')} onClick={() => toggleFilter('country',book.country)}>{book.country}</button></div>}
          {book.series && <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 6 }}>{lang==='de'?'Reihe':'Series'}</div><div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>{book.series}</div></div>}
          {book.rating != null && <div style={{ marginBottom: 12 }}><div className="label" style={{ marginBottom: 4 }}>{lang==='de'?'Bewertung':'Rating'}</div><div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--oxblood)', letterSpacing: '0.1em' }}>{'★'.repeat(Math.round(book.rating))}<span style={{ color: 'var(--ink-4)' }}>{'★'.repeat(Math.max(0,5-Math.round(book.rating)))}</span></div></div>}
          {book.keywords.length > 0 && <div style={{ marginBottom: 14 }}><div className="label" style={{ marginBottom: 6 }}>{L.keywords}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{book.keywords.map(k => <button key={k} className={'m-kw-chip'+(activeSet.has(k.toLowerCase())?' active':'')} onClick={() => onAddKeyword && onAddKeyword(k)}>{k}</button>)}</div></div>}
          {book.mainIdea && <div style={{ marginTop: 18 }}><div className="label" style={{ marginBottom: 6 }}>{L.mainIdea}</div><p style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.5, color: 'var(--ink)', margin: 0, textWrap: 'pretty', borderLeft: '2px solid var(--oxblood)', paddingLeft: 14, fontStyle: 'italic' }}>{lang==='en'?(book.mainIdeaEn||book.mainIdea):book.mainIdea}</p></div>}
          {book.summary && <div style={{ marginTop: 18 }}><div className="label" style={{ marginBottom: 6 }}>{L.summary}</div><p style={{ fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.6, color: 'var(--ink)', margin: 0, textWrap: 'pretty' }}>{lang==='en'?(book.summaryEn||book.summary):book.summary}</p></div>}
        </div>
      </div>
    </div>
  );
}

function boot() {
  const root = ReactDOM.createRoot(document.getElementById('app'));
  root.render(<MobileApp />);
  const bootEl = document.getElementById('boot');
  if (bootEl) setTimeout(() => { bootEl.classList.add('hidden'); setTimeout(() => bootEl.remove(), 400); }, 200);
}
if (window.LIB) boot();
else window.addEventListener('lib-ready', boot, { once: true });
