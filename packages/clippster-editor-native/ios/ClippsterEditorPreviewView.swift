import AVFoundation
import ExpoModulesCore
import UIKit

final class ClippsterEditorPreviewView: ExpoView {
  let onSurfaceReady = EventDispatcher()
  let onFramePresented = EventDispatcher()

  private let displayLayer = AVSampleBufferDisplayLayer()
  private let filteredFrameView = UIImageView()
  private let overlayView = LayerOverlayView()
  private let pipeline = MediaPreviewPipeline()
  private let wipeRenderer = WipePreviewRenderer()
  private var documentJSON = ""
  private var frameDescriptor: [String: Any]?
  private var playheadSeconds = 0.0
  private var playing = false
  private var quality = "auto"
  private var showingWipeComposite = false
  private var lastRequestedSeconds = Double.nan
  private var lastRequestedSource: String?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    displayLayer.backgroundColor = UIColor.black.cgColor
    displayLayer.videoGravity = .resize
    displayLayer.anchorPoint = .zero
    layer.addSublayer(displayLayer)
    filteredFrameView.isHidden = true
    filteredFrameView.contentMode = .scaleToFill
    filteredFrameView.layer.anchorPoint = .zero
    addSubview(filteredFrameView)
    addSubview(overlayView)
    pipeline.attach(to: displayLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if showingWipeComposite {
      filteredFrameView.frame = bounds
    } else {
      applyEvaluatorTransform(frameDescriptor)
    }
    overlayView.frame = bounds
    onSurfaceReady(["width": bounds.width, "height": bounds.height])
  }

  func setDocumentJSON(_ value: String) {
    if documentJSON == value { return }
    documentJSON = value
    lastRequestedSeconds = .nan
    lastRequestedSource = nil
    requestFrame()
  }

  func setPlaying(_ value: Bool) {
    playing = value
    if !value {
      lastRequestedSeconds = .nan
    }
  }

  func setPlayheadSeconds(_ value: Double) {
    playheadSeconds = max(0, value)
    requestFrame()
  }

  func setQuality(_ value: String) {
    if quality == value { return }
    quality = value
    lastRequestedSeconds = .nan
    requestFrame()
  }

  private func requestFrame() {
    let frame = evaluatedFrame()
    frameDescriptor = frame
    overlayView.setFrame(frame)
    let videoLayers = (frame?["layers"] as? [[String: Any]])?
      .filter { $0["kind"] as? String == "video" } ?? []
    let videoLayer = videoLayers.first
    applyEvaluatorTransform(frame)
    let needsWipeFallback = videoLayers.contains {
      ($0["transition"] as? [String: Any])?["kind"] as? String == "wipe"
    }
    if needsWipeFallback, let frame, bounds.width > 0, bounds.height > 0 {
      showingWipeComposite = true
      displayLayer.isHidden = true
      filteredFrameView.isHidden = false
      filteredFrameView.layer.setAffineTransform(.identity)
      filteredFrameView.layer.mask = nil
      filteredFrameView.frame = bounds
      wipeRenderer.render(frame: frame, outputSize: bounds.size) { [weak self] image in
        guard let self else { return }
        filteredFrameView.image = image
        onFramePresented(["timeSeconds": playheadSeconds, "quality": quality])
      }
      return
    }
    wipeRenderer.cancel()
    showingWipeComposite = false
    displayLayer.isHidden = false
    let source = videoLayer?["sourceUri"] as? String
      ?? (frame == nil ? firstVideoSource() : nil)
    guard window != nil, let source, !source.isEmpty else { return }
    let sourceTick = (videoLayer?["sourceTick"] as? NSNumber)?.int64Value
    let decodeSeconds = sourceTick.map {
      Double($0) / Double(GraphBridge.ticksPerSecond())
    } ?? playheadSeconds

    if playing,
       source == lastRequestedSource,
       !lastRequestedSeconds.isNaN,
       abs(decodeSeconds - lastRequestedSeconds) < (1.0 / 45.0) {
      return
    }
    lastRequestedSource = source
    lastRequestedSeconds = decodeSeconds

    let effects = videoLayer?["effects"] as? [[String: Any]] ?? []
    let clipID = videoLayer?["clipId"] as? String ?? ""
    let frameTick = (frame?["tick"] as? NSNumber)?.int64Value ?? sourceTick ?? 0
    let effectSeed = EffectImageProcessor.stableSeed(clipID, tick: frameTick)
    displayLayer.isHidden = !effects.isEmpty
    filteredFrameView.isHidden = effects.isEmpty
    let frameHandler: ((UIImage) -> Void)? = effects.isEmpty ? nil : { [weak self] image in
      self?.filteredFrameView.image = EffectImageProcessor.process(
        image,
        effects: effects,
        seed: effectSeed
      )
    }
    pipeline.showFrame(
      sourceURI: source,
      seconds: decodeSeconds,
      precise: !playing,
      frameHandler: frameHandler
    ) { [weak self] result in
      guard let self else { return }
      switch result {
      case .success(let seconds):
        onFramePresented(["timeSeconds": seconds, "quality": quality])
      case .failure(let error):
        // Offline/missing media is a recoverable black-frame state.
        displayLayer.flushAndRemoveImage()
        onFramePresented([
          "timeSeconds": playheadSeconds,
          "error": error.localizedDescription,
        ])
      }
    }
  }

