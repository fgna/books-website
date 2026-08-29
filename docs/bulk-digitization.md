# Bulk digitization of a large book collection

Personal Library is designed for two complementary workflows:

- **Initial bulk digitization:** create a `books.json` from many shelf or book photos with an AI assistant such as Claude or ChatGPT.
- **Ongoing maintenance:** import that catalog into Personal Library and use the Android app to add newly acquired books, correct metadata and maintain the collection day to day.

For a large existing library, photographing and adding hundreds or thousands of books individually in the app is unnecessarily slow. Bulk JSON creation is therefore an intentional Personal Library workflow, not a legacy migration path.

## 1. Prepare a private working directory or repository

Keep your real catalog private. Create a working directory or private repository that contains your `books.json` and the photos you use while digitizing the collection.

Do not commit personal catalog data or book photos to the public Personal Library repository.

## 2. Give the AI assistant the catalog format

Use the schema and examples from Personal Library as the target format. If you use an agent that can work with repository files, you can also give it the repository's development instructions as context.

Tell the assistant which language you want for generated metadata such as genres, language names and summaries.

## 3. Photograph books in batches

For efficient initial capture:

- Photograph several books or an entire shelf at once when the spines are readable.
- Use additional cover or title-page photos for books that are difficult to identify.
- Work in manageable batches so you can review the extracted titles before moving on.

## 4. Ask Claude or ChatGPT to extract the books

Attach the photos and ask the assistant to identify the books and create entries matching the Personal Library JSON format.

A useful instruction is:

> Identify the books in these photos and add them to `books.json` using the Personal Library schema. Preserve existing entries and flag uncertain metadata instead of guessing.

For subsequent batches, ask the assistant to extend the existing file rather than replacing it.

## 5. Review each batch

Before accepting a batch, check at least:

- title and author
- edition or language where relevant
- duplicate entries
- fields the model marked as uncertain

Correct mistakes in the conversation or edit the JSON directly. For a large collection, accuracy is more important than maximizing the number of books per photo.

## 6. Keep the JSON safe

After each reviewed batch, save or commit the updated `books.json`. If you use Git, a private repository gives you a useful history of the catalog while it is being assembled.

The catalog itself is user data and does not need to live in a Git repository. A normal private backup is equally valid.

## 7. Import the catalog into Personal Library

Once the initial catalog is ready, import the JSON into Personal Library. The web and Android clients are intended to work with the same catalog format.

Keep an exported copy as part of your normal backup strategy.

## 8. Maintain the collection with the Android app

After the initial mass digitization, the Android app becomes the convenient everyday workflow. Use its photo-based add-book function for newly acquired books and its editing and duplicate-management features for ongoing maintenance.

You can still repeat the bulk workflow later if you acquire or discover a large batch of books at once.
