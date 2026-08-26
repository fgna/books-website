package de.fgna.library

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.time.LocalDate

object BookBackupManager {
    private const val MAX_BACKUPS = 3

    fun createBackupIfNeeded(context: Context): Boolean {
        val source = activeCatalog(context)
        validate(source)

        val directory = File(context.filesDir, "catalog-backups").apply { mkdirs() }
        val today = LocalDate.now().toString()
        val destination = File(directory, "books-$today.json")
        if (destination.isFile && destination.length() > 0L) {
            prune(directory)
            return false
        }

        val temporary = File(directory, "books-$today.json.part")
        temporary.writeText(source, Charsets.UTF_8)
        validate(temporary.readText(Charsets.UTF_8))
        destination.delete()
        check(temporary.renameTo(destination)) { "Backup could not be finalized." }
        prune(directory)
        return true
    }

    private fun activeCatalog(context: Context): String {
        val cached = File(context.filesDir, "books-cache.json")
            .takeIf { it.isFile && it.length() > 0L }
            ?.readText(Charsets.UTF_8)
        if (!cached.isNullOrBlank()) return cached

        return context.assets.open("www/books.json")
            .bufferedReader(Charsets.UTF_8)
            .use { it.readText() }
    }

    private fun validate(text: String) {
        JSONObject(text).getJSONArray("books")
    }

    private fun prune(directory: File) {
        directory.listFiles { file ->
            file.isFile && file.name.startsWith("books-") && file.name.endsWith(".json")
        }
            ?.sortedByDescending { it.name }
            ?.drop(MAX_BACKUPS)
            ?.forEach(File::delete)

        directory.listFiles { file -> file.name.endsWith(".part") }
            ?.forEach(File::delete)
    }
}
