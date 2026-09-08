package app.clippster.editor.engine

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.view.Surface
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Long-lived MediaCodec → Surface preview path.
 *
 * Keeps one extractor/decoder session per source URI. Scrubs seek+flush the
 * existing session; continuous play advances frames without tearing the codec
 * down every Choreographer tick.
 */
internal class MediaPreviewPipeline(private val context: Context) {
  private data class Session(
    val sourceUri: String,
    val extractor: MediaExtractor,
    val decoder: MediaCodec,
    var lastPresentedUs: Long = -1L,
    var inputEnded: Boolean = false,
  )

  private val executor = Executors.newSingleThreadExecutor()
  private val generation = AtomicInteger()

  @Volatile private var surface: Surface? = null
  @Volatile private var released = false
  @Volatile private var session: Session? = null

  fun attachSurface(value: Surface) {
    // Surface must be visible immediately — requestFrame can follow on the same call stack.
    surface?.release()
    surface = value
    generation.incrementAndGet()
    executor.execute { releaseSessionLocked() }
  }

  fun showFrame(
    sourceUri: String,
    timeSeconds: Double,
    precise: Boolean,
    onPresented: (Double) -> Unit,
    onError: (Throwable) -> Unit,
  ) {
    val request = generation.incrementAndGet()
    executor.execute {
      if (released || request != generation.get()) return@execute
      val targetUs = (timeSeconds.coerceAtLeast(0.0) * 1_000_000.0).toLong()
      try {
        presentFrame(sourceUri, targetUs, precise, request, onPresented)
      } catch (error: Throwable) {
        if (!released && request == generation.get()) {
          releaseSessionLocked()
          onError(error)
        }
      }
    }
  }

  private fun presentFrame(
    sourceUri: String,
    targetUs: Long,
    precise: Boolean,
    request: Int,
    onPresented: (Double) -> Unit,
  ) {
    var active = ensureSession(sourceUri)
    val last = active.lastPresentedUs
    val needsSeek =
      last < 0L ||
        targetUs + SEEK_BACK_SLACK_US < last ||
        (precise && kotlin.math.abs(targetUs - last) > PRECISE_RESYNC_US) ||
        (!precise && targetUs > last + FORWARD_JUMP_US)

    if (needsSeek) {
      active = seekSession(active, targetUs, precise)
    }

    val presentedUs = decodeUntil(active, targetUs, precise, request) ?: return
    if (!released && request == generation.get()) {
      active.lastPresentedUs = presentedUs
      onPresented(presentedUs / 1_000_000.0)
    }
  }

  private fun ensureSession(sourceUri: String): Session {
    val existing = session
    if (existing != null && existing.sourceUri == sourceUri) return existing
    releaseSessionLocked()

    val output = surface ?: error("Preview surface is not attached")
    val extractor = MediaExtractor()
    setDataSource(extractor, sourceUri)
    val track = findVideoTrack(extractor)
    require(track >= 0) { "No video track in $sourceUri" }
    extractor.selectTrack(track)
    val format = extractor.getTrackFormat(track)
    val mime = format.getString(MediaFormat.KEY_MIME)
      ?: error("Video track has no MIME type")

    val decoder = MediaCodec.createDecoderByType(mime)
    decoder.configure(format, output, null, 0)
    decoder.start()

    return Session(sourceUri, extractor, decoder).also { session = it }
  }

  private fun seekSession(active: Session, targetUs: Long, precise: Boolean): Session {
    val seekMode =
      if (precise) MediaExtractor.SEEK_TO_PREVIOUS_SYNC
      else MediaExtractor.SEEK_TO_CLOSEST_SYNC
    active.extractor.seekTo(targetUs, seekMode)
    try {
      active.decoder.flush()
    } catch (_: IllegalStateException) {
      // Flush can race a prior EOS; rebuild once.
      val uri = active.sourceUri
      releaseSessionLocked()
      val rebuilt = ensureSession(uri)
      rebuilt.extractor.seekTo(targetUs, seekMode)
      rebuilt.inputEnded = false
      rebuilt.lastPresentedUs = -1L
      return rebuilt
    }
    active.inputEnded = false
    active.lastPresentedUs = -1L
    return active
  }

  private fun decodeUntil(
    active: Session,
    targetUs: Long,
    precise: Boolean,
    request: Int,
  ): Long? {
    val info = MediaCodec.BufferInfo()
    var presented: Long? = null
    var loops = 0

    while (presented == null && !released && request == generation.get() && loops < MAX_LOOPS) {
      loops += 1
      if (!active.inputEnded) {
        val inputIndex = active.decoder.dequeueInputBuffer(10_000)
        if (inputIndex >= 0) {
          val buffer = active.decoder.getInputBuffer(inputIndex)
            ?: error("Decoder input buffer unavailable")
          val size = active.extractor.readSampleData(buffer, 0)
          if (size < 0) {
            active.decoder.queueInputBuffer(
              inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM,
            )
            active.inputEnded = true
          } else {
            active.decoder.queueInputBuffer(
              inputIndex, 0, size, active.extractor.sampleTime, active.extractor.sampleFlags,
            )
            active.extractor.advance()
          }
        }
      }

      val outputIndex = active.decoder.dequeueOutputBuffer(info, 10_000)
      if (outputIndex >= 0) {
        val pts = info.presentationTimeUs
        val atTarget = if (precise) {
          pts >= targetUs
        } else {
          // During play, render the first frame at/after the clock, or the
          // next available frame when we are catching up within one GOP.
          pts >= targetUs - PLAY_LEAD_US
        }
        val endOfStream = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
        active.decoder.releaseOutputBuffer(outputIndex, atTarget)
        if (atTarget) {
          presented = pts
        }
        if (endOfStream) break
      }
    }
    return presented
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
    (0 until extractor.trackCount).firstOrNull {
      extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)
        ?.startsWith("video/") == true
    } ?: -1

  private fun releaseSessionLocked() {
    val current = session ?: return
    session = null
    try {
      current.decoder.stop()
    } catch (_: IllegalStateException) {
    }
    try {
      current.decoder.release()
    } catch (_: IllegalStateException) {
    }
    try {
      current.extractor.release()
    } catch (_: IllegalStateException) {
    }
  }

  fun detachSurface() {
    generation.incrementAndGet()
    executor.execute {
      releaseSessionLocked()
      surface?.release()
      surface = null
    }
  }

  fun release() {
    released = true
    generation.incrementAndGet()
    executor.execute {
      releaseSessionLocked()
      surface?.release()
      surface = null
      executor.shutdown()
    }
  }

  private companion object {
    const val SEEK_BACK_SLACK_US = 40_000L
    const val PRECISE_RESYNC_US = 80_000L
    const val FORWARD_JUMP_US = 350_000L
    const val PLAY_LEAD_US = 45_000L
    const val MAX_LOOPS = 240
  }
}
