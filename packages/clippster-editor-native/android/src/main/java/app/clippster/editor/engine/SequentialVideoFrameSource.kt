package app.clippster.editor.engine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Rect
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.util.Log
import kotlin.math.abs

/**
 * Sequential MediaCodec video decoder for export burn-in.
 *
 * [android.media.MediaMetadataRetriever.getFrameAtTime] re-seeks the container
 * for every call. On a long VOD that is minutes per short export. This decoder
 * seeks only when the requested timestamp jumps, then walks frames forward.
 */
internal class SequentialVideoFrameSource(private val context: Context) {
  private var session: Session? = null

  fun getFrame(sourceUri: String, sourceUs: Long): Bitmap? {
    val targetUs = sourceUs.coerceAtLeast(0L)
    val active = ensureSession(sourceUri)
    val cached = active.bitmap
    if (
      cached != null &&
      active.bitmapPtsUs >= 0L &&
      abs(active.bitmapPtsUs - targetUs) <= FRAME_MATCH_US
    ) {
      return cached
    }
    val decoder = if (needsSeek(active, targetUs)) seek(active, targetUs) else active
    return decodeUntil(decoder, targetUs)
  }

  fun release() {
    releaseSession()
  }

  private fun ensureSession(sourceUri: String): Session {
    val existing = session
    if (existing != null && existing.sourceUri == sourceUri) return existing
    releaseSession()

    val extractor = MediaExtractor()
    setDataSource(extractor, sourceUri)
    val track = findVideoTrack(extractor)
    require(track >= 0) { "No video track in $sourceUri" }
    extractor.selectTrack(track)
    val format = extractor.getTrackFormat(track)
    format.setInteger(
      MediaFormat.KEY_COLOR_FORMAT,
      MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible,
    )
    val mime = format.getString(MediaFormat.KEY_MIME)
      ?: error("Video track has no MIME type")
    val decoder = MediaCodec.createDecoderByType(mime)
    decoder.configure(format, null, null, 0)
    decoder.start()
    return Session(sourceUri, extractor, decoder).also { session = it }
  }

  private fun needsSeek(active: Session, targetUs: Long): Boolean {
    val last = active.lastPtsUs
    return last < 0L ||
      targetUs + SEEK_BACK_SLACK_US < last ||
      targetUs > last + FORWARD_JUMP_US
  }

