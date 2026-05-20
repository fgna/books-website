// Side panels: filter rail, stats summary, book detail.

const { useState, useMemo, useEffect, useRef } = React;

function FilterRail({ filters, setFilters, books, baseBooks, lang, L, onClose }) {
  const facets = window.LIB.facets;
  const populated = window.LIB.populated || {};
  const trV = (kind, v) => window.tr(kind, v, lang);

  // Available facet values (recomputed against full set)
  const sections = [
    { id: 'family',   label: L.genreFamily,      values: facets.family,           kind: 'family' },
    { id: 'language', label: L.readingLanguage,  values: facets.language,         kind: 'language' },
    { id: 'originalLanguage', label: L.originalLanguage, values: facets.originalLanguage.slice(0, 14), kind: 'language' },
    { id: 'era',      label: L.era,              values: facets.era,              kind: 'era' },
    { id: 'author',   label: L.authors3plus,     values: facets.author.filter(f => f.count >= 3), kind: null },
    { id: 'genres',   label: lang === 'de' ? 'Genre' : 'Genre', values: facets.genres.slice(0, 40), kind: 'genre' },
  ];
  // Conditionally include optional fields once they have any data
  if (populated.read)    sections.push({ id: 'read',    label: lang === 'de' ? 'Gelesen'      : 'Read',    values: facets.read,    kind: null,
    displayOf: (v) => v === true ? (lang === 'de' ? 'Gelesen' : 'Read') : v === false ? (lang === 'de' ? 'Ungelesen' : 'Unread') : (lang === 'de' ? 'Unbekannt' : 'Unknown'),
  });
  if (populated.mood)    sections.push({ id: 'mood',    label: lang === 'de' ? 'Stimmung'     : 'Mood',    values: facets.mood,    kind: null });
  if (populated.period)  sections.push({ id: 'period',  label: lang === 'de' ? 'Periode'      : 'Period',  values: facets.period,  kind: null });
  if (populated.country) sections.push({ id: 'country', label: lang === 'de' ? 'Herkunftsland': 'Country', values: facets.country, kind: null });
  if (populated.rating)  sections.push({ id: 'rating',  label: lang === 'de' ? 'Bewertung'    : 'Rating',  values: facets.rating,  kind: null });

  const toggle = (key, val) => {
    setFilters(f => {
      const cur = new Set(f[key] || []);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      return { ...f, [key]: Array.from(cur) };
    });
  };

  const activeCount = Object.values(filters).reduce((s,a) => s + (a?.length||0), 0) + (filters.search ? 1 : 0);

  // Recompute counts within current filtered set
  const currentCounts = useMemo(() => {
    const out = {};
    for (const s of sections) {
      out[s.id] = {};
      for (const b of books) {
        const vals = Array.isArray(b[s.id]) ? b[s.id] : [b[s.id]];
        for (const v of vals) out[s.id][v] = (out[s.id][v] || 0) + 1;
      }
    }
    return out;
  }, [books]);

  return (
    <aside style={{
      width: 240,
      borderRight: '1px solid var(--ink)',
      background: 'var(--paper)',
      padding: '18px 14px 80px',
      overflowY: 'auto',
      height: '100%',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="label">{L.filter}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeCount > 0 && (
            <button
              onClick={() => setFilters({ search: '' })}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--oxblood)',
                textTransform: 'uppercase', letterSpacing: '0.14em', padding: 0,
              }}>
              {L.clear} ({activeCount})
            </button>
          )}
          {onClose && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)', padding: 0, lineHeight: 1,
            }}>×</button>
          )}
        </div>
      </div>
      <input
        type="text"
        value={filters.search || ''}
        onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
        placeholder={L.search}
        style={{
          width: '100%',
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          padding: '8px 10px',
          fontFamily: 'var(--serif)',
          fontSize: 14,
          color: 'var(--ink)',
          outline: 'none',
          marginTop: 8,
          marginBottom: 18,
        }}
      />

      {sections.map(s => (
        <FilterSection
          key={s.id}
          section={s}
          activeValues={filters[s.id] || []}
          currentCounts={currentCounts[s.id] || {}}
          onToggle={(v) => toggle(s.id, v)}
          lang={lang}
          L={L}
        />
      ))}
    </aside>
  );
}

