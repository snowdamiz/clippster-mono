package app.clippster.editor.engine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Random
import kotlin.math.max
import kotlin.math.roundToInt

internal class OverlayBitmapCache(private val context: Context) {
  private val bitmaps = mutableMapOf<String, Bitmap>()

  fun get(uriValue: String): Bitmap? {
    if (uriValue.isBlank()) return null
    bitmaps[uriValue]?.let { return it }
    val bitmap = runCatching {
      val uri = Uri.parse(uriValue)
      when (uri.scheme?.lowercase()) {
        "content", "android.resource" ->
          context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
        "file" -> uri.path?.let { BitmapFactory.decodeFile(it) }
        null, "" -> BitmapFactory.decodeFile(File(uriValue).path)
        else -> null
      }
    }.getOrNull() ?: return null
    bitmaps[uriValue] = bitmap
    return bitmap
  }

  fun clear() {
    bitmaps.values.forEach { bitmap ->
      if (!bitmap.isRecycled) bitmap.recycle()
    }
    bitmaps.clear()
  }
}

internal object OverlayFrameRenderer {
  fun draw(
    canvas: Canvas,
    frame: JSONObject?,
    bitmapCache: OverlayBitmapCache,
  ) {
    if (frame == null) return
    val frameCanvas = frame.optJSONObject("canvas") ?: return
    val canvasWidth = frameCanvas.optDouble("width", 0.0)
    val canvasHeight = frameCanvas.optDouble("height", 0.0)
    if (canvasWidth <= 0.0 || canvasHeight <= 0.0) return

    val outputScaleX = canvas.width / canvasWidth.toFloat()
    val outputScaleY = canvas.height / canvasHeight.toFloat()
    val imagePaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
    val layers = frame.optJSONArray("layers") ?: return
    for (index in 0 until layers.length()) {
      val layer = layers.optJSONObject(index) ?: continue
      val kind = layer.optString("kind")
      if (kind != "image" && kind != "text") continue

      canvas.save()
      canvas.scale(outputScaleX, outputScaleY)
      applyTransitionClip(canvas, layer)
      canvas.concat(layerMatrix(layer))
      when (kind) {
        "image" -> drawImage(
          canvas,
          layer,
          bitmapCache,
          imagePaint,
          frame.optLong("tick", layer.optLong("sourceTick", 0L)),
        )
        "text" -> drawText(canvas, layer, textPaint)
      }
      canvas.restore()
    }
  }

  fun layerMatrix(layer: JSONObject): Matrix {
    val transform = layer.optJSONObject("transform")
    return Matrix().apply {
      setValues(
        floatArrayOf(
          transform?.optDouble("m00", 1.0)?.toFloat() ?: 1f,
          transform?.optDouble("m01", 0.0)?.toFloat() ?: 0f,
          transform?.optDouble("m02", 0.0)?.toFloat() ?: 0f,
          transform?.optDouble("m10", 0.0)?.toFloat() ?: 0f,
          transform?.optDouble("m11", 1.0)?.toFloat() ?: 1f,
          transform?.optDouble("m12", 0.0)?.toFloat() ?: 0f,
          0f,
          0f,
          1f,
        ),
      )
    }
  }

  fun applyTransitionClip(canvas: Canvas, layer: JSONObject) {
    val transition = layer.optJSONObject("transition") ?: return
    if (transition.optString("kind") != "wipe") return
    val width = layer.optDouble("sourceWidth", 0.0).toFloat()
    val height = layer.optDouble("sourceHeight", 0.0).toFloat()
    if (width <= 0f || height <= 0f) return
    val bounds = RectF(0f, 0f, width, height)
    layerMatrix(layer).mapRect(bounds)
    val progress = transition.optDouble("horizontalWipeProgress", 1.0)
      .coerceIn(0.0, 1.0).toFloat()
    canvas.clipRect(bounds.left, bounds.top, bounds.left + bounds.width() * progress, bounds.bottom)
  }