  private fun seek(active: Session, targetUs: Long): Session {
    active.extractor.seekTo(targetUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
    try {
      active.decoder.flush()
    } catch (_: IllegalStateException) {
      val uri = active.sourceUri
      releaseSession()
      val rebuilt = ensureSession(uri)
      rebuilt.extractor.seekTo(targetUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      return rebuilt
    }
    active.inputEnded = false
    active.lastPtsUs = -1L
    active.bitmapPtsUs = -1L
    return active
  }

  private fun decodeUntil(active: Session, targetUs: Long): Bitmap? {
    val info = MediaCodec.BufferInfo()
    var loops = 0
    var best: Bitmap? = active.bitmap
    while (loops < MAX_LOOPS) {
      loops += 1
      if (!active.inputEnded) {
        val inputIndex = active.decoder.dequeueInputBuffer(CODEC_TIMEOUT_US)
        if (inputIndex >= 0) {
          val buffer = requireNotNull(active.decoder.getInputBuffer(inputIndex))
          val size = active.extractor.readSampleData(buffer, 0)
          if (size < 0) {
            active.decoder.queueInputBuffer(
              inputIndex,
              0,
              0,
              0L,
              MediaCodec.BUFFER_FLAG_END_OF_STREAM,
            )
            active.inputEnded = true
          } else {
            active.decoder.queueInputBuffer(
              inputIndex,
              0,
              size,
              active.extractor.sampleTime,
              active.extractor.sampleFlags,
            )
            active.extractor.advance()
          }
        }
      }

      when (val outputIndex = active.decoder.dequeueOutputBuffer(info, CODEC_TIMEOUT_US)) {
        MediaCodec.INFO_TRY_AGAIN_LATER,
        MediaCodec.INFO_OUTPUT_FORMAT_CHANGED,
        MediaCodec.INFO_OUTPUT_BUFFERS_CHANGED,
        -> Unit
        else -> if (outputIndex >= 0) {
          val endOfStream = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
          val pts = info.presentationTimeUs
          val render = info.size > 0 && (pts >= targetUs || endOfStream || active.inputEnded)
          if (info.size > 0) {
            val image = active.decoder.getOutputImage(outputIndex)
            if (image != null) {
              try {
                val pixels = active.pixelsFor(image.cropRect.width() * image.cropRect.height())
                best = YuvImageConverter.copyToBitmap(image, active.bitmap, pixels)
                active.bitmap = best
                active.bitmapPtsUs = pts
                active.lastPtsUs = pts
              } finally {
                image.close()
              }
            } else {
              Log.w(TAG, "Decoder produced no Image for $pts")
              active.lastPtsUs = pts
            }
          }
          active.decoder.releaseOutputBuffer(outputIndex, false)
          if (render || endOfStream) return best
        }
      }
    }
    return best
  }

  private fun setDataSource(extractor: MediaExtractor, source: String) {
    val uri = Uri.parse(source)
    if (uri.scheme == "content" || uri.scheme == "file") {
      extractor.setDataSource(context, uri, null)
    } else {
      extractor.setDataSource(source)
    }
  }

  private fun findVideoTrack(extractor: MediaExtractor): Int =
    (0 until extractor.trackCount).firstOrNull { index ->
      extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)
        ?.startsWith("video/") == true
    } ?: -1

  private fun releaseSession() {
    val current = session ?: return
    session = null
    current.bitmap?.recycle()
    current.bitmap = null
    runCatching { current.decoder.stop() }
    runCatching { current.decoder.release() }
    runCatching { current.extractor.release() }
  }

  private class Session(
    val sourceUri: String,
    val extractor: MediaExtractor,
    val decoder: MediaCodec,
    var lastPtsUs: Long = -1L,
    var inputEnded: Boolean = false,
    var bitmap: Bitmap? = null,
    var bitmapPtsUs: Long = -1L,
    var pixels: IntArray? = null,
  ) {
    fun pixelsFor(size: Int): IntArray {
      val existing = pixels
      if (existing != null && existing.size == size) return existing
      return IntArray(size).also { pixels = it }
    }
  }

  private companion object {
    const val TAG = "ClippsterExport"
    const val CODEC_TIMEOUT_US = 10_000L
    const val FRAME_MATCH_US = 20_000L
    const val SEEK_BACK_SLACK_US = 40_000L
    const val FORWARD_JUMP_US = 500_000L
    const val MAX_LOOPS = 240
  }
}

internal object YuvImageConverter {
  fun copyToBitmap(image: Image, reuse: Bitmap?, pixels: IntArray): Bitmap {
    val crop = image.cropRect
    val width = crop.width()
    val height = crop.height()
    require(pixels.size >= width * height) { "Pixel buffer is too small for ${width}x$height" }
    when (image.format) {
      ImageFormat.YUV_420_888 -> yuv420888ToArgb(image, crop, pixels)
      else -> error("Unsupported decoder image format ${image.format}")
    }
    val bitmap =
      if (reuse != null && reuse.width == width && reuse.height == height && !reuse.isRecycled) {
        reuse
      } else {
        reuse?.recycle()
        Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      }
    bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
    return bitmap
  }

  private fun yuv420888ToArgb(image: Image, crop: Rect, out: IntArray) {
    val yPlane = image.planes[0]
    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    val yBuffer = yPlane.buffer.duplicate()
    val uBuffer = uPlane.buffer.duplicate()
    val vBuffer = vPlane.buffer.duplicate()
    val yRow = yPlane.rowStride
    val yPix = yPlane.pixelStride
    val uRow = uPlane.rowStride
    val uPix = uPlane.pixelStride
    val vRow = vPlane.rowStride
    val vPix = vPlane.pixelStride
    val width = crop.width()
    val height = crop.height()
    val left = crop.left
    val top = crop.top
    var outIndex = 0
    for (row in 0 until height) {
      val yBase = (top + row) * yRow + left * yPix
      val chromaRow = (top + row) / 2
      val uBase = chromaRow * uRow
      val vBase = chromaRow * vRow
      for (col in 0 until width) {
        val y = yBuffer.get(yBase + col * yPix).toInt() and 0xff
        val chromaCol = (left + col) / 2
        val u = (uBuffer.get(uBase + chromaCol * uPix).toInt() and 0xff) - 128
        val v = (vBuffer.get(vBase + chromaCol * vPix).toInt() and 0xff) - 128
        val y1192 = 1192 * y
        out[outIndex++] = Color.argb(
          255,
          ((y1192 + 1634 * v) shr 10).coerceIn(0, 255),
          ((y1192 - 833 * v - 400 * u) shr 10).coerceIn(0, 255),
          ((y1192 + 2066 * u) shr 10).coerceIn(0, 255),
        )
      }
    }
  }
}
