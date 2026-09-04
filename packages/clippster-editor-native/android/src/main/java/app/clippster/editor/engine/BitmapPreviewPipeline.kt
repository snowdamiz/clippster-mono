package app.clippster.editor.engine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.media.MediaMetadataRetriever
import android.net.Uri
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Still-frame compositor for effects that cannot be rendered by TextureView. */
internal class BitmapPreviewPipeline(private val context: Context) {
  private val executor = Executors.newSingleThreadExecutor()
  private val generation = AtomicInteger()

  fun render(
    frame: JSONObject,
    width: Int,
    height: Int,
    onRendered: (Bitmap) -> Unit,
  ) {
    val request = generation.incrementAndGet()
    executor.execute {
      val bitmap = renderFrame(frame, width, height)
      if (request == generation.get()) {
        onRendered(bitmap)
      } else {
        bitmap.recycle()
      }
    }
  }

  private fun renderFrame(frame: JSONObject, width: Int, height: Int): Bitmap {
    val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    canvas.drawColor(Color.BLACK)
    val descriptor = frame.optJSONObject("canvas")
    val frameWidth = descriptor?.optDouble("width", width.toDouble()) ?: width.toDouble()
    val frameHeight = descriptor?.optDouble("height", height.toDouble()) ?: height.toDouble()
    val layers = frame.optJSONArray("layers") ?: return output
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    for (index in 0 until layers.length()) {
      val layer = layers.optJSONObject(index) ?: continue
      if (layer.optString("kind") != "video") continue
      val sourceUri = layer.optString("sourceUri")
      if (sourceUri.isBlank()) continue
      val retriever = MediaMetadataRetriever()
      try {
        val uri = Uri.parse(sourceUri)
        if (uri.scheme == "content" || uri.scheme == "file") {
          retriever.setDataSource(context, uri)
        } else {
          retriever.setDataSource(sourceUri)
        }
        val sourceUs = layer.optLong("sourceTick", 0L) * 1_000_000L /
          ClippsterEditorNativeModule.ticksPerSecond()
        val source = retriever.getFrameAtTime(
          sourceUs,
          MediaMetadataRetriever.OPTION_CLOSEST,
        ) ?: continue
        canvas.save()
        canvas.scale(
          (width / frameWidth).toFloat(),
          (height / frameHeight).toFloat(),
        )
        OverlayFrameRenderer.applyTransitionClip(canvas, layer)
        canvas.concat(OverlayFrameRenderer.layerMatrix(layer))
        OverlayFrameRenderer.drawBitmapLayer(
          canvas,
          layer,
          source,
          paint,
          frame.optLong("tick", layer.optLong("sourceTick", 0L)),
        )
        canvas.restore()
        source.recycle()
      } finally {
        retriever.release()
      }
    }
    return output
  }

  fun cancel() {
    generation.incrementAndGet()
  }

  fun release() {
    cancel()
    executor.shutdownNow()
  }
}
