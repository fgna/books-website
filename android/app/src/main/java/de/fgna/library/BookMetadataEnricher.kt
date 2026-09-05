package de.fgna.library

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.text.Normalizer
import java.util.Locale

internal object BookMetadataEnricher {
    private const val USER_AGENT = "FreyaBooks/0.1 (personal library app)"

    fun enrich(
        recognized: JSONObject,
        catalogJson: String,
        userConfirmedIdentity: Boolean = false,
    ): JSONObject {
        val recognizedTitle = recognized.getString("title").trim()
        val candidates = visibleAuthorCandidates(recognized)
        val recognizedAuthor = recognized.optString("author", "").trim()
            .takeIf { author -> candidates.any { sameName(it, author) } }
            ?: candidates.firstOrNull().orEmpty()

        val bibliographic = runCatching {
            lookupOpenLibrary(recognizedTitle, candidates)
        }.getOrElse { JSONObject() }
        val bibliographicMatch = bibliographic.optBoolean("trusted_match", false)
        val identityVerified = bibliographicMatch || userConfirmedIdentity
        val canonicalTitle = bibliographic.optString("canonical_title").trim()
            .ifBlank { standardizeTitle(recognizedTitle) }
        val selectedAuthor = bibliographic.optString("selected_visible_author").trim()
            .ifBlank { recognizedAuthor }
        val genres = collectExistingGenres(catalogJson)

        val semantic = if (identityVerified) {
            val prompt = buildPrompt(
                title = canonicalTitle,
                author = selectedAuthor,
                facts = bibliographic,
                genres = genres,
                bibliographicMatch = bibliographicMatch,
                userConfirmedIdentity = userConfirmedIdentity,
            )
            parseJsonObject(LocalBookInference.enrich(prompt))
        } else {
            JSONObject()
        }

        return normalizeResult(recognized, bibliographic, semantic, genres).apply {
            put("_identity_verified", identityVerified)
            put("_bibliographic_match", bibliographicMatch)
            put("_author_candidates", JSONArray(candidates))
        }
    }

    private fun lookupOpenLibrary(title: String, visibleCandidates: List<String>): JSONObject {
        // First try every name that was actually visible on the book. The external
        // source may select among those names, but may never introduce a new author.
        for (candidate in visibleCandidates) {
            val match = selectMatch(
                docs = searchOpenLibrary(title, candidate),
                title = title,
                author = candidate,
                requireAuthorMatch = true,
            )
            if (match != null) return factsForMatch(match, title, candidate)
        }

        // If several names were visible, title-only search can still determine which
        // visible candidate belongs to the matched work. A canonical author that was
        // not visible is deliberately ignored.
        val titleMatches = searchOpenLibrary(title, "")
        for (i in 0 until titleMatches.length()) {
            val doc = titleMatches.optJSONObject(i) ?: continue
            if (!strongTitleMatch(title, doc.optString("title"))) continue
            for (candidate in visibleCandidates) {
                if (authorsMatch(candidate, doc.optJSONArray("author_name"))) {
                    return factsForMatch(doc, title, candidate)
                }
            }
        }
        return JSONObject()
    }

    private fun factsForMatch(match: JSONObject, scannedTitle: String, visibleAuthor: String): JSONObject {
        val facts = JSONObject()
            .put("trusted_match", true)
            .put("selected_visible_author", visibleAuthor)

        val canonicalTitle = match.optString("title").trim()
        if (canonicalTitle.isNotBlank()) facts.put("canonical_title", canonicalTitle)

        val key = match.optString("key")
        val workId = if (key.startsWith("/works/")) key.removePrefix("/works/") else ""
        if (workId.isNotBlank()) facts.put("openlibrary_work_id", workId)
        if (match.has("first_publish_year")) facts.put("year_published", match.optInt("first_publish_year"))
        facts.put("openlibrary_title", canonicalTitle)
        facts.put("openlibrary_authors", match.optJSONArray("author_name") ?: JSONArray())
        facts.put("openlibrary_languages", match.optJSONArray("language") ?: JSONArray())
        facts.put("openlibrary_subjects", match.optJSONArray("subject") ?: JSONArray())

        if (workId.isNotBlank()) {
            val work = runCatching { getJson("https://openlibrary.org/works/$workId.json") }.getOrNull()
            if (work != null) {
                val originalTitle = work.optString("original_title").trim()
                if (originalTitle.isNotBlank() && !strongTitleMatch(canonicalTitle.ifBlank { scannedTitle }, originalTitle)) {
                    facts.put("original_title", originalTitle)
                }
                val description = when (val raw = work.opt("description")) {
                    is String -> raw
                    is JSONObject -> raw.optString("value")
                    else -> ""
                }.trim()
                if (description.isNotBlank()) facts.put("description", description.take(3000))
                val subjects = work.optJSONArray("subjects")
                if (subjects != null && subjects.length() > 0) facts.put("work_subjects", subjects)
                val links = work.optJSONArray("links") ?: JSONArray()
                for (i in 0 until links.length()) {
                    val url = links.optJSONObject(i)?.optString("url").orEmpty()
                    if (url.contains("wikipedia.org")) {
                        facts.put("wikipedia_url", url)
                        break
                    }
                }
            }
        }
        return facts
    }

