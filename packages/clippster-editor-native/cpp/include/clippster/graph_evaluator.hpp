#pragma once

#include "clippster/scene_graph.hpp"

#include <optional>

namespace clippster {

struct AffineTransform {
  double m00 = 1.0, m01 = 0.0, m02 = 0.0;
  double m10 = 0.0, m11 = 1.0, m12 = 0.0;

  [[nodiscard]] Vec2 apply(Vec2 point) const noexcept;
};

enum class LayerKind { Video, Image, Text };

struct TransitionBlend {
  TransitionKind kind = TransitionKind::Cut;
  double progress = 0.0;
  double incomingWeight = 1.0;
  double outgoingWeight = 0.0;
  double horizontalWipeProgress = 1.0;
};

struct LayerDrawCmd {
  std::string clipId;
  LayerKind kind = LayerKind::Video;
  std::string mediaAssetId;
  std::string sourceUri;
  std::string text;
  Tick sourceTick = 0;
  int sourceWidth = 0;
  int sourceHeight = 0;
  double fontSize = 0.0;
  ColorRGBA color{1.0F, 1.0F, 1.0F, 1.0F};
  AffineTransform transform;
  double opacity = 1.0;
  std::vector<EffectOp> effects;
  std::optional<TransitionBlend> transition;
};

struct ComposedFrameDescriptor {
  Tick tick = 0;
  CanvasOutput canvas;
  ColorRGBA clearColor{0.0F, 0.0F, 0.0F, 1.0F};
  std::vector<LayerDrawCmd> layers;
  bool dropped = false;
};

class GraphEvaluator {
 public:
  void setScene(SceneGraph scene);
  [[nodiscard]] ComposedFrameDescriptor evaluatePreview(
      Tick tick, bool dropLate = false);
  [[nodiscard]] ComposedFrameDescriptor evaluateExport(Tick exactTick) const;

 private:
  [[nodiscard]] ComposedFrameDescriptor evaluate(Tick tick) const;

  SceneGraph scene_;
  Tick lastPreviewTick_ = -1;
};

// Geometry uses column vectors and applies, in order:
// 1. translate the source so its normalized anchor is at the origin,
// 2. rotate, 3. scale (including contain/cover/fill fit),
// 4. translate to the normalized canvas position.
// Compositors must use premultiplied-alpha source-over blending. All colors are
// assumed to be SDR sRGB; transfer conversion belongs in platform renderers.

}  // namespace clippster