function FilterSection({ section, activeValues, currentCounts, onToggle, lang, L }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const cap = 8;
  // Push unknown/other-style buckets to the end regardless of count
  const isUnknown = (n) => /^(Unbekannt|Unknown|Andere|Other|Andere Autoren|Other authors|Andere Sprachen|Other languages|Unklassifiziert|Unclassified)$/i.test(String(n));
  const sortedValues = useMemo(() => {
    return section.values.slice().sort((a, b) => {
      const ua = isUnknown(a.value), ub = isUnknown(b.value);
      if (ua !== ub) return ua ? 1 : -1;
      return b.count - a.count;
    });
  }, [section.values]);
  const list = showAll ? sortedValues : sortedValues.slice(0, cap);
  return (
    <div style={{ marginBottom: 18, borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0,
          fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--ink)', cursor: 'pointer',
        }}>
        <span>{section.label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 400, color: 'var(--ink-3)' }}>
          {open ? '–' : '+'}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {list.map(v => {
            const active = activeValues.includes(v.value);
            const cur = currentCounts[v.value] || 0;
            const dimmed = cur === 0 && !active;
            const display = section.displayOf ? section.displayOf(v.value) : section.kind ? window.tr(section.kind, v.value, lang) : String(v.value ?? '');
            return (
              <button
                key={v.value}
                onClick={() => onToggle(v.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '4px 0', background: 'none', border: 'none',
                  fontFamily: 'var(--sans)', fontSize: 13, color: dimmed ? 'var(--ink-4)' : 'var(--ink-2)',
                  cursor: 'pointer', textAlign: 'left',
                  opacity: dimmed ? 0.5 : 1,
                }}>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--oxblood)' : 'inherit',
                }}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10,
                    border: '1px solid ' + (active ? 'var(--oxblood)' : 'var(--ink-3)'),
                    background: active ? 'var(--oxblood)' : 'transparent',
                    flexShrink: 0,
                  }}/>
                  {display}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                  {cur === v.count ? v.count : `${cur}/${v.count}`}
                </span>
              </button>
            );
          })}
          {sortedValues.length > cap && (
            <button
              onClick={() => setShowAll(s => !s)}
              style={{
                marginTop: 6, background: 'none', border: 'none', padding: 0,
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.14em', cursor: 'pointer',
              }}>
              {showAll ? L.showLess : L.moreCount(sortedValues.length - cap)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const SHORT_LABEL_KEYS = {
  family: 'familyShort',
  genre: 'genreShort',
  language: 'readLangShort',
  originalLanguage: 'origLangShort',
  era: 'eraShort',
  decade: 'decadeShort',
  author: 'authorShort',
  translated: 'translatedShort',
  mood: 'moodShort',
  period: 'periodShort',
  country: 'countryShort',
  rating: 'ratingShort',
  read: 'readShort',
};

function StatBar({ books, baseBooks, grouping, setGrouping, lang, L, showRail, onToggleRail }) {
  const GROUPINGS = window.LIB.GROUPINGS;
  const populated = window.LIB.populated || {};
  // Hide group-by options whose underlying field has no data
  const HIDE_IF_EMPTY = { mood: 'mood', period: 'period', country: 'country', rating: 'rating', read: 'read' };
  const HIDDEN = new Set(['genre', 'decade', 'author', 'translated', 'era', 'originalLanguage', 'mood', 'rating', 'read']);
  const groupKeys = Object.keys(GROUPINGS).filter(k => !HIDDEN.has(k) && (!HIDE_IF_EMPTY[k] || populated[HIDE_IF_EMPTY[k]]));
  return (
    <div style={{
      borderBottom: '1px solid var(--ink)',
      background: 'var(--paper)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px 12px', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          {onToggleRail && (
            <button onClick={onToggleRail} title={showRail ? (lang === 'de' ? 'Filter ausblenden' : 'Hide filters') : (lang === 'de' ? 'Filter anzeigen' : 'Show filters')} style={{
              background: 'none', border: 'none', padding: '4px 2px',
              color: 'var(--ink-3)', cursor: 'pointer', alignSelf: 'center',
              display: 'flex', alignItems: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {showRail
                  ? <polyline points="10,3 5,8 10,13" />
                  : <polyline points="6,3 11,8 6,13" />}
              </svg>
            </button>
          )}
          <div>
            <div className="display" style={{ fontSize: 38, lineHeight: 1 }}>{books.length}</div>
            <div className="mono">{L.ofVolumes(baseBooks.length)}</div>
          </div>
          <div style={{ display: 'flex', gap: 18, marginLeft: 12 }}>
            <Stat label={L.authors} value={new Set(books.map(b=>b.author)).size} />
            <Stat label={L.span} value={spanOf(books)} />
          </div>
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--ink)' }}>
          {groupKeys.map((k, i) => (
            <button
              key={k}
              onClick={() => setGrouping(k)}
              style={{
                padding: '7px 12px',
                background: grouping === k ? 'var(--ink)' : 'var(--paper)',
                color: grouping === k ? 'var(--paper)' : 'var(--ink)',
                border: 'none',
                borderLeft: i === 0 ? 'none' : '1px solid var(--ink)',
                fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {L[SHORT_LABEL_KEYS[k]] || k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ borderLeft: '1px solid var(--rule)', paddingLeft: 14 }}>
      <div className="display" style={{ fontSize: 22, lineHeight: 1, fontWeight: 500 }}>{value}</div>
      <div className="mono">{label}</div>
    </div>
  );
}
function spanOf(books) {
  const yrs = books.map(b => b.yearPublished).filter(y => y != null);
  if (yrs.length === 0) return '—';
  const lo = Math.min(...yrs);
  const hi = Math.max(...yrs);
  if (lo === hi) return String(lo);
  const loS = lo < 0 ? `${-lo} BCE` : String(lo);
  return `${loS}–${hi}`;
}

function Legend({ books, grouping, lang, L }) {
  const g = window.LIB.GROUPINGS[grouping];
  const KIND_OF = { family: 'family', genre: 'genre', language: 'language', originalLanguage: 'language', era: 'era', decade: 'decade', author: null, translated: 'translated' };
  const kind = KIND_OF[grouping];
  const counts = useMemo(() => {
    const m = new Map();
    for (const b of books) {
      const k = g.groupOf(b);
      if (!m.has(k)) m.set(k, { count: 0, color: g.colorOf(b) });
      m.get(k).count++;
    }
    let arr = Array.from(m.entries()).map(([name, v]) => ({ name, ...v }));
    const isUnknown = (n) => /^(Unbekannt|Unknown|Andere|Other|Andere Autoren|Other authors|Andere Sprachen|Other languages|Unklassifiziert|Unclassified)$/i.test(n);
    if (g.order) {
      arr.sort((a,b) => {
        const ua = isUnknown(a.name), ub = isUnknown(b.name);
        if (ua !== ub) return ua ? 1 : -1;
        const ia = g.order.indexOf(a.name); const ib = g.order.indexOf(b.name);
        if (ia === -1 && ib === -1) return b.count - a.count;
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
    } else {
      arr.sort((a,b) => {
        const ua = isUnknown(a.name), ub = isUnknown(b.name);
        if (ua !== ub) return ua ? 1 : -1;
        return b.count - a.count;
      });
    }
    return arr;
  }, [books, grouping]);

  return (
    <div style={{ padding: '12px 24px', borderTop: '1px solid var(--ink)', background: 'var(--paper)', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      <span className="label">{L.legend}</span>
      {counts.map(c => (
        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, background: c.color }}/>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink-2)' }}>
            {kind ? window.tr(kind, c.name, lang) : c.name}
            <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 10, marginLeft: 4 }}>{c.count}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function BookDetail({ book, onClose, onAddKeyword, onAddAuthor, onAddFilter, activeKeywords = [], activeAuthors = [], filters = {}, lang, L }) {
  if (!book) return null;
  const activeSet = new Set(activeKeywords.map(k => k.toLowerCase()));
  const authorActive = activeAuthors.includes(book.author);
  const trLang = (v) => window.tr('language', v, lang);
  const isActive = (key, val) => (filters[key] || []).includes(val);
  const toggleFilter = (key, val) => onAddFilter && onAddFilter(key, val);
  return (
    <div style={{
      width: 420, flexShrink: 0,
      borderLeft: '1px solid var(--ink)',
      background: 'var(--paper)',
      padding: '24px 28px', overflowY: 'auto',
      height: '100%',
      animation: 'slideIn .2s ease-out',
    }}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .kw-chip { font-family: var(--mono); font-size: 10px; text-transform: capitalize;
          padding: 3px 9px; border: 1px solid var(--rule); color: var(--ink-2);
          background: transparent; cursor: pointer; transition: all .12s;
          letter-spacing: 0.02em;
        }
        .kw-chip:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .kw-chip.active { background: var(--oxblood); color: var(--paper); border-color: var(--oxblood); }
        .kw-chip.active:hover { background: var(--oxblood-dk); }
        .author-link { background: none; border: none; padding: 0; cursor: pointer;
          font-family: var(--serif); font-size: 16px; font-style: italic;
          color: var(--ink-2); text-decoration: underline;
          text-decoration-color: var(--rule); text-underline-offset: 3px;
          transition: color .12s, text-decoration-color .12s;
        }
        .author-link:hover { color: var(--oxblood); text-decoration-color: var(--oxblood); }
        .author-link.active { color: var(--oxblood); text-decoration-color: var(--oxblood); font-weight: 500; }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div className="mono">{L.vol} №{String(book.id+1).padStart(3,'0')}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {book.read === true && (
            <button onClick={() => toggleFilter('read', true)} style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--paper)',
              background: isActive('read', true) ? 'var(--oxblood-dk)' : 'var(--oxblood)',
              border: 'none', padding: '3px 8px', cursor: 'pointer',
            }}>{L.read}</button>
          )}
          {book.read === false && (
            <button onClick={() => toggleFilter('read', false)} style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: isActive('read', false) ? 'var(--paper)' : 'var(--ink-2)',
              background: isActive('read', false) ? 'var(--ink)' : 'none',
              border: '1px solid var(--ink-3)', padding: '2px 7px', cursor: 'pointer',
            }}>{lang === 'de' ? 'ungelesen' : 'unread'}</button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>close ×</button>
        </div>
      </div>
      <h2 className="display" style={{ fontSize: 28, margin: '0 0 6px', textWrap: 'pretty' }}>{book.title}</h2>
      {book.originalTitle && (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-3)', marginBottom: 4 }}>
          {L.originalTitle}: {book.originalTitle}
        </div>
      )}
      <div style={{ marginBottom: 18 }}>
        <button
          className={'author-link' + (authorActive ? ' active' : '')}
          onClick={() => onAddAuthor && onAddAuthor(book.author)}
          title={authorActive ? L.removeAuthorFilter : L.filterByAuthor}
        >
          {book.author}
        </button>
        {book.yearPublished != null && (
          <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic', marginLeft: 6 }}>
            · {book.yearPublished < 0 ? `${-book.yearPublished} BCE` : book.yearPublished}
          </span>
        )}
      </div>
      <div className="rule" style={{ marginBottom: 14 }}/>
      {book.genres.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>{L.genre}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {book.genres.map(g => (
              <button key={g} className={'kw-chip' + (isActive('genres', g) ? ' active' : '')}
                onClick={() => toggleFilter('genres', g)}>{g}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <div className="label" style={{ marginBottom: 6 }}>{L.language}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button className={'kw-chip' + (isActive('language', book.language) ? ' active' : '')}
            onClick={() => toggleFilter('language', book.language)}>{trLang(book.language)}</button>
          {book.translated && (
            <button className={'kw-chip' + (isActive('originalLanguage', book.originalLanguage) ? ' active' : '')}
              onClick={() => toggleFilter('originalLanguage', book.originalLanguage)}>
              ← {trLang(book.originalLanguage)}
            </button>
          )}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div className="label" style={{ marginBottom: 6 }}>{L.era}</div>
        <button className={'kw-chip' + (isActive('era', book.era) ? ' active' : '')}
          onClick={() => toggleFilter('era', book.era)}>{book.era}</button>
      </div>
      {book.mood && book.mood.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 6 }}>{lang === 'de' ? 'Stimmung' : 'Mood'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {book.mood.map(m => (
              <button key={m} className={'kw-chip' + (isActive('mood', m) ? ' active' : '')}
                onClick={() => toggleFilter('mood', m)}>{m}</button>
            ))}
          </div>
        </div>
      )}
      {book.period && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>{lang === 'de' ? 'Periode' : 'Period'}</div>
          <button className={'kw-chip' + (isActive('period', book.period) ? ' active' : '')}
            onClick={() => toggleFilter('period', book.period)}>{book.period}</button>
        </div>
      )}
      {book.country && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 6 }}>{lang === 'de' ? 'Herkunftsland' : 'Country'}</div>
          <button className={'kw-chip' + (isActive('country', book.country) ? ' active' : '')}
            onClick={() => toggleFilter('country', book.country)}>{book.country}</button>
        </div>
      )}
      {book.series && <Field label={lang === 'de' ? 'Reihe' : 'Series'} value={book.series} />}
      {book.rating != null && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 2 }}>{lang === 'de' ? 'Bewertung' : 'Rating'}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--oxblood)', letterSpacing: '0.1em' }}>
            {'★'.repeat(Math.round(book.rating))}<span style={{ color: 'var(--ink-4)' }}>{'★'.repeat(Math.max(0, 5 - Math.round(book.rating)))}</span>
          </div>
        </div>
      )}
      {book.keywords.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 6 }}>{L.keywords}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {book.keywords.map(k => (
              <button
                key={k}
                className={'kw-chip' + (activeSet.has(k.toLowerCase()) ? ' active' : '')}
                onClick={() => onAddKeyword && onAddKeyword(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
      {book.mainIdea && (
        <div style={{ marginTop: 18 }}>
          <div className="label" style={{ marginBottom: 6 }}>{L.mainIdea}</div>
          <p style={{
            fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.5, color: 'var(--ink)',
            margin: 0, textWrap: 'pretty',
            borderLeft: '2px solid var(--oxblood)', paddingLeft: 12, fontStyle: 'italic',
          }}>
            {lang === 'en' ? (book.mainIdeaEn || book.mainIdea) : book.mainIdea}
          </p>
        </div>
      )}
      {book.summary && (
        <div style={{ marginTop: 18 }}>
          <div className="label" style={{ marginBottom: 6 }}>{L.summary}</div>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.55, color: 'var(--ink)', margin: 0, textWrap: 'pretty' }}>
            {lang === 'en' ? (book.summaryEn || book.summary) : book.summary}
          </p>
        </div>
      )}
    </div>
  );
}
function Field({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="label" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function HoverCard({ book, lang }) {
  if (!book) return null;
  const trLang = (v) => window.tr('language', v, lang);
  const trGenre = lang === 'de' ? book.primaryGenre : (window.I18N.genre[book.primaryGenre] || book.primaryGenre);
  return (
    <div style={{
      position: 'fixed', bottom: 18, left: 264,
      background: 'var(--ink)', color: 'var(--paper)',
      padding: '10px 14px', maxWidth: 420,
      fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.4,
      pointerEvents: 'none', zIndex: 40,
      borderLeft: '3px solid ' + (window.LIB.FAMILY_COLOR[book.family] || '#a8884a'),
    }}>
      <div style={{ fontWeight: 600 }}>{book.title}</div>
      <div style={{ fontStyle: 'italic', color: 'var(--paper-3)', fontSize: 13 }}>
        {book.author}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--brass)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>
        {trGenre} · {trLang(book.language)}{book.yearPublished != null ? ` · ${book.yearPublished < 0 ? -book.yearPublished + ' BCE' : book.yearPublished}` : ''}
      </div>
    </div>
  );
}

function ActiveFilters({ filters, setFilters, lang, L }) {
  const chips = [];
  for (const key of ['family','language','originalLanguage','era','author','genres','keywords','mood','period','country','read']) {
    for (const v of (filters[key] || [])) {
      chips.push({ key, value: v });
    }
  }
  if (filters.search) chips.push({ key: 'search', value: filters.search, prefix: '"' });
  if (chips.length === 0) return null;

  const removeChip = (key, value) => {
    setFilters(f => {
      if (key === 'search') return { ...f, search: '' };
      const cur = (f[key] || []).filter(v => v !== value);
      return { ...f, [key]: cur };
    });
  };

  const KEY_LABEL = {
    family: L.family, language: L.language.toLowerCase(), originalLanguage: 'orig',
    era: L.era.toLowerCase(), author: L.authorPrefix,
    genres: 'genre', keywords: lang === 'de' ? 'schlagwort' : 'keyword',
    mood: lang === 'de' ? 'stimmung' : 'mood',
    period: lang === 'de' ? 'periode' : 'period',
    country: lang === 'de' ? 'land' : 'country',
    read: lang === 'de' ? 'gelesen' : 'read',
    search: lang === 'de' ? 'suche' : 'search',
  };
  const KIND_OF = { family: 'family', language: 'language', originalLanguage: 'language', era: 'era', genres: 'genre', keywords: null, author: null, mood: null, period: null, country: null, read: null };
  const READ_LABEL = { true: lang === 'de' ? 'Gelesen' : 'Read', false: lang === 'de' ? 'Ungelesen' : 'Unread', null: 'Unbekannt' };

  return (
    <div style={{
      padding: '8px 24px',
      borderBottom: '1px solid var(--rule)',
      background: 'var(--paper)',
      display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
    }}>
      <span className="label" style={{ marginRight: 4 }}>{L.active} ({chips.length})</span>
      {chips.map((c, i) => {
        const display = c.key === 'read' ? READ_LABEL[String(c.value)] : KIND_OF[c.key] ? window.tr(KIND_OF[c.key], c.value, lang) : c.value;
        return (
          <button
            key={c.key + '|' + c.value + '|' + i}
            onClick={() => removeChip(c.key, c.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--ink)', color: 'var(--paper)',
              border: 'none', padding: '4px 8px 4px 10px',
              fontFamily: 'var(--sans)', fontSize: 11, cursor: 'pointer',
            }}
            title={L.removeFilter}
          >
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--paper-3)' }}>{KEY_LABEL[c.key]}</span>
            <span>{(c.prefix||'') + display + (c.prefix?'"':'')}</span>
            <span style={{ marginLeft: 2, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--paper-3)' }}>×</span>
          </button>
        );
      })}
      <button
        onClick={() => setFilters({ search: '' })}
        style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--oxblood)',
          textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>
        {L.clearAll}
      </button>
    </div>
  );
}

// Carousel view — same grouping logic as Treemap, but renders each group as
// a horizontal scroll-snap band of book cards. Touch-friendly and works as an
// alternative for browsing a single group at a time.
function CarouselView({ books, grouping, lang, L, onSelectBook }) {
  const g = window.LIB.GROUPINGS[grouping];
  const KIND_OF = { family: 'family', genre: 'genre', language: 'language', originalLanguage: 'language', era: 'era', decade: 'decade', author: null, translated: 'translated', mood: null, period: null, country: null, rating: null, read: null };
  const kind = KIND_OF[grouping];
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

  if (books.length === 0) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        {L.noMatches}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0 24px' }}>
      <style>{`
        .car-row::-webkit-scrollbar { height: 8px; }
        .car-row::-webkit-scrollbar-track { background: transparent; }
        .car-row::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 4px; }
        .car-row::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }
      `}</style>
      {groups.map(gr => {
        const displayName = kind ? window.tr(kind, gr.name, lang) : gr.name;
        return (
          <CarouselRow
            key={gr.name}
            group={gr}
            displayName={displayName}
            onSelectBook={onSelectBook}
          />
        );
      })}
    </div>
  );
}

function CarouselRow({ group, displayName, onSelectBook }) {
  const rowRef = useRef(null);
  // Loop is enabled when there are enough items that scrolling makes sense.
  const loopable = group.items.length >= 6;
  // Render items 3× when looping so we can silently jump between copies.
  const items = loopable
    ? [...group.items, ...group.items, ...group.items]
    : group.items;
  const middleStart = loopable ? group.items.length : 0;

  // Position scroller in the middle copy on mount and on book-list changes.
  const settled = useRef(false);
  useEffect(() => {
    if (!loopable) return;
    settled.current = false;
    const el = rowRef.current; if (!el) return;
    // Wait one frame so the children have laid out, then position to the
    // start of the middle copy (works as long as every card has the same width).
    requestAnimationFrame(() => {
      const cardW = el.firstElementChild ? el.firstElementChild.offsetWidth : 180;
      el.scrollLeft = group.items.length * (cardW + 12);
      settled.current = true;
    });
  }, [group.items.length, loopable]);

  // Wrap scroll position back into the middle copy whenever it drifts out.
  useEffect(() => {
    if (!loopable) return;
    const el = rowRef.current; if (!el) return;
    const onScroll = () => {
      if (!settled.current) return;
      const one = el.scrollWidth / 3;
      if (el.scrollLeft < one * 0.5) {
        el.scrollLeft += one;
      } else if (el.scrollLeft > one * 2 - el.clientWidth + one * 0.5) {
        // i.e. scrolled past two copies into the trailing one
        el.scrollLeft -= one;
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loopable]);

  // Track whether arrows should show. In loop mode they always show.
  const [canLeft, setCanLeft] = useState(loopable);
  const [canRight, setCanRight] = useState(true);
  useEffect(() => {
    if (loopable) { setCanLeft(true); setCanRight(true); return; }
    const el = rowRef.current; if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [loopable]);

  const scrollBy = (dir) => {
    const el = rowRef.current; if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section style={{ marginBottom: 26, position: 'relative' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 12px 12px',
      }}>
        <span style={{ width: 16, height: 16, background: group.color, flexShrink: 0 }} />
        <h2 style={{
          margin: 0, fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)',
        }}>{displayName}</h2>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)',
        }}>{group.items.length}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--rule)' }}/>
      </header>
      <div style={{ position: 'relative' }}>
        <div ref={rowRef} className="car-row" style={{
          display: 'flex', gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollPaddingLeft: 12,
          padding: '4px 12px 16px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {items.map((b, i) => (
            <CarouselCard key={`${b.id}-${i}`} book={b} color={group.color} onClick={() => onSelectBook(b)} />
          ))}
        </div>
        <CarouselArrow direction="left"  visible={canLeft}  onClick={() => scrollBy(-1)} />
        <CarouselArrow direction="right" visible={canRight} onClick={() => scrollBy(1)}  />
      </div>
    </section>
  );
}

function CarouselArrow({ direction, visible, onClick }) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      aria-label={direction === 'left' ? 'previous' : 'next'}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        [direction]: 10,
        width: 32, height: 56,
        background: 'rgba(28,28,30,0.32)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: 'none',
        color: 'var(--paper)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.85,
        transition: 'opacity .15s ease, background .15s',
        zIndex: 2,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(28,28,30,0.7)'; e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(28,28,30,0.32)'; e.currentTarget.style.opacity = '0.85'; }}
    >
      <svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'left'
          ? <polyline points="9,3 4,8 9,13" />
          : <polyline points="5,3 10,8 5,13" />}
      </svg>
    </button>
  );
}

