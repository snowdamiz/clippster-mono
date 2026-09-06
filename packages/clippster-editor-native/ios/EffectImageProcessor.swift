import CoreImage
import UIKit

enum EffectImageProcessor {
  private static let context = CIContext(options: [.cacheIntermediates: false])

  static func process(
    _ image: UIImage,
    effects: [[String: Any]],
    seed: UInt64 = 0
  ) -> UIImage {
    guard let cgImage = image.cgImage, !effects.isEmpty else { return image }
    var output = CIImage(cgImage: cgImage)
    let originalExtent = output.extent

    for effect in effects {
      let type = normalizedType(effect["type"] as? String)
      let raw = number(effect["intensity"])?.clamped(to: 0...100) ?? 100
      let amount = raw / 100
      let bipolar = ((raw - 50) / 50).clamped(to: -1...1)
      if let matrix = colorMatrix(type: type, amount: amount, bipolar: bipolar) {
        output = output.applyingFilter(
          "CIColorMatrix",
          parameters: [
            "inputRVector": vector(matrix.r),
            "inputGVector": vector(matrix.g),
            "inputBVector": vector(matrix.b),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
            "inputBiasVector": vector(matrix.bias),
          ]
        )
      } else if type == "blur", amount > 0 {
        output = output.clampedToExtent()
          .applyingFilter(
            "CIGaussianBlur",
            parameters: [kCIInputRadiusKey: 0.5 + amount * 24]
          )
          .cropped(to: originalExtent)
      } else if type == "sharpen", amount > 0 {
        output = output.applyingFilter(
          "CISharpenLuminance",
          parameters: [kCIInputSharpnessKey: amount * 1.5]
        )
      } else if type == "vignette", amount > 0 {
        output = output.applyingFilter(
          "CIVignette",
          parameters: ["inputIntensity": amount * 2, "inputRadius": amount * 2]
        )
      } else if type == "grain", amount > 0 {
        let noise = CIFilter(name: "CIRandomGenerator")!.outputImage!
          .cropped(to: originalExtent)
          .applyingFilter(
            "CIColorMatrix",
            parameters: [
              "inputRVector": CIVector(x: 0.2, y: 0.2, z: 0.2, w: 0),
              "inputGVector": CIVector(x: 0.2, y: 0.2, z: 0.2, w: 0),
              "inputBVector": CIVector(x: 0.2, y: 0.2, z: 0.2, w: 0),
              "inputAVector": CIVector(x: 0, y: 0, z: 0, w: amount * 0.18),
            ]
          )
        output = noise.applyingFilter(
          "CISourceOverCompositing",
          parameters: [kCIInputBackgroundImageKey: output]
        )
      } else if type == "mirror", amount > 0 {
        output = output.transformed(
          by: CGAffineTransform(translationX: originalExtent.width, y: 0)
            .scaledBy(x: -1, y: 1)
        )
      }
    }

    guard let rendered = context.createCGImage(output, from: originalExtent) else {
      return image
    }
    var result = UIImage(cgImage: rendered, scale: image.scale, orientation: image.imageOrientation)
    let glitch = intensity(of: "glitch", in: effects)
    if glitch > 0 {
      result = applyGlitch(to: result, intensity: glitch, seed: seed)
    }
    let letterbox = intensity(of: "letterbox", in: effects)
    if letterbox > 0 {
      let format = UIGraphicsImageRendererFormat()
      format.scale = image.scale
      let base = result
      result = UIGraphicsImageRenderer(size: base.size, format: format).image { _ in
        base.draw(at: .zero)
        UIColor.black.setFill()
        let bar = base.size.height * max(0.06, letterbox * 0.18)
        UIRectFill(CGRect(x: 0, y: 0, width: base.size.width, height: bar))
        UIRectFill(
          CGRect(
            x: 0,
            y: base.size.height - bar,
            width: base.size.width,
            height: bar
          )
        )
      }
    }
    return result
  }

  static func stableSeed(_ value: String, tick: Int64) -> UInt64 {
    var hash: UInt64 = 14_695_981_039_346_656_037
    for byte in value.utf8 {
      hash ^= UInt64(byte)
      hash = hash &* 1_099_511_628_211
    }
    return hash ^ UInt64(bitPattern: tick)
  }

