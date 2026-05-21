# Library Digitization
### A Step-by-Step Guide by Freya Gnam & Claude

*Photograph your books · Let Claude extract the metadata · Browse your library in a beautiful web app*

---

## Part 1 — Set Up Your Repository

**1. Create a GitHub account**

If you do not already have one, go to [github.com](https://github.com) and sign up for a free account.

**2. Create a new repository**

- Click the **+** icon in the top-right corner → **New repository**
- Give it a name, e.g. `my-books`
- Set visibility to **Private** (or Public if you want to share it)
- Click **Create repository**

---

## Part 2 — Connect Claude Code

**3. Open Claude Code on the web**

Go to [claude.ai/code](https://claude.ai/code) and sign in. Claude Code is Anthropic's AI coding assistant — it can read and write files in your repository directly. You'll need a Claude Pro subscription.

**4. Connect your GitHub repository**

- Click **New session** → **Connect a repository**
- Authorise GitHub when prompted, then select your `my-books` repository
- Claude Code will clone it into a secure cloud workspace

> The workspace is ephemeral. Changes only persist once you commit and push — Claude will do this for you when you ask.

---

## Part 3 — Add the CLAUDE.md Instruction File

**5. Create CLAUDE.md in your repository**

This file tells Claude how your book database is structured and how to add new entries. Copy `CLAUDE.md` from [github.com/fgna/books-website](https://github.com/fgna/books-website) into your repository.

At the top of the file, set your preferred language for data values:

```
MY_LANGUAGE = English
```

Change `English` to your language (e.g. `German`, `French`, `Spanish`). All genre values, language names, and summaries will be written in that language.

**Key fields Claude will fill in for each book:**

| Field | Description |
|---|---|
| `title` | As it appears on your copy |
| `author` | Author name |
| `genre` | Array of genre tags |
| `language` | Language of your copy |
| `summary` | 2–4 sentence description |
| `read` | `null` = unknown · `false` = unread · `true` = read |
| `year_published` | Year of first publication |
| `rating` | 1–5 personal rating |
| `mood` | Atmosphere tags, e.g. `["Dark", "Thoughtful"]` |
| `series` | Series name, or `null` if standalone |

---

## Part 4 — Digitize Your Books

**6. Photograph your books**

- A photo of the spine is usually enough
- You can photograph a whole shelf — Claude will identify each spine

**7. Share photos in Claude Code**

Drag and drop photos into the Claude Code chat, or click the paperclip to attach them. Then send:

```
Add these books to books.json
```

Claude will read each spine, extract the metadata, and append the entries.

**8. Review and correct**

Claude will show you what it added. If anything looks wrong, say so in chat and it will fix the entry. You can also ask it to fill in missing fields, update read status, or add a rating.

**9. Commit and push**

When satisfied with the batch, ask Claude:

```
Commit and push the changes
```

Claude creates a git commit and pushes it to GitHub so the data is safely stored.

---

## Part 5 — View Your Library

Once your `books.json` is populated, browse it in the visual web app.

**10. Clone the website**

Fork or clone [github.com/fgna/books-website](https://github.com/fgna/books-website).

**11. Copy your books.json into the folder**

```bash
cp ../my-books/books.json ./books.json
```

**12. Set your language and library name**

Open `config.js` and edit the two lines:

```js
window.LIB_CONFIG = {
  lang: 'en',           // 'en' (English) or 'de' (German)
  name: 'My Library',   // shown in the header
};
```

**13. Open in your browser**

Open `index.html` — no installation or build step needed.

Repeat step 11 each time you add new books.

---

## Part 6 — Tips & Ongoing Use

**Adding more books later**

Open a new Claude Code session on the same repository, take more photos, and repeat steps 6–9. Claude remembers the schema from `CLAUDE.md` and appends to the existing list.

**Tracking what you have read**

Tell Claude in chat: *"I have read Kafka on the Shore"* — it will set `read: true` for that entry immediately.

**Exporting your list**

Ask Claude Code to generate a CSV, HTML table, or formatted reading list from `books.json` at any time.

---

## Advanced — Run with Docker

If you're comfortable with Docker, this approach reads `books.json` directly from your `my-books` folder — no copying needed each time you add books.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (free)

**Setup**

Clone `books-website` as a sibling of your books repository:

```
my-books/           ← your books repository (books.json lives here)
books-website/      ← the web app
```

Open `docker-compose.yml` and configure:

```yaml
environment:
  LIB_LANG: en          # 'en' or 'de'
  # LIB_NAME: My Library  # optional; leave blank for the default name
```

The library name defaults to **"the Library"** (en) or **"die Bibliothek"** (de).

**Run**

```bash
cd books-website
docker compose up --build
```

Open **http://localhost:8080**. Updates to `books.json` appear immediately — no rebuild needed.

---

*Made with Claude Code · [github.com/fgna/books-website](https://github.com/fgna/books-website)*
