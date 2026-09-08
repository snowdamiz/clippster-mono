#pragma once

#include "clippster/types.hpp"

#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace clippster {

struct Transform {
  double positionX = 0.5;
  double positionY = 0.5;
  double scaleX = 1.0;
  double scaleY = 1.0;
  double rotationDeg = 0.0;
  double anchorX = 0.5;
  double anchorY = 0.5;
  FitMode fit = FitMode::Contain;
};

struct RatioAwareTransform {
  Transform base;
  std::map<Ratio, Transform> overrides;
  [[nodiscard]] const Transform& forRatio(Ratio ratio) const noexcept;
};

enum class MediaKind { Video, Image, Audio };

struct MediaAsset {
  std::string id;
  MediaKind kind = MediaKind::Video;
  std::string sourceUri;
  Tick durationTicks = 0;
  int width = 0;
  int height = 0;
  double rotationDeg = 0.0;
  bool hasAudio = false;
};

struct EffectOp {
  std::string type;
  double intensity = 0.0;
};

struct VideoClip {
  std::string id;
  std::string assetId;
  Tick timelineStart = 0;
  Tick timelineEnd = 0;
  Tick sourceStart = 0;
  Tick sourceEnd = 0;
  double speed = 1.0;
  double volume = 1.0;
  RatioAwareTransform transform;
  std::vector<EffectOp> effects;
};

struct TextClip {
  std::string id;
  Tick timelineStart = 0;
  Tick timelineEnd = 0;
  std::string content;
  ColorRGBA color{1.0F, 1.0F, 1.0F, 1.0F};
  double fontSize = 48.0;
  std::string animationIn;
  std::string animationOut;
  RatioAwareTransform transform;
};

struct OverlayClip {
  std::string id;
  std::string assetId;
  Tick timelineStart = 0;
  Tick timelineEnd = 0;
  Tick sourceStart = 0;
  Tick sourceEnd = 0;
  double speed = 1.0;
  double volume = 1.0;
  double opacity = 1.0;
  RatioAwareTransform transform;
  std::vector<EffectOp> effects;
};

struct AudioClip {
  std::string id;
  std::string assetId;
  Tick timelineStart = 0;
  Tick timelineEnd = 0;
  Tick sourceStart = 0;
  Tick sourceEnd = 0;
  double speed = 1.0;
  double volume = 1.0;
  Tick fadeInTicks = 0;
  Tick fadeOutTicks = 0;
};

enum class TransitionKind { Cut, Fade, Dissolve, Wipe };

struct Transition {
  std::string id;
  std::string fromItemId;
  std::string toItemId;
  TransitionKind kind = TransitionKind::Cut;
  Tick durationTicks = 0;
};

using Clip = std::variant<VideoClip, TextClip, OverlayClip, AudioClip>;

enum class TrackKind { Video, Text, Overlay, Audio };

struct Track {
  std::string id;
  TrackKind kind = TrackKind::Video;
  int zOrder = 0;
  std::vector<Clip> clips;
  std::vector<Transition> transitions;
};

struct CanvasOutput {
  int width = 1080;
  int height = 1920;
  int fps = 30;
};

struct CaptionLayer {
  struct Word {
    std::string id;
    std::string text;
    Tick start = 0;
    Tick end = 0;
  };

  struct Phrase {
    std::string id;
    std::vector<std::string> wordIds;
    Tick start = 0;
    Tick end = 0;
  };

  bool enabled = false;
  std::string id = "caption";
  std::string presetId;
  std::vector<Word> words;
  std::vector<Phrase> phrases;
  ColorRGBA textColor{1.0F, 1.0F, 1.0F, 1.0F};
  double fontSize = 48.0;
  std::string effectMode = "phrase";
  RatioAwareTransform transform;
};

struct SceneGraph {
  std::string revisionId;
  int schemaVersion = 3;
  Ratio activeRatio = Ratio::NineSixteen;
  std::map<Ratio, CanvasOutput> outputs;
  std::map<std::string, MediaAsset, std::less<>> assets;
  std::vector<Track> tracks;
  std::optional<CaptionLayer> captionLayer;
};

[[nodiscard]] SceneGraph parseSceneGraph(std::string_view json);
[[nodiscard]] Tick secondsToTicks(double seconds) noexcept;
[[nodiscard]] double ticksToSeconds(Tick ticks) noexcept;
[[nodiscard]] std::int64_t frameIndexAt(Tick tick, int fps);
[[nodiscard]] Tick tickAtFrame(std::int64_t frame, int fps);

}  // namespace clippster
