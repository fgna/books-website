# Personal Library

Personal Library is a personal book catalog with a web interface and an Android app. You can use the website, the Android app, or both. Both clients are built around the same portable JSON catalog, so the collection stays under your control and can be imported, exported and backed up without depending on a hosted library service.

## Features

- Browse and search a personal book collection on web or Android.
- Add newly acquired books from photos in the Android app.
- Import and export the complete catalog as portable JSON.
- Detect, review and merge duplicate entries.
- Keep local Android backups of the catalog.
- Bootstrap large existing collections efficiently from shelf photos with a multimodal AI assistant.
- Use Android LLM Service as the inference boundary for photo-based metadata extraction.

## How the pieces fit together

`books.json` is the portable catalog at the center of Personal Library. The website and Android app are independent clients for the same format: use either one or move the catalog between both. Android-only AI features call Android LLM Service rather than embedding a specific model provider into Personal Library.

## Start with a large existing collection

If you already own hundreds or thousands of books, entering them one by one in the Android app is not the intended starting point. Photograph shelves or groups of books and use a multimodal AI assistant such as Claude or ChatGPT to identify the books and build `books.json` in batches. Review each batch, then import the resulting catalog into Personal Library.

This bulk workflow is an intentional part of the product. See [Bulk digitization of a large book collection](docs/bulk-digitization.md) for the full process.

## Choose how you use Personal Library

You do not need both clients.

- Use the **website** if you mainly want to browse and manage your library from a desktop or browser.
- Use the **Android app** if you mainly want a mobile library and camera-based book entry.
- Use **both** if you want access from desktop and phone. The shared JSON format makes it possible to move the same catalog between the two clients.

## Android app

The Android app can be used to browse the collection, add newly acquired books from photos, edit metadata, import and export JSON, manage duplicates and maintain local backups.

Photo-based metadata extraction is routed through the separate Android LLM Service. The target architecture allows Personal Library to use the same client boundary whether inference runs directly on the phone, on a trusted local server or through an explicitly configured external API.

The Android application lives in [`android/`](android/). Android-specific build and setup information is documented in [`ANDROID.md`](ANDROID.md).

## Website

The web client provides a visual browser for the same JSON catalog. It is dependency-light and can be run locally, including through Docker.

### Docker

Clone the repository and start the web app:

```bash
git clone https://github.com/fgna/personal-library.git
cd personal-library
docker compose up --build
```

Then open `http://localhost:8080`. With no additional configuration, Docker starts with the privacy-safe `books.example.json` catalog so the interface is immediately usable.

To use your own catalog:

```bash
BOOKS_JSON=/path/to/books.json docker compose up --build
```

Configuration such as interface language and library name is available through the existing web configuration/environment settings.

### Static browser use

The web UI can also be served as static files. Provide a compatible `books.json`, configure `config.js` as needed and serve/open the project through a local web server.

## Shared catalog

The app and website intentionally share the JSON catalog format. JSON import/export is therefore a core capability: it enables initial AI-assisted bulk digitization, portability between clients and user-controlled backups. Neither client depends on the other.

A privacy-safe example catalog is provided as [`books.example.json`](books.example.json). Real `books.json` files are user data and are ignored by Git in this repository.

## Data ownership and privacy

The repository contains application code and safe sample/schema data only. Your real `books.json`, photos, backups, credentials and other personal runtime data should remain outside the public repository.

A private Git repository can be useful while assembling a large catalog, but it is not required. The catalog is ordinary user data and can live wherever you normally keep and back up private files.

## Repository structure

- `android/` — Android application
- `docs/` — user and workflow documentation
- web files in the repository root — browser interface
- `books.example.json` — privacy-safe example catalog
- `books.json` — local/runtime catalog data; ignored by Git
