#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace clippster {

using Tick = std::int64_t;

inline constexpr Tick TICKS_PER_SECOND = 60'000;
inline constexpr Tick MAX_SECONDS = 120;
inline constexpr Tick MAX_TICKS = TICKS_PER_SECOND * MAX_SECONDS;

struct Vec2 {
  double x = 0.0;
  double y = 0.0;
};

struct ColorRGBA {
  float r = 0.0F;
  float g = 0.0F;
  float b = 0.0F;
  float a = 1.0F;

  [[nodiscard]] ColorRGBA premultiplied() const noexcept {
    const float alpha = std::clamp(a, 0.0F, 1.0F);
    return {std::clamp(r, 0.0F, 1.0F) * alpha,
            std::clamp(g, 0.0F, 1.0F) * alpha,
            std::clamp(b, 0.0F, 1.0F) * alpha, alpha};
  }

  [[nodiscard]] ColorRGBA unpremultiplied() const noexcept {
    if (a <= 0.0F) return {};
    return {std::clamp(r / a, 0.0F, 1.0F),
            std::clamp(g / a, 0.0F, 1.0F),
            std::clamp(b / a, 0.0F, 1.0F), std::clamp(a, 0.0F, 1.0F)};
  }
};

enum class FitMode { Contain, Cover, Fill };
enum class Ratio { NineSixteen, SixteenNine };

}  // namespace clippster