    private fun visibleAuthorCandidates(recognized: JSONObject): List<String> {
        val values = linkedSetOf<String>()
        val array = recognized.optJSONArray("author_candidates")
        if (array != null) {
            for (i in 0 until array.length()) {
                val value = array.optString(i).trim()
                if (value.isNotBlank()) values += value
            }
        }
        val author = recognized.optString("author", "").trim()
        if (author.isNotBlank() && values.none { sameName(it, author) }) values += author
        return values.toList()
    }

    private fun searchOpenLibrary(title: String, author: String): JSONArray {
        val query = buildString {
            append("https://openlibrary.org/search.json?title=")
            append(enc(title))
            if (author.isNotBlank()) {
                append("&author=")
                append(enc(author))
            }
            append("&limit=10&fields=key,title,author_name,first_publish_year,language,subject")
        }
        return getJson(query).optJSONArray("docs") ?: JSONArray()
    }

    private fun selectMatch(
        docs: JSONArray,
        title: String,
        author: String,
        requireAuthorMatch: Boolean,
    ): JSONObject? {
        var best: JSONObject? = null
        var bestScore = -1
        for (i in 0 until docs.length()) {
            val doc = docs.optJSONObject(i) ?: continue
            val titleScore = titleMatchScore(title, doc.optString("title"))
            if (titleScore < 0) continue
            val authorMatches = authorsMatch(author, doc.optJSONArray("author_name"))
            if (requireAuthorMatch && !authorMatches) continue
            val score = titleScore + if (authorMatches) 10 else 0
            if (score > bestScore) {
                best = doc
                bestScore = score
            }
        }
        return best
    }

