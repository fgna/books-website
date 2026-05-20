// Lightweight i18n: UI strings only. All data values (genres, languages, etc.)
// are stored in German and displayed as-is in both language modes.

const I18N = {
  ui: {
    de: {
      filter: 'Filter',
      clear: 'Löschen',
      clearAll: 'alles löschen',
      search: 'Titel, Autor, Schlagwort…',
      groupBy: 'Gruppieren nach',
      active: 'Aktiv',
      legend: 'Legende',
      authors: 'Autoren',
      span: 'Zeitraum',
      ofVolumes: (n) => `von ${n} Bänden`,
      genreFamily: 'Genre-Familie',
      readingLanguage: 'Lesesprache',
      originalLanguage: 'Originalsprache',
      era: 'Epoche',
      author: 'Autor',
      familyShort: 'Familie',
      genreShort: 'Genre',
      readLangShort: 'Lesespr.',
      origLangShort: 'Orig. Spr.',
      eraShort: 'Epoche',
      decadeShort: 'Jahrzehnt',
      authorShort: 'Autor',
      translatedShort: 'Übersetzt',
      moodShort: 'Stimmung',
      periodShort: 'Periode',
      countryShort: 'Land',
      ratingShort: 'Bewertung',
      readShort: 'Gelesen',
      vol: 'Bd.',
      read: 'gelesen',
      keywords: 'Schlagwörter',
      summary: 'Zusammenfassung',
      mainIdea: 'Hauptthese',
      language: 'Sprache',
      genre: 'Genre',
      authorPrefix: 'Autor',
      family: 'Familie',
      authors3plus: 'Autor (3+ Bücher)',
      moreCount: (n) => `+ ${n} weitere`,
      showLess: 'weniger anzeigen',
      footnote: 'Jede Zelle = ein Band · Klick für Detail · Hover für Titel',
      esc: 'ESC zum Schließen',
      cataloged: 'Katalogisiert 2026',
      removeFilter: 'Filter entfernen',
      filterByAuthor: 'Nach diesem Autor filtern',
      removeAuthorFilter: 'Autor-Filter entfernen',
      noMatches: 'Keine Bände entsprechen den aktuellen Filtern',
      originalTitle: 'Originaltitel',
    },
    en: {
      filter: 'Filter',
      clear: 'Clear',
      clearAll: 'clear all',
      search: 'Title, author, keyword…',
      groupBy: 'Group by',
      active: 'Active',
      legend: 'Legend',
      authors: 'authors',
      span: 'span',
      ofVolumes: (n) => `of ${n} volumes`,
      genreFamily: 'Genre family',
      readingLanguage: 'Reading language',
      originalLanguage: 'Original language',
      era: 'Era',
      author: 'Author',
      familyShort: 'Family',
      genreShort: 'Genre',
      readLangShort: 'Read lang.',
      origLangShort: 'Orig. lang.',
      eraShort: 'Era',
      decadeShort: 'Decade',
      authorShort: 'Author',
      translatedShort: 'Translated',
      moodShort: 'Mood',
      periodShort: 'Period',
      countryShort: 'Country',
      ratingShort: 'Rating',
      readShort: 'Read',
      vol: 'Vol.',
      read: 'read',
      keywords: 'Keywords',
      summary: 'Summary',
      mainIdea: 'Main idea',
      language: 'Language',
      genre: 'Genre',
      authorPrefix: 'author',
      family: 'family',
      authors3plus: 'Author (3+ books)',
      moreCount: (n) => `+ ${n} more`,
      showLess: 'show less',
      footnote: 'each cell = one volume · click for full record · hover for title',
      esc: 'ESC to close',
      cataloged: 'Catalogued 2026',
      removeFilter: 'Remove filter',
      filterByAuthor: 'Filter by this author',
      removeAuthorFilter: 'Remove author filter',
      noMatches: 'No volumes match the current filters',
      originalTitle: 'Original title',
    },
  },
};

function T(lang) {
  return I18N.ui[lang] || I18N.ui.de;
}

// All data values are stored in German — no translation needed regardless of lang.
function tr(_kind, value, _lang) {
  return value;
}

function trGenres(arr, _lang) {
  return arr;
}

window.I18N = I18N;
window.T = T;
window.tr = tr;
window.trGenres = trGenres;
