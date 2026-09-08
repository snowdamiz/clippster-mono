#include "clippster/capabilities.hpp"

#include <array>

namespace clippster {
namespace {

constexpr std::array<std::string_view, 30> kNames{
    "trim",          "split",           "speed",       "volume",
    "crop",          "reframe",         "rotate",      "mirror",
    "overlay",       "audio_mix",       "opacity",     "fade",
    "text",          "captions",        "dissolve",    "fade_transition",
    "wipe",          "color_matrix",    "lut",         "brightness",
    "exposure",      "contrast",        "saturation",  "temperature",
    "tint",          "blur",            "sharpen",     "grain",
    "vignette",      "glitch"};

constexpr bool initiallySupported(CapabilityId id) {
  // Only mark complete when graph node + both platform renderers + export +
  // validation + golden fixtures all exist. Partial features stay hidden.
  switch (id) {
    case CapabilityId::Trim:
    case CapabilityId::Split:
    case CapabilityId::Speed:
    case CapabilityId::Volume:
    case CapabilityId::Crop:
    case CapabilityId::Reframe:
    case CapabilityId::Rotate:
    case CapabilityId::Overlay:
    case CapabilityId::Opacity:
    case CapabilityId::Text:
    case CapabilityId::AudioMix:
    case CapabilityId::Fade:
    case CapabilityId::Dissolve:
    case CapabilityId::FadeTransition:
    case CapabilityId::Wipe:
    case CapabilityId::ColorMatrix:
    case CapabilityId::Captions:
    case CapabilityId::Brightness:
    case CapabilityId::Exposure:
    case CapabilityId::Contrast:
    case CapabilityId::Saturation:
    case CapabilityId::Temperature:
    case CapabilityId::Tint:
    case CapabilityId::Blur:
    case CapabilityId::Sharpen:
    case CapabilityId::Vignette:
    case CapabilityId::Grain:
    case CapabilityId::Mirror:
    case CapabilityId::Glitch:
      return true;
    default:
      return false;
  }
}

}  // namespace

std::string_view capabilityName(CapabilityId id) noexcept {
  const auto index = static_cast<std::size_t>(id);
  return index < kNames.size() ? kNames[index] : std::string_view{};
}

std::vector<CapabilitySpec> builtinCapabilities() {
  std::vector<CapabilitySpec> result;
  result.reserve(kNames.size());
  for (std::size_t index = 0; index < kNames.size(); ++index) {
    const auto id = static_cast<CapabilityId>(index);
    const bool supported = initiallySupported(id);
    result.push_back({id, supported, supported, supported, supported, supported,
                      supported});
  }
  return result;
}

bool isToolVisible(const CapabilitySpec& capability) noexcept {
  return capability.hasGraphNode && capability.hasAndroidRenderer &&
         capability.hasIosRenderer && capability.hasExport &&
         capability.hasValidation && capability.hasGoldenFixture;
}

}  // namespace clippster
