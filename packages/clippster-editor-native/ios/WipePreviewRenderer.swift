import AVFoundation
import UIKit

/** Still-frame fallback used only while a wipe needs two video layers. */
final class WipePreviewRenderer {
  private let queue = DispatchQueue(label: "app.clippster.editor.preview.wipe")
  private let imageCache = OverlayImageCache()
  private let generationLock = NSLock()
  private var generation = 0

  func render(
    frame: [String: Any],
    outputSize: CGSize,
    completion: @escaping (UIImage) -> Void
  ) {
    let request = nextGeneration()
    queue.async { [weak self] in
      guard let self else { return }
      var frames: [String: UIImage] = [:]
      let layers = frame["layers"] as? [[String: Any]] ?? []
      for layer in layers where layer["kind"] as? String == "video" {
        guard
          let clipID = layer["clipId"] as? String,
          let sourceURI = layer["sourceUri"] as? String,
          let url = Self.url(sourceURI)
        else { continue }
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let tick = (layer["sourceTick"] as? NSNumber)?.int64Value ?? 0
        let time = CMTime(value: tick, timescale: CMTimeScale(GraphBridge.ticksPerSecond()))
        if let image = try? generator.copyCGImage(at: time, actualTime: nil) {
          frames[clipID] = UIImage(cgImage: image)
        }
      }

      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let image = UIGraphicsImageRenderer(size: outputSize, format: format).image { renderer in
        renderer.cgContext.setFillColor(UIColor.black.cgColor)
        renderer.cgContext.fill(CGRect(origin: .zero, size: outputSize))
        OverlayFrameRenderer.draw(
          frame: frame,
          in: renderer.cgContext,
          outputSize: outputSize,
          imageCache: imageCache,
          videoFrames: frames,
          includedKinds: ["video"]
        )
      }
      DispatchQueue.main.async { [weak self] in
        guard self?.isCurrent(request) == true else { return }
        completion(image)
      }
    }
  }

  func release() {
    cancel()
    imageCache.clear()
  }

  func cancel() {
    _ = nextGeneration()
  }

  private func nextGeneration() -> Int {
    generationLock.lock()
    defer { generationLock.unlock() }
    generation += 1
    return generation
  }

  private func isCurrent(_ value: Int) -> Bool {
    generationLock.lock()
    defer { generationLock.unlock() }
    return generation == value
  }

  private static func url(_ value: String) -> URL? {
    guard !value.isEmpty else { return nil }
    if let url = URL(string: value), url.scheme != nil { return url }
    return URL(fileURLWithPath: value)
  }
}
