package de.fgna.library

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig

internal object LocalBookInference {
    private const val MAX_TOKENS = 4096

    fun identify(modelPath: String, imagePath: String): String {
        val gpu = runCatching {
            runImage(modelPath, imagePath, Backend.GPU(), Backend.GPU())
        }
        return gpu.getOrElse {
            runImage(modelPath, imagePath, Backend.CPU(), Backend.CPU())
        }
    }

    fun enrich(modelPath: String, prompt: String): String {
        val gpu = runCatching {
            runText(modelPath, prompt, Backend.GPU())
        }
        return gpu.getOrElse {
            runText(modelPath, prompt, Backend.CPU())
        }
    }

    private fun runImage(
        modelPath: String,
        imagePath: String,
        backend: Backend,
        visionBackend: Backend,
    ): String {
        val engine = Engine(
            EngineConfig(
                modelPath = modelPath,
                backend = backend,
                visionBackend = visionBackend,
                maxNumTokens = MAX_TOKENS,
            )
        )
        try {
            engine.initialize()
            val conversation = engine.createConversation()
            try {
                return conversation.sendMessage(
                    Contents.of(
                        Content.ImageFile(imagePath),
                        Content.Text(identifyPrompt()),
                    )
                ).toString().trim()
            } finally {
                conversation.close()
            }
        } finally {
            engine.close()
        }
    }

    private fun runText(modelPath: String, prompt: String, backend: Backend): String {
        val engine = Engine(
            EngineConfig(
                modelPath = modelPath,
                backend = backend,
                maxNumTokens = MAX_TOKENS,
            )
        )
        try {
            engine.initialize()
            val conversation = engine.createConversation()
            try {
                return conversation.sendMessage(
                    Contents.of(Content.Text(prompt))
                ).toString().trim()
            } finally {
                conversation.close()
            }
        } finally {
            engine.close()
        }
    }

    private fun identifyPrompt(): String = """
        Du liest ein Foto eines einzelnen physischen Buches oder Buchrückens.
        Extrahiere ausschließlich Informationen, die auf dem Foto sichtbar sind.
        Erfinde keine Metadaten und ergänze nichts aus deinem Weltwissen.

        Antworte ausschließlich mit genau einem JSON-Objekt ohne Markdown:
        {
          "title": "sichtbarer Buchtitel",
          "author": "sichtbarer Autor oder leerer String",
          "confidence": 0.0
        }

        Regeln:
        - title muss der Buchtitel sein, nicht Verlag, Zitat oder Reihenlogo.
        - author darf leer sein, wenn kein Autor sicher lesbar ist.
        - confidence liegt zwischen 0 und 1.
        - Wenn kein Titel sicher lesbar ist, setze title auf einen leeren String.
    """.trimIndent()
}
