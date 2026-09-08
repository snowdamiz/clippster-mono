package app.clippster.editor.engine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import org.json.JSONObject

class FrameOverlayCompositor(context: Context) {
  private val bitmapCache = OverlayBitmapCache(context)

  fun compose(baseBitmap: Bitmap, frameJson: String): Bitmap {
    val output = baseBitmap.copy(Bitmap.Config.ARGB_8888, true)
    val frame = runCatching { JSONObject(frameJson) }.getOrNull() ?: return output
    OverlayFrameRenderer.draw(Canvas(output), frame, bitmapCache)
    return output
  }

  fun clear() {
    bitmapCache.clear()
  }
}
