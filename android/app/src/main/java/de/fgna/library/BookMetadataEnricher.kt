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
    ): JSONObject {
        val title = recognized.getString("title").trim()
        val author = recognized.optString("author", "").trim()
        val bibliographic = runCatching { lookupOpenLibrary(title, author) }.getOrElse { JSONObject() }
        val genres = collectExistingGenres(catalogJson)

        val prompt = buildPrompt(title, author, bibliographic, genres)
        val semantic = parseJsonObject(LocalBookInference.enrich(prompt))

        return normalizeResult(recognized, bibliographic, semantic, genres)
    }

    private fun lookupOpenLibrary(title: String, author: String): JSONObject {
        val query = buildString {
            append("https://openlibrary.org/search.json?title=")
            append(enc(title))
            if (author.isNotBlank()) {
                append("&author=")
                append(enc(author))
            }
            append("&limit=5&fields=key,title,author_name,first_publish_year,language,subject")
        }
        val docs = getJson(query).optJSONArray("docs") ?: JSONArray()
        var match: JSONObject? = null
        for (i in 0 until docs.length()) {
            val doc = docs.optJSONObject(i) ?: continue
            if (titlesMatch(title, doc.optString("title"))) {
                match = doc
                break
            }
        }
        if (match == null) return JSONObject()

        val facts = JSONObject()
        val key = match.optString("key")
        val workId = if (key.startsWith("/works/")) key.removePrefix("/works/") else ""
        if (workId.isNotBlank()) facts.put("openlibrary_work_id", workId)
        if (match.has("first_publish_year")) facts.put("year_published", match.optInt("first_publish_year"))
        facts.put("openlibrary_title", match.optString("title"))
        facts.put("openlibrary_languages", match.optJSONArray("language") ?: JSONArray())
        facts.put("openlibrary_subjects", match.optJSONArray("subject") ?: JSONArray())

        if (workId.isNotBlank()) {
            val work = runCatching { getJson("https://openlibrary.org/works/$workId.json") }.getOrNull()
            if (work != null) {
                val originalTitle = work.optString("original_title").trim()
                if (originalTitle.isNotBlank() && !titlesMatch(title, originalTitle)) {
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

    private fun buildPrompt(
        title: String,
        author: String,
        facts: JSONObject,
        genres: List<String>,
    ): String = """
        Du ergänzt Metadaten für einen privaten Buchkatalog. Antworte ausschließlich mit genau einem JSON-Objekt ohne Markdown.

        Identifiziertes Buch:
        Titel: ${jsonText(title)}
        Autor: ${jsonText(author)}

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
        - Inhaltswerte sind auf Deutsch. summary ist eine knappe Beschreibung in 2 bis 4 Sätzen.
        - summary_en und main_idea_en enthalten eine englische Übersetzung, sofern der deutsche Wert vorhanden ist.
        - genre darf ausschließlich Werte aus der erlaubten Liste verwenden. Nimm höchstens 3 passende Werte.
        - keywords und mood sollen kurz und nützlich sein, jeweils höchstens 6 Werte.
        - language bezeichnet die Sprache der fotografierten Ausgabe. Wenn sie aus Titel/Foto-Kontext nicht sicher ableitbar ist, verwende einen leeren String.
        - Nutze Open-Library-Fakten bevorzugt. Allgemeines Weltwissen darf nur für bekannte, stabile Werkdaten und Inhaltsklassifikation verwendet werden.
        - Wenn ein Feld unsicher ist, verwende null bzw. [] statt etwas zu erfinden.
        - read und rating werden ausdrücklich nicht erzeugt.
    """.trimIndent()

    private fun normalizeResult(
        recognized: JSONObject,
        facts: JSONObject,
        semantic: JSONObject,
        allowedGenres: List<String>,
    ): JSONObject {
        val result = JSONObject()
        result.put("title", recognized.getString("title").trim())
        result.put("author", recognized.optString("author", "").trim())
        result.put("confidence", recognized.optDouble("confidence", 0.0).coerceIn(0.0, 1.0))

        putNullable(result, "original_title", facts.opt("original_title"))
        putStringArray(result, "genre", filterGenres(semantic.optJSONArray("genre"), allowedGenres))
        result.put("language", semantic.optString("language", "").trim())
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

    private fun titlesMatch(a: String, b: String): Boolean {
        val left = normalize(a)
        val right = normalize(b)
        return left == right || left.contains(right) || right.contains(left)
    }

    private fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "")
        .lowercase(Locale.ROOT)
        .replace("[^a-z0-9]+".toRegex(), " ")
        .trim()
}
