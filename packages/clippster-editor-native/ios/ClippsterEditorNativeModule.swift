import AVFoundation
import ExpoModulesCore
import Foundation
import ImageIO

public final class ClippsterEditorNativeModule: Module {
  private let exporter = HardwareExportPipeline()
  private let stateQueue = DispatchQueue(label: "app.clippster.editor.state")
  private var documentJSON = ""
  private var isPlaying = false
  private var previewQuality = "auto"
  private var currentSeconds = 0.0
  private var playStartSeconds = 0.0
  private var playStartUptime = ProcessInfo.processInfo.systemUptime
  private var timer: DispatchSourceTimer?

  public func definition() -> ModuleDefinition {
    Name("ClippsterEditorNative")

    Constants([
      "ticksPerSecond": GraphBridge.ticksPerSecond(),
    ])

    Events(
      "onTimeUpdate",
      "onExportProgress",
      "onExportComplete",
      "onExportError",
      "onEngineError"
    )

    AsyncFunction("getCapabilities") { () -> [[String: Any]] in
      let data = Data(GraphBridge.capabilitiesJSON().utf8)
      return try JSONSerialization.jsonObject(with: data) as? [[String: Any]] ?? []
    }

    AsyncFunction("loadRevision") { (value: String) in
      try self.validateDocument(value)
      self.stateQueue.sync { self.documentJSON = value }
    }

    AsyncFunction("applyRevision") { (value: String) in
      try self.validateDocument(value)
      self.stateQueue.sync { self.documentJSON = value }
    }

    AsyncFunction("play") {
      self.stateQueue.sync {
        guard !self.isPlaying else { return }
        self.isPlaying = true
        self.playStartSeconds = self.currentSeconds
        self.playStartUptime = ProcessInfo.processInfo.systemUptime
      }
      self.startClock()
    }

    AsyncFunction("pause") {
      self.stateQueue.sync { self.isPlaying = false }
      self.stopClock()
    }

    AsyncFunction("seek") { (timeSeconds: Double, mode: String) in
      guard timeSeconds.isFinite, timeSeconds >= 0 else {
        throw ModuleError.invalidArgument("Invalid seek time")
      }
      guard mode == "interactive" || mode == "precise" else {
        throw ModuleError.invalidArgument("Seek mode must be interactive or precise")
      }
      self.stateQueue.sync {
        self.currentSeconds = timeSeconds
        self.playStartSeconds = timeSeconds
        self.playStartUptime = ProcessInfo.processInfo.systemUptime
      }
      self.sendEvent("onTimeUpdate", ["timeSeconds": timeSeconds, "mode": mode])
    }

    AsyncFunction("setPreviewQuality") { (quality: String) in
      guard ["auto", "low", "medium", "high", "full"].contains(quality) else {
        throw ModuleError.invalidArgument("Unsupported preview quality: \(quality)")
      }
      self.stateQueue.sync { self.previewQuality = quality }
    }

    AsyncFunction("getCurrentTime") { () -> Double in
      self.stateQueue.sync { self.currentSeconds }
    }

    AsyncFunction("export") { (requestJSON: String) -> [String: Any] in
      do {
        guard
          let data = requestJSON.data(using: .utf8),
          let request = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          let outputPath = request["outputPath"] as? String
        else { throw ModuleError.invalidArgument("Invalid export request JSON") }

        let outputPaths: [String]
        if let sceneJSON = request["sceneJson"] as? String {
          outputPaths = try self.exporter.exportScene(
            sceneJSON: sceneJSON,
            outputPath: outputPath,
            width: request["width"] as? Int ?? 1080,
            height: request["height"] as? Int ?? 1920,
            fps: request["fps"] as? Int ?? 30
          ) { progress in
            self.sendEvent("onExportProgress", ["progress": progress])
          }
        } else if let inputPath = request["inputPath"] as? String {
          outputPaths = try self.exporter.export(
            inputPath: inputPath,
            outputPath: outputPath
          ) { progress in
            self.sendEvent("onExportProgress", ["progress": progress])
          }
        } else {
          throw ModuleError.invalidArgument("Export request needs inputPath or sceneJson")
        }
        let result: [String: Any] = ["outputPaths": outputPaths]
        self.sendEvent("onExportComplete", result)
        return result
      } catch {
        self.sendEvent("onExportError", ["message": error.localizedDescription])
        throw error
      }
    }

    AsyncFunction("cancelExport") {
      self.exporter.cancel()
    }

    AsyncFunction("probeMedia") { (sourceURI: String) -> [String: Any?] in
      try Self.probeMediaMetadata(sourceURI)
    }

    AsyncFunction("generateProxy") {
      (sourceURI: String, destinationURI: String) -> [String: Any] in
      let source = Self.fileURL(sourceURI)
      let destination = Self.fileURL(destinationURI)
      try FileManager.default.createDirectory(
        at: destination.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      try? FileManager.default.removeItem(at: destination)
      try FileManager.default.copyItem(at: source, to: destination)
      return [
        "outputPath": destination.path,
        "passthrough": true,
        "note": "Proxy transcoding is not implemented; source was copied.",
      ]
    }

    AsyncFunction("generateThumbnail") {
      (sourceURI: String, timeSeconds: Double, destinationURI: String) -> [String: Any] in
      let asset = AVURLAsset(url: Self.fileURL(sourceURI))
      let generator = AVAssetImageGenerator(asset: asset)
      generator.appliesPreferredTrackTransform = true
      let image = try generator.copyCGImage(
        at: CMTime(seconds: max(0, timeSeconds), preferredTimescale: 600),
        actualTime: nil
      )
      let destination = Self.fileURL(destinationURI)
      try FileManager.default.createDirectory(
        at: destination.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      guard
        let target = CGImageDestinationCreateWithURL(
          destination as CFURL, "public.jpeg" as CFString, 1, nil
        )
      else { throw ModuleError.invalidArgument("Could not create thumbnail destination") }
      CGImageDestinationAddImage(target, image, [
        kCGImageDestinationLossyCompressionQuality: 0.9,
      ] as CFDictionary)
      guard CGImageDestinationFinalize(target) else {
        throw ModuleError.invalidArgument("Could not encode thumbnail")
      }
      return ["outputPath": destination.path]
    }

    View(ClippsterEditorPreviewView.self) {
      Events("onSurfaceReady", "onFramePresented")
      Prop("documentJson") { (view, value: String) in view.setDocumentJSON(value) }
      Prop("playing") { (view, value: Bool) in view.setPlaying(value) }
      Prop("playheadSeconds") { (view, value: Double) in view.setPlayheadSeconds(value) }
      Prop("quality") { (view, value: String) in view.setQuality(value) }
    }

    OnDestroy {
      self.stopClock()
      self.exporter.cancel()
    }
  }

  private func validateDocument(_ value: String) throws {
    guard !value.isEmpty else { throw ModuleError.invalidArgument("Document JSON is empty") }
    let tick = stateQueue.sync {
      Int64(currentSeconds * Double(GraphBridge.ticksPerSecond()))
    }
    do {
      _ = try GraphBridge.parseAndEvaluate(value, tick: tick, previewMode: true)
    } catch {
      sendEvent("onEngineError", ["message": error.localizedDescription])
      throw error
    }
  }

  private func startClock() {
    DispatchQueue.main.async {
      guard self.timer == nil else { return }
      let timer = DispatchSource.makeTimerSource(queue: .main)
      timer.schedule(deadline: .now(), repeating: 1.0 / 30.0)
      timer.setEventHandler { [weak self] in
        guard let self else { return }
        let value = self.stateQueue.sync { () -> Double in
          guard self.isPlaying else { return self.currentSeconds }
          self.currentSeconds = self.playStartSeconds
            + ProcessInfo.processInfo.systemUptime - self.playStartUptime
          return self.currentSeconds
        }
        self.sendEvent("onTimeUpdate", ["timeSeconds": value])
      }
      self.timer = timer
      timer.resume()
    }
  }

  private func stopClock() {
    DispatchQueue.main.async {
      self.timer?.cancel()
      self.timer = nil
    }
  }

  private static func fileURL(_ value: String) -> URL {
    if let url = URL(string: value), url.isFileURL { return url }
    return URL(fileURLWithPath: value)
  }

  private static func probeMediaMetadata(_ sourceURI: String) throws -> [String: Any?] {
    let url = fileURL(sourceURI)
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw ModuleError.invalidArgument("Media file does not exist: \(url.path)")
    }
    let asset = AVURLAsset(url: url)
    let videoTrack = asset.tracks(withMediaType: .video).first
    let audioTrack = asset.tracks(withMediaType: .audio).first
    guard let videoTrack else {
      throw ModuleError.invalidArgument("Could not validate exported video metadata")
    }
    let size = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
    let width = Int(abs(size.width).rounded())
    let height = Int(abs(size.height).rounded())
    let duration = CMTimeGetSeconds(asset.duration)
    guard width > 0, height > 0, duration.isFinite, duration > 0 else {
      throw ModuleError.invalidArgument("Could not validate exported video metadata")
    }
    let videoCodec: String
    if let format = videoTrack.formatDescriptions.first {
      let type = CMFormatDescriptionGetMediaSubType(format as! CMFormatDescription)
      videoCodec = type == kCMVideoCodecType_H264 ? "h264" : String(format: "%c%c%c%c",
        (type >> 24) & 0xff, (type >> 16) & 0xff, (type >> 8) & 0xff, type & 0xff)
    } else {
      videoCodec = "h264"
    }
    var audioCodec: String? = nil
    if let audioTrack,
       let format = audioTrack.formatDescriptions.first {
      let type = CMFormatDescriptionGetMediaSubType(format as! CMFormatDescription)
      audioCodec = type == kAudioFormatMPEG4AAC ? "aac" : String(format: "%c%c%c%c",
        (type >> 24) & 0xff, (type >> 16) & 0xff, (type >> 8) & 0xff, type & 0xff)
    }
    return [
      "width": width,
      "height": height,
      "duration": duration,
      "videoCodec": videoCodec.lowercased(),
      "audioCodec": audioCodec?.lowercased(),
    ]
  }

  private enum ModuleError: LocalizedError {
    case invalidArgument(String)

    var errorDescription: String? {
      switch self {
      case .invalidArgument(let message): return message
      }
    }
  }
}