  private static func applyGlitch(
    to image: UIImage,
    intensity: CGFloat,
    seed: UInt64
  ) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = image.scale
    var random = StableRandom(seed: seed)
    let sliceCount = min(6, max(3, Int((3 + intensity * 3).rounded())))
    return UIGraphicsImageRenderer(size: image.size, format: format).image { renderer in
      image.draw(at: .zero)
      for _ in 0..<sliceCount {
        let sliceHeight = image.size.height * (0.018 + random.unit() * 0.065)
        let top = random.unit() * max(1, image.size.height - sliceHeight)
        let offset = (random.unit() * 2 - 1) * image.size.width * 0.08 * intensity
        renderer.cgContext.saveGState()
        renderer.cgContext.clip(
          to: CGRect(x: 0, y: top, width: image.size.width, height: sliceHeight)
        )
        image.draw(at: CGPoint(x: offset, y: 0))
        renderer.cgContext.restoreGState()
      }
    }
  }

  private static func colorMatrix(
    type: String,
    amount: CGFloat,
    bipolar: CGFloat
  ) -> Matrix? {
    let identity = Matrix(
      r: [1, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 1, 0], bias: [0, 0, 0, 0]
    )
    let target: Matrix
    switch type {
    case "grayscale":
      target = Matrix(
        r: [0.3, 0.59, 0.11, 0],
        g: [0.3, 0.59, 0.11, 0],
        b: [0.3, 0.59, 0.11, 0],
        bias: [0, 0, 0, 0]
      )
    case "sepia":
      target = Matrix(
        r: [0.393, 0.769, 0.189, 0],
        g: [0.349, 0.686, 0.168, 0],
        b: [0.272, 0.534, 0.131, 0],
        bias: [0, 0, 0, 0]
      )
    case "negative":
      target = Matrix(
        r: [-1, 0, 0, 0], g: [0, -1, 0, 0], b: [0, 0, -1, 0],
        bias: [1, 1, 1, 0]
      )
    case "warm":
      target = Matrix(
        r: [1.1, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 0.9, 0],
        bias: [0.04, 0, -0.04, 0]
      )
    case "cool":
      target = Matrix(
        r: [0.9, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 1.1, 0],
        bias: [-0.04, 0, 0.04, 0]
      )
    case "brightness":
      return Matrix(
        r: identity.r, g: identity.g, b: identity.b,
        bias: [bipolar * 0.16, bipolar * 0.16, bipolar * 0.16, 0]
      ).unlessNeutral(bipolar)
    case "exposure":
      let scale = pow(2, bipolar * 0.5)
      return scaleMatrix(red: scale, green: scale, blue: scale).unlessNeutral(bipolar)
    case "contrast":
      let scale = 1 + bipolar * 0.5
      let bias = 0.5 * (1 - scale)
      return Matrix(
        r: [scale, 0, 0, 0], g: [0, scale, 0, 0], b: [0, 0, scale, 0],
        bias: [bias, bias, bias, 0]
      ).unlessNeutral(bipolar)
    case "saturation":
      let saturation = 1 + bipolar
      let inverse = 1 - saturation
      return Matrix(
        r: [0.299 * inverse + saturation, 0.587 * inverse, 0.114 * inverse, 0],
        g: [0.299 * inverse, 0.587 * inverse + saturation, 0.114 * inverse, 0],
        b: [0.299 * inverse, 0.587 * inverse, 0.114 * inverse + saturation, 0],
        bias: [0, 0, 0, 0]
      ).unlessNeutral(bipolar)
    case "temperature":
      return scaleMatrix(
        red: 1 + bipolar * 0.16,
        green: 1,
        blue: 1 - bipolar * 0.16
      ).unlessNeutral(bipolar)
    case "tint":
      return scaleMatrix(
        red: 1 + bipolar * 0.08,
        green: 1 - bipolar * 0.08,
        blue: 1 + bipolar * 0.08
      ).unlessNeutral(bipolar)
    default:
      return nil
    }
    return interpolate(identity, target, amount)
  }

  private static func scaleMatrix(red: CGFloat, green: CGFloat, blue: CGFloat) -> Matrix {
    return Matrix(
      r: [red, 0, 0, 0], g: [0, green, 0, 0], b: [0, 0, blue, 0],
      bias: [0, 0, 0, 0]
    )
  }

  private static func interpolate(_ from: Matrix, _ to: Matrix, _ amount: CGFloat) -> Matrix {
    let mix: ([CGFloat], [CGFloat]) -> [CGFloat] = { first, second in
      zip(first, second).map { pair in
        pair.0 + (pair.1 - pair.0) * amount
      }
    }
    return Matrix(
      r: mix(from.r, to.r),
      g: mix(from.g, to.g),
      b: mix(from.b, to.b),
      bias: mix(from.bias, to.bias)
    )
  }

  private static func intensity(of type: String, in effects: [[String: Any]]) -> CGFloat {
    guard let effect = effects.first(where: {
      normalizedType($0["type"] as? String) == type
    }) else { return 0 }
    return (number(effect["intensity"]) ?? 100).clamped(to: 0...100) / 100
  }

  private static func normalizedType(_ value: String?) -> String {
    (value ?? "").lowercased().replacingOccurrences(of: "-", with: "_")
      .replacingOccurrences(of: "adjust_", with: "")
  }

  private static func number(_ value: Any?) -> CGFloat? {
    (value as? NSNumber).map { CGFloat(truncating: $0) }
  }

  private static func vector(_ values: [CGFloat]) -> CIVector {
    CIVector(x: values[0], y: values[1], z: values[2], w: values[3])
  }

  private struct Matrix {
    let r: [CGFloat]
    let g: [CGFloat]
    let b: [CGFloat]
    let bias: [CGFloat]

    func unlessNeutral(_ value: CGFloat) -> Matrix? {
      value == 0 ? nil : self
    }
  }

  private struct StableRandom {
    private var state: UInt64

    init(seed: UInt64) {
      state = seed == 0 ? 0x9E37_79B9_7F4A_7C15 : seed
    }

    mutating func unit() -> CGFloat {
      state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
      return CGFloat(Double(state >> 11) / 9_007_199_254_740_992.0)
    }
  }
}

private extension CGFloat {
  func clamped(to range: ClosedRange<CGFloat>) -> CGFloat {
    min(max(self, range.lowerBound), range.upperBound)
  }
}
