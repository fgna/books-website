package de.fgna.library

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val ioExecutor = Executors.newSingleThreadExecutor()
    private val prefs by lazy { getSharedPreferences("library", MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            addJavascriptInterface(BookSourceBridge(), "AndroidBookSource")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
            }
        }

        setContentView(webView)
        loadApp()
    }

    private fun loadApp() {
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/mobile.html")
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK || data?.data == null) return

        when (requestCode) {
            REQUEST_IMPORT -> {
                val uri = data.data ?: return
                ioExecutor.execute {
                    runCatching {
                        val text = contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
                            ?: error("Could not read selected JSON file")
                        validateJson(text)
                        cacheFile().writeText(text, Charsets.UTF_8)
                        prefs.edit().putBoolean(PREF_MANUAL_OVERRIDE, true).apply()
                    }.onSuccess {
                        runOnUiThread { loadApp() }
                    }.onFailure { error ->
                        showNativeError(error.message ?: "JSON import failed")
                    }
                }
            }
            REQUEST_EXPORT -> {
                val uri = data.data ?: return
                ioExecutor.execute {
                    runCatching {
                        val text = activeJsonForExport()
                        contentResolver.openOutputStream(uri, "wt")?.bufferedWriter(Charsets.UTF_8)?.use { it.write(text) }
                            ?: error("Could not write selected file")
                    }.onFailure { error ->
                        showNativeError(error.message ?: "JSON export failed")
                    }
                }
            }
        }
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        ioExecutor.shutdownNow()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }

    inner class BookSourceBridge {
        @JavascriptInterface
        fun getDefaultBooksUrl(): String = BuildConfig.BOOKS_URL

        @JavascriptInterface
        fun isManualOverride(): Boolean = prefs.getBoolean(PREF_MANUAL_OVERRIDE, false)

        @JavascriptInterface
        fun importBooks() {
            runOnUiThread {
                startActivityForResult(
                    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                    },
                    REQUEST_IMPORT
                )
            }
        }

        @JavascriptInterface
        fun exportBooks() {
            runOnUiThread {
                startActivityForResult(
                    Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                        putExtra(Intent.EXTRA_TITLE, "books.json")
                    },
                    REQUEST_EXPORT
                )
            }
        }

        @JavascriptInterface
        fun useRemoteBooks() {
            prefs.edit().putBoolean(PREF_MANUAL_OVERRIDE, false).apply()
            runOnUiThread { loadApp() }
        }

        @JavascriptInterface
        fun requestBooks(url: String, requestId: String) {
            ioExecutor.execute {
                if (prefs.getBoolean(PREF_MANUAL_OVERRIDE, false)) {
                    val imported = runCatching { cacheFile().takeIf(File::isFile)?.readText(Charsets.UTF_8) }.getOrNull()
                    if (!imported.isNullOrBlank()) {
                        resolve(requestId, imported, null)
                        return@execute
                    }
                    prefs.edit().putBoolean(PREF_MANUAL_OVERRIDE, false).apply()
                }

                try {
                    val json = downloadAndValidate(url)
                    cacheFile().writeText(json, Charsets.UTF_8)
                    resolve(requestId, json, null)
                } catch (networkError: Exception) {
                    val cached = runCatching { cacheFile().takeIf(File::isFile)?.readText(Charsets.UTF_8) }.getOrNull()
                    if (!cached.isNullOrBlank()) {
                        resolve(requestId, cached, null)
                    } else {
                        resolve(requestId, null, networkError.message ?: "books.json sync failed")
                    }
                }
            }
        }

        private fun downloadAndValidate(value: String): String {
            val parsed = URL(value)
            require(parsed.protocol == "https" || parsed.protocol == "http") { "booksUrl must use http or https" }

            val connection = (parsed.openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 12000
                requestMethod = "GET"
                setRequestProperty("Accept", "application/json")
                useCaches = false
            }

            try {
                val status = connection.responseCode
                require(status in 200..299) { "books.json HTTP $status" }
                val text = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                validateJson(text)
                return text
            } finally {
                connection.disconnect()
            }
        }

        private fun resolve(requestId: String, json: String?, error: String?) {
            val base64 = json?.let {
                Base64.encodeToString(it.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
            }
            val script = "window.__bookSourceResolve(${JSONObject.quote(requestId)}, ${JSONObject.quote(base64)}, ${JSONObject.quote(error)});"
            runOnUiThread { webView.evaluateJavascript(script, null) }
        }
    }

    private fun validateJson(text: String) {
        JSONObject(text).getJSONArray("books")
    }

    private fun activeJsonForExport(): String {
        val cached = cacheFile().takeIf(File::isFile)?.readText(Charsets.UTF_8)
        if (!cached.isNullOrBlank()) {
            validateJson(cached)
            return cached
        }
        return assets.open("www/books.json").bufferedReader(Charsets.UTF_8).use { it.readText() }.also(::validateJson)
    }

    private fun cacheFile() = File(filesDir, "books-cache.json")

    private fun showNativeError(message: String) {
        val script = "alert(${JSONObject.quote(message)});"
        runOnUiThread { webView.evaluateJavascript(script, null) }
    }

    companion object {
        private const val REQUEST_IMPORT = 1001
        private const val REQUEST_EXPORT = 1002
        private const val PREF_MANUAL_OVERRIDE = "manual_books_override"
    }
}
