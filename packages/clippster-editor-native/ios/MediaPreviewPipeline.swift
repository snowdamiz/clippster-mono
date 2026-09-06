import AVFoundation
import CoreImage
import Foundation
import UIKit

/// Long-lived AVAssetReader → AVSampleBufferDisplayLayer preview path.
///
/// Reuses one reader session per source URI. Scrubs recreate the reader at the
/// seek point; continuous play advances sample buffers without reopening the asset.
final class MediaPreviewPipeline {
  enum PipelineError: LocalizedError {
    case invalidURL
    case missingVideoTrack
    case readerStartFailed(String)
    case frameUnavailable

    var errorDescription: String? {
      switch self {
      case .invalidURL: return "Invalid media URL"
      case .missingVideoTrack: return "Media has no video track"
      case .readerStartFailed(let detail): return "Could not start video reader: \(detail)"
      case .frameUnavailable: return "No frame is available at the requested time"
      }
    }
  }

  private final class Session {
    let sourceURI: String
    let asset: AVURLAsset
    let track: AVAssetTrack
    var reader: AVAssetReader
    var output: AVAssetReaderTrackOutput
    var lastPresentedSeconds: Double = -1
    let copiesPixels: Bool

    init(
      sourceURI: String,
      asset: AVURLAsset,
      track: AVAssetTrack,
      reader: AVAssetReader,
      output: AVAssetReaderTrackOutput,
      copiesPixels: Bool
    ) {
      self.sourceURI = sourceURI
      self.asset = asset
      self.track = track
      self.reader = reader
      self.output = output
      self.copiesPixels = copiesPixels
    }
  }

  private let queue = DispatchQueue(label: "app.clippster.editor.preview")
  private weak var displayLayer: AVSampleBufferDisplayLayer?
  private var generation = 0
  private var session: Session?

  private let seekBackSlack = 0.04
  private let preciseResync = 0.08
  private let forwardJump = 0.35

  func attach(to displayLayer: AVSampleBufferDisplayLayer) {
    queue.async { [weak self, weak displayLayer] in
      self?.displayLayer = displayLayer
    }
  }

  func showFrame(
    sourceURI: String,
    seconds: Double,
    precise: Bool,
    frameHandler: ((UIImage) -> Void)? = nil,
    completion: @escaping (Result<Double, Error>) -> Void
  ) {
    queue.async { [weak self] in
      guard let self else { return }
      generation += 1
      let request = generation
      do {
        let needsPixels = frameHandler != nil
        var active = try ensureSession(sourceURI: sourceURI, copiesPixels: needsPixels)
        let target = max(0, seconds)
        let last = active.lastPresentedSeconds
        let needsSeek =
          last < 0 ||
          target + seekBackSlack < last ||
          (precise && abs(target - last) > preciseResync) ||
          (!precise && target > last + forwardJump) ||
          active.reader.status != .reading

        if needsSeek {
          active = try recreateReader(active, at: target, precise: precise)
          session = active
        }

        var selected: CMSampleBuffer?
        var presentedSeconds = target
        while request == generation, let sample = active.output.copyNextSampleBuffer() {
          let pts = CMSampleBufferGetPresentationTimeStamp(sample).seconds
          selected = sample
          presentedSeconds = pts
          if !precise || pts >= target { break }
          if !precise && pts >= target - 0.045 { break }
        }
        guard request == generation, let sample = selected else {
          throw PipelineError.frameUnavailable
        }
        active.lastPresentedSeconds = presentedSeconds
        let image = frameHandler.flatMap { _ -> UIImage? in
          guard let buffer = CMSampleBufferGetImageBuffer(sample) else { return nil }
          let ciImage = CIImage(cvPixelBuffer: buffer)
          guard let cgImage = CIContext(options: [.cacheIntermediates: false])
            .createCGImage(ciImage, from: ciImage.extent)
          else { return nil }
          return UIImage(cgImage: cgImage)
        }
        DispatchQueue.main.async { [weak self] in
          guard request == self?.generation else { return }
          if let image, let frameHandler {
            frameHandler(image)
            self?.displayLayer?.flushAndRemoveImage()
          } else {
            if self?.displayLayer?.status == .failed {
              self?.displayLayer?.flush()
            }
            self?.displayLayer?.enqueue(sample)
          }
          completion(.success(presentedSeconds))
        }
      } catch {
        DispatchQueue.main.async { completion(.failure(error)) }
      }
    }
  }

  private func ensureSession(sourceURI: String, copiesPixels: Bool) throws -> Session {
    if let existing = session,
       existing.sourceURI == sourceURI,
       existing.copiesPixels == copiesPixels {
      return existing
    }
    session = nil
    let parsedURL = URL(string: sourceURI)
    let url = parsedURL?.scheme == nil ? URL(fileURLWithPath: sourceURI) : parsedURL!
    let asset = AVURLAsset(url: url)
    guard let track = asset.tracks(withMediaType: .video).first else {
      throw PipelineError.missingVideoTrack
    }
    let reader = try AVAssetReader(asset: asset)
    let outputSettings: [String: Any]? = copiesPixels ? [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ] : nil
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: outputSettings)
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw PipelineError.frameUnavailable }
    reader.add(output)
    guard reader.startReading() else {
      throw PipelineError.readerStartFailed(reader.error?.localizedDescription ?? "unknown error")
    }
    let created = Session(
      sourceURI: sourceURI,
      asset: asset,
      track: track,
      reader: reader,
      output: output,
      copiesPixels: copiesPixels
    )
    session = created
    return created
  }

  private func recreateReader(_ active: Session, at seconds: Double, precise: Bool) throws -> Session {
    active.reader.cancelReading()
    let reader = try AVAssetReader(asset: active.asset)
    let outputSettings: [String: Any]? = active.copiesPixels ? [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ] : nil
    let output = AVAssetReaderTrackOutput(track: active.track, outputSettings: outputSettings)
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw PipelineError.frameUnavailable }
    reader.add(output)
    let target = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
    reader.timeRange = CMTimeRange(
      start: precise ? target : max(.zero, target - CMTime(seconds: 0.5, preferredTimescale: 600)),
      duration: .positiveInfinity
    )
    guard reader.startReading() else {
      throw PipelineError.readerStartFailed(reader.error?.localizedDescription ?? "unknown error")
    }
    active.reader = reader
    active.output = output
    active.lastPresentedSeconds = -1
    return active
  }

  func release() {
    queue.async { [weak self] in
      guard let self else { return }
      generation += 1
      session?.reader.cancelReading()
      session = nil
      DispatchQueue.main.async { self.displayLayer?.flushAndRemoveImage() }
      displayLayer = nil
    }
  }
}
