package de.fgna.library

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File

class BookCameraActivity : ComponentActivity() {
    private lateinit var previewView: PreviewView
    private lateinit var shutter: Button
    private lateinit var status: TextView
    private var imageCapture: ImageCapture? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera() else fail("Kamerazugriff wurde nicht erlaubt.")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun buildUi() {
        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        root.addView(previewView)

        val top = TextView(this).apply {
            text = "Buchcover oder Buchrücken vollständig ins Bild nehmen"
            setTextColor(Color.WHITE)
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(24, 24, 24, 24)
            setBackgroundColor(0x66000000)
        }
        root.addView(
            top,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP,
            ),
        )

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(20, 18, 20, 30)
            setBackgroundColor(0x77000000)
        }

        val cancel = Button(this).apply {
            text = "Abbrechen"
            setOnClickListener {
                setResult(Activity.RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR, "Kameraaufnahme abgebrochen."))
                finish()
            }
        }
        shutter = Button(this).apply {
            text = "Foto"
            isEnabled = false
            setOnClickListener { takePhoto() }
        }
        controls.addView(cancel, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        controls.addView(shutter, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        status = TextView(this).apply {
            text = "Kamera wird vorbereitet…"
            setTextColor(Color.WHITE)
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(12, 8, 12, 8)
        }
        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(status, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(controls, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        root.addView(
            bottom,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM,
            ),
        )

        setContentView(root)
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            runCatching {
                val provider = providerFuture.get()
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }
                imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .build()
                provider.unbindAll()
                provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageCapture,
                )
                shutter.isEnabled = true
                status.text = "Bereit"
            }.onFailure { fail("Kamera konnte nicht gestartet werden: ${it.message ?: it.javaClass.simpleName}") }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val capture = imageCapture ?: return
        val outputPath = intent.getStringExtra(EXTRA_OUTPUT_PATH)
        if (outputPath.isNullOrBlank()) {
            fail("Kein Ziel für die Aufnahme vorhanden.")
            return
        }

        val output = File(outputPath)
        output.parentFile?.mkdirs()
        shutter.isEnabled = false
        status.text = "Foto wird gespeichert…"

        capture.takePicture(
            ImageCapture.OutputFileOptions.Builder(output).build(),
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    if (!output.isFile || output.length() <= 0L) {
                        fail("Die Kamera hat kein Bild gespeichert.")
                        return
                    }
                    setResult(Activity.RESULT_OK, Intent().putExtra(EXTRA_OUTPUT_PATH, output.absolutePath))
                    finish()
                }

                override fun onError(exception: ImageCaptureException) {
                    fail("Foto konnte nicht gespeichert werden: ${exception.message ?: exception.imageCaptureError}")
                }
            },
        )
    }

    private fun fail(message: String) {
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR, message))
        finish()
    }

    companion object {
        const val EXTRA_OUTPUT_PATH = "book_camera_output_path"
        const val EXTRA_ERROR = "book_camera_error"
    }
}
