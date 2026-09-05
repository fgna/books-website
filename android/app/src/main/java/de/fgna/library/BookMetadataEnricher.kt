package de.fgna.library

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.text.Normalizer
import java.util.Locale

internal object BookMetadataEnricher {
    private const val USER_AGENT = "PersonalLibrary/0.1"

    fun enrich(
        recognized: JSONObject,
        catalogJson: String,
        userConfirmedIdentity: Boolean = false,
    ): JSONObject {
        val scannedTitle = recognized.getString("title").trim()
        val candidates = visibleAuthorCandidates(recognized)
        val preferredAuthor = recognized.optString("author", "").trim()
            .takeIf { author -> candidates.any { sameName(it, author) } }
            ?: candidates.firstOrNull().orEmpty()

        val openLibrary = runCatching {
            lookupOpenLibrary(scannedTitle, candidates)
        }.getOrElse { error ->
            JSONObject().put("source_error", error.message ?: "Open Library lookup failed")
        }

        val googleBooks = if (preferredAuthor.isNotBlank()) {
            runCatching {
                lookupGoogleBooks(scannedTitle, preferredAuthor)
            }.getOrElse { error ->
                JSONObject().put("source_error", error.message ?: "Google Books lookup failed")
            }
        } else JSONObject()

        val openLibraryMatch = openLibrary.optBoolean("trusted_match", false)
        val googleMatch = googleBooks.optBoolean("trusted_match", false)
        val sourceMatch = openLibraryMatch || googleMatch
        val identityVerified = sourceMatch || userConfirmedIdentity

        val canonicalTitle = openLibrary.optString("canonical_title").trim()
            .ifBlank { googleBooks.optString("canonical_title").trim() }
            .ifBlank { standardizeTitle(scannedTitle) }
        val selectedAuthor = openLibrary.optString("selected_visible_author").trim()
            .ifBlank { googleBooks.optString("selected_visible_author").trim() }
            .ifBlank { preferredAuthor }

        val facts = JSONObject()
        mergeFacts(facts, openLibrary)
        mergeFacts(facts, googleBooks)

        val genres = collectExistingGenres(catalogJson)
        val metadata = if (identityVerified) metadataFromInternetFacts(facts, genres) else JSONObject()
        val mainIdea = if (sourceMatch) {
            synthesizeMainIdea(
                title = canonicalTitle,
                author = selectedAuthor,
                description = metadata.optString("summary", "").trim(),
                keywords = metadata.optJSONArray("keywords"),
            )
        } else ""

        return normalizeResult(
            recognized = recognized,
            canonicalTitle = canonicalTitle,
            selectedAuthor = selectedAuthor,
            facts = facts,
            metadata = metadata,
            mainIdea = mainIdea,
            allowedGenres = genres,
        ).apply {
            put("_identity_verified", identityVerified)
            put("_bibliographic_match", sourceMatch)
            put("_author_candidates", JSONArray(candidates))
            put("_metadata_sources", JSONArray().apply {
                if (openLibraryMatch) put("Open Library")
                if (googleMatch) put("Google Books")
            })
            put("_metadata_diagnostics", JSONObject().apply {
                put("open_library", when {
                    openLibraryMatch -> "match ${openLibrary.optString("openlibrary_work_id")}".trim()
                    openLibrary.has("source_error") -> openLibrary.optString("source_error")
                    else -> "no match"
                })
                put("google_books", when {
                    googleMatch -> "match"
                    googleBooks.has("source_error") -> googleBooks.optString("source_error")
                    else -> "no match"
                })
                put("main_idea", when {
                    metadata.optString("summary", "").isBlank() -> "skipped: no sourced description"
                    mainIdea.isNotBlank() -> "generated from sourced description"
                    else -> "not generated"
                })
            })
        }
    }

    private fun lookupOpenLibrary(title: String, visibleCandidates: List<String>): JSONObject {
        for (candidate in visibleCandidates) {
            val docs = combineArrays(
                searchOpenLibraryByFields(title, candidate),
                searchOpenLibraryGeneral(title, candidate),
                searchOpenLibraryByFields(title, ""),
            )
            val match = selectOpenLibraryMatch(docs, title, candidate)
            if (match != null) return factsForOpenLibraryMatch(match, title, candidate)
        }
        return JSONObject()
    }