  private fun drawImage(
    canvas: Canvas,
    layer: JSONObject,
    bitmapCache: OverlayBitmapCache,
    paint: Paint,
    frameTick: Long,
  ) {
    val bitmap = bitmapCache.get(layer.optString("sourceUri")) ?: return
    drawBitmapLayer(canvas, layer, bitmap, paint, frameTick)
  }

  fun drawBitmapLayer(
    canvas: Canvas,
    layer: JSONObject,
    bitmap: Bitmap,
    paint: Paint,
    frameTick: Long = layer.optLong("sourceTick", 0L),
  ) {
    paint.alpha = opacityAlpha(layer)
    paint.colorFilter = EffectColorMatrices.colorFilter(layer.optJSONArray("effects"))
    val width = layer.optDouble("sourceWidth", bitmap.width.toDouble()).toFloat()
    val height = layer.optDouble("sourceHeight", bitmap.height.toDouble()).toFloat()
    val effects = layer.optJSONArray("effects")
    canvas.save()
    if (effectIntensity(effects, "mirror") > 0f) {
      canvas.scale(-1f, 1f, width / 2f, height / 2f)
    }
    drawBitmapWithBlur(canvas, bitmap, paint, effectIntensity(effects, "blur"))
    drawGlitch(canvas, layer, bitmap, paint, effects, width, height, frameTick)
    drawStyleEffects(canvas, layer, effects, width, height)
    canvas.restore()
    paint.colorFilter = null
  }

  private fun drawBitmapWithBlur(
    canvas: Canvas,
    bitmap: Bitmap,
    paint: Paint,
    intensity: Float,
  ) {
    if (intensity <= 0f) {
      canvas.drawBitmap(bitmap, 0f, 0f, paint)
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && canvas.isHardwareAccelerated) {
      val node = RenderNode("clippster-blur").apply {
        setPosition(0, 0, bitmap.width, bitmap.height)
        setRenderEffect(
          RenderEffect.createBlurEffect(
            0.5f + intensity * 24f,
            0.5f + intensity * 24f,
            Shader.TileMode.CLAMP,
          ),
        )
      }
      node.beginRecording(bitmap.width, bitmap.height).also {
        it.drawBitmap(bitmap, 0f, 0f, paint)
        node.endRecording()
      }
      canvas.drawRenderNode(node)
      return
    }

    val scale = (1f - intensity * 0.88f).coerceIn(0.12f, 1f)
    val downsampled = Bitmap.createScaledBitmap(
      bitmap,
      max(1, (bitmap.width * scale).roundToInt()),
      max(1, (bitmap.height * scale).roundToInt()),
      true,
    )
    canvas.drawBitmap(
      downsampled,
      null,
      RectF(0f, 0f, bitmap.width.toFloat(), bitmap.height.toFloat()),
      paint,
    )
    if (downsampled !== bitmap) downsampled.recycle()
  }

  private fun drawGlitch(
    canvas: Canvas,
    layer: JSONObject,
    bitmap: Bitmap,
    paint: Paint,
    effects: JSONArray?,
    width: Float,
    height: Float,
    frameTick: Long,
  ) {
    val intensity = effectIntensity(effects, "glitch")
    if (intensity <= 0f || bitmap.width <= 0 || bitmap.height <= 0) return
    val seed = layer.optString("clipId").hashCode().toLong() * 31L + frameTick
    val random = Random(seed)
    val sliceCount = (3 + intensity * 3f).roundToInt().coerceIn(3, 6)
    val sourceScaleY = bitmap.height / height.coerceAtLeast(1f)
    canvas.save()
    canvas.clipRect(0f, 0f, width, height)
    repeat(sliceCount) {
      val sliceHeight = height * (0.018f + random.nextFloat() * 0.065f)
      val top = random.nextFloat() * max(1f, height - sliceHeight)
      val sourceTop = (top * sourceScaleY).roundToInt().coerceIn(0, bitmap.height - 1)
      val sourceBottom = ((top + sliceHeight) * sourceScaleY)
        .roundToInt().coerceIn(sourceTop + 1, bitmap.height)
      val offset = (random.nextFloat() * 2f - 1f) * width * 0.08f * intensity
      canvas.drawBitmap(
        bitmap,
        Rect(0, sourceTop, bitmap.width, sourceBottom),
        RectF(offset, top, width + offset, top + sliceHeight),
        paint,
      )
    }
    canvas.restore()
  }

