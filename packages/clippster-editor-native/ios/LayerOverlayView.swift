import UIKit

final class LayerOverlayView: UIView {
  private let imageCache = OverlayImageCache()
  private var frameDescriptor: [String: Any]?

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    backgroundColor = .clear
    isUserInteractionEnabled = false
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    isOpaque = false
    backgroundColor = .clear
    isUserInteractionEnabled = false
  }

  func setFrame(_ frame: [String: Any]?) {
    frameDescriptor = frame
    setNeedsDisplay()
  }

  override func draw(_ rect: CGRect) {
    guard let context = UIGraphicsGetCurrentContext() else { return }
    OverlayFrameRenderer.draw(
      frame: frameDescriptor,
      in: context,
      outputSize: bounds.size,
      imageCache: imageCache
    )
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      frameDescriptor = nil
      imageCache.clear()
    }
  }
}