    private fun combineArrays(vararg arrays: JSONArray): JSONArray {
        val result = JSONArray()
        val seen = linkedSetOf<String>()
        for (array in arrays) {
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val key = item.optString("key").ifBlank {
                    "${item.optString("title")}|${item.optJSONArray("author_name")?.toString().orEmpty()}"
                }
                if (seen.add(key)) result.put(item)
            }
        }
        return result
    }

    private fun searchOpenLibraryByFields(title: String, author: String): JSONArray {
        val query = buildString {
            append("https://openlibrary.org/search.json?title=")
            append(enc(title))
            if (author.isNotBlank()) {
                append("&author=")
                append(enc(author))
            }
            append("&limit=30&fields=key,title,author_name,first_publish_year,language,subject,edition_count,isbn")
        }
        return getJson(query).optJSONArray("docs") ?: JSONArray()
    }

    private fun searchOpenLibraryGeneral(title: String, author: String): JSONArray {
        val q = listOf(title, author).filter { it.isNotBlank() }.joinToString(" ")
        val query = "https://openlibrary.org/search.json?q=${enc(q)}&limit=30&fields=key,title,author_name,first_publish_year,language,subject,edition_count,isbn"
        return getJson(query).optJSONArray("docs") ?: JSONArray()
    }

    private fun selectOpenLibraryMatch(docs: JSONArray, title: String, author: String): JSONObject? {
        var best: JSONObject? = null
        var bestScore = -1
        for (i in 0 until docs.length()) {
            val doc = docs.optJSONObject(i) ?: continue
            val titleScore = titleMatchScore(title, doc.optString("title"))
            if (titleScore < 0) continue
            if (!authorsMatch(author, doc.optJSONArray("author_name"))) continue

            val subjectCount = doc.optJSONArray("subject")?.length() ?: 0
            val languageCount = doc.optJSONArray("language")?.length() ?: 0
            val editionCount = doc.optInt("edition_count", 0).coerceAtMost(20)
            val isbnCount = doc.optJSONArray("isbn")?.length() ?: 0
            val completeness =
                subjectCount.coerceAtMost(10) * 5 +
                languageCount.coerceAtMost(3) * 2 +
                editionCount * 2 +
                if (isbnCount > 0) 3 else 0
            val score = titleScore * 100 + completeness
            if (score > bestScore) {
                best = doc
                bestScore = score
            }
        }
        return best
    }

    private fun factsForOpenLibraryMatch(match: JSONObject, scannedTitle: String, visibleAuthor: String): JSONObject {
        val facts = JSONObject()
            .put("trusted_match", true)
            .put("selected_visible_author", visibleAuthor)
            .put("source", "openlibrary")

        val canonicalTitle = match.optString("title").trim()
        if (canonicalTitle.isNotBlank()) facts.put("canonical_title", canonicalTitle)

        val key = match.optString("key")
        val workId = if (key.startsWith("/works/")) key.removePrefix("/works/") else ""
        if (workId.isNotBlank()) facts.put("openlibrary_work_id", workId)
        if (match.has("first_publish_year")) {
            val year = match.optInt("first_publish_year")
            if (year > 0) facts.put("year_published", year)
        }
        facts.put("openlibrary_languages", match.optJSONArray("language") ?: JSONArray())
        facts.put("openlibrary_subjects", match.optJSONArray("subject") ?: JSONArray())
        match.optJSONArray("isbn")?.optString(0)?.trim()?.takeIf { it.isNotBlank() }?.let {
            facts.put("isbn", it)
        }

        if (workId.isNotBlank()) {
            val work = runCatching { getJson("https://openlibrary.org/works/$workId.json") }.getOrNull()
            if (work != null) {
                val originalTitle = work.optString("original_title").trim()
                if (originalTitle.isNotBlank() && !strongTitleMatch(canonicalTitle.ifBlank { scannedTitle }, originalTitle)) {
                    facts.put("original_title", originalTitle)
                }
                val description = descriptionText(work.opt("description"))
                if (description.isNotBlank()) facts.put("description", description.take(4000))
                val subjects = work.optJSONArray("subjects")
                if (subjects != null && subjects.length() > 0) facts.put("work_subjects", subjects)
                val links = work.optJSONArray("links") ?: JSONArray()
                for (i in 0 until links.length()) {
                    val link = links.optJSONObject(i)?.optString("url").orEmpty()
                    if (link.contains("wikipedia.org")) {
                        facts.put("wikipedia_url", link)
                        break
                    }
                }
            }

            enrichFromOpenLibraryEditions(facts, workId)
        }
        return facts
    }

    private fun enrichFromOpenLibraryEditions(facts: JSONObject, workId: String) {
        val payload = runCatching {
            getJson("https://openlibrary.org/works/$workId/editions.json?limit=50")
        }.getOrNull() ?: return
        val entries = payload.optJSONArray("entries") ?: return
        val subjects = linkedSetOf<String>()
        val languages = linkedSetOf<String>()
        var description = ""
        var earliestYear = facts.optInt("year_published", 0).takeIf { it > 0 }

        for (i in 0 until entries.length()) {
            val edition = entries.optJSONObject(i) ?: continue
            val editionSubjects = edition.optJSONArray("subjects")
            if (editionSubjects != null) {
                for (j in 0 until editionSubjects.length()) {
                    editionSubjects.optString(j).trim().takeIf { it.isNotBlank() }?.let(subjects::add)
                }
            }
            val editionLanguages = edition.optJSONArray("languages")
            if (editionLanguages != null) {
                for (j in 0 until editionLanguages.length()) {
                    val languageKey = editionLanguages.optJSONObject(j)?.optString("key").orEmpty()
                    languageKey.substringAfterLast('/').trim().takeIf { it.isNotBlank() }?.let(languages::add)
                }
            }
            if (description.isBlank()) description = descriptionText(edition.opt("description"))
            val year = Regex("(?:18|19|20)\\d{2}")
                .find(edition.optString("publish_date"))
                ?.value
                ?.toIntOrNull()
            if (year != null && (earliestYear == null || year < earliestYear)) earliestYear = year
        }

        if (facts.optJSONArray("work_subjects")?.length() ?: 0 == 0 && subjects.isNotEmpty()) {
            facts.put("edition_subjects", JSONArray(subjects.toList()))
        }
        if (facts.optJSONArray("openlibrary_languages")?.length() ?: 0 == 0 && languages.isNotEmpty()) {
            facts.put("openlibrary_languages", JSONArray(languages.toList()))
        }
        if (facts.optString("description").isBlank() && description.isNotBlank()) {
            facts.put("description", description.take(4000))
        }
        if (earliestYear != null && earliestYear > 0) facts.put("year_published", earliestYear)
    }

    private fun descriptionText(raw: Any?): String = when (raw) {
        is String -> raw
        is JSONObject -> raw.optString("value")
        else -> ""
    }.trim()

    private fun lookupGoogleBooks(title: String, author: String): JSONObject {
        val q = "intitle:${baseTitle(title)} inauthor:$author"
        val url = "https://www.googleapis.com/books/v1/volumes?q=${enc(q)}&maxResults=10&printType=books"
        val items = getJson(url).optJSONArray("items") ?: JSONArray()
        val match = selectGoogleBooksMatch(items, title, author)
        return if (match != null) factsForGoogleBooksMatch(match, author) else JSONObject()
    }

    private fun selectGoogleBooksMatch(items: JSONArray, title: String, author: String): JSONObject? {
        var best: JSONObject? = null
        var bestScore = -1
        for (i in 0 until items.length()) {
            val info = items.optJSONObject(i)?.optJSONObject("volumeInfo") ?: continue
            val titleScore = titleMatchScore(title, info.optString("title"))
            if (titleScore < 0) continue
            if (!authorsMatch(author, info.optJSONArray("authors"))) continue
            val score = titleScore + 10
            if (score > bestScore) {
                best = info
                bestScore = score
            }
        }
        return best
    }

    private fun factsForGoogleBooksMatch(info: JSONObject, visibleAuthor: String): JSONObject = JSONObject().apply {
        put("trusted_match", true)
        put("selected_visible_author", visibleAuthor)
        put("source", "googlebooks")
        val title = info.optString("title").trim()
        if (title.isNotBlank()) put("canonical_title", title)
        val description = info.optString("description").trim()
        if (description.isNotBlank()) put("description", description.take(4000))
        val categories = info.optJSONArray("categories")
        if (categories != null && categories.length() > 0) put("google_categories", categories)
        val language = info.optString("language").trim()
        if (language.isNotBlank()) put("google_language", language)
        val date = info.optString("publishedDate").trim()
        if (date.isNotBlank()) {
            put("google_published_date", date)
            date.take(4).toIntOrNull()?.takeIf { it > 0 }?.let { put("year_published", it) }
        }
        val link = info.optString("canonicalVolumeLink").trim()
        if (link.isNotBlank()) put("google_books_url", link)
    }

    private fun mergeFacts(target: JSONObject, source: JSONObject) {
        if (!source.optBoolean("trusted_match", false)) return
        val keys = source.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            if (key in setOf("trusted_match", "source")) continue
            val value = source.opt(key)
            when {
                !target.has(key) -> target.put(key, value)
                key == "description" && target.optString(key).isBlank() -> target.put(key, value)
                key == "year_published" && target.optInt(key, 0) <= 0 -> target.put(key, value)
            }
        }
    }

    private fun metadataFromInternetFacts(facts: JSONObject, allowedGenres: List<String>): JSONObject {
        val result = JSONObject()
        val sourceTerms = linkedSetOf<String>()
        for (key in listOf("work_subjects", "edition_subjects", "openlibrary_subjects", "google_categories")) {
            val values = facts.optJSONArray(key) ?: continue
            for (i in 0 until values.length()) {
                values.optString(i).trim().takeIf { it.isNotBlank() }?.let(sourceTerms::add)
            }
        }

        val genres = JSONArray()
        val genreCandidates = mapSourceTermsToGenres(sourceTerms, allowedGenres)
        genreCandidates.take(3).forEach(genres::put)
        result.put("genre", genres)
        result.put("keywords", JSONArray(sourceTerms.take(6)))
        result.put("summary", facts.optString("description", "").trim())

        val googleLanguage = languageFromCode(facts.optString("google_language"))
        result.put(
            "language",
            googleLanguage.ifBlank { languageFromOpenLibrary(facts.optJSONArray("openlibrary_languages")) },
        )
        return result
    }

    private fun synthesizeMainIdea(
        title: String,
        author: String,
        description: String,
        keywords: JSONArray?,
    ): String {
        if (description.isBlank()) return ""
        val keywordText = buildList {
            if (keywords != null) {
                for (i in 0 until keywords.length()) {
                    keywords.optString(i).trim().takeIf { it.isNotBlank() }?.let(::add)
                }
            }
        }.joinToString(", ")
        val prompt = """
            Formuliere die zentrale Hauptthese des folgenden Buches auf Deutsch in genau einem kurzen Satz.
            Verwende ausschließlich Informationen aus der bereitgestellten, bereits verifizierten Quellenbeschreibung.
            Erfinde keine Fakten, Ereignisse, Personen, Motive oder Schlussfolgerungen, die nicht durch diese Beschreibung gestützt werden.
            Wenn aus der Beschreibung keine belastbare Hauptthese ableitbar ist, antworte exakt mit: LEER
            Keine Einleitung, kein Markdown, keine Anführungszeichen.

            Titel: $title
            Autor: $author
            Quellen-Schlagwörter: $keywordText
            Quellenbeschreibung:
            ${description.take(3500)}
        """.trimIndent()

        return runCatching { LocalBookInference.enrich(prompt) }
            .getOrDefault("")
            .replace("```", "")
            .trim()
            .trim('"', '\'', '“', '”')
            .takeIf { it.isNotBlank() && !it.equals("LEER", ignoreCase = true) }
            ?.take(600)
            .orEmpty()
    }

    private fun mapSourceTermsToGenres(terms: Set<String>, allowedGenres: List<String>): List<String> {
        val normalized = terms.map(::normalize)
        val desired = linkedSetOf<String>()

        fun addIfAllowed(vararg names: String) {
            for (name in names) {
                allowedGenres.firstOrNull { normalize(it) == normalize(name) }?.let(desired::add)
            }
        }

        if (normalized.any { "psychology" in it || "psychologie" in it }) addIfAllowed("Psychologie")
        if (normalized.any { "biography" in it || "autobiography" in it || "biografie" in it }) addIfAllowed("Biografie")
        if (normalized.any { "philosophy" in it || "philosophie" in it }) addIfAllowed("Philosophie")
        if (normalized.any { "history" in it || "geschichte" in it }) addIfAllowed("Geschichte")
        if (normalized.any { "science" in it || "wissenschaft" in it }) addIfAllowed("Wissenschaft")
        if (normalized.any { "business" in it || "economics" in it || "wirtschaft" in it }) addIfAllowed("Wirtschaft")
        if (normalized.any { "fiction" in it || "belletristik" in it }) addIfAllowed("Belletristik")

        for (genre in allowedGenres) {
            val needle = normalize(genre)
            if (needle.isNotBlank() && normalized.any { it == needle || it.contains(needle) || needle.contains(it) }) {
                desired += genre
            }
        }
        return desired.toList()
    }

    private fun languageFromCode(value: String): String = when (value.lowercase(Locale.ROOT)) {
        "en", "eng" -> "English"
        "de", "deu", "ger" -> "Deutsch"
        "fr", "fra", "fre" -> "Französisch"
        "es", "spa" -> "Spanisch"
        "it", "ita" -> "Italienisch"
        else -> ""
    }

    private fun languageFromOpenLibrary(values: JSONArray?): String {
        if (values == null) return ""
        for (i in 0 until values.length()) {
            val language = languageFromCode(values.optString(i))
            if (language.isNotBlank()) return language
        }
        return ""
    }

    private fun visibleAuthorCandidates(recognized: JSONObject): List<String> {
        val values = linkedSetOf<String>()
        recognized.optJSONArray("author_candidates")?.let { array ->
            for (i in 0 until array.length()) {
                array.optString(i).trim().takeIf { it.isNotBlank() }?.let(values::add)
            }
        }
        val author = recognized.optString("author", "").trim()
        if (author.isNotBlank() && values.none { sameName(it, author) }) values += author
        return values.toList()
    }

    private fun titleMatchScore(a: String, b: String): Int {
        val left = normalize(a)
        val right = normalize(b)
        if (left.isBlank() || right.isBlank()) return -1
        if (left == right) return 5
        if (compact(left) == compact(right)) return 4

        val leftBase = normalize(baseTitle(a))
        val rightBase = normalize(baseTitle(b))
        if (leftBase.isNotBlank() && leftBase == rightBase) return 3
        if (leftBase.isNotBlank() && compact(leftBase) == compact(rightBase)) return 2

        if (leftBase.isNotBlank() && right.startsWith("$leftBase ")) return 1
        if (leftBase.isNotBlank() && compact(right).startsWith(compact(leftBase))) return 1
        return -1
    }

    private fun strongTitleMatch(a: String, b: String): Boolean = titleMatchScore(a, b) >= 0

    private fun baseTitle(value: String): String = value
        .substringBefore(':')
        .substringBefore(" — ")
        .substringBefore(" - ")
        .trim()

    private fun compact(value: String): String = value.replace(" ", "")

    private fun sameName(a: String, b: String): Boolean {
        val left = normalize(a)
        val right = normalize(b)
        return left.isNotBlank() && (left == right || compact(left) == compact(right))
    }

    private fun authorsMatch(author: String, names: JSONArray?): Boolean {
        if (author.isBlank() || names == null) return false
        for (i in 0 until names.length()) {
            if (sameName(author, names.optString(i))) return true
        }
        return false
    }

    private fun normalizeResult(
        recognized: JSONObject,
        canonicalTitle: String,
        selectedAuthor: String,
        facts: JSONObject,
        metadata: JSONObject,
        mainIdea: String,
        allowedGenres: List<String>,
    ): JSONObject {
        val result = JSONObject()
        result.put("title", canonicalTitle)
        result.put("author", selectedAuthor)
        result.put("confidence", recognized.optDouble("confidence", 0.0).coerceIn(0.0, 1.0))
        putNullable(result, "original_title", facts.opt("original_title"))
        putStringArray(result, "genre", filterGenres(metadata.optJSONArray("genre"), allowedGenres))

        val sourceLanguage = metadata.optString("language", "").trim()
        val visibleLanguage = recognized.optString("language", "").trim()
        result.put("language", sourceLanguage.ifBlank { visibleLanguage })
        putStringArray(result, "keywords", metadata.optJSONArray("keywords"))
        result.put("summary", metadata.optString("summary", "").trim())
        result.put("summary_en", JSONObject.NULL)
        result.put("read", JSONObject.NULL)

        val year = facts.optInt("year_published", 0)
        if (year > 0) result.put("year_published", year) else result.put("year_published", JSONObject.NULL)

        putNullable(result, "main_idea", mainIdea)
        result.put("main_idea_en", JSONObject.NULL)
        putNullable(result, "openlibrary_work_id", facts.opt("openlibrary_work_id"))
        putNullable(result, "wikipedia_url", facts.opt("wikipedia_url"))
        result.put("original_language", JSONObject.NULL)
        result.put("country_of_origin", JSONObject.NULL)
        result.put("period", JSONObject.NULL)
        result.put("rating", JSONObject.NULL)
        result.put("mood", JSONArray())
        result.put("series", JSONObject.NULL)
        return result
    }

    private fun standardizeTitle(value: String): String {
        val trimmed = value.trim().replace(Regex("\\s+"), " ")
        val letters = trimmed.filter(Char::isLetter)
        if (letters.isEmpty() || letters.any(Char::isLowerCase)) return trimmed
        return trimmed.split(' ').joinToString(" ") { word ->
            if (word.isBlank()) word
            else word.lowercase(Locale.ROOT).replaceFirstChar { it.titlecase(Locale.ROOT) }
        }
    }

    private fun collectExistingGenres(catalogJson: String): List<String> {
        val books = JSONObject(catalogJson).optJSONArray("books") ?: JSONArray()
        val values = linkedSetOf<String>()
        for (i in 0 until books.length()) {
            val genres = books.optJSONObject(i)?.optJSONArray("genre") ?: continue
            for (j in 0 until genres.length()) {
                genres.optString(j).trim().takeIf { it.isNotBlank() }?.let(values::add)
            }
        }
        if (values.isEmpty()) {
            values += listOf(
                "Belletristik", "Roman", "Klassiker", "Krimi", "Thriller",
                "Science-Fiction", "Fantasy", "Philosophie", "Psychologie",
                "Wissenschaft", "Geschichte", "Biografie", "Sachbuch", "Kunst", "Wirtschaft",
            )
        }
        return values.toList().sorted()
    }

    private fun filterGenres(input: JSONArray?, allowed: List<String>): JSONArray {
        val result = JSONArray()
        if (input == null) return result
        val allowedSet = allowed.toSet()
        for (i in 0 until input.length()) {
            val value = input.optString(i).trim()
            if (value in allowedSet && result.length() < 3) result.put(value)
        }
        return result
    }

    private fun putStringArray(target: JSONObject, key: String, source: JSONArray?) {
        val result = JSONArray()
        if (source != null) {
            for (i in 0 until source.length()) {
                val value = source.optString(i).trim()
                if (value.isNotBlank() && result.length() < 6) result.put(value)
            }
        }
        target.put(key, result)
    }

    private fun putNullable(target: JSONObject, key: String, value: Any?) {
        val text = when (value) {
            null, JSONObject.NULL -> ""
            else -> value.toString().trim()
        }
        if (text.isBlank() || text.equals("null", true)) target.put(key, JSONObject.NULL)
        else target.put(key, text)
    }

    private fun getJson(value: String): JSONObject {
        val connection = (URL(value).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 12000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", USER_AGENT)
            useCaches = false
        }
        try {
            val status = connection.responseCode
            require(status in 200..299) { "Metadata source HTTP $status" }
            return JSONObject(connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() })
        } finally {
            connection.disconnect()
        }
    }

    private fun enc(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "")
        .lowercase(Locale.ROOT)
        .replace("[^a-z0-9]+".toRegex(), " ")
        .trim()
}
