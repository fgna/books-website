package de.fgna.library

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.os.ParcelFileDescriptor
import de.fgna.androidllmservice.ILlmCallback
import de.fgna.androidllmservice.ILlmService
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

internal object LocalBookInference {
    private const val TIMEOUT_SECONDS = 180L
    @Volatile private var appContext: Context? = null

    fun install(context: Context) {
        appContext = context.applicationContext
    }

    fun isReady(): Boolean = runCatching { withService { it.isModelReady } }.getOrDefault(false)

    fun activeModelName(): String = runCatching { withService { it.activeModelName } }.getOrDefault("")

    fun identify(imagePath: String): String {
        val image = File(imagePath)
        require(image.isFile && image.length() > 0L) { "Bilddatei fehlt." }
        return withService { service ->
            ParcelFileDescriptor.open(image, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
                awaitResult { callback -> service.generateWithImage(identifyPrompt(), descriptor, callback) }
            }
        }
    }

    fun enrich(prompt: String): String =
        withService { service -> awaitResult { callback -> service.generate(prompt, callback) } }

    private fun <T> withService(block: (ILlmService) -> T): T {
        val context = checkNotNull(appContext) { "Android LLM Service context not initialized." }
        val latch = CountDownLatch(1)
        val serviceRef = AtomicReference<ILlmService?>()
        val errorRef = AtomicReference<Throwable?>()
        lateinit var connection: ServiceConnection
        connection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                serviceRef.set(ILlmService.Stub.asInterface(binder))
                latch.countDown()
            }
            override fun onServiceDisconnected(name: ComponentName?) = Unit
            override fun onNullBinding(name: ComponentName?) {
                errorRef.set(IllegalStateException("Android LLM Service returned null binding."))
                latch.countDown()
            }
        }
        val intent = Intent("de.fgna.androidllmservice.BIND").apply {
            component = ComponentName("de.fgna.androidllmservice", "de.fgna.androidllmservice.LlmBinderService")
        }
        check(context.bindService(intent, connection, Context.BIND_AUTO_CREATE)) { "Android LLM Service ist nicht verfügbar." }
        try {
            check(latch.await(15, TimeUnit.SECONDS)) { "Zeitüberschreitung beim Verbinden mit Android LLM Service." }
            errorRef.get()?.let { throw it }
            val service = checkNotNull(serviceRef.get()) { "Android LLM Service konnte nicht verbunden werden." }
            check(service.isModelReady) { "Im Android LLM Service ist kein Modell bereit." }
            return block(service)
        } finally {
            runCatching { context.unbindService(connection) }
        }
    }

    private fun awaitResult(start: (ILlmCallback) -> Unit): String {
        val latch = CountDownLatch(1)
        val result = AtomicReference<String?>()
        val error = AtomicReference<Throwable?>()
        start(object : ILlmCallback.Stub() {
            override fun onSuccess(text: String?, initializationMillis: Long, generationMillis: Long, coldStart: Boolean) {
                result.set(text.orEmpty())
                latch.countDown()
            }
            override fun onError(code: String?, message: String?) {
                error.set(IllegalStateException(listOfNotNull(code, message).joinToString(": ")))
                latch.countDown()
            }
        })
        check(latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) { "LLM-Anfrage hat zu lange gedauert." }
        error.get()?.let { throw it }
        return result.get().orEmpty().trim()
    }

    private fun identifyPrompt(): String = """
        Du liest ein Foto eines einzelnen physischen Buches oder Buchrückens.
        Arbeite wie OCR: Extrahiere ausschließlich Text und Personennamen, die auf dem Foto wirklich sichtbar sind.
        Erfinde keine Namen oder Metadaten und ergänze insbesondere keinen Autor aus deinem Weltwissen.

        Antworte ausschließlich mit genau einem JSON-Objekt ohne Markdown:
        {
          "title": "sichtbarer Buchtitel in normaler Schreibweise",
          "author": "plausibelster sichtbarer Autor oder leerer String",
          "author_candidates": ["alle auf dem Buch lesbaren Personennamen"],
          "language": "Sprache des sichtbaren Buchtitels oder leerer String",
          "confidence": 0.0
        }

        Regeln:
        - Lies zuerst systematisch alle Textbereiche des Buches: oberen Rand, Autorenzeile über dem Titel, Titel, Untertitel sowie Zitat-/Rezensionszeilen unten.
        - title muss der eigentliche Buchtitel sein, nicht Verlag, Werbespruch, Zitat, Reihenlogo oder Unterzeile einer Rezension.
        - Gib title in üblicher Schreibweise zurück. Übernimm reine GROSSSCHREIBUNG des Covers nicht, wenn normale Groß-/Kleinschreibung eindeutig ist.
        - author_candidates enthält ALLE tatsächlich lesbaren Personennamen auf dem Buch, unabhängig davon, ob sie Autor, Rezensent oder zitierte Person sind. Die Liste ist eine reine Sichtbarkeitsliste.
        - Kopiere Namen buchstabengetreu vom Foto. Erfinde oder vervollständige keine Namen. Ein Name, der nicht sichtbar ist, darf niemals in author_candidates oder author stehen.
        - Bevorzuge für author einen Namen, der typografisch als Autorenzeile direkt oberhalb oder nahe beim Titel steht.
        - Namen aus Rezensionen, Zitaten, Presseangaben oder Empfehlungen dürfen in author_candidates stehen, aber NICHT als author gewählt werden. Warnsignale sind Anführungszeichen sowie Zusätze wie Zeitung, Magazin, Daily Mail, Sunday Times, New York Times o. Ä.
        - Wenn mehrere Namen sichtbar sind und ihre Rolle unklar ist, setze author auf den plausibelsten sichtbaren Kandidaten oder leer; erfinde niemals eine weitere Alternative.
        - language bezeichnet nur die Sprache des sichtbaren Titels/Textes auf dem fotografierten Buch, nicht die vermutete Originalsprache des Werks.
        - confidence liegt zwischen 0 und 1 und bewertet gemeinsam die Sicherheit von Titel und author. Bei unklarem Autor muss confidence deutlich sinken.
        - Wenn kein Titel sicher lesbar ist, setze title auf einen leeren String.
    """.trimIndent()
}
