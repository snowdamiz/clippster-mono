#include "clippster/graph_evaluator.hpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <type_traits>

namespace clippster {
namespace {

constexpr double kPi = 3.14159265358979323846;

bool active(Tick tick, Tick start, Tick end) {
  return tick >= start && tick < end;
}

AffineTransform buildTransform(const Transform& transform, int sourceWidth,
                               int sourceHeight,
                               const CanvasOutput& canvas) {
  const double width = std::max(1, sourceWidth);
  const double height = std::max(1, sourceHeight);
  const double fitX = static_cast<double>(canvas.width) / width;
  const double fitY = static_cast<double>(canvas.height) / height;
  double x = fitX;
  double y = fitY;
  if (transform.fit == FitMode::Contain) x = y = std::min(fitX, fitY);
  if (transform.fit == FitMode::Cover) x = y = std::max(fitX, fitY);
  x *= transform.scaleX;
  y *= transform.scaleY;

  const double radians = transform.rotationDeg * kPi / 180.0;
  const double cosine = std::cos(radians);
  const double sine = std::sin(radians);
  AffineTransform matrix;
  // S * R * T(-anchor), followed by T(position).
  matrix.m00 = x * cosine;
  matrix.m01 = -x * sine;
  matrix.m10 = y * sine;
  matrix.m11 = y * cosine;
  const double anchorX = transform.anchorX * width;
  const double anchorY = transform.anchorY * height;
  matrix.m02 = transform.positionX * canvas.width -
               matrix.m00 * anchorX - matrix.m01 * anchorY;
  matrix.m12 = transform.positionY * canvas.height -
               matrix.m10 * anchorX - matrix.m11 * anchorY;
  return matrix;
}

struct TimedFields {
  const std::string* id;
  Tick start;
  Tick end;
};

TimedFields timedFields(const Clip& clip) {
  return std::visit(
      [](const auto& item) {
        return TimedFields{&item.id, item.timelineStart, item.timelineEnd};
      },
      clip);
}

std::optional<TransitionBlend> transitionFor(
    const Track& track, const TimedFields& clip, Tick tick, double& opacity) {
  for (const Transition& transition : track.transitions) {
    if (transition.durationTicks <= 0 || transition.kind == TransitionKind::Cut)
      continue;
    if (transition.toItemId == *clip.id &&
        active(tick, clip.start, clip.start + transition.durationTicks)) {
      const double progress = std::clamp(
          static_cast<double>(tick - clip.start) / transition.durationTicks,
          0.0, 1.0);
      TransitionBlend blend{transition.kind, progress, progress, 1.0 - progress,
                            transition.kind == TransitionKind::Wipe ? progress
                                                                    : 1.0};
      if (transition.kind != TransitionKind::Wipe) opacity *= progress;
      return blend;
    }
    if (transition.fromItemId == *clip.id) {
      const Clip* incoming = nullptr;
      for (const Clip& candidate : track.clips) {
        if (*timedFields(candidate).id == transition.toItemId) {
          incoming = &candidate;
          break;
        }
      }
      if (!incoming) continue;
      const Tick transitionStart = timedFields(*incoming).start;
      if (!active(tick, transitionStart,
                  transitionStart + transition.durationTicks))
        continue;
      const double progress = std::clamp(
          static_cast<double>(tick - transitionStart) /
              transition.durationTicks,
          0.0, 1.0);
      TransitionBlend blend{transition.kind, progress, progress, 1.0 - progress,
                            transition.kind == TransitionKind::Wipe ? progress
                                                                    : 1.0};
      if (transition.kind != TransitionKind::Wipe) opacity *= 1.0 - progress;
      return blend;
    }
  }
  return std::nullopt;
}

Tick sourceTick(Tick timelineTick, Tick timelineStart, Tick sourceStart,
                double speed) {
  return sourceStart + secondsToTicks(
                           ticksToSeconds(timelineTick - timelineStart) * speed);
}

void applyTextAnimation(LayerDrawCmd& command, const TextClip& item, Tick tick) {
  command.opacity = item.color.a;
  constexpr Tick kAnimTicks = TICKS_PER_SECOND / 4;  // 250ms
  if (!item.animationIn.empty() && kAnimTicks > 0 &&
      tick < item.timelineStart + kAnimTicks) {
    const double progress = std::clamp(
        static_cast<double>(tick - item.timelineStart) / kAnimTicks, 0.0, 1.0);
    double scale = 1.0;
    if (item.animationIn == "bounce") {
      // Ease-out overshoot approximated as sin curve into 1.0.
      scale = std::sin(progress * kPi * 0.5);
      if (progress > 0.7) scale = 1.0 + (1.0 - progress) * 0.15;
      command.opacity *= progress;
    } else if (item.animationIn == "pop") {
      scale = 0.55 + 0.45 * progress;
      command.opacity *= progress;
    } else if (item.animationIn == "slide") {
      const double slidePx = (1.0 - progress) * 48.0;
      command.transform.m12 += slidePx;
      command.opacity *= progress;
    } else {
      // fade (default)
      command.opacity *= progress;
    }
    command.transform.m00 *= scale;
    command.transform.m01 *= scale;
    command.transform.m10 *= scale;
    command.transform.m11 *= scale;
  }
  if (!item.animationOut.empty() && kAnimTicks > 0 &&
      tick > item.timelineEnd - kAnimTicks) {
    const double progress = std::clamp(
        static_cast<double>(item.timelineEnd - tick) / kAnimTicks, 0.0, 1.0);
    command.opacity *= progress;
  }
}

}  // namespace

Vec2 AffineTransform::apply(Vec2 point) const noexcept {
  return {m00 * point.x + m01 * point.y + m02,
          m10 * point.x + m11 * point.y + m12};
}

void GraphEvaluator::setScene(SceneGraph scene) {
  for (const Track& track : scene.tracks) {
    for (const Clip& clip : track.clips) {
      std::visit(
          [&](const auto& item) {
            using T = std::decay_t<decltype(item)>;
            if constexpr (!std::is_same_v<T, TextClip>) {
              if (scene.assets.find(item.assetId) == scene.assets.end())
                throw std::invalid_argument("clip references unknown asset '" +
                                            item.assetId + "'");
            }
          },
          clip);
    }
  }
  scene_ = std::move(scene);
  lastPreviewTick_ = -1;
}

ComposedFrameDescriptor GraphEvaluator::evaluatePreview(Tick tick,
                                                         bool dropLate) {
  if (dropLate && lastPreviewTick_ >= 0 && tick <= lastPreviewTick_) {
    ComposedFrameDescriptor dropped;
    dropped.tick = tick;
    const auto output = scene_.outputs.find(scene_.activeRatio);
    if (output != scene_.outputs.end()) dropped.canvas = output->second;
    dropped.dropped = true;
    return dropped;
  }
  lastPreviewTick_ = tick;
  return evaluate(tick);
}

ComposedFrameDescriptor GraphEvaluator::evaluateExport(Tick exactTick) const {
  return evaluate(exactTick);
}

ComposedFrameDescriptor GraphEvaluator::evaluate(Tick tick) const {
  ComposedFrameDescriptor frame;
  frame.tick = tick;
  const auto output = scene_.outputs.find(scene_.activeRatio);
  if (output == scene_.outputs.end())
    throw std::logic_error("scene has no output for its active ratio");
  frame.canvas = output->second;

  for (const Track& track : scene_.tracks) {
    if (track.kind == TrackKind::Audio) continue;
    for (const Clip& clip : track.clips) {
      const TimedFields timed = timedFields(clip);
      if (!active(tick, timed.start, timed.end)) continue;
      LayerDrawCmd command;
      command.clipId = *timed.id;
      command.opacity = 1.0;

      std::visit(
          [&](const auto& item) {
            using T = std::decay_t<decltype(item)>;
            if constexpr (std::is_same_v<T, TextClip>) {
              command.kind = LayerKind::Text;
              command.text = item.content;
              command.fontSize = item.fontSize;
              command.color = item.color;
              command.sourceWidth = std::max(
                  1, static_cast<int>(std::ceil(
                         item.fontSize * 0.6 * std::max<std::size_t>(1, item.content.size()))));
              command.sourceHeight =
                  std::max(1, static_cast<int>(std::ceil(item.fontSize * 1.2)));
              command.transform =
                  buildTransform(item.transform.forRatio(scene_.activeRatio),
                                 command.sourceWidth, command.sourceHeight,
                                 frame.canvas);
              applyTextAnimation(command, item, tick);
            } else {
              const MediaAsset& asset = scene_.assets.at(item.assetId);
              command.kind = asset.kind == MediaKind::Image ? LayerKind::Image
                                                            : LayerKind::Video;
              command.mediaAssetId = asset.id;
              command.sourceUri = asset.sourceUri;
              command.sourceWidth = asset.width > 0 ? asset.width : frame.canvas.width;
              command.sourceHeight = asset.height > 0 ? asset.height : frame.canvas.height;
              command.sourceTick =
                  sourceTick(tick, item.timelineStart, item.sourceStart, item.speed);
              if constexpr (std::is_same_v<T, VideoClip> ||
                            std::is_same_v<T, OverlayClip>) {
                command.transform =
                    buildTransform(item.transform.forRatio(scene_.activeRatio),
                                   command.sourceWidth, command.sourceHeight,
                                   frame.canvas);
                command.effects = item.effects;
              }
              if constexpr (std::is_same_v<T, OverlayClip>)
                command.opacity = item.opacity;
            }
          },
          clip);
      command.transition = transitionFor(track, timed, tick, command.opacity);
      frame.layers.push_back(std::move(command));
    }
  }

  if (scene_.captionLayer && scene_.captionLayer->enabled) {
    const CaptionLayer& captions = *scene_.captionLayer;
    const auto phrase = std::find_if(
        captions.phrases.begin(), captions.phrases.end(),
        [tick](const CaptionLayer::Phrase& candidate) {
          return active(tick, candidate.start, candidate.end);
        });
    if (phrase != captions.phrases.end()) {
      std::string content;
      for (const std::string& wordId : phrase->wordIds) {
        const auto word = std::find_if(
            captions.words.begin(), captions.words.end(),
            [&wordId](const CaptionLayer::Word& candidate) {
              return candidate.id == wordId;
            });
        if (word == captions.words.end()) continue;
        if (!content.empty()) content.push_back(' ');
        content += word->text;
      }
      if (!content.empty()) {
        LayerDrawCmd command;
        command.clipId = captions.id;
        command.kind = LayerKind::Text;
        command.text = std::move(content);
        command.fontSize = captions.fontSize;
        command.color = captions.textColor;
        command.sourceWidth = std::max(
            1, static_cast<int>(std::ceil(
                   command.fontSize * 0.6 *
                   std::max<std::size_t>(1, command.text.size()))));
        command.sourceHeight = std::max(
            1, static_cast<int>(std::ceil(command.fontSize * 1.2)));
        command.transform =
            buildTransform(captions.transform.forRatio(scene_.activeRatio),
                           command.sourceWidth, command.sourceHeight,
                           frame.canvas);
        frame.layers.push_back(std::move(command));
      }
    }
  }
  return frame;
}

}  // namespace clippster
