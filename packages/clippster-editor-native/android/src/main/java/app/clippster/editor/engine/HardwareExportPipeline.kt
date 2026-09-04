package app.clippster.editor.engine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.net.Uri
import android.util.Log
import android.view.Surface
import org.json.JSONObject
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.CancellationException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/**
 * Hardware H.264 export pipeline.
 *
 * Video is decoded to the encoder input Surface and encoded as H.264. AAC audio
 * is copied without generation loss after applying the same trim and speed
 * timestamp mapping as video.
 */
class HardwareExportPipeline {
  private val cancelled = AtomicBoolean(false)

  fun export(
    inputPath: String,
    outputPath: String,
    onProgress: (Double) -> Unit,
  ): List<String> {
    cancelled.set(false)
    val source = inspectSource(inputPath)
    return transcode(
      inputPath = inputPath,
      outputPath = outputPath,
      trimStartUs = 0L,
      trimEndUs = source.durationUs,
      speed = 1.0,
      outputWidth = source.width,
      outputHeight = source.height,
      fps = source.frameRate,
      onProgress = onProgress,
    )
  }

  fun exportScene(
    context: Context,
    sceneJson: String,
    outputPath: String,
    width: Int,
    height: Int,
    fps: Int,
    onProgress: (Double) -> Unit,
  ): List<String> {
    require(width > 0 && height > 0 && fps > 0) { "Invalid export dimensions" }
    cancelled.set(false)
    val clips = parseScene(sceneJson)
    if (sceneRequiresOverlayBurnIn(sceneJson)) {
      return exportSceneWithOverlayBurnIn(
        context = context,
        sceneJson = sceneJson,
        clips = clips,
        outputPath = outputPath,
        width = width,
        height = height,
        fps = fps,
        onProgress = onProgress,
      )
    }
    if (clips.size == 1) {
      val clip = clips.single()
      return transcode(
        inputPath = clip.sourceUri,
        outputPath = outputPath,
        trimStartUs = ticksToUs(clip.sourceStart),
        trimEndUs = ticksToUs(clip.sourceEnd),
        speed = clip.speed,
        outputWidth = width,
        outputHeight = height,
        fps = fps,
        onProgress = onProgress,
      )
    }

    val destination = localPath(outputPath)
    val outputFile = File(destination)
    outputFile.parentFile?.mkdirs()
    val segmentFiles = mutableListOf<File>()
    val clipDurationsUs = clips.map { clip ->
      ((ticksToUs(clip.sourceEnd) - ticksToUs(clip.sourceStart)) / clip.speed)
        .toLong()
        .coerceAtLeast(1L)
    }
    val totalDurationUs = clipDurationsUs.sum().coerceAtLeast(1L)
    var completedDurationUs = 0L

    try {
      clips.forEachIndexed { index, clip ->
        throwIfCancelled()
        val segment = File(
          outputFile.parentFile,
          "${outputFile.nameWithoutExtension}.segment-$index-${System.nanoTime()}.mp4",
        )
        segmentFiles += segment
        val clipDurationUs = clipDurationsUs[index]
        transcode(
          inputPath = clip.sourceUri,
          outputPath = segment.path,
          trimStartUs = ticksToUs(clip.sourceStart),
          trimEndUs = ticksToUs(clip.sourceEnd),
          speed = clip.speed,
          outputWidth = width,
          outputHeight = height,
          fps = fps,
          onProgress = { clipProgress ->
            onProgress(
              TRANSCODE_PROGRESS_WEIGHT *
                (completedDurationUs + clipDurationUs * clipProgress) / totalDurationUs,
            )
          },
        )
        completedDurationUs += clipDurationUs
      }
      concatenateSegments(
        segments = segmentFiles,
        segmentDurationsUs = clipDurationsUs,
        outputPath = destination,
        onProgress = { muxProgress ->
          onProgress(
            TRANSCODE_PROGRESS_WEIGHT +
              (1.0 - TRANSCODE_PROGRESS_WEIGHT) * muxProgress,
          )
        },
      )
      onProgress(1.0)
      return listOf(destination)
    } catch (error: Throwable) {
      outputFile.delete()
      throw error
    } finally {
      segmentFiles.forEach { segment -> runCatching { segment.delete() } }
    }
  }

  fun cancel() {
    cancelled.set(true)
  }

  fun drawOverlaysOntoBitmap(
    context: Context,
    baseBitmap: Bitmap,
    frameJson: String,
  ): Bitmap {
    val compositor = FrameOverlayCompositor(context)
    return try {
      compositor.compose(baseBitmap, frameJson)
    } finally {
      compositor.clear()
    }
  }

  private fun exportSceneWithOverlayBurnIn(
    context: Context,
    sceneJson: String,
    clips: List<SceneSource>,
    outputPath: String,
    width: Int,
    height: Int,
    fps: Int,
    onProgress: (Double) -> Unit,
  ): List<String> {
    val destination = localPath(outputPath)
    val outputFile = File(destination)
    outputFile.parentFile?.mkdirs()
    outputFile.delete()
    val videoOnlyFile = File(
      outputFile.parentFile,
      "${outputFile.nameWithoutExtension}.overlay-video-${System.nanoTime()}.mp4",
    )
    try {
      encodeOverlayVideo(
        context = context,
        sceneJson = sceneJson,
        durationTicks = clips.maxOf(SceneSource::timelineEnd),
        outputPath = videoOnlyFile.path,
        width = width,
        height = height,
        fps = fps,
      ) { progress ->
        onProgress(progress * OVERLAY_VIDEO_PROGRESS_WEIGHT)
      }
      muxOverlayVideoAndAudio(
        videoPath = videoOnlyFile.path,
        clips = clips,
        outputPath = destination,
      ) { progress ->
        onProgress(
          OVERLAY_VIDEO_PROGRESS_WEIGHT +
            progress * (1.0 - OVERLAY_VIDEO_PROGRESS_WEIGHT),
        )
      }
      onProgress(1.0)
      return listOf(destination)
    } catch (error: Throwable) {
      outputFile.delete()
      throw error
    } finally {
      videoOnlyFile.delete()
    }
  }