  private func firstVideoSource() -> String? {
    guard
      let data = documentJSON.data(using: .utf8),
      let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let assets = root["assets"] as? [String: Any]
    else { return nil }

    return assets.values.lazy.compactMap { value -> String? in
      guard let asset = value as? [String: Any] else { return nil }
      let kind = (asset["kind"] as? String ?? "video").lowercased()
      return kind == "video" ? asset["sourceUri"] as? String : nil
    }.first
  }

  private func evaluatedFrame() -> [String: Any]? {
    let tick = Int64(playheadSeconds * Double(GraphBridge.ticksPerSecond()))
    guard
      let json = try? GraphBridge.parseAndEvaluate(
        documentJSON,
        tick: tick,
        previewMode: true
      ),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
  }

  private func applyEvaluatorTransform(_ frame: [String: Any]?) {
    guard
      let layers = frame?["layers"] as? [[String: Any]],
      let layer = layers.first(where: { $0["kind"] as? String == "video" }),
      let canvas = frame?["canvas"] as? [String: Any],
      let canvasWidth = number(canvas["width"]),
      let canvasHeight = number(canvas["height"]),
      let sourceWidth = number(layer["sourceWidth"]),
      let sourceHeight = number(layer["sourceHeight"]),
      canvasWidth > 0,
      canvasHeight > 0,
      sourceWidth > 0,
      sourceHeight > 0
    else {
      displayLayer.setAffineTransform(.identity)
      displayLayer.bounds = bounds
      displayLayer.position = .zero
      displayLayer.opacity = 1
      displayLayer.mask = nil
      filteredFrameView.layer.setAffineTransform(.identity)
      filteredFrameView.frame = bounds
      filteredFrameView.layer.opacity = 1
      filteredFrameView.layer.mask = nil
      return
    }
    let outputScaleX = bounds.width / canvasWidth
    let outputScaleY = bounds.height / canvasHeight
    displayLayer.bounds = CGRect(x: 0, y: 0, width: sourceWidth, height: sourceHeight)
    displayLayer.position = .zero
    displayLayer.opacity = Float(
      min(max(number(layer["opacity"]) ?? 1, 0), 1)
    )
    let transform = OverlayFrameRenderer.affineTransform(
      for: layer,
      outputScaleX: outputScaleX,
      outputScaleY: outputScaleY
    )
    displayLayer.setAffineTransform(transform)
    filteredFrameView.layer.bounds = displayLayer.bounds
    filteredFrameView.layer.position = .zero
    filteredFrameView.layer.opacity = displayLayer.opacity
    filteredFrameView.layer.setAffineTransform(transform)
    let transition = layer["transition"] as? [String: Any]
    if transition?["kind"] as? String == "wipe" {
      let progress = min(max(number(transition?["horizontalWipeProgress"]) ?? 1, 0), 1)
      let mask = CALayer()
      mask.frame = CGRect(
        x: 0,
        y: 0,
        width: sourceWidth * progress,
        height: sourceHeight
      )
      mask.backgroundColor = UIColor.white.cgColor
      displayLayer.mask = mask
      let imageMask = CALayer()
      imageMask.frame = mask.frame
      imageMask.backgroundColor = UIColor.white.cgColor
      filteredFrameView.layer.mask = imageMask
    } else {
      displayLayer.mask = nil
      filteredFrameView.layer.mask = nil
    }
  }

  private func number(_ value: Any?) -> CGFloat? {
    (value as? NSNumber).map { CGFloat(truncating: $0) }
  }

  deinit {
    pipeline.release()
    wipeRenderer.release()
  }
}
