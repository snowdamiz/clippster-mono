package app.clippster.editor.engine

import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicReference

class ClippsterEditorNativeModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val exporter = HardwareExportPipeline()
  private val document = AtomicReference("")

  @Volatile private var playing = false
  @Volatile private var previewQuality = "auto"
  @Volatile private var currentSeconds = 0.0
  private var playStartedNanos = 0L
  private var playStartedSeconds = 0.0

  private val frameCallback = object : Choreographer.FrameCallback {
    override fun doFrame(frameTimeNanos: Long) {
      if (!playing) return
      currentSeconds = playStartedSeconds +
        (frameTimeNanos - playStartedNanos).coerceAtLeast(0L) / 1_000_000_000.0
      sendEvent("onTimeUpdate", mapOf("timeSeconds" to currentSeconds))
      Choreographer.getInstance().postFrameCallback(this)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ClippsterEditorNative")

    Constants(
      "ticksPerSecond" to nativeTicksPerSecond(),
    )

    Events(
      "onTimeUpdate",
      "onExportProgress",
      "onExportComplete",
      "onExportError",
      "onEngineError",
    )

    AsyncFunction("getCapabilities") {
      jsonArrayToList(JSONArray(nativeGetCapabilitiesJson()))
    }

    AsyncFunction("loadRevision") { documentJson: String ->
      validateDocument(documentJson)
      document.set(documentJson)
      Unit
    }

    AsyncFunction("applyRevision") { documentJson: String ->
      validateDocument(documentJson)
      document.set(documentJson)
      Unit
    }

    AsyncFunction("play") {
      if (!playing) {
        playing = true
        playStartedSeconds = currentSeconds
        mainHandler.post {
          playStartedNanos = System.nanoTime()
          Choreographer.getInstance().removeFrameCallback(frameCallback)
          Choreographer.getInstance().postFrameCallback(frameCallback)
        }
      }
      Unit
    }

    AsyncFunction("pause") {
      playing = false
      mainHandler.post { Choreographer.getInstance().removeFrameCallback(frameCallback) }
      Unit
    }

    AsyncFunction("seek") { timeSeconds: Double, mode: String ->
      require(timeSeconds.isFinite() && timeSeconds >= 0.0) { "Invalid seek time" }
      require(mode == "interactive" || mode == "precise") {
        "Seek mode must be interactive or precise"
      }
      currentSeconds = timeSeconds
      playStartedSeconds = timeSeconds
      playStartedNanos = System.nanoTime()
      sendEvent("onTimeUpdate", mapOf("timeSeconds" to currentSeconds, "mode" to mode))
      Unit
    }

    AsyncFunction("setPreviewQuality") { quality: String ->
      require(quality in setOf("auto", "low", "medium", "high", "full")) {
        "Unsupported preview quality: $quality"
      }
      previewQuality = quality
      Unit
    }

    AsyncFunction("getCurrentTime") {
      currentSeconds
    }

    AsyncFunction("export") { requestJson: String ->
      val request = JSONObject(requestJson)
      val outputPath = request.getString("outputPath")
      try {
        val scenePayload = when {
          request.has("sceneJson") && !request.isNull("sceneJson") ->
            request.getString("sceneJson")
          request.has("documentJson") && !request.isNull("documentJson") ->
            request.getString("documentJson")
          else -> null
        }
        val outputPaths = if (scenePayload != null) {
          exporter.exportScene(
            context = requireNotNull(appContext.reactContext),
            sceneJson = scenePayload,
            outputPath = outputPath,
            width = request.optInt("width", 1080),
            height = request.optInt("height", 1920),
            fps = request.optInt("fps", 30),
          ) { progress ->
            sendEvent("onExportProgress", mapOf("progress" to progress))
          }
        } else {
          require(request.has("inputPath") && !request.isNull("inputPath")) {
            "Export requires sceneJson, documentJson, or inputPath"
          }
          exporter.export(
            inputPath = request.getString("inputPath"),
            outputPath = outputPath,
          ) { progress ->
            sendEvent("onExportProgress", mapOf("progress" to progress))
          }
        }
        val result = mapOf("outputPaths" to outputPaths)
        sendEvent("onExportComplete", result)
        result
      } catch (error: Throwable) {
        sendEvent("onExportError", mapOf("message" to (error.message ?: "Export failed")))
        throw error
      }
    }

    AsyncFunction("cancelExport") {
      exporter.cancel()
      Unit
    }

    AsyncFunction("probeMedia") { sourceUri: String ->
      probeMediaMetadata(sourceUri)
    }

    AsyncFunction("generateProxy") { sourceUri: String, destUri: String ->
      val source = fileForUri(sourceUri)
      val destination = fileForUri(destUri)
      destination.parentFile?.mkdirs()
      source.copyTo(destination, overwrite = true)
      destination.absolutePath
    }

    AsyncFunction("generateThumbnail") {
        sourceUri: String, timeSeconds: Double, destUri: String ->
      val retriever = MediaMetadataRetriever()
      try {
        val source = Uri.parse(sourceUri)
        val context = requireNotNull(appContext.reactContext)
        if (source.scheme == "content" || source.scheme == "file") {
          retriever.setDataSource(context, source)
        } else {
          retriever.setDataSource(sourceUri)
        }
        val bitmap = retriever.getFrameAtTime(
          (timeSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong(),
          MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
        ) ?: error("No thumbnail frame available")
        val destination = fileForUri(destUri)
        destination.parentFile?.mkdirs()
        FileOutputStream(destination).use {
          check(bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, it)) {
            "Could not encode thumbnail"
          }
        }
        bitmap.recycle()
        destination.absolutePath
      } finally {
        retriever.release()
      }
    }

    View(ClippsterEditorPreviewView::class) {
      Events("onSurfaceReady", "onFramePresented")
      Prop("documentJson") { view: ClippsterEditorPreviewView, value: String ->
        view.setDocumentJson(value)
      }
      Prop("playing") { view: ClippsterEditorPreviewView, value: Boolean ->
        view.setPlaying(value)
      }
      Prop("playheadSeconds") { view: ClippsterEditorPreviewView, value: Double ->
        view.setPlayheadSeconds(value)
      }
      Prop("quality") { view: ClippsterEditorPreviewView, value: String ->
        view.setQuality(value)
      }
    }
  }

  private fun validateDocument(value: String) {
    require(value.isNotBlank()) { "Document JSON is empty" }
    val tick = (currentSeconds * nativeTicksPerSecond()).toLong()
    val result = JSONObject(nativeParseAndEvaluate(value, tick, true))
    if (result.has("error")) {
      val message = result.optString("error", "Invalid editor document")
      sendEvent("onEngineError", mapOf("message" to message))
      error(message)
    }
  }

  private fun fileForUri(value: String): File {
    val uri = Uri.parse(value)
    require(uri.scheme == null || uri.scheme == "file") {
      "Destination and copy paths must be local file URIs"
    }
    return File(if (uri.scheme == "file") requireNotNull(uri.path) else value)
  }

  private fun probeMediaMetadata(sourceUri: String): Map<String, Any?> {
    val path = fileForUri(sourceUri).absolutePath
    require(File(path).isFile) { "Media file does not exist: $path" }

    val retriever = MediaMetadataRetriever()
    val width: Int
    val height: Int
    val durationSeconds: Double
    try {
      retriever.setDataSource(path)
      width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        ?.toIntOrNull()
        ?: error("Could not read export width")
      height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
        ?.toIntOrNull()
        ?: error("Could not read export height")
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        ?.toLongOrNull()
        ?: error("Could not read export duration")
      durationSeconds = durationMs / 1000.0
    } finally {
      retriever.release()
    }

    var videoCodec = "h264"
    var audioCodec: String? = null
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(path)
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        when {
          mime.startsWith("video/") ->
            videoCodec = when {
              mime.contains("avc", ignoreCase = true) || mime.contains("h264", ignoreCase = true) ->
                "h264"
              mime.contains("hevc", ignoreCase = true) || mime.contains("h265", ignoreCase = true) ->
                "hevc"
              else -> mime.substringAfter('/')
            }
          mime.startsWith("audio/") ->
            audioCodec = when {
              mime.contains("mp4a", ignoreCase = true) || mime.contains("aac", ignoreCase = true) ->
                "aac"
              else -> mime.substringAfter('/')
            }
        }
      }
    } finally {
      extractor.release()
    }

    return mapOf(
      "width" to width,
      "height" to height,
      "duration" to durationSeconds,
      "videoCodec" to videoCodec,
      "audioCodec" to audioCodec,
    )
  }

  private fun jsonArrayToList(array: JSONArray): List<Map<String, Any?>> =
    (0 until array.length()).map { jsonObjectToMap(array.getJSONObject(it)) }

  private fun jsonObjectToMap(value: JSONObject): Map<String, Any?> =
    value.keys().asSequence().associateWith { key ->
      when (val entry = value.get(key)) {
        JSONObject.NULL -> null
        is JSONObject -> jsonObjectToMap(entry)
        is JSONArray -> (0 until entry.length()).map(entry::get)
        else -> entry
      }
    }

  internal companion object {
    init {
      System.loadLibrary("clippster_editor_jni")
    }

    @JvmStatic private external fun nativeGetCapabilitiesJson(): String
    @JvmStatic private external fun nativeParseAndEvaluate(
      sceneJson: String,
      tick: Long,
      previewMode: Boolean,
    ): String
    @JvmStatic private external fun nativeTicksPerSecond(): Long

    fun evaluateDocument(sceneJson: String, tick: Long, previewMode: Boolean): String =
      nativeParseAndEvaluate(sceneJson, tick, previewMode)

    fun ticksPerSecond(): Long = nativeTicksPerSecond()
  }
}