function CarouselCard({ book, color, onClick }) {
  const year = book.yearPublished != null
    ? (book.yearPublished < 0 ? `${-book.yearPublished} BCE` : String(book.yearPublished))
    : '';
  return (
    <button onClick={onClick} style={{
      width: 180, minWidth: 180, height: 240,
      flexShrink: 0,
      background: color, color: 'var(--paper)',
      padding: '16px 16px 14px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      textAlign: 'left',
      scrollSnapAlign: 'start',
      cursor: 'pointer', overflow: 'hidden',
      border: 'none',
      borderRadius: 2,
      boxShadow: '0 1px 0 rgba(0,0,0,0.05), 0 8px 20px -8px rgba(28,28,30,0.3)',
      transition: 'transform .14s ease, box-shadow .14s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 1px 0 rgba(0,0,0,0.05), 0 16px 28px -10px rgba(28,28,30,0.4)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 0 rgba(0,0,0,0.05), 0 8px 20px -8px rgba(28,28,30,0.3)'; }}
    >
      <div style={{
        fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500,
        lineHeight: 1.15, letterSpacing: '-0.01em',
        color: 'var(--paper)',
        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 5,
        overflow: 'hidden', textWrap: 'pretty',
      }}>{book.title}</div>
      <div>
        <div style={{
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13,
          color: 'rgba(232,232,229,0.88)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 4,
        }}>{book.author}</div>
        {year && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em',
            color: 'rgba(232,232,229,0.55)',
          }}>{year}</div>
        )}
      </div>
    </button>
  );
}

window.CarouselView = CarouselView;
window.ActiveFilters = ActiveFilters;
window.FilterRail = FilterRail;
window.StatBar = StatBar;
window.Legend = Legend;
window.BookDetail = BookDetail;
window.HoverCard = HoverCard;