    private fun titleMatchScore(a: String, b: String): Int {
        val left = normalize(a)
        val right = normalize(b)
        if (left.isBlank() || right.isBlank()) return -1
        if (left == right) return 4
        if (compact(left) == compact(right)) return 3
        val leftBase = normalize(baseTitle(a))
        val rightBase = normalize(baseTitle(b))
        if (leftBase.isNotBlank() && leftBase == rightBase) return 2
        if (leftBase.isNotBlank() && compact(leftBase) == compact(rightBase)) return 1
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

    private fun buildPrompt(
        title: String,
        author: String,
        facts: JSONObject,
        genres: List<String>,
        bibliographicMatch: Boolean,
        userConfirmedIdentity: Boolean,
    ): String {
        val identitySource = when {
            bibliographicMatch && userConfirmedIdentity -> "Titel und sichtbarer Autor wurden vom Nutzer bestätigt und bibliografisch abgeglichen."
            bibliographicMatch -> "Titel und sichtbarer Autor wurden bibliografisch abgeglichen."
            else -> "Titel und Autor wurden ausdrücklich vom Nutzer bestätigt; es liegt kein belastbarer Open-Library-Treffer vor."
        }
        return """
            Du ergänzt Metadaten für einen privaten Buchkatalog. Antworte ausschließlich mit genau einem JSON-Objekt ohne Markdown.

            Bestätigtes Buch:
            Titel: ${jsonText(title)}
            Autor: ${jsonText(author)}
            Identitätsquelle: $identitySource

            Verfügbare bibliografische Daten aus Open Library:
            ${facts.toString()}

            Erlaubte Genrewerte aus dem bestehenden Katalog:
            ${JSONArray(genres).toString()}

            Erzeuge nur diese Felder:
            {
              "genre": ["..."],
              "language": "...",
              "keywords": ["..."],
              "summary": "...",
              "summary_en": "... oder null",
              "main_idea": "... oder null",
              "main_idea_en": "... oder null",
              "original_language": "... oder null",
              "country_of_origin": "... oder null",
              "period": "... oder null",
              "mood": ["..."],
              "series": "... oder null"
            }

            Regeln:
            - Titel und Autor oben sind verbindlich. Erzeuge niemals Inhalte über eine andere Person oder ein anderes Werk.
            - Open-Library-Fakten sind, sofern vorhanden, harte Plausibilitätsgrenzen.
            - Wenn kein bibliografischer Treffer vorliegt, erfinde keine spezifischen Werkdetails. Nutze nur Wissen, bei dem du für genau diesen Titel und Autor sehr sicher bist; sonst null/[]/leerer String.
            - Inhaltswerte sind auf Deutsch. summary ist eine knappe Beschreibung in 2 bis 4 Sätzen.
            - summary_en und main_idea_en enthalten eine englische Übersetzung, sofern der deutsche Wert vorhanden ist.
            - genre darf ausschließlich Werte aus der erlaubten Liste verwenden. Nimm höchstens 3 passende Werte.
            - keywords und mood sollen kurz und nützlich sein, jeweils höchstens 6 Werte.
            - language bezeichnet die Sprache der fotografierten Ausgabe. Wenn sie nicht sicher ableitbar ist, verwende einen leeren String.
            - read und rating werden ausdrücklich nicht erzeugt.
        """.trimIndent()
    }

    private fun normalizeResult(
        recognized: JSONObject,
        facts: JSONObject,
        semantic: JSONObject,
        allowedGenres: List<String>,
    ): JSONObject {
        val result = JSONObject()
        val recognizedTitle = recognized.getString("title").trim()
        val candidates = visibleAuthorCandidates(recognized)
        val recognizedAuthor = recognized.optString("author", "").trim()
            .takeIf { author -> candidates.any { sameName(it, author) } }
            ?: candidates.firstOrNull().orEmpty()
        val canonicalTitle = facts.optString("canonical_title").trim()
            .ifBlank { standardizeTitle(recognizedTitle) }
        val selectedAuthor = facts.optString("selected_visible_author").trim()
            .ifBlank { recognizedAuthor }

        result.put("title", canonicalTitle)
        result.put("author", selectedAuthor)
        result.put("confidence", recognized.optDouble("confidence", 0.0).coerceIn(0.0, 1.0))

        putNullable(result, "original_title", facts.opt("original_title"))
        putStringArray(result, "genre", filterGenres(semantic.optJSONArray("genre"), allowedGenres))
        val visibleLanguage = recognized.optString("language", "").trim()
        result.put("language", visibleLanguage.ifBlank { semantic.optString("language", "").trim() })
        putStringArray(result, "keywords", semantic.optJSONArray("keywords"))
        result.put("summary", semantic.optString("summary", "").trim())
        putNullable(result, "summary_en", semantic.opt("summary_en"))
        result.put("read", JSONObject.NULL)
        if (facts.has("year_published") && facts.optInt("year_published") > 0) result.put("year_published", facts.optInt("year_published"))
        else result.put("year_published", JSONObject.NULL)
        putNullable(result, "main_idea", semantic.opt("main_idea"))
        putNullable(result, "main_idea_en", semantic.opt("main_idea_en"))
        putNullable(result, "openlibrary_work_id", facts.opt("openlibrary_work_id"))
        putNullable(result, "wikipedia_url", facts.opt("wikipedia_url"))
        putNullable(result, "original_language", semantic.opt("original_language"))
        putNullable(result, "country_of_origin", semantic.opt("country_of_origin"))
        putNullable(result, "period", semantic.opt("period"))
        result.put("rating", JSONObject.NULL)
        putStringArray(result, "mood", semantic.optJSONArray("mood"))
        putNullable(result, "series", semantic.opt("series"))
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
        val root = JSONObject(catalogJson)
        val books = root.optJSONArray("books") ?: JSONArray()
        val values = linkedSetOf<String>()
        for (i in 0 until books.length()) {
            val genres = books.optJSONObject(i)?.optJSONArray("genre") ?: continue
            for (j in 0 until genres.length()) {
                val value = genres.optString(j).trim()
                if (value.isNotBlank()) values += value
            }
        }
        if (values.isEmpty()) {
            values += listOf("Belletristik", "Roman", "Klassiker", "Krimi", "Thriller", "Science-Fiction", "Fantasy", "Philosophie", "Psychologie", "Wissenschaft", "Geschichte", "Biografie", "Sachbuch", "Kunst", "Wirtschaft")
        }
        return values.toList().sorted()
    }

    private fun filterGenres(input: JSONArray?, allowed: List<String>): JSONArray {
        val output = JSONArray()
        if (input == null) return output
        val allowedSet = allowed.toSet()
        for (i in 0 until input.length()) {
            val value = input.optString(i).trim()
            if (value in allowedSet && output.length() < 3) output.put(value)
        }
        return output
    }

    private fun putStringArray(target: JSONObject, key: String, source: JSONArray?) {
        val output = JSONArray()
        if (source != null) {
            for (i in 0 until source.length()) {
                val value = source.optString(i).trim()
                if (value.isNotBlank() && output.length() < 6) output.put(value)
            }
        }
        target.put(key, output)
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
            useCaches = true
        }
        try {
            val status = connection.responseCode
            require(status in 200..299) { "Open Library HTTP $status" }
            val text = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            return JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }

    private fun parseJsonObject(raw: String): JSONObject {
        val cleaned = raw.replace("```json", "", ignoreCase = true).replace("```", "").trim()
        val start = cleaned.indexOf('{')
        val end = cleaned.lastIndexOf('}')
        require(start >= 0 && end > start) { "Metadata response contained no JSON object" }
        return JSONObject(cleaned.substring(start, end + 1))
    }

    private fun enc(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
    private fun jsonText(value: String): String = JSONObject.quote(value)

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "")
        .lowercase(Locale.ROOT)
        .replace("[^a-z0-9]+".toRegex(), " ")
        .trim()
}
