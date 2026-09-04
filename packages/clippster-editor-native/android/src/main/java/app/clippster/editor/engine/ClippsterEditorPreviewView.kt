package app.clippster.editor.engine

import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.SurfaceTexture
import android.view.Surface
import android.view.TextureView
import android.widget.FrameLayout
import android.widget.ImageView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONObject

class ClippsterEditorPreviewView(
  context: android.content.Context,
  appContext: AppContext,
) : ExpoView(context, appContext), TextureView.SurfaceTextureListener {
  private val onSurfaceReady by EventDispatcher()
  private val onFramePresented by EventDispatcher()
  private val textureView = TextureView(context)
  private val bitmapPreviewView = ImageView(context)
  private val overlayView = LayerOverlayView(context)
  private val pipeline = MediaPreviewPipeline(context)
  private val bitmapPipeline = BitmapPreviewPipeline(context)
  private var previewBitmap: android.graphics.Bitmap? = null

  private var documentJson = ""
  private var playheadSeconds = 0.0
  private var playing = false
  private var quality = "auto"
  private var lastRequestedSeconds = Double.NaN
  private var lastRequestedSource: String? = null

  init {
    setBackgroundColor(Color.BLACK)
    // TextureView rejects background drawables on API 28+; keep black on the parent only.
    textureView.surfaceTextureListener = this
    addView(
      textureView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    bitmapPreviewView.scaleType = ImageView.ScaleType.FIT_XY
    bitmapPreviewView.visibility = INVISIBLE
    addView(
      bitmapPreviewView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    addView(
      overlayView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
  }

  fun setDocumentJson(value: String) {
    if (documentJson == value) return
    documentJson = value
    lastRequestedSeconds = Double.NaN
    lastRequestedSource = null
    requestFrame()
  }

  fun setPlaying(value: Boolean) {
    playing = value
    if (!value) {
      lastRequestedSeconds = Double.NaN
    }
  }

  fun setPlayheadSeconds(value: Double) {
    playheadSeconds = value.coerceAtLeast(0.0)
    requestFrame()
  }

  fun setQuality(value: String) {
    if (quality == value) return
    quality = value
    lastRequestedSeconds = Double.NaN
    requestFrame()
  }

  private fun requestFrame() {
    if (documentJson.isBlank()) return
    val frame = evaluatedFrame()
    overlayView.setFrame(frame)
    if (!textureView.isAvailable) return
    val videoLayer = frame?.optJSONArray("layers")
      ?.let { layers ->
        (0 until layers.length())
          .mapNotNull(layers::optJSONObject)
          .firstOrNull { it.optString("kind") == "video" }
      }
    val videoLayers = frame?.optJSONArray("layers")?.let { layers ->
      (0 until layers.length())
        .mapNotNull(layers::optJSONObject)
        .filter { it.optString("kind") == "video" }
    }.orEmpty()
    val needsBitmapComposition = videoLayers.any(::requiresBitmapComposition)
    if (needsBitmapComposition && frame != null && width > 0 && height > 0) {
      textureView.visibility = INVISIBLE
      bitmapPreviewView.visibility = VISIBLE
      bitmapPipeline.render(frame, width, height) { bitmap ->
        post {
          val previous = previewBitmap
          previewBitmap = bitmap
          bitmapPreviewView.setImageBitmap(bitmap)
          previous?.takeIf { it !== bitmap && !it.isRecycled }?.recycle()
          onFramePresented(mapOf("timeSeconds" to playheadSeconds, "quality" to quality))
        }
      }
      return
    }
    bitmapPipeline.cancel()
    bitmapPreviewView.visibility = INVISIBLE
    textureView.visibility = VISIBLE
    applyEvaluatorTransform(frame, videoLayer)
    val source = videoLayer?.optString("sourceUri")?.takeIf(String::isNotBlank)
      ?: (if (frame == null) firstVideoSource(documentJson) else null)
      ?: return
    val sourceTick = videoLayer
      ?.takeIf { it.has("sourceTick") && !it.isNull("sourceTick") }
      ?.optLong("sourceTick")
    val decodeTimeSeconds = sourceTick
      ?.let { it.toDouble() / ClippsterEditorNativeModule.ticksPerSecond() }
      ?: playheadSeconds

    // Drop redundant play ticks — sticky decoder advances; flooding seeks stalls it.
    if (
      playing &&
      source == lastRequestedSource &&
      !lastRequestedSeconds.isNaN() &&
      kotlin.math.abs(decodeTimeSeconds - lastRequestedSeconds) < PLAY_TICK_MIN_DELTA
    ) {
      return
    }
    lastRequestedSource = source
    lastRequestedSeconds = decodeTimeSeconds

    pipeline.showFrame(
      sourceUri = source,
      timeSeconds = decodeTimeSeconds,
      precise = !playing,
      onPresented = { seconds ->
        post {
          onFramePresented(
            mapOf(
              "timeSeconds" to seconds,
              "quality" to quality,
            ),
          )
        }
      },
      onError = { error ->
        post {
          // Missing/offline media is a recoverable black-frame state.
          onFramePresented(
            mapOf(
              "timeSeconds" to playheadSeconds,
              "error" to (error.message ?: "Unable to decode preview frame"),
            ),
          )
        }
      },
    )
  }

  private fun requiresBitmapComposition(layer: JSONObject): Boolean {
    if (layer.optJSONObject("transition")?.optString("kind") == "wipe") return true
    val effects = layer.optJSONArray("effects") ?: return false
    for (index in 0 until effects.length()) {
      val type = effects.optJSONObject(index)?.optString("type")
        ?.lowercase()
        ?.replace('-', '_')
        ?.removePrefix("adjust_")
        ?: continue
      if (type in RASTER_EFFECTS) return true
    }
    return false
  }

  private fun firstVideoSource(json: String): String? = runCatching {
    val root = JSONObject(json)
    val assets = root.optJSONObject("assets") ?: return@runCatching null
    assets.keys().asSequence()
      .mapNotNull { assets.optJSONObject(it) }
      .firstOrNull { it.optString("kind", "video").equals("video", true) }
      ?.optString("sourceUri")
      ?.takeIf(String::isNotBlank)
  }.getOrNull()

  private fun evaluatedFrame(): JSONObject? = runCatching {
    val tick = (playheadSeconds * ClippsterEditorNativeModule.ticksPerSecond()).toLong()
    JSONObject(
      ClippsterEditorNativeModule.evaluateDocument(
        documentJson,
        tick,
        true,
      ),
    ).takeUnless { it.has("error") }
  }.getOrNull()

  private fun applyEvaluatorTransform(frame: JSONObject?, layer: JSONObject?) {
    val frameCanvas = frame?.optJSONObject("canvas")
    val transform = layer?.optJSONObject("transform")
    if (frameCanvas == null || transform == null || width <= 0 || height <= 0) {
      textureView.setTransform(Matrix())
      textureView.alpha = 1f
      textureView.clipBounds = null
      textureView.setLayerType(LAYER_TYPE_NONE, null)
      return
    }
    textureView.alpha = layer.optDouble("opacity", 1.0).coerceIn(0.0, 1.0).toFloat()
    val colorFilter = EffectColorMatrices.colorFilter(layer.optJSONArray("effects"))
    textureView.setLayerType(
      if (colorFilter == null) LAYER_TYPE_NONE else LAYER_TYPE_HARDWARE,
      colorFilter?.let { Paint(Paint.ANTI_ALIAS_FLAG).apply { this.colorFilter = it } },
    )
    val transition = layer.optJSONObject("transition")
    textureView.clipBounds =
      if (transition?.optString("kind") == "wipe") {
        val progress = transition.optDouble("horizontalWipeProgress", 1.0)
          .coerceIn(0.0, 1.0)
        Rect(0, 0, (textureView.width * progress).toInt(), textureView.height)
      } else {
        null
      }
    val canvasWidth = frameCanvas.optDouble("width", width.toDouble()).coerceAtLeast(1.0)
    val canvasHeight = frameCanvas.optDouble("height", height.toDouble()).coerceAtLeast(1.0)
    val sourceWidth = layer.optDouble("sourceWidth", width.toDouble()).coerceAtLeast(1.0)
    val sourceHeight = layer.optDouble("sourceHeight", height.toDouble()).coerceAtLeast(1.0)
    val outputScaleX = width / canvasWidth
    val outputScaleY = height / canvasHeight
    val inputScaleX = sourceWidth / width
    val inputScaleY = sourceHeight / height
    val values = floatArrayOf(
      (outputScaleX * transform.optDouble("m00", 1.0) * inputScaleX).toFloat(),
      (outputScaleX * transform.optDouble("m01", 0.0) * inputScaleY).toFloat(),
      (outputScaleX * transform.optDouble("m02", 0.0)).toFloat(),
      (outputScaleY * transform.optDouble("m10", 0.0) * inputScaleX).toFloat(),
      (outputScaleY * transform.optDouble("m11", 1.0) * inputScaleY).toFloat(),
      (outputScaleY * transform.optDouble("m12", 0.0)).toFloat(),
      0f,
      0f,
      1f,
    )
    textureView.setTransform(Matrix().apply { setValues(values) })
  }

  override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
    pipeline.attachSurface(Surface(surfaceTexture))
    onSurfaceReady(mapOf("width" to width, "height" to height))
    requestFrame()
  }

  override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
    requestFrame()
  }

  override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
    pipeline.detachSurface()
    return true
  }

  override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit

  override fun onDetachedFromWindow() {
    pipeline.release()
    bitmapPipeline.release()
    bitmapPreviewView.setImageDrawable(null)
    if (previewBitmap?.isRecycled == false) previewBitmap?.recycle()
    previewBitmap = null
    super.onDetachedFromWindow()
  }

  private companion object {
    const val PLAY_TICK_MIN_DELTA = 1.0 / 45.0
    val RASTER_EFFECTS = setOf(
      "blur",
      "glitch",
      "letterbox",
      "vignette",
      "grain",
      "mirror",
    )
  }
}
