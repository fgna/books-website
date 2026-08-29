# Personal Library

Personal Library is a personal book catalog with a web interface and an Android app. It is built around a portable JSON catalog so the collection stays under your control and can be imported, exported and backed up without depending on a hosted library service.

The project supports two complementary ways of building and maintaining a collection.

## Start with a large existing collection

If you already own hundreds or thousands of books, entering them one by one in the Android app is not the intended starting point. Photograph shelves or groups of books and use a multimodal AI assistant such as Claude or ChatGPT to identify the books and build `books.json` in batches. Review each batch, then import the resulting catalog into Personal Library.

This bulk workflow is an intentional part of the product. See [Bulk digitization of a large book collection](docs/bulk-digitization.md) for the full process.

## Maintain the library with the Android app

Once the initial catalog exists, the Android app is the convenient day-to-day interface. It can be used to browse the collection, add newly acquired books from photos, edit metadata, import and export JSON, manage duplicates and maintain local backups.

Photo-based metadata extraction is routed through the separate Android LLM Service. The target architecture allows Personal Library to use the same client boundary whether inference runs directly on the phone, on a trusted local server or through an explicitly configured external API.

## Web interface

The web client provides a visual browser for the same JSON catalog. It is dependency-light and can be run locally, including through Docker.

### Docker

Clone the repository and start the web app:

```bash
git clone https://github.com/fgna/personal-library.git
cd personal-library
docker compose up --build
```

Then open `http://localhost:8080`.

You can point the container at a catalog stored elsewhere:

```bash
BOOKS_JSON=/path/to/books.json docker compose up --build
```

Configuration such as interface language and library name is available through the existing web configuration/environment settings.

### Static browser use

The web UI can also be served as static files. Provide a compatible `books.json`, configure `config.js` as needed and serve/open the project through a local web server.

## Android app

The Android application lives in [`android/`](android/). Android-specific build and setup information is documented in [`ANDROID.md`](ANDROID.md).

The app and web client intentionally share the JSON catalog format. JSON import/export is therefore a core capability: it enables initial AI-assisted bulk digitization, portability between clients and user-controlled backups.

## Data ownership and privacy

The repository contains application code and safe sample/schema data only. Your real `books.json`, photos, backups, credentials and other personal runtime data should remain outside the public repository.

A private Git repository can be useful while assembling a large catalog, but it is not required. The catalog is ordinary user data and can live wherever you normally keep and back up private files.

## Repository structure

- `android/` — Android application
- `docs/` — user and workflow documentation
- web files in the repository root — browser interface
- `books.json` — development/sample catalog; do not replace it with a personal catalog in the public repository

## Development status

Personal Library is being prepared as a clean public project. Current work includes repository hygiene, final Android device validation and completion of Android LLM Service integration.

See issue #17 for the public-release cleanup checklist.
