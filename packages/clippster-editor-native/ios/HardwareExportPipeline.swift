import AVFoundation
import CoreImage
import Foundation
import UIKit

/// VideoToolbox-backed AVAssetWriter H.264/AAC feasibility export path.
final class HardwareExportPipeline {
  private let overlayCompositor = FrameOverlayCompositor()

  enum ExportError: LocalizedError {
    case invalidInput
    case noVideo
    case cancelled
    case failed(String)

    var errorDescription: String? {
      switch self {
      case .invalidInput: return "Invalid export input"
      case .noVideo: return "Input contains no video track"
      case .cancelled: return "Export cancelled"
      case .failed(let detail): return "Export failed: \(detail)"
      }
    }
  }

  private let stateLock = NSLock()
  private var isCancelled = false
  private var activeExportSession: AVAssetExportSession?

  func export(
    inputPath: String,
    outputPath: String,
    onProgress: @escaping (Double) -> Void
  ) throws -> [String] {
    setCancelled(false)
    let inputURL = Self.url(for: inputPath)
    let outputURL = Self.url(for: outputPath)
    try? FileManager.default.removeItem(at: outputURL)
    try FileManager.default.createDirectory(
      at: outputURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )

    let asset = AVURLAsset(url: inputURL)
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      throw ExportError.noVideo
    }
    let reader = try AVAssetReader(asset: asset)
    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
    let dimensions = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
    let width = max(2, Int(abs(dimensions.width)) / 2 * 2)
    let height = max(2, Int(abs(dimensions.height)) / 2 * 2)

