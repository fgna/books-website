# My Books Database

A personal book catalog stored as a JSON file, populated from photos of physical books.

## Configuration

There are two separate language settings:

**1. Content language** — the language used for data values (genre names, language names, summaries):

```
MY_LANGUAGE = German
```

Change `German` to any language (e.g. `English`, `French`, `Spanish`). Field **keys** always stay in English.

**2. UI language** — the language of the web app interface (labels, buttons, filter names). Set in `docker-compose.yml`:

```yaml
environment:
  LIB_LANG: de    # 'en' (English) or 'de' (German)
```

Only `en` and `de` are supported for the UI. MY_LANGUAGE can be any language regardless of the UI setting.

---

## Repository Structure

- `books.json` — the main database; each entry follows the schema below. Created automatically on first use.
- `CLAUDE.md` — this file

If this is a `books-website` checkout, the design files (`index.html`, `app.jsx`, etc.) also live here. `books.json` is the data layer that feeds the website — see *Providing books.json* below.

## How to Add Books

1. Take a clear photo of the book cover or spine (a whole shelf works too).
2. Share the photo in this Claude Code session.
3. Claude will extract the metadata and append a new entry to `books.json`. If the file does not exist yet, Claude will create it as an empty array `[]` first.
4. If a book cannot be identified from the photo, Claude will ask for clarification.

When committing, ask Claude: *"Commit and push the changes"*.

## Book Entry Schema

```json
{
  "title": "string",
  "original_title": "string | null",
  "author": "string",
  "genre": ["string"],
  "language": "string",
  "keywords": ["string"],
  "summary": "string",
  "summary_en": "string | null",
  "read": "true | false | null",
  "year_published": "1984 | null",
  "main_idea": "string | null",
  "main_idea_en": "string | null",
  "openlibrary_work_id": "OL123456W | null",
  "wikipedia_url": "string | null",
  "original_language": "string | null",
  "country_of_origin": "string | null",
  "period": "string | null",
  "rating": "1 | 2 | 3 | 4 | 5 | null",
  "mood": ["string | null"],
  "series": "string | null"
}
```

## Language Convention

Field **keys** are always in English. Field **values** for controlled-vocabulary fields (`genre`, `language`, `original_language`, `summary`, `main_idea`) are written in the language set in MY_LANGUAGE above.

When adding a new book, use genre and language values already present in `books.json` for consistency. If this is a `books-website` checkout, refer to `data.jsx` (FAMILY_DEFS) for the canonical genre vocabulary.

## Conventions

- `title`: the title as it appears on the copy in the library (may be a translation).
- `original_title`: the title in the work's original language. Set to `null` if the same as `title` or unknown.
- `genre` and `keywords` are arrays (a book can belong to multiple categories).
- `language` and `original_language` use the name of the language in MY_LANGUAGE (e.g. if MY_LANGUAGE is English: `"German"`, `"French"`; if German: `"Deutsch"`, `"Französisch"`).
- `summary` is a concise 2–4 sentence description of the book's content, written in MY_LANGUAGE.
- `summary_en`: English translation of `summary`. Set to `null` if MY_LANGUAGE is already English, or if unknown.
- `main_idea`: a single sentence distilling the book's central thesis or argument, in MY_LANGUAGE. Set to `null` if not applicable (e.g. reference books, dictionaries) or unknown.
- `main_idea_en`: English translation of `main_idea`. Set to `null` if MY_LANGUAGE is already English, or if unknown.
- Entries are kept in the order they were added.
- `read`: three-state field — `null` = status unknown (default); `false` = user has not read the book; `true` = user has read the book. Claude must update this field immediately whenever the user provides this information.
- `year_published`: integer representing the year the original work was first published in any language (use the year of composition for ancient works). Set to `null` if unknown.
- `openlibrary_work_id`: the Open Library Work ID (e.g. `"OL123456W"`). Set to `null` if not found.
- `original_language`: the language the work was originally written in. Distinct from `language` (the reading copy's language). Set to `null` if unknown.
- `country_of_origin`: the country most associated with the work's origin or author nationality. Set to `null` if unknown or not applicable.
- `period`: a string describing the historical or cultural period (e.g. `"19th century"`, `"Cold War"`, `"Ancient Rome"`). Set to `null` if unknown or not applicable.
- `rating`: integer 1–5 representing personal rating. Set to `null` if unrated.
- `mood`: array of mood/atmosphere tags describing the reading experience (e.g. `["Dark", "Thoughtful"]`). Set to `null` if unknown.
- `series`: name of the series the book belongs to. Set to `null` if standalone.

## Filling in Missing Information

`missing-info.md` tracks entries where `year_published` or `author` is unknown. Whenever new information becomes available — from user input, a photo, or context in the conversation — Claude must immediately update the relevant fields in `books.json` and remove the corresponding rows from `missing-info.md`. The same applies to any other `null` field (`main_idea`, `read`) if the user provides the information.

## Providing books.json (books-website only)

If you are working in a `books-website` checkout, `books.json` is not the source of truth here — it lives in a separate `my-books`-style repository. To update it:

```bash
cp ../my-books/books.json ./books.json
```

When running via Docker, `books.json` is mounted directly from that repository and never needs to be copied manually. Do not commit an empty `books.json`.
