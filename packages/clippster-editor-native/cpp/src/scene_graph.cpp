#include "clippster/scene_graph.hpp"

#include "clippster/json_lite.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace clippster {
namespace {

using json::Value;

long double roundLikeJavaScript(long double value) {
  return std::floor(value + 0.5L);
}

const Value& required(const Value& object, std::string_view key) {
  const Value* value = object.find(key);
  if (!value) throw json::ParseError("missing required field '" + std::string(key) + "'");
  return *value;
}

std::string stringOr(const Value& object, std::string_view key,
                     std::string fallback = {}) {
  const Value* value = object.find(key);
  return value ? value->asString() : std::move(fallback);
}

double numberOr(const Value& object, std::string_view key, double fallback) {
  const Value* value = object.find(key);
  return value ? value->asNumber() : fallback;
}

bool boolOr(const Value& object, std::string_view key, bool fallback) {
  const Value* value = object.find(key);
  return value ? value->asBool() : fallback;
}

Tick tickValue(const Value& value, std::string_view field) {
  const double number = value.asNumber();
  if (!std::isfinite(number) || std::trunc(number) != number ||
      number < static_cast<double>(std::numeric_limits<Tick>::min()) ||
      number > static_cast<double>(std::numeric_limits<Tick>::max()))
    throw json::ParseError("field '" + std::string(field) + "' must be an integer tick");
  return static_cast<Tick>(number);
}

Tick tickOr(const Value& object, std::string_view key, Tick fallback) {
  const Value* value = object.find(key);
  return value ? tickValue(*value, key) : fallback;
}

int intValue(const Value& value, std::string_view field) {
  const double number = value.asNumber();
  if (std::trunc(number) != number ||
      number < static_cast<double>(std::numeric_limits<int>::min()) ||
      number > static_cast<double>(std::numeric_limits<int>::max()))
    throw json::ParseError("field '" + std::string(field) + "' must be an integer");
  return static_cast<int>(number);
}

FitMode parseFit(std::string_view fit) {
  if (fit == "contain") return FitMode::Contain;
  if (fit == "cover") return FitMode::Cover;
  if (fit == "fill") return FitMode::Fill;
  throw json::ParseError("unknown fit mode");
}

Ratio parseRatio(std::string_view ratio) {
  if (ratio == "9:16") return Ratio::NineSixteen;
  if (ratio == "16:9") return Ratio::SixteenNine;
  throw json::ParseError("unknown canvas ratio");
}

Transform parseTransform(const Value& value, const Transform& defaults = {}) {
  static_cast<void>(value.asObject());
  Transform result = defaults;
  result.positionX = numberOr(value, "positionX", result.positionX);
  result.positionY = numberOr(value, "positionY", result.positionY);
  result.scaleX = numberOr(value, "scaleX", result.scaleX);
  result.scaleY = numberOr(value, "scaleY", result.scaleY);
  result.rotationDeg = numberOr(value, "rotationDeg", result.rotationDeg);
  result.anchorX = numberOr(value, "anchorX", result.anchorX);
  result.anchorY = numberOr(value, "anchorY", result.anchorY);
  if (const Value* fit = value.find("fit")) result.fit = parseFit(fit->asString());
  return result;
}

RatioAwareTransform parseRatioTransform(const Value* value) {
  RatioAwareTransform result;
  if (!value) return result;
  static_cast<void>(value->asObject());
  if (const Value* base = value->find("base")) {
    result.base = parseTransform(*base);
  } else {
    result.base = parseTransform(*value);
  }
  if (const Value* overrides = value->find("overrides")) {
    for (const auto& [key, overrideValue] : overrides->asObject())
      result.overrides.emplace(parseRatio(key),
                               parseTransform(overrideValue, result.base));
  }
  return result;
}

MediaKind parseMediaKind(std::string_view kind) {
  if (kind == "video") return MediaKind::Video;
  if (kind == "image") return MediaKind::Image;
  if (kind == "audio") return MediaKind::Audio;
  throw json::ParseError("unknown media kind");
}

TrackKind parseTrackKind(std::string_view kind) {
  if (kind == "video") return TrackKind::Video;
  if (kind == "text") return TrackKind::Text;
  if (kind == "overlay") return TrackKind::Overlay;
  if (kind == "audio") return TrackKind::Audio;
  throw json::ParseError("unknown track kind");
}

TransitionKind parseTransitionKind(std::string_view kind) {
  if (kind == "cut") return TransitionKind::Cut;
  if (kind == "fade") return TransitionKind::Fade;
  if (kind == "dissolve") return TransitionKind::Dissolve;
  if (kind == "wipe") return TransitionKind::Wipe;
  throw json::ParseError("unknown transition kind");
}

std::vector<EffectOp> parseEffects(const Value* value) {
  std::vector<EffectOp> effects;
  if (!value) return effects;
  for (const Value& entry : value->asArray()) {
    EffectOp effect;
    effect.type = required(entry, "type").asString();
    effect.intensity = std::clamp(numberOr(entry, "intensity", 100.0), 0.0, 100.0);
    effects.push_back(std::move(effect));
  }
  return effects;
}

ColorRGBA parseHexColor(std::string_view value) {
  if (value.size() != 7 && value.size() != 9)
    return {1.0F, 1.0F, 1.0F, 1.0F};
  auto component = [&](std::size_t offset) -> float {
    const std::string token(value.substr(offset, 2));
    try {
      return static_cast<float>(std::stoul(token, nullptr, 16)) / 255.0F;
    } catch (...) {
      return 1.0F;
    }
  };
  if (value.front() != '#') return {1.0F, 1.0F, 1.0F, 1.0F};
  return {component(1), component(3), component(5),
          value.size() == 9 ? component(7) : 1.0F};
}

void validateTimed(Tick start, Tick end) {
  if (start < 0 || end <= start || end > MAX_TICKS)
    throw json::ParseError("clip timeline range is invalid or exceeds 120 seconds");
}

Clip parseClip(const Value& item, TrackKind kind) {
  const std::string id = required(item, "id").asString();
  const Tick start = tickValue(required(item, "timelineStart"), "timelineStart");
  const Tick end = tickValue(required(item, "timelineEnd"), "timelineEnd");
  validateTimed(start, end);
  if (kind == TrackKind::Video) {
    VideoClip clip;
    clip.id = id;
    clip.assetId = required(item, "assetId").asString();
    clip.timelineStart = start;
    clip.timelineEnd = end;
    clip.sourceStart = tickOr(item, "sourceStart", 0);
    clip.sourceEnd = tickOr(item, "sourceEnd", clip.sourceStart + (end - start));
    clip.speed = numberOr(item, "speed", 1.0);
    clip.volume = numberOr(item, "volume", 1.0);
    clip.transform = parseRatioTransform(item.find("transform"));
    clip.effects = parseEffects(item.find("effectStack"));
    return clip;
  }
  if (kind == TrackKind::Text) {
    TextClip clip;
    clip.id = id;
    clip.timelineStart = start;
    clip.timelineEnd = end;
    clip.content = required(item, "content").asString();
    clip.transform = parseRatioTransform(item.find("transform"));
    if (const Value* style = item.find("style")) {
      clip.fontSize = numberOr(*style, "fontSize", clip.fontSize);
      clip.color = parseHexColor(stringOr(*style, "color", "#FFFFFFFF"));
    }
    clip.animationIn = stringOr(item, "animationIn");
    clip.animationOut = stringOr(item, "animationOut");
    return clip;
  }
  if (kind == TrackKind::Overlay) {
    OverlayClip clip;
    clip.id = id;
    clip.assetId = required(item, "assetId").asString();
    clip.timelineStart = start;
    clip.timelineEnd = end;
    clip.sourceStart = tickOr(item, "sourceStart", 0);
    clip.sourceEnd = tickOr(item, "sourceEnd", clip.sourceStart + (end - start));
    clip.speed = numberOr(item, "speed", 1.0);
    clip.volume = numberOr(item, "volume", 1.0);
    clip.opacity = std::clamp(numberOr(item, "opacity", 1.0), 0.0, 1.0);
    clip.transform = parseRatioTransform(item.find("transform"));
    clip.effects = parseEffects(item.find("effectStack"));
    return clip;
  }
  AudioClip clip;
  clip.id = id;
  clip.assetId = required(item, "assetId").asString();
  clip.timelineStart = start;
  clip.timelineEnd = end;
  clip.sourceStart = tickOr(item, "sourceStart", 0);
  clip.sourceEnd = tickOr(item, "sourceEnd", clip.sourceStart + (end - start));
  clip.speed = numberOr(item, "speed", 1.0);
  clip.volume = numberOr(item, "volume", 1.0);
  clip.fadeInTicks = tickOr(item, "fadeInTicks", 0);
  clip.fadeOutTicks = tickOr(item, "fadeOutTicks", 0);
  return clip;
}

}  // namespace

