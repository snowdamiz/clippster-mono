#include "clippster/reference_renderer.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <limits>

namespace clippster {
namespace {

ColorRGBA layerColor(const LayerDrawCmd& layer) {
  if (layer.kind == LayerKind::Text) return layer.color;
  std::uint32_t hash = 2166136261U;
  for (const unsigned char c : layer.mediaAssetId) {
    hash ^= c;
    hash *= 16777619U;
  }
  const float r = 0.25F + static_cast<float>(hash & 0xFFU) / 510.0F;
  const float g =
      0.25F + static_cast<float>((hash >> 8U) & 0xFFU) / 510.0F;
  const float b =
      0.25F + static_cast<float>((hash >> 16U) & 0xFFU) / 510.0F;
  return {r, g, b, 1.0F};
}

std::uint8_t byte(float value) {
  return static_cast<std::uint8_t>(
      std::lround(std::clamp(value, 0.0F, 1.0F) * 255.0F));
}

void blend(std::uint8_t* destination, ColorRGBA source, float opacity) {
  source.a = std::clamp(source.a * opacity, 0.0F, 1.0F);
  const ColorRGBA premultiplied = source.premultiplied();
  const float destinationAlpha = destination[3] / 255.0F;
  const float inverse = 1.0F - premultiplied.a;
  const float outAlpha = premultiplied.a + destinationAlpha * inverse;
  const float outR = premultiplied.r + (destination[0] / 255.0F) * inverse;
  const float outG = premultiplied.g + (destination[1] / 255.0F) * inverse;
  const float outB = premultiplied.b + (destination[2] / 255.0F) * inverse;
  destination[0] = byte(outR);
  destination[1] = byte(outG);
  destination[2] = byte(outB);
  destination[3] = byte(outAlpha);
}

}  // namespace

Rgba8Image ReferenceRenderer::render(
    const ComposedFrameDescriptor& frame) const {
  Rgba8Image image;
  image.width = std::max(0, frame.canvas.width);
  image.height = std::max(0, frame.canvas.height);
  image.pixels.resize(static_cast<std::size_t>(image.width) * image.height * 4U);

  const ColorRGBA clear = frame.clearColor.premultiplied();
  for (std::size_t offset = 0; offset < image.pixels.size(); offset += 4U) {
    image.pixels[offset] = byte(clear.r);
    image.pixels[offset + 1] = byte(clear.g);
    image.pixels[offset + 2] = byte(clear.b);
    image.pixels[offset + 3] = byte(clear.a);
  }
  if (frame.dropped) return image;

  for (const LayerDrawCmd& layer : frame.layers) {
    const std::array<Vec2, 4> corners{
        layer.transform.apply({0.0, 0.0}),
        layer.transform.apply({static_cast<double>(layer.sourceWidth), 0.0}),
        layer.transform.apply({0.0, static_cast<double>(layer.sourceHeight)}),
        layer.transform.apply({static_cast<double>(layer.sourceWidth),
                               static_cast<double>(layer.sourceHeight)})};
    double minX = std::numeric_limits<double>::infinity();
    double minY = std::numeric_limits<double>::infinity();
    double maxX = -std::numeric_limits<double>::infinity();
    double maxY = -std::numeric_limits<double>::infinity();
    for (const Vec2 corner : corners) {
      minX = std::min(minX, corner.x);
      minY = std::min(minY, corner.y);
      maxX = std::max(maxX, corner.x);
      maxY = std::max(maxY, corner.y);
    }
    int left = std::clamp(static_cast<int>(std::floor(minX)), 0, image.width);
    const int top =
        std::clamp(static_cast<int>(std::floor(minY)), 0, image.height);
    int right = std::clamp(static_cast<int>(std::ceil(maxX)), 0, image.width);
    const int bottom =
        std::clamp(static_cast<int>(std::ceil(maxY)), 0, image.height);
    if (layer.transition &&
        layer.transition->kind == TransitionKind::Wipe) {
      right = left + static_cast<int>(
                         std::lround((right - left) *
                                     layer.transition->horizontalWipeProgress));
    }
    const ColorRGBA color = layerColor(layer);
    for (int y = top; y < bottom; ++y) {
      for (int x = left; x < right; ++x) {
        const std::size_t offset =
            (static_cast<std::size_t>(y) * image.width + x) * 4U;
        blend(image.pixels.data() + offset, color,
              static_cast<float>(std::clamp(layer.opacity, 0.0, 1.0)));
      }
    }
  }
  return image;
}

}  // namespace clippster
