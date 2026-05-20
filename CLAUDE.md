# My Books Database

A personal book catalog stored as a JSON file, populated from photos of physical books.

## Repository Structure

- `books.json` — the main database; each entry follows the schema below
- `CLAUDE.md` — this file

## Book Entry Schema

```json
{
  "title": "string",
  "original_title": "string" | null,
  "author": "string",
  "genre": ["string"],
  "language": "string",
  "keywords": ["string"],
  "summary": "string",
  "summary_en": "string" | null,
  "read": true | false | null,
  "year_published": 1984 | null,
  "main_idea": "string" | null,
  "main_idea_en": "string" | null,
  "openlibrary_work_id": "OL123456W" | null,
  "wikipedia_url": "string" | null,
  "original_language": "string" | null,
  "country_of_origin": "string" | null,
  "period": "string" | null,
  "rating": 1 | 2 | 3 | 4 | 5 | null,
  "mood": ["string"] | null,
  "series": "string" | null
}
```

## How to Add Books

1. Take a clear photo of the spine
2. Share the photo in this Claude Code session.
3. Claude will extract the metadata and append a new entry to `books.json`.
4. If a book cannot be identified from the photo, Claude will ask for clarification.

## Language Convention
 
Field **keys** are in English (e.g. `"genre"`, `"language"`). Field **values** for controlled-vocabulary fields are in German.
The UI supports DE/EN display; data values display as-is in both modes

When adding a new book, use the genre/language values already present in `books.json`. Refer to the genre families in `library-digital-twin/project/data.jsx` (FAMILY_DEFS) for the canonical German genre vocabulary.

## Conventions

- `title`: the title as it appears on the copy in the library (may be a translation).
- `original_title`: the title in the work's original language. Set to `null` if the same as `title` or unknown.
- `genre` and `keywords` are arrays (a book can belong to multiple categories).
- `genre` values are German canonical names (e.g. `"Roman"`, `"Sachbuch"`, `"Philosophie"`).
- `language` and `original_language` use the German language name (e.g. `"Deutsch"`, `"Englisch"`, `"Spanisch"`).
- `summary` is a concise 2–4 sentence description of the book's content in German. When adding a new book, write the summary in German directly.
- `summary_en`: English version of the summary, populated automatically by `translate_summaries.py` (which translates English→German, saving the original to this field). Set to `null` if unknown.
- `main_idea`: a single sentence distilling the book's central thesis or argument, in German. Set to `null` if not applicable (e.g. reference books, dictionaries) or unknown.
- `main_idea_en`: English version of `main_idea`, saved by `translate_summaries.py`. Set to `null` if unknown.
- Entries are kept in the order they were added.
- `read`: three-state field — `null` = status unknown (default); `false` = user has not read the book; `true` = user has read the book. Claude must update this field immediately whenever the user provides this information.
- `year_published`: integer representing the year the original work was first published in any language (use the year of composition for ancient works). Set to `null` if unknown.
- `original_language`: the language the work was originally written in (e.g. `"Englisch"`, `"Deutsch"`). Distinct from `language` (the reading copy's language). Set to `null` if unknown.
- `country_of_origin`: the country most associated with the work's origin or author nationality (e.g. `"Vereinigtes Königreich"`, `"Deutschland"`). Set to `null` if unknown or not applicable.
- `period`: a string describing the historical or cultural period (e.g. `"19. Jahrhundert"`, `"Kalter Krieg"`, `"Antikes Rom"`, `"Gegenwart"`). Set to `null` if unknown or not applicable.
- `rating`: integer 1–5 representing personal rating. Set to `null` if unrated.
- `mood`: array of mood/atmosphere tags describing the reading experience (e.g. `["Düster", "Nachdenklich"]`, `["Humorvoll", "Leicht"]`). Set to `null` if unknown.
- `series`: name of the series the book belongs to, if any (e.g. `"Känguru-Reihe"`). Set to `null` if standalone.

## Filling in missing information

`missing-info.md` tracks entries where `year_published` or `author` is unknown. Whenever new information becomes available — from user input, a photo, or context in the conversation — Claude must immediately update the relevant fields in `books.json` and remove the corresponding rows from `missing-info.md`. The same applies to any other `null` field (`main_idea`, `read`) if the user provides the information.