const Transform& RatioAwareTransform::forRatio(Ratio ratio) const noexcept {
  const auto found = overrides.find(ratio);
  return found == overrides.end() ? base : found->second;
}

SceneGraph parseSceneGraph(std::string_view source) {
  const Value root = json::parse(source);
  static_cast<void>(root.asObject());
  SceneGraph scene;
  scene.schemaVersion = intValue(required(root, "schemaVersion"), "schemaVersion");
  if (scene.schemaVersion != 3)
    throw json::ParseError("only MobileEditProject schema version 3 is supported");
  scene.revisionId = stringOr(root, "revisionId", stringOr(root, "id"));

  const Value& canvas = required(root, "canvas");
  scene.activeRatio = parseRatio(stringOr(canvas, "activeRatio", "9:16"));
  if (const Value* outputs = canvas.find("outputByRatio")) {
    for (const auto& [ratioName, outputValue] : outputs->asObject()) {
      CanvasOutput output;
      output.width = intValue(required(outputValue, "width"), "width");
      output.height = intValue(required(outputValue, "height"), "height");
      output.fps = intValue(required(outputValue, "fps"), "fps");
      if (output.width <= 0 || output.height <= 0 || output.fps <= 0)
        throw json::ParseError("canvas output values must be positive");
      scene.outputs.emplace(parseRatio(ratioName), output);
    }
  }
  if (scene.outputs.empty())
    scene.outputs.emplace(scene.activeRatio, CanvasOutput{});

  for (const auto& [assetId, assetValue] : required(root, "assets").asObject()) {
    MediaAsset asset;
    asset.id = stringOr(assetValue, "id", assetId);
    asset.kind = parseMediaKind(required(assetValue, "kind").asString());
    asset.sourceUri = required(assetValue, "sourceUri").asString();
    asset.durationTicks = tickValue(required(assetValue, "durationTicks"), "durationTicks");
    asset.width = assetValue.find("width") ? intValue(*assetValue.find("width"), "width") : 0;
    asset.height = assetValue.find("height") ? intValue(*assetValue.find("height"), "height") : 0;
    asset.rotationDeg = numberOr(assetValue, "rotationDeg", 0.0);
    asset.hasAudio = boolOr(assetValue, "hasAudio", false);
    scene.assets.emplace(asset.id, std::move(asset));
  }

  int zOrder = 0;
  for (const Value& trackValue : required(root, "tracks").asArray()) {
    Track track;
    track.id = required(trackValue, "id").asString();
    track.kind = parseTrackKind(required(trackValue, "kind").asString());
    track.zOrder = trackValue.find("zOrder")
                       ? intValue(*trackValue.find("zOrder"), "zOrder")
                       : zOrder;
    ++zOrder;
    for (const Value& item : required(trackValue, "items").asArray())
      track.clips.push_back(parseClip(item, track.kind));
    if (const Value* transitions = trackValue.find("transitions")) {
      for (const Value& entry : transitions->asArray()) {
        Transition transition;
        transition.id = required(entry, "id").asString();
        transition.fromItemId = required(entry, "fromItemId").asString();
        transition.toItemId = required(entry, "toItemId").asString();
        transition.kind =
            parseTransitionKind(required(entry, "transition").asString());
        transition.durationTicks =
            tickValue(required(entry, "durationTicks"), "durationTicks");
        track.transitions.push_back(std::move(transition));
      }
    }
    scene.tracks.push_back(std::move(track));
  }
  std::stable_sort(scene.tracks.begin(), scene.tracks.end(),
                   [](const Track& a, const Track& b) {
                     return a.zOrder < b.zOrder;
                   });

  if (const Value* caption = root.find("captionDocument")) {
    CaptionLayer layer;
    layer.id = stringOr(*caption, "id", "caption");
    layer.enabled = boolOr(*caption, "enabled", false);
    layer.presetId = stringOr(*caption, "presetId");
    layer.transform = parseRatioTransform(caption->find("transform"));
    if (const Value* words = caption->find("words")) {
      for (const Value& entry : words->asArray()) {
        CaptionLayer::Word word;
        word.id = required(entry, "id").asString();
        word.text = required(entry, "word").asString();
        word.start = tickValue(required(entry, "start"), "start");
        word.end = tickValue(required(entry, "end"), "end");
        validateTimed(word.start, word.end);
        layer.words.push_back(std::move(word));
      }
    }
    if (const Value* phrases = caption->find("phrases")) {
      for (const Value& entry : phrases->asArray()) {
        CaptionLayer::Phrase phrase;
        phrase.id = required(entry, "id").asString();
        phrase.start = tickValue(required(entry, "start"), "start");
        phrase.end = tickValue(required(entry, "end"), "end");
        validateTimed(phrase.start, phrase.end);
        for (const Value& wordId : required(entry, "wordIds").asArray())
          phrase.wordIds.push_back(wordId.asString());
        layer.phrases.push_back(std::move(phrase));
      }
    }
    if (const Value* settings = caption->find("settings")) {
      layer.textColor =
          parseHexColor(stringOr(*settings, "textColor", "#FFFFFFFF"));
      layer.fontSize = numberOr(*settings, "fontSize", layer.fontSize);
    }
    if (const Value* effect = caption->find("effect"))
      layer.effectMode = stringOr(*effect, "mode", layer.effectMode);
    scene.captionLayer = std::move(layer);
  }
  return scene;
}

