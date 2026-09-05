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

    fun enrich(recognized: JSONObject, catalogJson: String, userConfirmedIdentity: Boolean = false): JSONObject {
        val recognizedTitle = recognized.getString("title").trim()
        val candidates = visibleAuthorCandidates(recognized)
        val recognizedAuthor = recognized.optString("author", "").trim()
            .takeIf { author -> candidates.any { sameName(it, author) } }
            ?: candidates.firstOrNull().orEmpty()

        val bibliographic = runCatching { lookupOpenLibrary(recognizedTitle, candidates) }.getOrElse { JSONObject() }
        val bibliographicMatch = bibliographic.optBoolean("trusted_match", false)
        val identityVerified = bibliographicMatch || userConfirmedIdentity
        val canonicalTitle = bibliographic.optString("canonical_title").trim().ifBlank { standardizeTitle(recognizedTitle) }
        val selectedAuthor = bibliographic.optString("selected_visible_author").trim().ifBlank { recognizedAuthor }

        val google = if (identityVerified && canonicalTitle.isNotBlank() && selectedAuthor.isNotBlank()) {
            runCatching { lookupGoogleBooks(canonicalTitle, selectedAuthor) }.getOrElse { JSONObject() }
        } else JSONObject()
        mergeInternetFacts(bibliographic, google)

        val genres = collectExistingGenres(catalogJson)
        val semantic = if (identityVerified) metadataFromInternetFacts(bibliographic, genres) else JSONObject()

        return normalizeResult(recognized, bibliographic, semantic, genres).apply {
            put("title", canonicalTitle)
            put("author", selectedAuthor)
            put("_identity_verified", identityVerified)
            put("_bibliographic_match", bibliographicMatch)
            put("_author_candidates", JSONArray(candidates))
            put("_metadata_sources", JSONArray().apply {
                if (bibliographicMatch) put("Open Library")
                if (google.optBoolean("trusted_match", false)) put("Google Books")
            })
        }
    }

    private fun lookupOpenLibrary(title: String, visibleCandidates: List<String>): JSONObject {
        for (candidate in visibleCandidates) {
            val match = selectMatch(searchOpenLibrary(title, candidate), title, candidate, true)
            if (match != null) return factsForOpenLibraryMatch(match, title, candidate)
        }
        val titleMatches = searchOpenLibrary(title, "")
        for (i in 0 until titleMatches.length()) {
            val doc = titleMatches.optJSONObject(i) ?: continue
            if (!strongTitleMatch(title, doc.optString("title"))) continue
            for (candidate in visibleCandidates) {
                if (authorsMatch(candidate, doc.optJSONArray("author_name"))) return factsForOpenLibraryMatch(doc, title, candidate)
            }
        }
        return JSONObject()
    }

    private fun lookupGoogleBooks(title: String, author: String): JSONObject {
        val query = buildString {
            append("https://www.googleapis.com/books/v1/volumes?q=intitle:")
            append(enc(title))
            append("+inauthor:")
            append(enc(author))
            append("&maxResults=10&printType=books")
        }
        val items = getJson(query).optJSONArray("items") ?: JSONArray()
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
        val info = best ?: return JSONObject()
        return JSONObject().apply {
            put("trusted_match", true)
            put("google_title", info.optString("title"))
            put("google_authors", info.optJSONArray("authors") ?: JSONArray())
            val description = info.optString("description").trim()
            if (description.isNotBlank()) put("google_description", description.take(4000))
            val categories = info.optJSONArray("categories")
            if (categories != null && categories.length() > 0) put("google_categories", categories)
            val publishedDate = info.optString("publishedDate").trim()
            if (publishedDate.isNotBlank()) put("google_published_date", publishedDate)
            val language = info.optString("language").trim()
            if (language.isNotBlank()) put("google_language", language)
            val link = info.optString("canonicalVolumeLink").trim()
            if (link.isNotBlank()) put("google_books_url", link)
        }
    }

    private fun mergeInternetFacts(target: JSONObject, google: JSONObject) {
        if (!google.optBoolean("trusted_match", false)) return
        val description = google.optString("google_description").trim()
        if (target.optString("description").isBlank() && description.isNotBlank()) target.put("description", description)
        val categories = google.optJSONArray("google_categories")
        if (categories != null && categories.length() > 0) target.put("google_categories", categories)
        val language = google.optString("google_language").trim()
        if (language.isNotBlank()) target.put("google_language", language)
        val date = google.optString("google_published_date").trim()
        if (date.isNotBlank()) target.put("google_published_date", date)
        val link = google.optString("google_books_url").trim()
        if (link.isNotBlank()) target.put("google_books_url", link)
    }

    private fun factsForOpenLibraryMatch(match: JSONObject, scannedTitle: String, visibleAuthor: String): JSONObject {
        val facts = JSONObject().put("trusted_match", true).put("selected_visible_author", visibleAuthor)
        val canonicalTitle = match.optString("title").trim()
        if (canonicalTitle.isNotBlank()) facts.put("canonical_title", canonicalTitle)
        val key = match.optString("key")
        val workId = if (key.startsWith("/works/")) key.removePrefix("/works/") else ""
        if (workId.isNotBlank()) facts.put("openlibrary_work_id", workId)
        if (match.has("first_publish_year")) facts.put("year_published", match.optInt("first_publish_year"))
        facts.put("openlibrary_languages", match.optJSONArray("language") ?: JSONArray())
        facts.put("openlibrary_subjects", match.optJSONArray("subject") ?: JSONArray())

        if (workId.isNotBlank()) {
            val work = runCatching { getJson("https://openlibrary.org/works/$workId.json") }.getOrNull()
            if (work != null) {
                val originalTitle = work.optString("original_title").trim()
                if (originalTitle.isNotBlank() && !strongTitleMatch(canonicalTitle.ifBlank { scannedTitle }, originalTitle)) facts.put("original_title", originalTitle)
                val description = when (val raw = work.opt("description")) {
                    is String -> raw
                    is JSONObject -> raw.optString("value")
                    else -> ""
                }.trim()
                if (description.isNotBlank()) facts.put("description", description.take(4000))
                val subjects = work.optJSONArray("subjects")
                if (subjects != null && subjects.length() > 0) facts.put("work_subjects", subjects)
                val links = work.optJSONArray("links") ?: JSONArray()
                for (i in 0 until links.length()) {
                    val url = links.optJSONObject(i)?.optString("url").orEmpty()
                    if (url.contains("wikipedia.org")) { facts.put("wikipedia_url", url); break }
                }
            }
        }
        return facts
    }

    private fun metadataFromInternetFacts(facts: JSONObject, allowedGenres: List<String>): JSONObject {
        val out = JSONObject()
        val subjects = linkedSetOf<String>()
        for (key in listOf("work_subjects", "openlibrary_subjects", "google_categories")) {
            val values = facts.optJSONArray(key) ?: continue
            for (i in 0 until values.length()) values.optString(i).trim().takeIf { it.isNotBlank() }?.let(subjects::add)
        }
        val normalizedSubjects = subjects.map { normalize(it) }
        val genres = JSONArray()
        for (genre in allowedGenres) {
            val needle = normalize(genre)
            if (needle.isNotBlank() && normalizedSubjects.any { it == needle || it.contains(needle) || needle.contains(it) }) {
                genres.put(genre)
                if (genres.length() == 3) break
            }
        }
        out.put("genre", genres)
        out.put("keywords", JSONArray(subjects.take(6)))
        out.put("summary", facts.optString("description", "").trim())
        val visibleOrGoogleLanguage = languageFromCode(facts.optString("google_language"))
        out.put("language", visibleOrGoogleLanguage.ifBlank { languageFromOpenLibrary(facts.optJSONArray("openlibrary_languages")) })
        return out
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
            for (i in 0 until array.length()) array.optString(i).trim().takeIf { it.isNotBlank() }?.let(values::add)
        }
        val author = recognized.optString("author", "").trim()
        if (author.isNotBlank() && values.none { sameName(it, author) }) values += author
        return values.toList()
    }

    private fun searchOpenLibrary(title: String, author: String): JSONArray {
        val query = buildString {
            append("https://openlibrary.org/search.json?title="); append(enc(title))
            if (author.isNotBlank()) { append("&author="); append(enc(author)) }
            append("&limit=10&fields=key,title,author_name,first_publish_year,language,subject")
        }
        return getJson(query).optJSONArray("docs") ?: JSONArray()
    }

    private fun selectMatch(docs: JSONArray, title: String, author: String, requireAuthorMatch: Boolean): JSONObject? {
        var best: JSONObject? = null; var bestScore = -1
        for (i in 0 until docs.length()) {
            val doc = docs.optJSONObject(i) ?: continue
            val titleScore = titleMatchScore(title, doc.optString("title")); if (titleScore < 0) continue
            val authorMatches = authorsMatch(author, doc.optJSONArray("author_name")); if (requireAuthorMatch && !authorMatches) continue
            val score = titleScore + if (authorMatches) 10 else 0
            if (score > bestScore) { best = doc; bestScore = score }
        }
        return best
    }

    private fun titleMatchScore(a: String, b: String): Int {
        val left = normalize(a); val right = normalize(b)
        if (left.isBlank() || right.isBlank()) return -1
        if (left == right) return 4
        if (compact(left) == compact(right)) return 3
        val leftBase = normalize(baseTitle(a)); val rightBase = normalize(baseTitle(b))
        if (leftBase.isNotBlank() && leftBase == rightBase) return 2
        if (leftBase.isNotBlank() && compact(leftBase) == compact(rightBase)) return 1
        return -1
    }

    private fun strongTitleMatch(a: String, b: String) = titleMatchScore(a, b) >= 0
    private fun baseTitle(value: String) = value.substringBefore(':').substringBefore(" — ").substringBefore(" - ").trim()
    private fun compact(value: String) = value.replace(" ", "")
    private fun sameName(a: String, b: String): Boolean { val l = normalize(a); val r = normalize(b); return l.isNotBlank() && (l == r || compact(l) == compact(r)) }
    private fun authorsMatch(author: String, names: JSONArray?): Boolean { if (author.isBlank() || names == null) return false; for (i in 0 until names.length()) if (sameName(author, names.optString(i))) return true; return false }

    private fun normalizeResult(recognized: JSONObject, facts: JSONObject, semantic: JSONObject, allowedGenres: List<String>): JSONObject {
        val result = JSONObject()
        val recognizedTitle = recognized.getString("title").trim()
        val candidates = visibleAuthorCandidates(recognized)
        val recognizedAuthor = recognized.optString("author", "").trim().takeIf { author -> candidates.any { sameName(it, author) } } ?: candidates.firstOrNull().orEmpty()
        result.put("title", facts.optString("canonical_title").trim().ifBlank { standardizeTitle(recognizedTitle) })
        result.put("author", facts.optString("selected_visible_author").trim().ifBlank { recognizedAuthor })
        result.put("confidence", recognized.optDouble("confidence", 0.0).coerceIn(0.0, 1.0))
        putNullable(result, "original_title", facts.opt("original_title"))
        putStringArray(result, "genre", filterGenres(semantic.optJSONArray("genre"), allowedGenres))
        val visibleLanguage = recognized.optString("language", "").trim()
        result.put("language", visibleLanguage.ifBlank { semantic.optString("language", "").trim() })
        putStringArray(result, "keywords", semantic.optJSONArray("keywords"))
        result.put("summary", semantic.optString("summary", "").trim())
        result.put("summary_en", JSONObject.NULL); result.put("read", JSONObject.NULL)
        if (facts.has("year_published") && facts.optInt("year_published") > 0) result.put("year_published", facts.optInt("year_published")) else result.put("year_published", JSONObject.NULL)
        result.put("main_idea", JSONObject.NULL); result.put("main_idea_en", JSONObject.NULL)
        putNullable(result, "openlibrary_work_id", facts.opt("openlibrary_work_id")); putNullable(result, "wikipedia_url", facts.opt("wikipedia_url"))
        result.put("original_language", JSONObject.NULL); result.put("country_of_origin", JSONObject.NULL); result.put("period", JSONObject.NULL); result.put("rating", JSONObject.NULL); result.put("mood", JSONArray()); result.put("series", JSONObject.NULL)
        return result
    }

    private fun standardizeTitle(value: String): String {
        val trimmed = value.trim().replace(Regex("\\s+"), " "); val letters = trimmed.filter(Char::isLetter)
        if (letters.isEmpty() || letters.any(Char::isLowerCase)) return trimmed
        return trimmed.split(' ').joinToString(" ") { word -> if (word.isBlank()) word else word.lowercase(Locale.ROOT).replaceFirstChar { it.titlecase(Locale.ROOT) } }
    }

    private fun collectExistingGenres(catalogJson: String): List<String> {
        val books = JSONObject(catalogJson).optJSONArray("books") ?: JSONArray(); val values = linkedSetOf<String>()
        for (i in 0 until books.length()) { val gs = books.optJSONObject(i)?.optJSONArray("genre") ?: continue; for (j in 0 until gs.length()) gs.optString(j).trim().takeIf { it.isNotBlank() }?.let(values::add) }
        if (values.isEmpty()) values += listOf("Belletristik", "Roman", "Klassiker", "Krimi", "Thriller", "Science-Fiction", "Fantasy", "Philosophie", "Psychologie", "Wissenschaft", "Geschichte", "Biografie", "Sachbuch", "Kunst", "Wirtschaft")
        return values.toList().sorted()
    }

    private fun filterGenres(input: JSONArray?, allowed: List<String>): JSONArray { val out = JSONArray(); if (input == null) return out; val set = allowed.toSet(); for (i in 0 until input.length()) { val v = input.optString(i).trim(); if (v in set && out.length() < 3) out.put(v) }; return out }
    private fun putStringArray(target: JSONObject, key: String, source: JSONArray?) { val out = JSONArray(); if (source != null) for (i in 0 until source.length()) { val v = source.optString(i).trim(); if (v.isNotBlank() && out.length() < 6) out.put(v) }; target.put(key, out) }
    private fun putNullable(target: JSONObject, key: String, value: Any?) { val text = when (value) { null, JSONObject.NULL -> ""; else -> value.toString().trim() }; if (text.isBlank() || text.equals("null", true)) target.put(key, JSONObject.NULL) else target.put(key, text) }
    private fun getJson(value: String): JSONObject { val c = (URL(value).openConnection() as HttpURLConnection).apply { connectTimeout = 8000; readTimeout = 12000; requestMethod = "GET"; setRequestProperty("Accept", "application/json"); setRequestProperty("User-Agent", USER_AGENT); useCaches = true }; try { val status = c.responseCode; require(status in 200..299) { "Metadata source HTTP $status" }; return JSONObject(c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }) } finally { c.disconnect() } }
    private fun enc(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
    private fun normalize(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD).replace("\\p{M}+".toRegex(), "").lowercase(Locale.ROOT).replace("[^a-z0-9]+".toRegex(), " ").trim()
}
