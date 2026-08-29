package de.fgna.library

import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale
import kotlin.math.max

object DuplicateMatcher {
    private data class Match(val score: Double, val reason: String)

    fun findGroups(books: JSONArray): JSONArray {
        val items = (0 until books.length()).mapNotNull { index ->
            books.optJSONObject(index)?.let { index to it }
        }
        val parent = IntArray(items.size) { it }
        val matches = mutableMapOf<Pair<Int, Int>, Match>()

        fun root(x: Int): Int {
            var n = x
            while (parent[n] != n) {
                parent[n] = parent[parent[n]]
                n = parent[n]
            }
            return n
        }
        fun union(a: Int, b: Int) {
            val ra = root(a)
            val rb = root(b)
            if (ra != rb) parent[rb] = ra
        }

        for (a in items.indices) {
            for (b in a + 1 until items.size) {
                val match = compare(items[a].second, items[b].second) ?: continue
                matches[a to b] = match
                union(a, b)
            }
        }

        val clusters = linkedMapOf<Int, MutableList<Int>>()
        items.indices.forEach { clusters.getOrPut(root(it)) { mutableListOf() }.add(it) }
        val result = JSONArray()
        clusters.values.filter { it.size > 1 }.forEach { cluster ->
            var best = Match(0.0, "similar metadata")
            for (i in cluster.indices) for (j in i + 1 until cluster.size) {
                val a = minOf(cluster[i], cluster[j])
                val b = maxOf(cluster[i], cluster[j])
                val m = matches[a to b]
                if (m != null && m.score > best.score) best = m
            }
            val entries = JSONArray()
            cluster.forEach { position ->
                val (catalogIndex, book) = items[position]
                entries.put(JSONObject().apply {
                    put("index", catalogIndex)
                    put("title", book.optString("title"))
                    put("author", book.optString("author"))
                    put("year_published", nullable(book, "year_published"))
                    put("language", book.optString("language"))
                    put("openlibrary_work_id", nullable(book, "openlibrary_work_id"))
                    put("has_summary", book.optString("summary").isNotBlank())
                    put("book", JSONObject(book.toString()))
                })
            }
            val first = items[cluster.first()].second
            result.put(JSONObject().apply {
                put("title", first.optString("title"))
                put("author", first.optString("author"))
                put("confidence", best.score.coerceIn(0.0, 1.0))
                put("reason", best.reason)
                put("entries", entries)
            })
        }
        return result
    }

    private fun compare(a: JSONObject, b: JSONObject): Match? {
        val idA = openLibraryWorkId(a)
        val idB = openLibraryWorkId(b)
        if (idA != null && idB != null && idA == idB) {
            return Match(1.0, "same Open Library work ID")
        }

        val titleA = normalize(a.optString("title"))
        val titleB = normalize(b.optString("title"))
        if (titleA.isBlank() || titleB.isBlank()) return null
        val title = stringSimilarity(titleA, titleB)

        val authorA = normalize(a.optString("author"))
        val authorB = normalize(b.optString("author"))
        val author = authorSimilarity(authorA, authorB)

        val yearA = a.optInt("year_published", -1)
        val yearB = b.optInt("year_published", -1)
        val yearCompatible = yearA <= 0 || yearB <= 0 || kotlin.math.abs(yearA - yearB) <= 2

        val accepted = when {
            authorA.isBlank() || authorB.isBlank() -> title >= 0.92 && yearCompatible
            else -> title >= 0.78 && author >= 0.58 && yearCompatible
        }
        if (!accepted) return null

        val score = if (authorA.isBlank() || authorB.isBlank()) title * 0.92 else title * 0.72 + author * 0.28
        return Match(score, "title ${percent(title)}, author ${percent(author)}")
    }

    private fun openLibraryWorkId(book: JSONObject): String? {
        if (!book.has("openlibrary_work_id") || book.isNull("openlibrary_work_id")) return null
        val raw = book.optString("openlibrary_work_id", "").trim()
        if (raw.isBlank()) return null
        if (raw.equals("null", true) || raw.equals("none", true) || raw.equals("undefined", true)) return null
        val id = raw.substringAfterLast('/').uppercase(Locale.ROOT)
        return id.takeIf { OPEN_LIBRARY_WORK_ID.matches(it) }
    }

    private fun authorSimilarity(a: String, b: String): Double {
        if (a.isBlank() || b.isBlank()) return 0.0
        if (a == b) return 1.0
        val ta = a.split(' ').filter { it.isNotBlank() }.toSet()
        val tb = b.split(' ').filter { it.isNotBlank() }.toSet()
        val surnameA = ta.lastOrNull().orEmpty()
        val surnameB = tb.lastOrNull().orEmpty()
        val surnameBoost = if (surnameA.length >= 3 && surnameA == surnameB) 0.88 else 0.0
        return max(stringSimilarity(a, b), surnameBoost)
    }

    private fun stringSimilarity(a: String, b: String): Double {
        if (a == b) return 1.0
        val token = tokenJaccard(a, b)
        val distance = levenshtein(a, b)
        val chars = 1.0 - distance.toDouble() / max(a.length, b.length).coerceAtLeast(1)
        val containment = if ((a.contains(b) || b.contains(a)) && minOf(a.length, b.length) >= 8) 0.9 else 0.0
        return max(max(token, chars), containment).coerceIn(0.0, 1.0)
    }

    private fun tokenJaccard(a: String, b: String): Double {
        val aa = a.split(' ').filter { it.isNotBlank() }.toSet()
        val bb = b.split(' ').filter { it.isNotBlank() }.toSet()
        if (aa.isEmpty() || bb.isEmpty()) return 0.0
        return aa.intersect(bb).size.toDouble() / aa.union(bb).size
    }

    private fun levenshtein(a: String, b: String): Int {
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        var previous = IntArray(b.length + 1) { it }
        var current = IntArray(b.length + 1)
        for (i in a.indices) {
            current[0] = i + 1
            for (j in b.indices) {
                current[j + 1] = minOf(
                    current[j] + 1,
                    previous[j + 1] + 1,
                    previous[j] + if (a[i] == b[j]) 0 else 1,
                )
            }
            val swap = previous
            previous = current
            current = swap
        }
        return previous[b.length]
    }

    fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace("\\p{M}+".toRegex(), "")
        .lowercase(Locale.ROOT)
        .replace("&", " and ")
        .replace("[^a-z0-9]+".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()

    private fun nullable(book: JSONObject, key: String): Any = if (!book.has(key) || book.isNull(key)) JSONObject.NULL else book.get(key)
    private fun percent(value: Double) = "${(value * 100).toInt()}%"

    private val OPEN_LIBRARY_WORK_ID = Regex("^OL[0-9]+W$")
}