Tick secondsToTicks(double seconds) noexcept {
  if (!std::isfinite(seconds)) return 0;
  const long double ticks =
      static_cast<long double>(seconds) * TICKS_PER_SECOND;
  if (ticks >= static_cast<long double>(std::numeric_limits<Tick>::max()))
    return std::numeric_limits<Tick>::max();
  if (ticks <= static_cast<long double>(std::numeric_limits<Tick>::min()))
    return std::numeric_limits<Tick>::min();
  return static_cast<Tick>(roundLikeJavaScript(ticks));
}

double ticksToSeconds(Tick ticks) noexcept {
  return static_cast<double>(ticks) / static_cast<double>(TICKS_PER_SECOND);
}

std::int64_t frameIndexAt(Tick tick, int fps) {
  if (fps <= 0) throw std::invalid_argument("fps must be positive");
  return static_cast<std::int64_t>(roundLikeJavaScript(
      static_cast<long double>(tick) * fps / TICKS_PER_SECOND));
}

Tick tickAtFrame(std::int64_t frame, int fps) {
  if (fps <= 0) throw std::invalid_argument("fps must be positive");
  return static_cast<Tick>(roundLikeJavaScript(
      static_cast<long double>(frame) * TICKS_PER_SECOND / fps));
}

}  // namespace clippster
