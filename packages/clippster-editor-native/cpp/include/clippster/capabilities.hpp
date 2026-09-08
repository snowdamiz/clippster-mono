#pragma once

#include <string_view>
#include <vector>

namespace clippster {

enum class CapabilityId {
  Trim, Split, Speed, Volume, Crop, Reframe, Rotate, Mirror, Overlay,
  AudioMix, Opacity, Fade, Text, Captions, Dissolve, FadeTransition, Wipe,
  ColorMatrix, Lut, Brightness, Exposure, Contrast, Saturation, Temperature,
  Tint, Blur, Sharpen, Grain, Vignette, Glitch
};

struct CapabilitySpec {
  CapabilityId id;
  bool hasGraphNode = false;
  bool hasAndroidRenderer = false;
  bool hasIosRenderer = false;
  bool hasExport = false;
  bool hasValidation = false;
  bool hasGoldenFixture = false;
};

[[nodiscard]] std::string_view capabilityName(CapabilityId id) noexcept;
[[nodiscard]] std::vector<CapabilitySpec> builtinCapabilities();
[[nodiscard]] bool isToolVisible(const CapabilitySpec& capability) noexcept;

}  // namespace clippster
