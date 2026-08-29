# Personal Library agent guidance

Personal Library is a public book-catalog application with two clients: a web interface and an Android app. Users may use either client independently or both with the same portable JSON catalog format.

This repository contains product code, documentation and privacy-safe sample data. Do not add a user's real catalog, book photos, credentials, backups, databases, model files or other private runtime data to the repository.

## Repository structure

- web application files live in the repository root
- `android/` contains the Android app
- `docs/` contains user and workflow documentation
- `books.example.json` is the public example catalog
- `books.json` is runtime/user data and is ignored by Git

## Catalog format

A catalog is a JSON array of book objects. Use `books.example.json` as the minimal public example. Existing application code may support additional metadata fields.

Typical fields include:

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
  "year_published": "integer | null",
  "main_idea": "string | null",
  "main_idea_en": "string | null",
  "openlibrary_work_id": "string | null",
  "wikipedia_url": "string | null",
  "original_language": "string | null",
  "country_of_origin": "string | null",
  "period": "string | null",
  "rating": "1 | 2 | 3 | 4 | 5 | null",
  "mood": ["string"],
  "series": "string | null"
}
```

Field keys stay in English. Preserve existing catalog vocabulary and conventions when editing data.

## Product workflows

For a large existing collection, the documented bulk workflow uses shelf or book photos with a multimodal AI assistant to create or extend a catalog in batches. See `docs/bulk-digitization.md`.

For ongoing maintenance, the Android app can add books from photos, edit metadata, import/export JSON, manage duplicates and maintain local backups.

The Android photo flow delegates inference to Android LLM Service through its Binder interface. Do not add app-local API credentials or silently bypass that boundary.

## Development rules

- Keep the web and Android clients compatible with the same catalog format.
- Keep personal runtime data outside the public repository.
- Never commit credentials, `.env` files, keystores, APKs, databases, backups, book photos or model binaries.
- Avoid dependencies on a particular user's directory layout or a separate `my-books` repository.
- Prefer explicit errors over silent fallback when an inference provider or required capability is unavailable.
- Update documentation when setup, catalog format or user-visible workflows change.
