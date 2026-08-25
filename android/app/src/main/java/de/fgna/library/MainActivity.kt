package de.fgna.library

import android.annotation.SuppressLint
import android.app.Activity
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
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/mobile.html")
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
        fun requestBooks(url: String, requestId: String) {
            ioExecutor.execute {
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
                JSONObject(text).getJSONArray("books")
                return text
            } finally {
                connection.disconnect()
            }
        }

        private fun cacheFile() = File(filesDir, "books-cache.json")

        private fun resolve(requestId: String, json: String?, error: String?) {
            val base64 = json?.let {
                Base64.encodeToString(it.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
            }
            val script = "window.__bookSourceResolve(${JSONObject.quote(requestId)}, ${JSONObject.quote(base64)}, ${JSONObject.quote(error)});"
            runOnUiThread { webView.evaluateJavascript(script, null) }
        }
    }
}
