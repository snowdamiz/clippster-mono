import UIKit

final class OverlayImageCache {
  private let images = NSCache<NSString, UIImage>()

  func image(for sourceURI: String) -> UIImage? {
    guard !sourceURI.isEmpty else { return nil }
    if let cached = images.object(forKey: sourceURI as NSString) { return cached }
    let url: URL
    if let parsed = URL(string: sourceURI), parsed.isFileURL {
      url = parsed
    } else {
      url = URL(fileURLWithPath: sourceURI)
    }
    guard let image = UIImage(contentsOfFile: url.path) else { return nil }
    images.setObject(image, forKey: sourceURI as NSString)
    return image
  }

  func clear() {
    images.removeAllObjects()
  }
}

enum OverlayFrameRenderer {
  static func draw(
    frame: [String: Any]?,
    in context: CGContext,
    outputSize: CGSize,
    imageCache: OverlayImageCache,
    videoFrames: [String: UIImage] = [:],
    includedKinds: Set<String> = ["image", "text"]
  ) {
    guard
      let frame,
      let canvas = frame["canvas"] as? [String: Any],
      let canvasWidth = number(canvas["width"]),
      let canvasHeight = number(canvas["height"]),
      canvasWidth > 0,
      canvasHeight > 0,
      let layers = frame["layers"] as? [[String: Any]]
    else { return }

    let outputScaleX = outputSize.width / canvasWidth
    let outputScaleY = outputSize.height / canvasHeight
    for layer in layers {
      guard
        let kind = layer["kind"] as? String,
        includedKinds.contains(kind)
      else { continue }
      context.saveGState()
      let transform = affineTransform(
        for: layer,
        outputScaleX: outputScaleX,
        outputScaleY: outputScaleY
      )
      applyTransitionClip(layer, transform: transform, in: context)
      context.concatenate(transform)
      context.setAlpha((number(layer["opacity"]) ?? 1).clamped(to: 0...1))
      if kind == "image" || kind == "video" {
        drawImage(
          layer,
          frameTick: (frame["tick"] as? NSNumber)?.int64Value,
          imageCache: imageCache,
          videoFrames: videoFrames
        )
      } else {
        drawText(layer)
      }
      context.restoreGState()
    }
  }

  static func affineTransform(
    for layer: [String: Any],
    outputScaleX: CGFloat,
    outputScaleY: CGFloat
  ) -> CGAffineTransform {
    let transform = layer["transform"] as? [String: Any] ?? [:]
    return CGAffineTransform(
      a: outputScaleX * (number(transform["m00"]) ?? 1),
      b: outputScaleY * (number(transform["m10"]) ?? 0),
      c: outputScaleX * (number(transform["m01"]) ?? 0),
      d: outputScaleY * (number(transform["m11"]) ?? 1),
      tx: outputScaleX * (number(transform["m02"]) ?? 0),
      ty: outputScaleY * (number(transform["m12"]) ?? 0)
    )
  }

  private static func drawImage(
    _ layer: [String: Any],
    frameTick: Int64?,
    imageCache: OverlayImageCache,
    videoFrames: [String: UIImage]
  ) {
    let clipID = layer["clipId"] as? String ?? ""
    let cachedImage: UIImage? = {
      guard let sourceURI = layer["sourceUri"] as? String else { return nil }
      return imageCache.image(for: sourceURI)
    }()
    guard let image = videoFrames[clipID] ?? cachedImage else { return }
    let effects = layer["effects"] as? [[String: Any]] ?? []
    let tick = frameTick ?? (layer["sourceTick"] as? NSNumber)?.int64Value ?? 0
    EffectImageProcessor.process(
      image,
      effects: effects,
      seed: EffectImageProcessor.stableSeed(clipID, tick: tick)
    ).draw(at: .zero)
  }

  private static func drawText(_ layer: [String: Any]) {
    guard
      let text = layer["text"] as? String,
      !text.isEmpty,
      let fontSize = number(layer["fontSize"]),
      fontSize > 0
    else { return }
    let color = layer["color"] as? [String: Any] ?? [:]
    let textColor = UIColor(
      red: (number(color["r"]) ?? 1).clamped(to: 0...1),
      green: (number(color["g"]) ?? 1).clamped(to: 0...1),
      blue: (number(color["b"]) ?? 1).clamped(to: 0...1),
      alpha: (number(color["a"]) ?? 1).clamped(to: 0...1)
    )
    (text as NSString).draw(
      at: .zero,
      withAttributes: [
        .font: UIFont.systemFont(ofSize: fontSize),
        .foregroundColor: textColor,
      ]
    )
  }

  private static func number(_ value: Any?) -> CGFloat? {
    (value as? NSNumber).map { CGFloat(truncating: $0) }
  }

  private static func applyTransitionClip(
    _ layer: [String: Any],
    transform: CGAffineTransform,
    in context: CGContext
  ) {
    guard
      let transition = layer["transition"] as? [String: Any],
      transition["kind"] as? String == "wipe",
      let width = number(layer["sourceWidth"]),
      let height = number(layer["sourceHeight"])
    else { return }
    let bounds = CGRect(x: 0, y: 0, width: width, height: height)
      .applying(transform)
      .standardized
    let progress = (number(transition["horizontalWipeProgress"]) ?? 1)
      .clamped(to: 0...1)
    context.clip(
      to: CGRect(
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.width * progress,
        height: bounds.height
      )
    )
  }
}

private extension CGFloat {
  func clamped(to range: ClosedRange<CGFloat>) -> CGFloat {
    Swift.min(Swift.max(self, range.lowerBound), range.upperBound)
  }
}
