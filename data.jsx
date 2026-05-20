// Load + normalize the library data; expose to window.

function showBootError(msg) {
  const sub = document.querySelector('.boot-sub');
  const bar = document.querySelector('.boot-bar');
  if (sub) { sub.textContent = msg; sub.style.color = '#8a3324'; }
  if (bar) bar.style.display = 'none';
}

(async () => {
  let res;
  try {
    res = await fetch('books.json');
  } catch (e) {
    showBootError('Netzwerkfehler — starte den Webserver aus dem project-Ordner: python3 -m http.server 8000');
    console.error('books.json fetch failed:', e);
    return;
  }
  if (!res.ok) {
    showBootError(`books.json nicht gefunden (${res.status}) — starte den Webserver aus dem project-Ordner`);
    console.error('books.json HTTP error:', res.status, res.url);
    return;
  }
  let json;
  try {
    json = await res.json();
  } catch (e) {
    showBootError('books.json konnte nicht geparst werden — ungültiges JSON');
    console.error('books.json parse error:', e);
    return;
  }
  const raw = json.books;

  // Genre family mapping (German values matching books.json)
  const FAMILY_DEFS = {
    'Belletristik': [
      'Belletristik','Roman','Literatur','Klassiker','Klassische Literatur',
      'Lateinamerikanische Literatur','Amerikanische Literatur','Deutsche Literatur','Französische Literatur',
      'Spanische Literatur','Britische Literatur','Russische Literatur','Italienische Literatur',
      'Japanische Literatur','Hebräische Literatur','Skandinavische Literatur','Israelische Literatur',
      'Afrikanische Literatur','Asiatische Literatur','Brasilianische Literatur','Portugiesische Literatur',
      'Schwedische Literatur','Niederländische Literatur','Finnische Literatur','Griechische Literatur',
      'Irische Literatur','Kanadische Literatur','Nigerianische Literatur','Mexikanische Literatur',
      'Chinesische Literatur','Indische Literatur','Dänische Literatur','Algerische Literatur',
      'Südafrikanische Literatur','Katalanische Literatur','Ägyptische Literatur','Serbische Literatur',
      'Türkische Literatur','Ukrainische Literatur','Isländische Literatur','Simbabwische Literatur',
      'Kinderliteratur','Jugendliteratur','Bilderbuch',
      'Kurzgeschichten','Anthologie','Comics',
      'Historischer Roman','Kriminalliteratur','Krimi','Mystery','Thriller',
      'Science-Fiction','Fantasy','Horror','Gothik','Liebesroman','Abenteuer',
      'Magischer Realismus','Drama','Poesie','Satire','Komödie','Humor',
      'Metafiktion','Akademische Fiktion',
    ],
    'Philosophie':  [
      'Philosophie','Ethik','Stoizismus','Buddhismus','Spiritualität','Religion','Achtsamkeit',
      'Metaphysik','Logik','Politische Philosophie','Wissenschaftsphilosophie','Philosophiegeschichte',
      'Aphorismen','Rhetorik','Sprachphilosophie','Theologie','Jüdische Literatur',
      'Ästhetik','Kulturtheorie','Literaturkritik','Literaturwissenschaft',
    ],
    'Wissenschaft': [
      'Wissenschaft','Populärwissenschaft','Wissenschaftsgeschichte',
      'Physik','Biologie','Mathematik','Astronomie','Botanik','Ornithologie',
      'Kognitionswissenschaft','Psychologie','Neurowissenschaft','Entwicklungswissenschaft',
      'Umwelt','Natur','Naturliteratur','Medizin','Gesundheit','Geografie',
      'Technologie','Informatik','Ingenieurwissenschaft','Programmierung','Telekommunikation','Technisch',
      'Linguistik','Sozialwissenschaft','Demografie','Stadtforschung','Geschlechterstudien',
      'Bildung','Futurismus','Nachhaltigkeit',
    ],
    'Kunst':        [
      'Kunst','Kunstgeschichte','Kunsttheorie','Kunstanleitung','Architektur',
      'Fotografie','Musik','Visuelle Studien','Design','Typografie','Zeichnen','Drucke',
      'Film','Filmwissenschaft','Filmtheorie','Theater','Semiotik','Literaturtheorie',
      'Medienwissenschaft','Modernismus','Mode','Dokumentarfilm',
    ],
    'Wirtschaft':   [
      'Wirtschaft','Wirtschaftswissenschaften','Management','Finanzen','Marketing',
      'Ratgeber','Produktivität','Führung','Karriere',
      'Unternehmertum','Strategie','Investitionen','Wirtschaftsschreiben','Recht',
    ],
    'Geschichte':   [
      'Geschichte','Kulturgeschichte','Alte Geschichte','Mittelalterliche Geschichte','Deutsche Geschichte',
      'Militärgeschichte','Politische Geschichte','Regionalgeschichte',
      'Memoiren','Biografie','Politik','Politikwissenschaft',
      'Kulturwissenschaften','Soziologie','Anthropologie','Journalismus','Aktuelles',
      'Gesellschaftskritik','Kulturkritik','Internationale Beziehungen',
      'Gesellschaft','Kommunikation','Kultur',
    ],
    'Fremdsprachen':['Wörterbuch','Sprache','Sprachenlernen','Sprachphilosophie'],
    'Sachbuch':     [
      'Sachbuch','Essays','Referenz','Enzyklopädie','Atlas',
      'Kochbuch','Reise','Feldführer','Gartenarbeit','Heimwerken',
      'Hobbys','Elternschaft','Familie','Erhaltung',
      'Kuriositäten','Interviews','Archäologie',
    ],
  };
  const FAMILY_COLOR = {
    'Belletristik': '#8a3324',
    'Philosophie':  '#2d3a5a',
    'Wissenschaft': '#3a5d5a',
    'Kunst':        '#9a5e2e',
    'Wirtschaft':   '#6b6843',
    'Geschichte':   '#4a2a3a',
    'Fremdsprachen':'#4a7a5a',
    'Sachbuch':     '#8e7d5c',
    'Andere':       '#5a5043',
  };

  function familyOf(book) {
    const gs = book.genre || [];
    for (const g of gs) {
      for (const [fam, list] of Object.entries(FAMILY_DEFS)) {
        if (list.includes(g)) return fam;
      }
    }
    return 'Andere';
  }

  function eraOf(book) {
    const y = book.year_published;
    if (y == null) return 'Unbekannt';
    if (y < 500) return 'Antike';
    if (y < 1500) return 'Mittelalter';
    if (y < 1700) return 'Frühe Neuzeit';
    if (y < 1800) return '18. Jh.';
    if (y < 1900) return '19. Jh.';
    if (y < 1950) return 'Frühes 20. Jh.';
    if (y < 1980) return 'Mittleres 20. Jh.';
    if (y < 2000) return 'Spätes 20. Jh.';
    if (y < 2010) return '2000er';
    if (y < 2020) return '2010er';
    return '2020er';
  }
  const ERA_ORDER = ['Antike','Mittelalter','Frühe Neuzeit','18. Jh.','19. Jh.','Frühes 20. Jh.','Mittleres 20. Jh.','Spätes 20. Jh.','2000er','2010er','2020er','Unbekannt'];

  function decadeOf(book) {
    const y = book.year_published;
    if (y == null) return 'Unbekannt';
    if (y < 1800) return 'vor 1800';
    return Math.floor(y/10)*10 + 'er';
  }

  // Normalize
  const books = raw.map((b, i) => ({
    id: i,
    title: b.title,
    originalTitle: b.original_title || null,
    author: b.author || 'Unbekannt',
    genres: b.genre || [],
    primaryGenre: (b.genre && b.genre[0]) || 'Unklassifiziert',
    family: familyOf(b),
    language: b.language || 'Unbekannt',
    originalLanguage: b.original_language || 'Unbekannt',
    keywords: b.keywords || [],
    summary: b.summary || '',
    summaryEn: b.summary_en || b.summary || '',
    mainIdea: b.main_idea || null,
    mainIdeaEn: b.main_idea_en || b.main_idea || null,
    read: b.read ?? null,
    yearPublished: b.year_published,
    era: eraOf(b),
    decade: decadeOf(b),
    translated: (b.language && b.original_language && b.language !== b.original_language),
    // Optional fields (currently null in the source but surface them when present)
    mood: b.mood || null,
    period: b.period || null,
    country: b.country_of_origin || null,
    rating: b.rating != null ? b.rating : null,
    series: b.series || null,
  }));

  // Author counts (used for the "Author" grouping which only shows top N)
  const authorTally = {};
  for (const b of books) authorTally[b.author] = (authorTally[b.author] || 0) + 1;

  function authorBucket(book) {
    return authorTally[book.author] >= 3 ? book.author : 'Andere Autoren';
  }

  // Language bucket: collapse long tail
  const langTally = {};
  for (const b of books) langTally[b.originalLanguage] = (langTally[b.originalLanguage]||0)+1;
  function origLangBucket(book) {
    return langTally[book.originalLanguage] >= 5 ? book.originalLanguage : 'Andere Sprachen';
  }

  // Grouping definitions
  const GROUPINGS = {
    family: {
      label: 'Genre family',
      key: 'family',
      colorOf: (book) => FAMILY_COLOR[book.family] || FAMILY_COLOR.Other,
      groupOf: (book) => book.family,
      order: Object.keys(FAMILY_COLOR),
    },
    genre: {
      label: 'Primary genre',
      key: 'genre',
      colorOf: (book) => FAMILY_COLOR[book.family] || FAMILY_COLOR.Other,
      groupOf: (book) => book.primaryGenre,
      order: null, // by count
    },
    language: {
      label: 'Reading language',
      key: 'language',
      colorOf: (book) => LANG_COLOR[book.language] || '#5a5043',
      groupOf: (book) => book.language,
      order: null,
    },
    originalLanguage: {
      label: 'Original language',
      key: 'originalLanguage',
      colorOf: (book) => LANG_COLOR[book.originalLanguage] || '#5a5043',
      groupOf: (book) => origLangBucket(book),
      order: null,
    },
    era: {
      label: 'Era',
      key: 'era',
      colorOf: (book) => ERA_COLOR[book.era] || '#5a5043',
      groupOf: (book) => book.era,
      order: ERA_ORDER,
    },
    decade: {
      label: 'Decade',
      key: 'decade',
      colorOf: (book) => ERA_COLOR[book.era] || '#5a5043',
      groupOf: (book) => book.decade,
      order: null,
    },
    author: {
      label: 'Author (top 15)',
      key: 'author',
      colorOf: (book) => FAMILY_COLOR[book.family] || FAMILY_COLOR.Other,
      groupOf: (book) => authorBucket(book),
      order: null,
    },
    translated: {
      label: 'Übersetzt?',
      key: 'translated',
      colorOf: (book) => book.translated ? '#8a3324' : '#3a5d5a',
      groupOf: (book) => book.translated ? 'Übersetzt' : 'Originalsprache',
      order: ['Originalsprache','Übersetzt'],
    },
    mood: {
      label: 'Stimmung',
      key: 'mood',
      colorOf: (book) => MOOD_COLOR[Array.isArray(book.mood) ? book.mood[0] : book.mood] || '#5a5043',
      groupOf: (book) => (Array.isArray(book.mood) && book.mood.length > 0 ? book.mood[0] : null) || 'Unbekannt',
      order: null,
    },
    period: {
      label: 'Periode',
      key: 'period',
      colorOf: (book) => PERIOD_COLOR[book.period] || '#5a5043',
      groupOf: (book) => book.period || 'Unbekannt',
      order: null,
    },
    country: {
      label: 'Herkunftsland',
      key: 'country',
      colorOf: (book) => COUNTRY_COLOR[book.country] || '#5a5043',
      groupOf: (book) => book.country || 'Unbekannt',
      order: null,
    },
    rating: {
      label: 'Bewertung',
      key: 'rating',
      colorOf: () => '#8a3324',
      groupOf: (book) => book.rating != null ? `${book.rating}★` : 'Unbewertet',
      order: ['5★','4★','3★','2★','1★','Unbewertet'],
    },
    read: {
      label: 'Gelesen?',
      key: 'read',
      colorOf: (book) => book.read === true ? '#8a3324' : book.read === false ? '#3a5d5a' : '#98989b',
      groupOf: (book) => book.read === true ? 'Gelesen' : book.read === false ? 'Ungelesen' : 'Unbekannt',
      order: ['Gelesen','Ungelesen','Unbekannt'],
    },
  };

  const MOOD_COLOR = {
    'Unbekannt': '#98989b',
  };

  const LANG_COLOR = {
    'Deutsch':        '#3d4f60',
    'Englisch':       '#8a3324',
    'Französisch':    '#2d3a5a',
    'Spanisch':       '#9a5e2e',
    'Italienisch':    '#3a5d5a',
    'Japanisch':      '#4a2a3a',
    'Dänisch':        '#6b6843',
    'Latein':         '#7a6a4a',
    'Griechisch':     '#8e7d5c',
    'Vietnamesisch':  '#5a5043',
    'Niederländisch': '#6b5e4d',
    'Chinesisch':     '#8a3520',
    'Hebräisch':      '#6a5548',
    'Schwedisch':     '#4a3f33',
    'Portugiesisch':  '#9c8d75',
    'Russisch':       '#2d3a5a',
    'Türkisch':       '#6b6843',
    'Arabisch':       '#9a5e2e',
    'Katalanisch':    '#6b6843',
    'Isländisch':     '#4a3f33',
    'Finnisch':       '#6b5e4d',
    'Serbisch':       '#7a3525',
    'Ukrainisch':     '#2d3a5a',
    'Andere Sprachen':'#5a5043',
    'Unbekannt':      '#98989b',
  };
  const ERA_COLOR = {
    'Antike':            '#5a1f15',
    'Mittelalter':       '#7a3f25',
    'Frühe Neuzeit':     '#9a5e2e',
    '18. Jh.':           '#8e7d5c',
    '19. Jh.':           '#6b6843',
    'Frühes 20. Jh.':    '#3a5d5a',
    'Mittleres 20. Jh.': '#2d4a5a',
    'Spätes 20. Jh.':    '#2d3a5a',
    '2000er':            '#4a2a3a',
    '2010er':            '#8a3324',
    '2020er':            '#8e7d5c',
    'Unbekannt':         '#98989b',
  };

  const PERIOD_COLOR = {
    'Antikes Griechenland': '#5a1f15',
    'Antikes Rom':          '#7a3025',
    'Renaissance':          '#9a5e2e',
    '16. Jahrhundert':      '#8e7d5c',
    '17. Jahrhundert':      '#6b6843',
    '18. Jahrhundert':      '#4a6b5a',
    '19. Jahrhundert':      '#3a5d5a',
    'Viktorianisches Zeitalter': '#2d4a5a',
    'Frühes 20. Jahrhundert':    '#2d3a5a',
    'Erster Weltkrieg':     '#4a3a5a',
    'Weltwirtschaftskrise': '#5a4a3a',
    'Zweiter Weltkrieg':    '#3a3050',
    'Nachkriegszeit':       '#4a2a3a',
    'Mittleres 20. Jahrhundert': '#6b3a2a',
    'Kalter Krieg':         '#8a3324',
    '20. Jahrhundert':      '#7a5e3a',
    'Gegenwart':            '#3a5d5a',
    'Unbekannt':            '#98989b',
  };

  // Group countries by broad geographic region
  const COUNTRY_COLOR = {
    // German-speaking
    'Deutschland': '#2d4a5a', 'Österreich': '#3a556a', 'Schweiz': '#4a6070',
    // Anglo
    'Vereinigtes Königreich': '#2d3a5a', 'Vereinigte Staaten': '#3a4a6a',
    'Irland': '#4a5a7a', 'Kanada': '#2a3555', 'Australien': '#3a5070',
    'Neuseeland': '#253570',
    // Romance / Southern Europe
    'Frankreich': '#8a3324', 'Spanien': '#9a3a2a', 'Italien': '#7a2a1e',
    'Portugal': '#6a2018', 'Griechenland': '#aa4433',
    // Latin America
    'Argentinien': '#9a5e2e', 'Mexiko': '#8e5228', 'Kolumbien': '#7a4520',
    'Chile': '#a06030', 'Brasilien': '#8a5830', 'Peru': '#b06838',
    'Uruguay': '#9a6035', 'Kuba': '#7a5025',
    // Nordic
    'Schweden': '#3a5d5a', 'Dänemark': '#2d504d', 'Finnland': '#4a6d6a',
    'Island': '#2a4a47', 'Norwegen': '#355855',
    // Eastern Europe
    'Russland': '#4a2a3a', 'Ukraine': '#6a4060', 'Serbien': '#5a3040',
    'Ungarn': '#4a2535', 'Polen': '#6a3a55',
    // East Asia
    'Japan': '#6b6843', 'China': '#7a7050', 'Vietnam': '#5a5835',
    // South & Southeast Asia
    'Indien': '#8e7d5c',
    // Middle East / North Africa
    'Israel': '#7a5e3a', 'Ägypten': '#8a6535', 'Algerien': '#7a5e30',
    'Türkei': '#9a6d40',
    // Sub-Saharan Africa
    'Nigeria': '#6b5030', 'Südafrika': '#5a4528', 'Simbabwe': '#4a3820',
    // Other
    'Unbekannt': '#98989b',
  };

  // Filterable facets: every distinct value with counts
  function facetCounts(field) {
    const out = {};
    for (const b of books) {
      const vals = Array.isArray(b[field]) ? b[field] : [b[field]];
      for (const v of vals) out[v] = (out[v] || 0) + 1;
    }
    return Object.entries(out).map(([v,c]) => ({ value: v, count: c })).sort((a,b)=>b.count-a.count);
  }
  const facets = {
    family: facetCounts('family'),
    language: facetCounts('language'),
    originalLanguage: facetCounts('originalLanguage'),
    era: facetCounts('era'),
    genres: facetCounts('genres'),
    author: facetCounts('author'),
    mood: facetCounts('mood').filter(f => f.value),
    period: facetCounts('period').filter(f => f.value),
    country: facetCounts('country').filter(f => f.value),
    rating: facetCounts('rating').filter(f => f.value != null),
    series: facetCounts('series').filter(f => f.value),
    read: [
      { value: true,  count: books.filter(b => b.read === true).length },
      { value: false, count: books.filter(b => b.read === false).length },
      { value: null,  count: books.filter(b => b.read === null).length },
    ],
  };

  // Which optional fields are populated at all
  const populated = {
    mainIdea: books.some(b => b.mainIdea),
    mood: facets.mood.length > 0,
    period: facets.period.length > 0,
    country: facets.country.length > 0,
    rating: facets.rating.length > 0,
    series: facets.series.length > 0,
    read: books.some(b => b.read != null),
  };

  window.LIB = {
    books,
    GROUPINGS,
    FAMILY_COLOR,
    LANG_COLOR,
    ERA_COLOR,
    ERA_ORDER,
    facets,
    populated,
  };
  window.dispatchEvent(new CustomEvent('lib-ready'));
})().catch(e => {
  showBootError('Unerwarteter Fehler beim Laden der Daten — siehe Konsole');
  console.error('data.jsx unhandled error:', e);
});
