#pragma once

#include "clippster/graph_evaluator.hpp"

#include <cstdint>
#include <vector>

namespace clippster {

struct Rgba8Image {
  int width = 0;
  int height = 0;
  std::vector<std::uint8_t> pixels;
};

// Deterministic CPU oracle for golden tests. Media and text are represented by
// stable solid rectangles bounded by each layer's transformed source AABB.
class ReferenceRenderer {
 public:
  [[nodiscard]] Rgba8Image render(
      const ComposedFrameDescriptor& frame) const;
};

}  // namespace clippster