    let videoOutput = AVAssetReaderTrackOutput(
      track: videoTrack,
      outputSettings: [
        kCVPixelBufferPixelFormatTypeKey as String:
          kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
      ]
    )
    let videoInput = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: max(2_000_000, width * height * 4),
          AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ],
      ]
    )
    videoInput.transform = videoTrack.preferredTransform
    videoInput.expectsMediaDataInRealTime = false
    guard reader.canAdd(videoOutput), writer.canAdd(videoInput) else {
      throw ExportError.failed("Video reader/writer configuration is unsupported")
    }
    reader.add(videoOutput)
    writer.add(videoInput)

    var audioPair: (AVAssetReaderTrackOutput, AVAssetWriterInput)?
    if let audioTrack = asset.tracks(withMediaType: .audio).first {
      let output = AVAssetReaderTrackOutput(
        track: audioTrack,
        outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM]
      )
      let input = AVAssetWriterInput(
        mediaType: .audio,
        outputSettings: [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVSampleRateKey: 48_000,
          AVNumberOfChannelsKey: 2,
          AVEncoderBitRateKey: 192_000,
        ]
      )
      if reader.canAdd(output), writer.canAdd(input) {
        reader.add(output)
        writer.add(input)
        audioPair = (output, input)
      }
    }

    guard writer.startWriting(), reader.startReading() else {
      throw ExportError.failed(writer.error?.localizedDescription
        ?? reader.error?.localizedDescription
        ?? "Could not start codecs")
    }
    writer.startSession(atSourceTime: .zero)

    let completion = DispatchSemaphore(value: 0)
    let group = DispatchGroup()
    let duration = max(asset.duration.seconds, 0.001)
    let videoQueue = DispatchQueue(label: "app.clippster.editor.export.video")
    group.enter()
    videoInput.requestMediaDataWhenReady(on: videoQueue) {
      while videoInput.isReadyForMoreMediaData {
        if self.cancelled() {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        guard let sample = videoOutput.copyNextSampleBuffer() else {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        // Samples currently remain in the VideoToolbox pixel-buffer path. If this
        // path exposes a UIImage/CGImage frame, evaluate that tick and route it
        // through drawOverlaysOntoBitmap before appending the replacement buffer.
        if !videoInput.append(sample) {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        let progress = CMSampleBufferGetPresentationTimeStamp(sample).seconds / duration
        DispatchQueue.main.async { onProgress(min(max(progress, 0), 1)) }
      }
    }

    if let (audioOutput, audioInput) = audioPair {
      let audioQueue = DispatchQueue(label: "app.clippster.editor.export.audio")
      group.enter()
      audioInput.requestMediaDataWhenReady(on: audioQueue) {
        while audioInput.isReadyForMoreMediaData {
          if self.cancelled() {
            audioInput.markAsFinished()
            group.leave()
            return
          }
          guard let sample = audioOutput.copyNextSampleBuffer() else {
            audioInput.markAsFinished()
            group.leave()
            return
          }
          if !audioInput.append(sample) {
            audioInput.markAsFinished()
            group.leave()
            return
          }
        }
      }
    }

    group.notify(queue: videoQueue) {
      if self.cancelled() {
        reader.cancelReading()
        writer.cancelWriting()
        completion.signal()
      } else {
        writer.finishWriting { completion.signal() }
      }
    }
    completion.wait()

    if cancelled() {
      try? FileManager.default.removeItem(at: outputURL)
      throw ExportError.cancelled
    }
    guard writer.status == .completed else {
      try? FileManager.default.removeItem(at: outputURL)
      throw ExportError.failed(writer.error?.localizedDescription ?? "Encoder did not complete")
    }
    onProgress(1)
    return [outputURL.path]
  }

  func exportScene(
    sceneJSON: String,
    outputPath: String,
    width: Int,
    height: Int,
    fps: Int,
    onProgress: @escaping (Double) -> Void
  ) throws -> [String] {
    guard width > 0, height > 0, fps > 0 else { throw ExportError.invalidInput }
    setCancelled(false)
    let clips = try parseScene(sceneJSON)
    let composition = AVMutableComposition()
    guard let compositionVideoTrack = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
      throw ExportError.failed("Could not create composition video track")
    }

    var compositionAudioTrack: AVMutableCompositionTrack?
    var cursor = CMTime.zero
    var instructions: [AVMutableVideoCompositionInstruction] = []
    let renderSize = CGSize(width: CGFloat(width), height: CGFloat(height))

    for (index, clip) in clips.enumerated() {
      if cancelled() { throw ExportError.cancelled }
      let asset = AVURLAsset(url: Self.url(for: clip.sourceURI))
      guard let sourceVideoTrack = asset.tracks(withMediaType: .video).first else {
        throw ExportError.noVideo
      }
      let sourceRange = CMTimeRange(
        start: CMTime(value: clip.sourceStart, timescale: Self.ticksPerSecond),
        duration: CMTime(
          value: clip.sourceEnd - clip.sourceStart,
          timescale: Self.ticksPerSecond
        )
      )
      let outputDuration = CMTimeMultiplyByFloat64(sourceRange.duration, multiplier: 1 / clip.speed)
      let insertionTime = CMTime(
        value: clip.timelineStart,
        timescale: Self.ticksPerSecond
      )
      let insertedRange = CMTimeRange(start: insertionTime, duration: sourceRange.duration)
      try compositionVideoTrack.insertTimeRange(
        sourceRange,
        of: sourceVideoTrack,
        at: insertionTime
      )
      compositionVideoTrack.scaleTimeRange(insertedRange, toDuration: outputDuration)

      let instruction = AVMutableVideoCompositionInstruction()
      instruction.timeRange = CMTimeRange(start: insertionTime, duration: outputDuration)
      let layerInstruction = AVMutableVideoCompositionLayerInstruction(
        assetTrack: compositionVideoTrack
      )
      layerInstruction.setTransform(
        Self.renderTransform(for: sourceVideoTrack, renderSize: renderSize),
        at: insertionTime
      )
      instruction.layerInstructions = [layerInstruction]
      instructions.append(instruction)

      if let sourceAudioTrack = asset.tracks(withMediaType: .audio).first {
        if compositionAudioTrack == nil {
          compositionAudioTrack = composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
          )
        }
        if let audioTrack = compositionAudioTrack {
          try audioTrack.insertTimeRange(sourceRange, of: sourceAudioTrack, at: insertionTime)
          audioTrack.scaleTimeRange(insertedRange, toDuration: outputDuration)
        }
      } else {
        NSLog("ClippsterExport: segment %d has no audio; leaving its audio interval empty", index)
      }
      cursor = CMTimeMaximum(cursor, CMTimeAdd(insertionTime, outputDuration))
    }

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = renderSize
    videoComposition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps))
    videoComposition.instructions = instructions

    let outputURL = Self.url(for: outputPath)
    try? FileManager.default.removeItem(at: outputURL)
    try FileManager.default.createDirectory(
      at: outputURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    if Self.sceneRequiresOverlayBurnIn(sceneJSON) {
      try exportCompositionWithOverlayBurnIn(
        sceneJSON: sceneJSON,
        composition: composition,
        videoComposition: videoComposition,
        outputURL: outputURL,
        width: width,
        height: height,
        duration: cursor,
        onProgress: onProgress
      )
      return [outputURL.path]
    }
    guard let session = AVAssetExportSession(
      asset: composition,
      presetName: AVAssetExportPresetHighestQuality
    ) else {
      throw ExportError.failed("Could not create composition export session")
    }
    session.outputURL = outputURL
    session.outputFileType = .mp4
    session.shouldOptimizeForNetworkUse = true
    session.videoComposition = videoComposition
    setActiveExportSession(session)
    defer { setActiveExportSession(nil) }

    onProgress(0)
    let completion = DispatchSemaphore(value: 0)
    session.exportAsynchronously { completion.signal() }
    while completion.wait(timeout: .now() + 0.1) == .timedOut {
      if cancelled() { session.cancelExport() }
      let progress = Double(session.progress)
      DispatchQueue.main.async { onProgress(min(max(progress, 0), 1)) }
    }

    if cancelled() || session.status == .cancelled {
      try? FileManager.default.removeItem(at: outputURL)
      throw ExportError.cancelled
    }
    guard session.status == .completed else {
      try? FileManager.default.removeItem(at: outputURL)
      throw ExportError.failed(session.error?.localizedDescription ?? "Encoder did not complete")
    }
    onProgress(1)
    return [outputURL.path]
  }

  private func exportCompositionWithOverlayBurnIn(
    sceneJSON: String,
    composition: AVMutableComposition,
    videoComposition: AVMutableVideoComposition,
    outputURL: URL,
    width: Int,
    height: Int,
    duration: CMTime,
    onProgress: @escaping (Double) -> Void
  ) throws {
    let reader = try AVAssetReader(asset: composition)
    let videoOutput = AVAssetReaderVideoCompositionOutput(
      videoTracks: composition.tracks(withMediaType: .video),
      videoSettings: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      ]
    )
    videoOutput.videoComposition = videoComposition
    guard reader.canAdd(videoOutput) else {
      throw ExportError.failed("Overlay video reader configuration is unsupported")
    }
    reader.add(videoOutput)

    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
    let videoInput = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: max(2_000_000, width * height * 4),
          AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        ],
      ]
    )
    videoInput.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: videoInput,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ]
    )
    guard writer.canAdd(videoInput) else {
      throw ExportError.failed("Overlay video writer configuration is unsupported")
    }
    writer.add(videoInput)

    var audioPair: (AVAssetReaderTrackOutput, AVAssetWriterInput)?
    if let audioTrack = composition.tracks(withMediaType: .audio).first {
      let output = AVAssetReaderTrackOutput(
        track: audioTrack,
        outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM]
      )
      let input = AVAssetWriterInput(
        mediaType: .audio,
        outputSettings: [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVSampleRateKey: 48_000,
          AVNumberOfChannelsKey: 2,
          AVEncoderBitRateKey: 192_000,
        ]
      )
      if reader.canAdd(output), writer.canAdd(input) {
        reader.add(output)
        writer.add(input)
        audioPair = (output, input)
      }
    }

    guard writer.startWriting(), reader.startReading() else {
      throw ExportError.failed(
        writer.error?.localizedDescription
          ?? reader.error?.localizedDescription
          ?? "Could not start overlay codecs"
      )
    }
    writer.startSession(atSourceTime: .zero)

    let completion = DispatchSemaphore(value: 0)
    let group = DispatchGroup()
    let videoQueue = DispatchQueue(label: "app.clippster.editor.export.overlay-video")
    let durationSeconds = max(duration.seconds, 0.001)
    group.enter()
    videoInput.requestMediaDataWhenReady(on: videoQueue) {
      while videoInput.isReadyForMoreMediaData {
        if self.cancelled() {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        guard
          let sample = videoOutput.copyNextSampleBuffer(),
          let sourceBuffer = CMSampleBufferGetImageBuffer(sample)
        else {
          videoInput.markAsFinished()
          group.leave()
          return
        }
        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sample)
        do {
          let tick = Int64(
            (presentationTime.seconds * Double(GraphBridge.ticksPerSecond())).rounded()
          )
          let frameJSON = try GraphBridge.parseAndEvaluate(
            sceneJSON,
            tick: tick,
            previewMode: false
          )
          let sourceImage = try Self.image(from: sourceBuffer)
          let composedImage = self.overlayCompositor.compose(
            baseBitmap: sourceImage,
            frameJson: frameJSON
          )
          guard
            let pool = adaptor.pixelBufferPool,
            let outputBuffer = Self.makePixelBuffer(
              image: composedImage,
              pool: pool,
              width: width,
              height: height
            ),
            adaptor.append(outputBuffer, withPresentationTime: presentationTime)
          else {
            reader.cancelReading()
            videoInput.markAsFinished()
            group.leave()
            return
          }
          let progress = presentationTime.seconds / durationSeconds
          DispatchQueue.main.async { onProgress(min(max(progress * 0.95, 0), 0.95)) }
        } catch {
          reader.cancelReading()
          videoInput.markAsFinished()
          group.leave()
          return
        }
      }
    }

    if let (audioOutput, audioInput) = audioPair {
      let audioQueue = DispatchQueue(label: "app.clippster.editor.export.overlay-audio")
      group.enter()
      audioInput.requestMediaDataWhenReady(on: audioQueue) {
        while audioInput.isReadyForMoreMediaData {
          if self.cancelled() {
            audioInput.markAsFinished()
            group.leave()
            return
          }
          guard let sample = audioOutput.copyNextSampleBuffer() else {
            audioInput.markAsFinished()
            group.leave()
            return
          }
          if !audioInput.append(sample) {
            audioInput.markAsFinished()
            group.leave()
            return
          }
        }
      }
    }

    group.notify(queue: videoQueue) {
      if self.cancelled() || reader.status == .failed {
        reader.cancelReading()
        writer.cancelWriting()
        completion.signal()
      } else {
        writer.finishWriting { completion.signal() }
      }
    }
    completion.wait()
    overlayCompositor.clear()

    if cancelled() {
      try? FileManager.default.removeItem(at: outputURL)
      throw ExportError.cancelled
    }
    guard reader.status == .completed, writer.status == .completed else {
      try? FileManager.default.removeItem(at: outputURL)
      throw ExportError.failed(
        writer.error?.localizedDescription
          ?? reader.error?.localizedDescription
          ?? "Overlay encoder did not complete"
      )
    }
    onProgress(1)
  }

  func cancel() {
    stateLock.lock()
    isCancelled = true
    let session = activeExportSession
    stateLock.unlock()
    session?.cancelExport()
  }

  func drawOverlaysOntoBitmap(
    _ baseBitmap: UIImage,
    frameJSON: String
  ) -> UIImage {
    overlayCompositor.compose(baseBitmap: baseBitmap, frameJson: frameJSON)
  }

  private static func sceneRequiresOverlayBurnIn(_ sceneJSON: String) -> Bool {
    guard
      let data = sceneJSON.data(using: .utf8),
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let tracks = root["tracks"] as? [[String: Any]]
    else { return false }
    if
      let captions = root["captionDocument"] as? [String: Any],
      captions["enabled"] as? Bool == true
    {
      return true
    }
    return tracks.contains { track in
      let kind = track["kind"] as? String
      let items = track["items"] as? [[String: Any]] ?? []
      if kind == "text" || kind == "overlay" { return !items.isEmpty }
      guard kind == "video" else { return false }
      let transitions = track["transitions"] as? [[String: Any]] ?? []
      if !transitions.isEmpty { return true }
      return items.contains {
        !(($0["effectStack"] as? [[String: Any]]) ?? []).isEmpty
      }
    }
  }

  private static func image(from pixelBuffer: CVPixelBuffer) throws -> UIImage {
    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
    let context = CIContext(options: [.cacheIntermediates: false])
    guard let image = context.createCGImage(ciImage, from: ciImage.extent) else {
      throw ExportError.failed("Could not materialize decoded video frame")
    }
    return UIImage(cgImage: image)
  }

  private static func makePixelBuffer(
    image: UIImage,
    pool: CVPixelBufferPool,
    width: Int,
    height: Int
  ) -> CVPixelBuffer? {
    var optionalBuffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &optionalBuffer) == kCVReturnSuccess,
      let buffer = optionalBuffer
    else { return nil }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard
      let baseAddress = CVPixelBufferGetBaseAddress(buffer),
      let context = CGContext(
        data: baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue
          | CGImageAlphaInfo.premultipliedFirst.rawValue
      )
    else { return nil }
    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    UIGraphicsPushContext(context)
    image.draw(in: CGRect(x: 0, y: 0, width: width, height: height))
    UIGraphicsPopContext()
    return buffer
  }

  private func parseScene(_ sceneJSON: String) throws -> [SceneClip] {
    guard
      let data = sceneJSON.data(using: .utf8),
      let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      let assets = root["assets"] as? [String: Any],
      let tracks = root["tracks"] as? [[String: Any]]
    else { throw ExportError.invalidInput }

    var clips: [SceneClip] = []
    for track in tracks where track["kind"] as? String == "video" {
      guard let items = track["items"] as? [[String: Any]] else { continue }
      for item in items {
        guard
          let assetID = item["assetId"] as? String,
          let asset = assets[assetID] as? [String: Any],
          let timelineStart = Self.int64(item["timelineStart"]),
          let sourceStart = Self.int64(item["sourceStart"]),
          let sourceEnd = Self.int64(item["sourceEnd"]),
          sourceEnd > sourceStart
        else { throw ExportError.invalidInput }
        let proxyURI = (asset["proxy"] as? [String: Any])?["uri"] as? String
        guard let sourceURI = Self.nonEmpty(proxyURI) ?? Self.nonEmpty(asset["sourceUri"] as? String)
        else { throw ExportError.invalidInput }
        let speed = Self.double(item["speed"]) ?? 1
        guard speed.isFinite, speed > 0 else { throw ExportError.invalidInput }
        clips.append(
          SceneClip(
            sourceURI: sourceURI,
            timelineStart: timelineStart,
            sourceStart: sourceStart,
            sourceEnd: sourceEnd,
            speed: speed
          )
        )
      }
    }
    guard !clips.isEmpty else { throw ExportError.invalidInput }
    return clips.sorted { $0.timelineStart < $1.timelineStart }
  }

  private func cancelled() -> Bool {
    stateLock.lock()
    defer { stateLock.unlock() }
    return isCancelled
  }

  private func setCancelled(_ value: Bool) {
    stateLock.lock()
    isCancelled = value
    stateLock.unlock()
  }

  private func setActiveExportSession(_ session: AVAssetExportSession?) {
    stateLock.lock()
    activeExportSession = session
    stateLock.unlock()
  }

  private static func url(for value: String) -> URL {
    if let url = URL(string: value), url.isFileURL { return url }
    return URL(fileURLWithPath: value)
  }

  private static func renderTransform(
    for track: AVAssetTrack,
    renderSize: CGSize
  ) -> CGAffineTransform {
    let transformedRect = CGRect(origin: .zero, size: track.naturalSize)
      .applying(track.preferredTransform)
    let sourceWidth = max(abs(transformedRect.width), 1)
    let sourceHeight = max(abs(transformedRect.height), 1)
    let scale = min(renderSize.width / sourceWidth, renderSize.height / sourceHeight)
    let centeredX = (renderSize.width - sourceWidth * scale) / 2
    let centeredY = (renderSize.height - sourceHeight * scale) / 2
    return track.preferredTransform
      .concatenating(
        CGAffineTransform(
          translationX: -transformedRect.minX,
          y: -transformedRect.minY
        )
      )
      .concatenating(CGAffineTransform(scaleX: scale, y: scale))
      .concatenating(CGAffineTransform(translationX: centeredX, y: centeredY))
  }

  private static func int64(_ value: Any?) -> Int64? {
    (value as? NSNumber)?.int64Value
  }

  private static func double(_ value: Any?) -> Double? {
    (value as? NSNumber)?.doubleValue
  }

  private static func nonEmpty(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return nil }
    return value
  }

  private struct SceneClip {
    let sourceURI: String
    let timelineStart: Int64
    let sourceStart: Int64
    let sourceEnd: Int64
    let speed: Double
  }

  private static let ticksPerSecond: CMTimeScale = 60_000
}
