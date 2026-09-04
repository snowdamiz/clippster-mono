package app.clippster.editor.engine

import android.content.Context
import android.graphics.Canvas
import android.view.View
import org.json.JSONObject

class LayerOverlayView(context: Context) : View(context) {
  private val bitmapCache = OverlayBitmapCache(context)
  private var frame: JSONObject? = null

  init {
    setWillNotDraw(false)
  }

  fun setFrame(value: JSONObject?) {
    frame = value
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    OverlayFrameRenderer.draw(canvas, frame, bitmapCache)
  }

  override fun onDetachedFromWindow() {
    frame = null
    bitmapCache.clear()
    super.onDetachedFromWindow()
  }
}
