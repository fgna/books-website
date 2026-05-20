// Main app

const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "Cool grey",
  "accent": "#8a3324",
  "density": "regular",
  "labels": "auto",
  "showHeaders": true,
  "showFootnote": true
}/*EDITMODE-END*/;

const PALETTES = {
  "Cool grey": {
    paper: '#e8e8e5', paper2: '#dcdcd9', paper3: '#c4c4c0',
    ink: '#1c1c1e', ink2: '#38383a', ink3: '#6a6a6d', ink4: '#98989b',
    rule: '#b8b8b4',
  },
  "Slate": {
    paper: '#e4e6e8', paper2: '#d4d7da', paper3: '#bcc0c4',
    ink: '#1a1d22', ink2: '#33373d', ink3: '#62676d', ink4: '#92969c',
    rule: '#b0b4b8',
  },
  "Warm beige": {
    paper: '#f4ede0', paper2: '#ebe2d0', paper3: '#ddd1b8',
    ink: '#1a1612', ink2: '#3a3128', ink3: '#6b5e4d', ink4: '#9c8d75',
    rule: '#c9bca0',
  },
  "Charcoal": {
    paper: '#1f1f21', paper2: '#2a2a2c', paper3: '#3a3a3c',
    ink: '#e8e8e5', ink2: '#c4c4c0', ink3: '#9a9a9d', ink4: '#6a6a6d',
    rule: '#3a3a3c',
  },
};


function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const lang = (window.LIB_CONFIG && window.LIB_CONFIG.lang) || 'de';
  const [showRail, setShowRail] = useState(false);
  const [grouping, setGrouping] = useState('family');
  const [filters, setFilters] = useState({ search: '' });
  const [selected, setSelected] = useState(null);
  const L = window.T(lang);

  // Apply palette → CSS vars
  useEffect(() => {
    const p = PALETTES[t.palette] || PALETTES["Cool grey"];
    const root = document.documentElement.style;
    root.setProperty('--paper', p.paper);
    root.setProperty('--paper-2', p.paper2);
    root.setProperty('--paper-3', p.paper3);
    root.setProperty('--ink', p.ink);
    root.setProperty('--ink-2', p.ink2);
    root.setProperty('--ink-3', p.ink3);
    root.setProperty('--ink-4', p.ink4);
    root.setProperty('--rule', p.rule);
    root.setProperty('--oxblood', t.accent);
  }, [t.palette, t.accent]);

  const baseBooks = window.LIB.books;

  // Apply filters
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
      if (f.period?.length && !f.period.includes(b.period)) return false;
      if (f.country?.length && !f.country.includes(b.country)) return false;
      if (f.rating?.length && !f.rating.includes(b.rating)) return false;
      if (f.read?.length && !f.read.includes(b.read)) return false;
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

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setSelected(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header L={L} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {showRail && <FilterRail filters={filters} setFilters={setFilters} books={books} baseBooks={baseBooks} lang={lang} L={L} onClose={() => setShowRail(false)} />}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <StatBar books={books} baseBooks={baseBooks} grouping={grouping} setGrouping={setGrouping} lang={lang} L={L} showRail={showRail} onToggleRail={() => setShowRail(v => !v)} />
          <ActiveFilters filters={filters} setFilters={setFilters} lang={lang} L={L} />
          <div style={{ flex: 1, padding: 0, minHeight: 600, background: 'var(--paper-2)', borderBottom: '1px solid var(--ink)', overflow: 'auto' }}>
            <CarouselView
              books={books}
              grouping={grouping}
              onSelectBook={setSelected}
              lang={lang}
              L={L}
            />
          </div>
        </main>
        <BookDetail
          book={selected}
        onClose={() => setSelected(null)}
        activeKeywords={filters.keywords || []}
        activeAuthors={filters.author || []}
        filters={filters}
        lang={lang}
        L={L}
        onAddKeyword={(k) => {
          setFilters(f => {
            const cur = new Set(f.keywords || []);
            if (cur.has(k)) cur.delete(k); else cur.add(k);
            return { ...f, keywords: Array.from(cur) };
          });
        }}
        onAddAuthor={(a) => {
          setFilters(f => {
            const cur = new Set(f.author || []);
            if (cur.has(a)) cur.delete(a); else cur.add(a);
            return { ...f, author: Array.from(cur) };
          });
        }}
        onAddFilter={(key, val) => {
          setFilters(f => {
            const cur = new Set(f[key] || []);
            if (cur.has(val)) cur.delete(val); else cur.add(val);
            return { ...f, [key]: Array.from(cur) };
          });
        }}
        />
      </div>
      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakSelect
          label="Palette"
          value={t.palette}
          options={Object.keys(PALETTES)}
          onChange={(v) => setTweak('palette', v)}
        />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={['#8a3324','#2d3a5a','#3a5d5a','#8e7d5c','#6b6843','#4a2a3a']}
          onChange={(v) => setTweak('accent', v)}
        />
        <TweakSection label="Chrome" />
        <TweakToggle
          label="Footer bar"
          value={t.showFootnote}
          onChange={(v) => setTweak('showFootnote', v)}
        />
      </TweaksPanel>
    </div>
  );
}

function Header({ L }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '14px 24px 12px', borderBottom: '1px solid var(--ink)',
      background: 'var(--paper)',
    }}>
      <div className="display" style={{ fontSize: 22 }}>{(window.LIB_CONFIG && window.LIB_CONFIG.name) || 'die Bibliothek'}</div>
    </header>
  );
}

function Footnote({ L }) {
  return (
    <div style={{
      padding: '10px 24px', display: 'flex', justifyContent: 'space-between',
      background: 'var(--ink)', color: 'var(--paper-3)',
      fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
    }}>
      <span>{L.footnote}</span>
      <span>{L.esc}</span>
    </div>
  );
}

function boot() {
  const root = ReactDOM.createRoot(document.getElementById('app'));
  root.render(<App />);
  const boot = document.getElementById('boot');
  if (boot) {
    setTimeout(() => { boot.classList.add('hidden'); setTimeout(() => boot.remove(), 400); }, 200);
  }
}

if (window.LIB) boot();
else window.addEventListener('lib-ready', boot, { once: true });
