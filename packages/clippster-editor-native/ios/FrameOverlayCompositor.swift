import AVFoundation
import UIKit

public final class FrameOverlayCompositor {
  private let imageCache = OverlayImageCache()
  private let videoFrameCache = VideoFrameImageCache()

  public init() {}

  public func compose(baseBitmap: UIImage, frameJson: String) -> UIImage {
    guard
      let data = frameJson.data(using: .utf8),
      let frame = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return baseBitmap }

    let pixelSize = CGSize(
      width: baseBitmap.cgImage.map { CGFloat($0.width) } ?? baseBitmap.size.width * baseBitmap.scale,
      height: baseBitmap.cgImage.map { CGFloat($0.height) } ?? baseBitmap.size.height * baseBitmap.scale
    )
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    return UIGraphicsImageRenderer(size: pixelSize, format: format).image { renderer in
      let videoLayers = (frame["layers"] as? [[String: Any]])?
        .filter { $0["kind"] as? String == "video" } ?? []
      if let firstClipID = videoLayers.first?["clipId"] as? String {
        var videoFrames: [String: UIImage] = [:]
        for layer in videoLayers {
          guard
            let clipID = layer["clipId"] as? String,
            let sourceURI = layer["sourceUri"] as? String
          else { continue }
          let tick = (layer["sourceTick"] as? NSNumber)?.int64Value ?? 0
          videoFrames[clipID] = videoFrameCache.image(
            sourceURI: sourceURI,
            tick: tick
          )
        }
        if videoFrames[firstClipID] == nil {
          videoFrames[firstClipID] = baseBitmap
        }
        renderer.cgContext.setFillColor(UIColor.black.cgColor)
        renderer.cgContext.fill(CGRect(origin: .zero, size: pixelSize))
        OverlayFrameRenderer.draw(
          frame: frame,
          in: renderer.cgContext,
          outputSize: pixelSize,
          imageCache: imageCache,
          videoFrames: videoFrames,
          includedKinds: ["video"]
        )
      } else {
        baseBitmap.draw(in: CGRect(origin: .zero, size: pixelSize))
      }
      OverlayFrameRenderer.draw(
        frame: frame,
        in: renderer.cgContext,
        outputSize: pixelSize,
        imageCache: imageCache
      )
    }
  }

  public func clear() {
    imageCache.clear()
    videoFrameCache.clear()
  }
}

private final class VideoFrameImageCache {
  private var generators: [String: AVAssetImageGenerator] = [:]

  func image(sourceURI: String, tick: Int64) -> UIImage? {
    let generator: AVAssetImageGenerator
    if let cached = generators[sourceURI] {
      generator = cached
    } else {
      let url: URL
      if let parsed = URL(string: sourceURI), parsed.scheme != nil {
        url = parsed
      } else {
        url = URL(fileURLWithPath: sourceURI)
      }
      generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
      generator.appliesPreferredTrackTransform = true
      generator.requestedTimeToleranceBefore = .zero
      generator.requestedTimeToleranceAfter = .zero
      generators[sourceURI] = generator
    }
    let time = CMTime(value: tick, timescale: CMTimeScale(GraphBridge.ticksPerSecond()))
    guard let image = try? generator.copyCGImage(at: time, actualTime: nil) else {
      return nil
    }
    return UIImage(cgImage: image)
  }

  func clear() {
    generators.removeAll()
  }
}