  private fun encodeOverlayVideo(
    context: Context,
    sceneJson: String,
    durationTicks: Long,
    outputPath: String,
    width: Int,
    height: Int,
    fps: Int,
    onProgress: (Double) -> Unit,
  ) {
    val encodedWidth = even(width)
    val encodedHeight = even(height)
    val totalFrames = kotlin.math.ceil(
      durationTicks.toDouble() * fps / TICKS_PER_SECOND,
    ).toLong().coerceAtLeast(1L)
    val codecInfo = findBitmapAvcEncoder(encodedWidth, encodedHeight)
    val colorFormat = selectBitmapColorFormat(codecInfo, MediaFormat.MIMETYPE_VIDEO_AVC)
    val format = MediaFormat.createVideoFormat(
      MediaFormat.MIMETYPE_VIDEO_AVC,
      encodedWidth,
      encodedHeight,
    ).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, colorFormat)
      setInteger(MediaFormat.KEY_BIT_RATE, bitrateFor(encodedWidth, encodedHeight, fps))
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }

    var encoder: MediaCodec? = null
    var muxer: MediaMuxer? = null
    var muxerStarted = false
    val retrievers = mutableMapOf<String, MediaMetadataRetriever>()
    val compositor = FrameOverlayCompositor(context)
    try {
      File(outputPath).delete()
      val activeEncoder = MediaCodec.createByCodecName(codecInfo.name)
      encoder = activeEncoder
      activeEncoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      val outputMuxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = outputMuxer
      activeEncoder.start()

      val info = MediaCodec.BufferInfo()
      var muxerTrack = -1
      var submittedFrames = 0L
      var inputEnded = false
      var outputEnded = false
      var idleIterations = 0
      while (!outputEnded) {
        throwIfCancelled()
        var madeProgress = false
        if (!inputEnded) {
          val inputIndex = activeEncoder.dequeueInputBuffer(CODEC_TIMEOUT_US)
          if (inputIndex >= 0) {
            if (submittedFrames < totalFrames) {
              val tick = submittedFrames * TICKS_PER_SECOND / fps
              val frameJson = ClippsterEditorNativeModule.evaluateDocument(
                sceneJson,
                tick,
                false,
              )
              val bitmap = renderEvaluatedFrame(
                context,
                frameJson,
                encodedWidth,
                encodedHeight,
                retrievers,
                compositor,
              )
              val inputBuffer = requireNotNull(activeEncoder.getInputBuffer(inputIndex))
              inputBuffer.clear()
              bitmapToYuv420(bitmap, inputBuffer, colorFormat)
              bitmap.recycle()
              val ptsUs = submittedFrames * 1_000_000L / fps
              activeEncoder.queueInputBuffer(
                inputIndex,
                0,
                encodedWidth * encodedHeight * 3 / 2,
                ptsUs,
                0,
              )
              submittedFrames++
              onProgress(submittedFrames.toDouble() / totalFrames)
            } else {
              activeEncoder.queueInputBuffer(
                inputIndex,
                0,
                0,
                totalFrames * 1_000_000L / fps,
                MediaCodec.BUFFER_FLAG_END_OF_STREAM,
              )
              inputEnded = true
            }
            madeProgress = true
          }
        }

        var drain = true
        while (drain) {
          when (val outputIndex = activeEncoder.dequeueOutputBuffer(info, CODEC_TIMEOUT_US)) {
            MediaCodec.INFO_TRY_AGAIN_LATER -> drain = false
            MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
              check(!muxerStarted) { "Overlay encoder output format changed twice" }
              muxerTrack = outputMuxer.addTrack(activeEncoder.outputFormat)
              outputMuxer.start()
              muxerStarted = true
              madeProgress = true
            }
            else -> if (outputIndex >= 0) {
              val outputBuffer = requireNotNull(activeEncoder.getOutputBuffer(outputIndex))
              if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
              if (info.size > 0) {
                check(muxerStarted && muxerTrack >= 0) { "Overlay video muxer is not ready" }
                outputBuffer.position(info.offset)
                outputBuffer.limit(info.offset + info.size)
                outputMuxer.writeSampleData(muxerTrack, outputBuffer, info)
              }
              outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
              activeEncoder.releaseOutputBuffer(outputIndex, false)
              madeProgress = true
            }
          }
        }
        idleIterations = if (madeProgress) 0 else idleIterations + 1
        check(idleIterations < MAX_IDLE_ITERATIONS) { "Overlay video encoder stalled" }
      }
      check(muxerStarted) { "Overlay encoder produced no output" }
    } finally {
      compositor.clear()
      retrievers.values.forEach { runCatching { it.release() } }
      runCatching { encoder?.stop() }
      runCatching { encoder?.release() }
      runCatching { if (muxerStarted) muxer?.stop() }
      runCatching { muxer?.release() }
    }
  }

  private fun renderEvaluatedFrame(
    context: Context,
    frameJson: String,
    width: Int,
    height: Int,
    retrievers: MutableMap<String, MediaMetadataRetriever>,
    compositor: FrameOverlayCompositor,
  ): Bitmap {
    val frame = JSONObject(frameJson)
    frame.optString("error").takeIf(String::isNotBlank)?.let(::error)
    val base = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(base)
    canvas.drawColor(Color.BLACK)
    val frameCanvas = frame.optJSONObject("canvas")
    val frameWidth = frameCanvas?.optDouble("width", width.toDouble()) ?: width.toDouble()
    val frameHeight = frameCanvas?.optDouble("height", height.toDouble()) ?: height.toDouble()
    val layers = frame.optJSONArray("layers")
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    if (layers != null) {
      for (index in 0 until layers.length()) {
        val layer = layers.optJSONObject(index) ?: continue
        if (layer.optString("kind") != "video") continue
        val sourceUri = layer.optString("sourceUri")
        if (sourceUri.isBlank()) continue
        val retriever = retrievers.getOrPut(sourceUri) {
          MediaMetadataRetriever().apply {
            val uri = Uri.parse(sourceUri)
            if (uri.scheme == "content" || uri.scheme == "file") {
              setDataSource(context, uri)
            } else {
              setDataSource(localPath(sourceUri))
            }
          }
        }
        val sourceUs = ticksToUs(layer.optLong("sourceTick", 0L))
        val sourceBitmap = retriever.getFrameAtTime(
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
          sourceBitmap,
          paint,
          frame.optLong("tick", layer.optLong("sourceTick", 0L)),
        )
        canvas.restore()
        sourceBitmap.recycle()
      }
    }
    val composed = compositor.compose(base, frameJson)
    base.recycle()
    return composed
  }

  private fun bitmapToYuv420(
    bitmap: Bitmap,
    output: ByteBuffer,
    colorFormat: Int,
  ) {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val frameSize = width * height
    val semiPlanar =
      colorFormat == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar
    for (y in 0 until height) {
      for (x in 0 until width) {
        val color = pixels[y * width + x]
        val red = Color.red(color)
        val green = Color.green(color)
        val blue = Color.blue(color)
        output.put(
          (y * width + x),
          (((66 * red + 129 * green + 25 * blue + 128) shr 8) + 16)
            .coerceIn(0, 255).toByte(),
        )
        if (y % 2 == 0 && x % 2 == 0) {
          val chromaIndex = y / 2 * (width / 2) + x / 2
          val u = (((-38 * red - 74 * green + 112 * blue + 128) shr 8) + 128)
            .coerceIn(0, 255).toByte()
          val v = (((112 * red - 94 * green - 18 * blue + 128) shr 8) + 128)
            .coerceIn(0, 255).toByte()
          if (semiPlanar) {
            output.put(frameSize + chromaIndex * 2, u)
            output.put(frameSize + chromaIndex * 2 + 1, v)
          } else {
            output.put(frameSize + chromaIndex, u)
            output.put(frameSize + frameSize / 4 + chromaIndex, v)
          }
        }
      }
    }
    output.position(frameSize * 3 / 2)
  }

  private fun transcode(
    inputPath: String,
    outputPath: String,
    trimStartUs: Long,
    trimEndUs: Long,
    speed: Double,
    outputWidth: Int,
    outputHeight: Int,
    fps: Int,
    onProgress: (Double) -> Unit,
  ): List<String> {
    require(speed.isFinite() && speed > 0.0) { "Video speed must be greater than zero" }
    require(trimStartUs >= 0L && trimEndUs > trimStartUs) { "Invalid source trim range" }
    require(outputWidth > 0 && outputHeight > 0 && fps > 0) { "Invalid output video format" }

    val sourcePath = localPath(inputPath)
    require(File(sourcePath).isFile) { "Input file does not exist: $sourcePath" }
    val destination = localPath(outputPath)
    File(destination).parentFile?.mkdirs()
    File(destination).delete()

    var videoExtractor: MediaExtractor? = null
    var audioExtractor: MediaExtractor? = null
    var decoder: MediaCodec? = null
    var encoder: MediaCodec? = null
    var encoderInputSurface: Surface? = null
    var muxer: MediaMuxer? = null
    var muxerStarted = false

    try {
      onProgress(0.0)
      val activeVideoExtractor = MediaExtractor().apply { setDataSource(sourcePath) }
      videoExtractor = activeVideoExtractor
      val videoTrack = findTrack(activeVideoExtractor, "video/")
      require(videoTrack >= 0) { "Input contains no video track" }
      val inputVideoFormat = activeVideoExtractor.getTrackFormat(videoTrack)
      val inputMime = inputVideoFormat.getString(MediaFormat.KEY_MIME)
        ?: error("Video track has no MIME type")
      val sourceDurationUs = inputVideoFormat.longOr(MediaFormat.KEY_DURATION, trimEndUs)
      require(sourceDurationUs > trimStartUs) { "Trim start is beyond the video duration" }
      val effectiveEndUs = minOf(trimEndUs, sourceDurationUs)
      val sourceWindowUs = effectiveEndUs - trimStartUs

      val activeAudioExtractor = MediaExtractor().apply { setDataSource(sourcePath) }
      audioExtractor = activeAudioExtractor
      val audioTrack = findTrack(activeAudioExtractor, "audio/")
      val audioFormat = audioTrack.takeIf { it >= 0 }?.let(activeAudioExtractor::getTrackFormat)
      val copyAudio = audioFormat?.getString(MediaFormat.KEY_MIME) == MediaFormat.MIMETYPE_AUDIO_AAC
      if (audioFormat != null && !copyAudio) {
        Log.w(TAG, "Skipping non-AAC audio track: ${audioFormat.getString(MediaFormat.KEY_MIME)}")
      }

      val outputMuxer = MediaMuxer(destination, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = outputMuxer
      val muxerAudioTrack =
        if (copyAudio) outputMuxer.addTrack(requireNotNull(audioFormat)) else -1

      val encodedWidth = even(outputWidth)
      val encodedHeight = even(outputHeight)
      val outputVideoFormat = MediaFormat.createVideoFormat(
        MediaFormat.MIMETYPE_VIDEO_AVC,
        encodedWidth,
        encodedHeight,
      ).apply {
        setInteger(
          MediaFormat.KEY_COLOR_FORMAT,
          MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface,
        )
        setInteger(MediaFormat.KEY_BIT_RATE, bitrateFor(encodedWidth, encodedHeight, fps))
        setInteger(MediaFormat.KEY_FRAME_RATE, fps)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
      }

      val videoEncoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC).apply {
        configure(outputVideoFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      }
      encoder = videoEncoder
      val inputSurface = videoEncoder.createInputSurface()
      encoderInputSurface = inputSurface
      val videoDecoder = MediaCodec.createDecoderByType(inputMime).apply {
        configure(inputVideoFormat, inputSurface, null, 0)
      }
      decoder = videoDecoder

      activeVideoExtractor.selectTrack(videoTrack)
      activeVideoExtractor.seekTo(trimStartUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      videoEncoder.start()
      videoDecoder.start()

      val decoderInfo = MediaCodec.BufferInfo()
      val encoderInfo = MediaCodec.BufferInfo()
      var muxerVideoTrack = -1
      var extractorDone = false
      var decoderDone = false
      var encoderDone = false
      var idleIterations = 0

      while (!encoderDone) {
        throwIfCancelled()
        var madeProgress = false

        if (!extractorDone) {
          val inputIndex = videoDecoder.dequeueInputBuffer(CODEC_TIMEOUT_US)
          if (inputIndex >= 0) {
            val inputBuffer = requireNotNull(videoDecoder.getInputBuffer(inputIndex))
            val sampleTimeUs = activeVideoExtractor.sampleTime
            if (sampleTimeUs < 0L || sampleTimeUs >= effectiveEndUs) {
              videoDecoder.queueInputBuffer(
                inputIndex,
                0,
                0,
                0L,
                MediaCodec.BUFFER_FLAG_END_OF_STREAM,
              )
              extractorDone = true
            } else {
              inputBuffer.clear()
              val sampleSize = activeVideoExtractor.readSampleData(inputBuffer, 0)
              if (sampleSize < 0) {
                videoDecoder.queueInputBuffer(
                  inputIndex,
                  0,
                  0,
                  0L,
                  MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                )
                extractorDone = true
              } else {
                videoDecoder.queueInputBuffer(
                  inputIndex,
                  0,
                  sampleSize,
                  sampleTimeUs,
                  activeVideoExtractor.sampleFlags,
                )
                activeVideoExtractor.advance()
              }
            }
            madeProgress = true
          }
        }

        if (!decoderDone) {
          when (val outputIndex = videoDecoder.dequeueOutputBuffer(decoderInfo, CODEC_TIMEOUT_US)) {
            MediaCodec.INFO_OUTPUT_FORMAT_CHANGED,
            MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
            else -> if (outputIndex >= 0) {
              val eos = decoderInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
              val inWindow = decoderInfo.size > 0 &&
                decoderInfo.presentationTimeUs >= trimStartUs &&
                decoderInfo.presentationTimeUs < effectiveEndUs
              if (inWindow) {
                val outputPtsUs = scaleTimestamp(decoderInfo.presentationTimeUs, trimStartUs, speed)
                // Scene exports only use this surface path when no graph overlays exist.
                videoDecoder.releaseOutputBuffer(outputIndex, outputPtsUs * 1_000L)
                onProgress(
                  ((decoderInfo.presentationTimeUs - trimStartUs).toDouble()
                    .div(sourceWindowUs) * VIDEO_PROGRESS_WEIGHT)
                    .coerceIn(0.0, VIDEO_PROGRESS_WEIGHT),
                )
              } else {
                videoDecoder.releaseOutputBuffer(outputIndex, false)
              }
              if (eos) {
                decoderDone = true
                videoEncoder.signalEndOfInputStream()
              }
              madeProgress = true
            }
          }
        }

        var drainEncoder = true
        while (drainEncoder) {
          when (val outputIndex = videoEncoder.dequeueOutputBuffer(encoderInfo, CODEC_TIMEOUT_US)) {
            MediaCodec.INFO_TRY_AGAIN_LATER -> drainEncoder = false
            MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
              check(!muxerStarted) { "Encoder output format changed twice" }
              muxerVideoTrack = outputMuxer.addTrack(videoEncoder.outputFormat)
              outputMuxer.start()
              muxerStarted = true
              madeProgress = true
            }
            else -> if (outputIndex >= 0) {
              val outputBuffer = requireNotNull(videoEncoder.getOutputBuffer(outputIndex))
              if (encoderInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                encoderInfo.size = 0
              }
              if (encoderInfo.size > 0) {
                check(muxerStarted && muxerVideoTrack >= 0) { "Muxer is not ready for video" }
                outputBuffer.position(encoderInfo.offset)
                outputBuffer.limit(encoderInfo.offset + encoderInfo.size)
                outputMuxer.writeSampleData(muxerVideoTrack, outputBuffer, encoderInfo)
              }
              encoderDone = encoderInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
              videoEncoder.releaseOutputBuffer(outputIndex, false)
              madeProgress = true
            }
          }
        }

        idleIterations = if (madeProgress) 0 else idleIterations + 1
        check(idleIterations < MAX_IDLE_ITERATIONS) { "Video codec pipeline stalled" }
      }

      check(muxerStarted) { "Encoder produced no output format" }
      if (copyAudio) {
        copyAacAudio(
          extractor = activeAudioExtractor,
          trackIndex = audioTrack,
          muxer = outputMuxer,
          muxerTrack = muxerAudioTrack,
          trimStartUs = trimStartUs,
          trimEndUs = effectiveEndUs,
          speed = speed,
          onProgress = onProgress,
        )
      }
      onProgress(1.0)
      return listOf(destination)
    } catch (error: Throwable) {
      File(destination).delete()
      throw error
    } finally {
      runCatching { decoder?.stop() }
      runCatching { encoder?.stop() }
      runCatching { decoder?.release() }
      runCatching { encoder?.release() }
      runCatching { encoderInputSurface?.release() }
      runCatching {
        if (muxerStarted) muxer?.stop()
      }
      runCatching { muxer?.release() }
      runCatching { videoExtractor?.release() }
      runCatching { audioExtractor?.release() }
    }
  }

  private fun copyAacAudio(
    extractor: MediaExtractor,
    trackIndex: Int,
    muxer: MediaMuxer,
    muxerTrack: Int,
    trimStartUs: Long,
    trimEndUs: Long,
    speed: Double,
    onProgress: (Double) -> Unit,
  ) {
    extractor.selectTrack(trackIndex)
    extractor.seekTo(trimStartUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
    val format = extractor.getTrackFormat(trackIndex)
    val bufferSize = max(
      DEFAULT_AUDIO_BUFFER_SIZE,
      format.intOr(MediaFormat.KEY_MAX_INPUT_SIZE, DEFAULT_AUDIO_BUFFER_SIZE),
    )
    val buffer = ByteBuffer.allocateDirect(bufferSize)
    val info = MediaCodec.BufferInfo()
    val durationUs = (trimEndUs - trimStartUs).coerceAtLeast(1L)

    while (true) {
      throwIfCancelled()
      val sampleTimeUs = extractor.sampleTime
      if (sampleTimeUs < 0L || sampleTimeUs >= trimEndUs) break
      if (sampleTimeUs < trimStartUs) {
        if (!extractor.advance()) break
        continue
      }
      buffer.clear()
      val size = extractor.readSampleData(buffer, 0)
      if (size < 0) break
      info.set(
        0,
        size,
        scaleTimestamp(sampleTimeUs, trimStartUs, speed),
        extractor.sampleFlags,
      )
      buffer.position(0)
      buffer.limit(size)
      muxer.writeSampleData(muxerTrack, buffer, info)
      onProgress(
        VIDEO_PROGRESS_WEIGHT +
          ((sampleTimeUs - trimStartUs).toDouble() / durationUs) *
          (1.0 - VIDEO_PROGRESS_WEIGHT),
      )
      if (!extractor.advance()) break
    }
    extractor.unselectTrack(trackIndex)
  }

  private fun muxOverlayVideoAndAudio(
    videoPath: String,
    clips: List<SceneSource>,
    outputPath: String,
    onProgress: (Double) -> Unit,
  ) {
    val videoFormat = inspectSegment(File(videoPath)).videoFormat
    val audioFormats = clips.map { clip -> inspectAacFormat(clip.sourceUri) }
    val referenceAudioFormat = audioFormats.firstNotNullOfOrNull { it }
    var muxer: MediaMuxer? = null
    var muxerStarted = false
    try {
      File(outputPath).delete()
      val outputMuxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = outputMuxer
      val videoTrack = outputMuxer.addTrack(videoFormat)
      val audioTrack = referenceAudioFormat?.let(outputMuxer::addTrack) ?: -1
      outputMuxer.start()
      muxerStarted = true
      appendTrack(
        sourcePath = videoPath,
        trackPrefix = "video/",
        muxer = outputMuxer,
        muxerTrack = videoTrack,
        presentationOffsetUs = 0L,
        previousPtsUs = -1L,
      )
      onProgress(if (referenceAudioFormat == null) 1.0 else 0.25)

      if (referenceAudioFormat != null) {
        var lastAudioPtsUs = -1L
        clips.forEachIndexed { index, clip ->
          throwIfCancelled()
          val audioFormat = audioFormats[index]
          when {
            audioFormat == null ->
              Log.w(TAG, "Overlay export clip $index has no AAC audio")
            !audioFormatsCompatible(referenceAudioFormat, audioFormat) ->
              Log.w(TAG, "Overlay export clip $index has incompatible AAC audio")
            else -> lastAudioPtsUs = appendAacClip(
              clip = clip,
              muxer = outputMuxer,
              muxerTrack = audioTrack,
              previousPtsUs = lastAudioPtsUs,
            )
          }
          onProgress(0.25 + 0.75 * (index + 1).toDouble() / clips.size)
        }
      }
    } finally {
      runCatching { if (muxerStarted) muxer?.stop() }
      runCatching { muxer?.release() }
    }
  }

  private fun appendAacClip(
    clip: SceneSource,
    muxer: MediaMuxer,
    muxerTrack: Int,
    previousPtsUs: Long,
  ): Long {
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(localPath(clip.sourceUri))
      val track = findTrack(extractor, "audio/")
      if (track < 0) return previousPtsUs
      val format = extractor.getTrackFormat(track)
      val buffer = ByteBuffer.allocateDirect(
        max(
          DEFAULT_AUDIO_BUFFER_SIZE,
          format.intOr(MediaFormat.KEY_MAX_INPUT_SIZE, DEFAULT_AUDIO_BUFFER_SIZE),
        ),
      )
      val sourceStartUs = ticksToUs(clip.sourceStart)
      val sourceEndUs = ticksToUs(clip.sourceEnd)
      val timelineStartUs = ticksToUs(clip.timelineStart)
      val info = MediaCodec.BufferInfo()
      extractor.selectTrack(track)
      extractor.seekTo(sourceStartUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      var lastPtsUs = previousPtsUs
      while (true) {
        throwIfCancelled()
        val sampleTimeUs = extractor.sampleTime
        if (sampleTimeUs < 0L || sampleTimeUs >= sourceEndUs) break
        if (sampleTimeUs < sourceStartUs) {
          if (!extractor.advance()) break
          continue
        }
        buffer.clear()
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) break
        val mappedPtsUs = timelineStartUs +
          scaleTimestamp(sampleTimeUs, sourceStartUs, clip.speed)
        val outputPtsUs = max(mappedPtsUs, lastPtsUs + 1L)
        info.set(0, size, outputPtsUs, extractor.sampleFlags)
        buffer.position(0)
        buffer.limit(size)
        muxer.writeSampleData(muxerTrack, buffer, info)
        lastPtsUs = outputPtsUs
        if (!extractor.advance()) break
      }
      return lastPtsUs
    } finally {
      extractor.release()
    }
  }

  private fun inspectAacFormat(sourceUri: String): MediaFormat? {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(localPath(sourceUri))
      val track = findTrack(extractor, "audio/")
      if (track < 0) null else extractor.getTrackFormat(track).takeIf {
        it.getString(MediaFormat.KEY_MIME) == MediaFormat.MIMETYPE_AUDIO_AAC
      }
    } finally {
      extractor.release()
    }
  }

  private fun concatenateSegments(
    segments: List<File>,
    segmentDurationsUs: List<Long>,
    outputPath: String,
    onProgress: (Double) -> Unit,
  ) {
    require(segments.isNotEmpty()) { "No segments to concatenate" }
    val segmentFormats = segments.map(::inspectSegment)
    val firstVideoFormat = segmentFormats.first().videoFormat
    val referenceAudioFormat = segmentFormats.firstNotNullOfOrNull { it.audioFormat }
    val outputFile = File(outputPath)
    outputFile.delete()

    var muxer: MediaMuxer? = null
    var muxerStarted = false
    try {
      val outputMuxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = outputMuxer
      val videoTrack = outputMuxer.addTrack(firstVideoFormat)
      val audioTrack = referenceAudioFormat?.let(outputMuxer::addTrack) ?: -1
      outputMuxer.start()
      muxerStarted = true

      var presentationOffsetUs = 0L
      var lastVideoPtsUs = -1L
      var lastAudioPtsUs = -1L
      segments.forEachIndexed { index, segment ->
        throwIfCancelled()
        val formats = segmentFormats[index]
        lastVideoPtsUs = appendTrack(
          sourcePath = segment.path,
          trackPrefix = "video/",
          muxer = outputMuxer,
          muxerTrack = videoTrack,
          presentationOffsetUs = presentationOffsetUs,
          previousPtsUs = lastVideoPtsUs,
        )

        if (referenceAudioFormat != null) {
          when {
            formats.audioFormat == null ->
              Log.w(TAG, "Segment $index has no AAC audio; leaving its audio interval empty")
            !audioFormatsCompatible(referenceAudioFormat, formats.audioFormat) ->
              Log.w(TAG, "Segment $index has incompatible AAC audio; skipping its audio samples")
            else -> lastAudioPtsUs = appendTrack(
              sourcePath = segment.path,
              trackPrefix = "audio/",
              muxer = outputMuxer,
              muxerTrack = audioTrack,
              presentationOffsetUs = presentationOffsetUs,
              previousPtsUs = lastAudioPtsUs,
            )
          }
        }
        presentationOffsetUs += segmentDurationsUs[index]
        onProgress((index + 1).toDouble() / segments.size)
      }
    } catch (error: Throwable) {
      outputFile.delete()
      throw error
    } finally {
      runCatching { if (muxerStarted) muxer?.stop() }
      runCatching { muxer?.release() }
    }
  }

  private fun appendTrack(
    sourcePath: String,
    trackPrefix: String,
    muxer: MediaMuxer,
    muxerTrack: Int,
    presentationOffsetUs: Long,
    previousPtsUs: Long,
  ): Long {
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(sourcePath)
      val track = findTrack(extractor, trackPrefix)
      require(track >= 0) { "Segment contains no $trackPrefix track" }
      val format = extractor.getTrackFormat(track)
      val buffer = ByteBuffer.allocateDirect(
        max(
          DEFAULT_MEDIA_BUFFER_SIZE,
          format.intOr(MediaFormat.KEY_MAX_INPUT_SIZE, DEFAULT_MEDIA_BUFFER_SIZE),
        ),
      )
      val info = MediaCodec.BufferInfo()
      extractor.selectTrack(track)
      var firstSampleTimeUs = -1L
      var lastPtsUs = previousPtsUs
      while (true) {
        throwIfCancelled()
        val sampleTimeUs = extractor.sampleTime
        if (sampleTimeUs < 0L) break
        if (firstSampleTimeUs < 0L) firstSampleTimeUs = sampleTimeUs
        buffer.clear()
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) break
        val mappedPtsUs = presentationOffsetUs + (sampleTimeUs - firstSampleTimeUs)
        val outputPtsUs = max(mappedPtsUs, lastPtsUs + 1L)
        info.set(0, size, outputPtsUs, extractor.sampleFlags)
        buffer.position(0)
        buffer.limit(size)
        muxer.writeSampleData(muxerTrack, buffer, info)
        lastPtsUs = outputPtsUs
        if (!extractor.advance()) break
      }
      return lastPtsUs
    } finally {
      extractor.release()
    }
  }

  private fun inspectSegment(segment: File): SegmentFormat {
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(segment.path)
      val videoTrack = findTrack(extractor, "video/")
      require(videoTrack >= 0) { "Encoded segment contains no video track" }
      val audioTrack = findTrack(extractor, "audio/")
      return SegmentFormat(
        videoFormat = extractor.getTrackFormat(videoTrack),
        audioFormat = audioTrack.takeIf { it >= 0 }?.let(extractor::getTrackFormat),
      )
    } finally {
      extractor.release()
    }
  }

  private fun audioFormatsCompatible(first: MediaFormat, second: MediaFormat): Boolean =
    first.getString(MediaFormat.KEY_MIME) == second.getString(MediaFormat.KEY_MIME) &&
      first.intOr(MediaFormat.KEY_SAMPLE_RATE, -1) == second.intOr(MediaFormat.KEY_SAMPLE_RATE, -1) &&
      first.intOr(MediaFormat.KEY_CHANNEL_COUNT, -1) ==
        second.intOr(MediaFormat.KEY_CHANNEL_COUNT, -1)

  private fun inspectSource(inputPath: String): SourceInfo {
    val path = localPath(inputPath)
    require(File(path).isFile) { "Input file does not exist: $path" }
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(path)
      val track = findTrack(extractor, "video/")
      require(track >= 0) { "Input contains no video track" }
      val format = extractor.getTrackFormat(track)
      val durationUs = format.longOr(MediaFormat.KEY_DURATION, -1L)
      require(durationUs > 0L) { "Video duration is unavailable" }
      return SourceInfo(
        durationUs = durationUs,
        width = format.intOr(MediaFormat.KEY_WIDTH, 1920),
        height = format.intOr(MediaFormat.KEY_HEIGHT, 1080),
        frameRate = format.intOr(MediaFormat.KEY_FRAME_RATE, DEFAULT_FPS).coerceAtLeast(1),
      )
    } finally {
      extractor.release()
    }
  }

  private fun sceneRequiresOverlayBurnIn(sceneJson: String): Boolean {
    val root = JSONObject(sceneJson)
    val captions = root.optJSONObject("captionDocument")
    if (captions?.optBoolean("enabled", false) == true) return true
    val tracks = root.optJSONArray("tracks") ?: return false
    for (index in 0 until tracks.length()) {
      val track = tracks.optJSONObject(index) ?: continue
      val items = track.optJSONArray("items")
      when (track.optString("kind")) {
        "text", "overlay" -> if (items != null && items.length() > 0) return true
        "video" -> {
          if ((track.optJSONArray("transitions")?.length() ?: 0) > 0) return true
          if (items != null && (0 until items.length()).any { itemIndex ->
              (items.optJSONObject(itemIndex)?.optJSONArray("effectStack")?.length() ?: 0) > 0
            }
          ) {
            return true
          }
        }
      }
    }
    return false
  }

  private fun parseScene(sceneJson: String): List<SceneSource> {
    val root = JSONObject(sceneJson)
    val tracks = root.optJSONArray("tracks") ?: error("Scene contains no tracks")
    val assets = root.optJSONObject("assets") ?: error("Scene contains no assets")
    val clips = mutableListOf<SceneSource>()
    for (index in 0 until tracks.length()) {
      val track = tracks.optJSONObject(index) ?: continue
      if (track.optString("kind") != "video") continue
      val items = track.optJSONArray("items") ?: continue
      for (itemIndex in 0 until items.length()) {
        val videoItem = items.optJSONObject(itemIndex) ?: continue
        val assetId = videoItem.optString("assetId").takeIf(String::isNotBlank)
          ?: error("Video item has no assetId")
        val asset = assets.optJSONObject(assetId)
          ?: error("Scene asset not found: $assetId")
        val sourceUri = asset.optJSONObject("proxy")
          ?.optString("uri")
          ?.takeIf(String::isNotBlank)
          ?: asset.optString("sourceUri").takeIf(String::isNotBlank)
          ?: error("Video asset has no sourceUri")
        val timelineStart = videoItem.requireLong("timelineStart")
        val timelineEnd = videoItem.requireLong("timelineEnd")
        require(timelineEnd > timelineStart) {
          "Video item timelineEnd must be after timelineStart"
        }
        val sourceStart = videoItem.requireLong("sourceStart")
        val sourceEnd = videoItem.requireLong("sourceEnd")
        require(sourceEnd > sourceStart) { "Video item sourceEnd must be after sourceStart" }
        val speed = videoItem.optDouble("speed", 1.0)
        require(speed.isFinite() && speed > 0.0) {
          "Video item speed must be greater than zero"
        }
        clips += SceneSource(
          sourceUri,
          timelineStart,
          timelineEnd,
          sourceStart,
          sourceEnd,
          speed,
        )
      }
    }
    require(clips.isNotEmpty()) { "Scene contains no video track item" }
    return clips.sortedBy(SceneSource::timelineStart)
  }

  private fun findTrack(extractor: MediaExtractor, prefix: String): Int =
    (0 until extractor.trackCount).firstOrNull { index ->
      extractor.getTrackFormat(index)
        .getString(MediaFormat.KEY_MIME)
        ?.startsWith(prefix) == true
    } ?: -1

  private fun findBitmapAvcEncoder(width: Int, height: Int): MediaCodecInfo {
    val candidates = MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.filter { info ->
      info.isEncoder &&
        info.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_VIDEO_AVC, ignoreCase = true) }
    }
    return candidates.firstOrNull { info ->
      runCatching {
        val capabilities = info.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC)
        capabilities.videoCapabilities.isSizeSupported(width, height) &&
          capabilities.colorFormats.any(::isSupportedBitmapColorFormat)
      }.getOrDefault(false)
    } ?: error("No H.264 encoder supports bitmap YUV input at ${width}x$height")
  }

  private fun selectBitmapColorFormat(codecInfo: MediaCodecInfo, mime: String): Int {
    val formats = codecInfo.getCapabilitiesForType(mime).colorFormats.toSet()
    return listOf(
      MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar,
      MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar,
      MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible,
    ).firstOrNull(formats::contains)
      ?: error("H.264 encoder ${codecInfo.name} has no supported YUV420 input format")
  }

  private fun isSupportedBitmapColorFormat(colorFormat: Int): Boolean =
    colorFormat == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar ||
      colorFormat == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar ||
      colorFormat == MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible

  private fun localPath(value: String): String {
    val uri = Uri.parse(value)
    require(uri.scheme == null || uri.scheme == "file") {
      "Hardware export requires a local file path: $value"
    }
    return if (uri.scheme == "file") requireNotNull(uri.path) else value
  }

  private fun throwIfCancelled() {
    if (cancelled.get()) throw CancellationException("Export cancelled")
  }

  private fun ticksToUs(ticks: Long): Long =
    ticks * 1_000_000L / TICKS_PER_SECOND

  private fun scaleTimestamp(sourceUs: Long, trimStartUs: Long, speed: Double): Long =
    ((sourceUs - trimStartUs).coerceAtLeast(0L) / speed).toLong()

  private fun bitrateFor(width: Int, height: Int, fps: Int): Int =
    (width.toLong() * height * fps / 8L)
      .coerceIn(MIN_VIDEO_BITRATE.toLong(), MAX_VIDEO_BITRATE.toLong())
      .toInt()

  private fun even(value: Int): Int =
    (if (value % 2 == 0) value else value - 1).coerceAtLeast(2)

  private fun MediaFormat.intOr(key: String, fallback: Int): Int =
    if (containsKey(key)) getInteger(key) else fallback

  private fun MediaFormat.longOr(key: String, fallback: Long): Long =
    if (containsKey(key)) getLong(key) else fallback

  private fun JSONObject.requireLong(key: String): Long {
    require(has(key) && !isNull(key)) { "Video item has no $key" }
    return getLong(key)
  }

  private data class SourceInfo(
    val durationUs: Long,
    val width: Int,
    val height: Int,
    val frameRate: Int,
  )

  private data class SceneSource(
    val sourceUri: String,
    val timelineStart: Long,
    val timelineEnd: Long,
    val sourceStart: Long,
    val sourceEnd: Long,
    val speed: Double,
  )

  private data class SegmentFormat(
    val videoFormat: MediaFormat,
    val audioFormat: MediaFormat?,
  )

  private companion object {
    const val TAG = "ClippsterExport"
    const val TICKS_PER_SECOND = 60_000L
    const val DEFAULT_FPS = 30
    const val CODEC_TIMEOUT_US = 10_000L
    const val MAX_IDLE_ITERATIONS = 3_000
    const val DEFAULT_AUDIO_BUFFER_SIZE = 256 * 1024
    const val DEFAULT_MEDIA_BUFFER_SIZE = 2 * 1024 * 1024
    const val MIN_VIDEO_BITRATE = 2_000_000
    const val MAX_VIDEO_BITRATE = 20_000_000
    const val VIDEO_PROGRESS_WEIGHT = 0.95
    const val TRANSCODE_PROGRESS_WEIGHT = 0.9
    const val OVERLAY_VIDEO_PROGRESS_WEIGHT = 0.9
  }
}
