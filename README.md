# Library Digitization

A Step-by-Step Guide by Freya Gnam & Claude

*Photograph your books · Let Claude extract the metadata · Browse your library in a beautiful web app*

---

**PART 1 — SET UP YOUR REPOSITORY**

1\. Create a GitHub account

If you do not already have one, go to github.com and sign up for a free account.

2\. Create a new repository

* Click the + icon in the top-right corner → New repository.
* Give it a name, e.g. `my-books`.
* Set visibility to Private (or Public if you want to share it).
* Click Create repository.

---

**PART 2 — CONNECT CLAUDE CODE**

3\. Open Claude Code on the web

Go to claude.ai/code and sign in. Claude Code is Anthropic’s AI coding assistant — it can read and write files in your repository directly. You’ll need a Claude Pro subscription.

4\. Connect your GitHub repository

* Click New session → Connect a repository.
* Authorise GitHub when prompted, then select your `my-books` repository.
* Claude Code will clone it into a secure cloud workspace.

*The workspace is ephemeral. Changes only persist once you commit and push — Claude will do this for you when you ask.*

---

**PART 3 — ADD THE CLAUDE.MD INSTRUCTION FILE**

5\. Create CLAUDE.md in your repository

This file tells Claude how your book database is structured and how to add new entries. Copy `CLAUDE.md` from this repository (github.com/fgna/books-website) into your `my-books` repository.

At the top of the file, set your preferred language for data values:

```
MY_LANGUAGE = English
```

Change `English` to your language (e.g. `German`, `French`, `Spanish`). All genre values, language names, and summaries will be written in that language.

---

**PART 4 — DIGITIZE YOUR BOOKS**

6\. Photograph your books

* A photo of the spine is usually enough.
* You can photograph a whole shelf — Claude will identify each spine.

7\. Share photos in Claude Code

Drag and drop photos into the Claude Code chat, or click the paperclip to attach them. Then send:

> Add these books to books.json

Claude will read each spine, extract the metadata, and append the entries.

8\. Review and correct

Claude will show you what it added. If anything looks wrong, say so in chat and it will fix the entry. You can also ask it to fill in missing fields, update read status, or add a rating.

9\. Commit and push

When satisfied with the batch, ask Claude:

> Commit and push the changes

Claude creates a git commit and pushes it to GitHub so the data is safely stored.

---

**PART 5 — VIEW YOUR LIBRARY**

Once your `books.json` is populated, browse it in the visual web app.

**Option A — Docker (recommended)**

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (free). No manual file copying — the app always reads your latest `books.json` directly.

1\. Clone this repository as a sibling of your books repository:

```bash
git clone https://github.com/fgna/books-website.git
```

Your folders should sit side by side:

```
my-books/           ← your books repository
  books.json
books-website/      ← the web app
  docker-compose.yml
  ...
```

2\. Open `docker-compose.yml` and set your language:

```yaml
environment:
  LIB_LANG: en    # 'en' (English) or 'de' (German)
  # LIB_NAME: My Library   # optional — leave blank to use the default name
```

The library name defaults to **“the Library”** (en) or **“die Bibliothek”** (de). Set `LIB_NAME` to use a custom name.

If your `books.json` is not in `../my-books/books.json`, set `BOOKS_JSON`:

```bash
BOOKS_JSON=/path/to/books.json docker compose up --build
```

3\. Build and start:

```bash
cd books-website
docker compose up --build
```

4\. Open **http://localhost:8080** in your browser.

Whenever you add books to your repository, the app picks up the updated `books.json` without a rebuild. Just refresh the page.

**Option B — Open directly in a browser (no Docker)**

1\. Fork or clone `fgna/books-website`.

2\. Copy your `books.json` into the `books-website` folder:

```bash
cp ../my-books/books.json ./books.json
```

3\. Edit `config.js` to set your language and library name:

```js
window.LIB_CONFIG = {
  lang: 'en',           // 'en' or 'de'
  name: 'My Library',
};
```

4\. Open `index.html` in a browser — no build step needed.

Repeat step 2 each time you add books.

---

**PART 6 — TIPS & ONGOING USE**

**Adding more books later**

Open a new Claude Code session on the same repository, take more photos, and repeat steps 6–9. Claude remembers the schema from CLAUDE.md and appends to the existing list.

**Tracking what you have read**

Tell Claude in chat: “I have read Kafka on the Shore” — it will set `read: true` for that entry immediately.

**Exporting your list**

Ask Claude Code to generate a CSV, HTML table, or formatted reading list from `books.json` at any time.

---

Made with Claude Code · github.com/fgna/books-website