  private fun drawText(canvas: Canvas, layer: JSONObject, paint: Paint) {
    val fontSize = layer.optDouble("fontSize", 0.0).toFloat()
    val text = layer.optString("text")
    if (fontSize <= 0f || text.isEmpty()) return
    val color = layer.optJSONObject("color")
    paint.textSize = fontSize
    paint.color = Color.rgb(
      colorComponent(color, "r"),
      colorComponent(color, "g"),
      colorComponent(color, "b"),
    )
    val colorAlpha = color?.optDouble("a", 1.0)?.coerceIn(0.0, 1.0) ?: 1.0
    paint.alpha = (opacityAlpha(layer) * colorAlpha).toInt().coerceIn(0, 255)
    val firstBaseline = -paint.fontMetrics.ascent
    val lineHeight = fontSize * 1.2f
    text.split('\n').forEachIndexed { lineIndex, line ->
      canvas.drawText(line, 0f, firstBaseline + lineHeight * lineIndex, paint)
    }
  }

  private fun colorComponent(color: JSONObject?, key: String): Int =
    ((color?.optDouble(key, 1.0) ?: 1.0).coerceIn(0.0, 1.0) * 255.0).toInt()

  private fun opacityAlpha(layer: JSONObject): Int =
    (layer.optDouble("opacity", 1.0).coerceIn(0.0, 1.0) * 255.0).toInt()

  private fun drawStyleEffects(
    canvas: Canvas,
    layer: JSONObject,
    effects: JSONArray?,
    width: Float,
    height: Float,
  ) {
    val opacity = opacityAlpha(layer)
    val vignette = effectIntensity(effects, "vignette")
    if (vignette > 0f) {
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        alpha = (opacity * vignette).toInt().coerceIn(0, 255)
        shader = RadialGradient(
          width / 2f,
          height / 2f,
          max(width, height) * 0.72f,
          intArrayOf(Color.TRANSPARENT, Color.TRANSPARENT, Color.BLACK),
          floatArrayOf(0f, 0.45f, 1f),
          Shader.TileMode.CLAMP,
        )
      }
      canvas.drawRect(0f, 0f, width, height, paint)
    }

    val grain = effectIntensity(effects, "grain")
    if (grain > 0f) {
      val random = Random(layer.optString("clipId").hashCode().toLong())
      val paint = Paint().apply {
        color = Color.WHITE
        alpha = (opacity * grain * 0.28f).toInt().coerceIn(0, 255)
        strokeWidth = max(1f, minOf(width, height) / 720f)
      }
      val samples = (width * height / 750f).toInt().coerceIn(300, 5_000)
      repeat(samples) {
        paint.color = if (random.nextBoolean()) Color.WHITE else Color.BLACK
        canvas.drawPoint(random.nextFloat() * width, random.nextFloat() * height, paint)
      }
    }

    val letterbox = effectIntensity(effects, "letterbox")
    if (letterbox > 0f) {
      val barHeight = height * max(0.06f, letterbox * 0.18f)
      val paint = Paint().apply {
        color = Color.BLACK
        alpha = opacity
      }
      canvas.drawRect(0f, 0f, width, barHeight, paint)
      canvas.drawRect(0f, height - barHeight, width, height, paint)
    }
  }

  private fun effectIntensity(effects: JSONArray?, type: String): Float {
    if (effects == null) return 0f
    for (index in 0 until effects.length()) {
      val effect = effects.optJSONObject(index) ?: continue
      if (effect.optString("type").equals(type, ignoreCase = true)) {
        return (effect.optDouble("intensity", 100.0) / 100.0)
          .toFloat().coerceIn(0f, 1f)
      }
    }
    return 0f
  }
}
