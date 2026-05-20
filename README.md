#Library Digitization

A Step-by-Step Guide by Freya Gnam & Claude

*Photograph your books · Let Claude extract the metadata · Browse your library in a beautiful web app*

**PART 1 — SET UP YOUR REPOSITORY**

1\.  Create a GitHub account

If you do not already have one, go to github.com and sign up for a free account.

2\.  Create a new repository

* Click the \+ icon in the top-right corner → New repository. 
* Give it a name, e.g. my-books. 
* Set visibility to Private (or Public if you want to share it). 
* Click Create repository.

**PART 2 — CONNECT CLAUDE CODE**

3\.  Open Claude Code on the web

Go to claude.ai/code and sign in. Claude Code is Anthropic's AI coding assistant — it can read and write files in your repository directly. You’ll need a Claude Pro subscription.

4\.  Connect your GitHub repository

* Click New session → Connect a repository. 
* Authorise GitHub when prompted, then select your my-books repository. 
* Claude Code will clone it into a secure cloud workspace.

*✦  The workspace is ephemeral. Changes only persist once you commit and push — Claude will do this for you when you ask.*

**PART 3 — ADD THE CLAUDE.MD INSTRUCTION FILE**

5\.  Create CLAUDE.md in your repository

This file tells Claude how your book database is structured and how to add new entries. In your Claude Code session type:

Create a file called CLAUDE.md with the following content:

Then paste the content below. Customise the language convention to match your preferred language (the example uses German for genre/language values). *The full CLAUDE.md is available at github.com/fgna/books-website— copy or adapt it.*

**Contents of CLAUDE.md**

**\# My Books Database**

A personal book catalog stored as a JSON file, populated from photos of physical books.

**\#\# Book Entry Schema**

Each book is a JSON object. Key fields: title, author, genre (array), language, summary, read (true/false/null), year\_published, rating (1–5), mood (array), series.

**\#\# How to Add Books**

1\. Take a clear photo of the book cover.

2\. Share the photo in this Claude Code session.

3\. Claude extracts the metadata and appends a new entry to books.json.

4\. If a book cannot be identified, Claude will ask for clarification.

**\#\# Language Convention**

Field keys are in English. Genre and language values use your preferred language.

My preferred language is: English.

**\#\# Key Field Conventions**

title — as it appears on your copy

original\_title — in the work's original language; null if same as title

summary — 2–4 sentence description

main\_idea — one-sentence central thesis

read — null \= unknown, false \= unread, true \= read

year\_published — year of first publication

rating — 1–5 personal rating

mood — atmosphere tags, e.g. \["Dark", "Thoughtful"\]

series — series name; null if standalone

**\#\# Filling in missing information**

\`missing-info.md\` tracks entries where \`year\_published\` or \`author\` is unknown. Whenever new information becomes available — from user input, a photo, or context in the conversation — Claude must immediately update the relevant fields in \`books.json\` and remove the corresponding rows from \`missing-info.md\`. 

**PART 4 — DIGITIZE YOUR BOOKS**

6\.  Photograph your books

* A photo of the spine is usually enough. 
* **You can photograph a whole shelf —** Claude will identify each spine.

7\.  Share photos in Claude Code

Drag and drop photos into the Claude Code chat, or click the paperclip to attach them. Then send:

Add these books to books.json

Claude will read each cover, extract the metadata, and append the entries.

8\.  Review and correct

Claude will show you what it added. If anything looks wrong, say so in chat and it will fix the entry. You can also ask it to fill in missing fields, update read status, or add a rating.

9\.  Commit and push

When satisfied with the batch, ask Claude to save the changes:

Commit and push the changes

Claude creates a git commit and pushes it to GitHub so the data is safely stored.

**PART 5 — ADD THE WEB APP**

Once your books.json is populated you can browse your library in a visual web app. There are two ways to get the app:

**Option A — Clone the ready-made website repository**

The repository github.com/fgna/books-website contains a complete, pre-built library browser. Clone it and point it at your books.json:

* Fork or clone fgna/books-website on GitHub. 
* Copy your books.json into the project (or symlink it). 
* **Open library-digital-twin/project/index.html in a browser —** no build step needed. 
* Edit config.js to set your library name.

window.LIB\_CONFIG \= {

  lang: 'en',          // 'en' or 'de'

  name: 'My Library',  // shown in the header

};

**Option B — Build your own with Claude Code**

Open a Claude Code session on your repository and describe the interface you want. Claude will generate the HTML/CSS/JS files from scratch. This is how the original app was created — entirely through conversation, no manual coding.

10\.  Customise the app

* **Change the name —** edit config.js → name field. 
* **Change the language —** set lang to "en" or "de". 
* **The app reads books.json directly —** no database or server required. 
* **Deploy by uploading the project folder to any static host (GitHub Pages, Netlify, Vercel —** all free).

**PART 6 — TIPS & ONGOING USE**

**Adding more books later**

Open a new Claude Code session on the same repository, take more photos, and repeat steps 6–9. Claude remembers the schema from CLAUDE.md and appends to the existing list.

**Tracking what you have read**

Tell Claude in chat: "I have read Kafka on the Shore" — it will set read: true for that entry immediately.

**Exporting your list**

Ask Claude Code to generate a CSV, HTML table, or formatted reading list from books.json at any time.

Made with Claude Code  ·   github.com/fgna/books-website
