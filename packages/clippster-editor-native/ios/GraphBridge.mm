#import "GraphBridge.h"

#include "clippster/capabilities.hpp"
#include "clippster/graph_evaluator.hpp"
#include "clippster/scene_graph.hpp"
#include "clippster/types.hpp"

#include <iomanip>
#include <sstream>
#include <string>

namespace {

std::string quote(std::string_view value) {
  std::ostringstream out;
  out << '"';
  for (const char c : value) {
    switch (c) {
      case '"': out << "\\\""; break;
      case '\\': out << "\\\\"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default: out << c;
    }
  }
  return out.str() + '"';
}

const char* layerKind(clippster::LayerKind kind) {
  switch (kind) {
    case clippster::LayerKind::Image: return "image";
    case clippster::LayerKind::Text: return "text";
    case clippster::LayerKind::Video: return "video";
  }
  return "video";
}

const char* transitionKind(clippster::TransitionKind kind) {
  switch (kind) {
    case clippster::TransitionKind::Cut: return "cut";
    case clippster::TransitionKind::Fade: return "fade";
    case clippster::TransitionKind::Dissolve: return "dissolve";
    case clippster::TransitionKind::Wipe: return "wipe";
  }
  return "cut";
}

std::string capabilitiesJSON() {
  std::ostringstream out;
  out << '[';
  bool first = true;
  for (const auto& spec : clippster::builtinCapabilities()) {
    if (!first) out << ',';
    first = false;
    out << "{\"id\":" << quote(clippster::capabilityName(spec.id))
        << ",\"hasGraphNode\":" << (spec.hasGraphNode ? "true" : "false")
        << ",\"hasAndroidRenderer\":"
        << (spec.hasAndroidRenderer ? "true" : "false")
        << ",\"hasIosRenderer\":" << (spec.hasIosRenderer ? "true" : "false")
        << ",\"hasExport\":" << (spec.hasExport ? "true" : "false")
        << ",\"hasValidation\":" << (spec.hasValidation ? "true" : "false")
        << ",\"hasGoldenFixture\":"
        << (spec.hasGoldenFixture ? "true" : "false") << '}';
  }
  return out.str() + ']';
}

std::string frameJSON(const clippster::ComposedFrameDescriptor& frame) {
  std::ostringstream out;
  out << std::setprecision(15)
      << "{\"tick\":" << frame.tick << ",\"canvas\":{\"width\":"
      << frame.canvas.width << ",\"height\":" << frame.canvas.height
      << ",\"fps\":" << frame.canvas.fps << "},\"dropped\":"
      << (frame.dropped ? "true" : "false") << ",\"layers\":[";
  bool first = true;
  for (const auto& layer : frame.layers) {
    if (!first) out << ',';
    first = false;
    out << "{\"clipId\":" << quote(layer.clipId)
        << ",\"kind\":" << quote(layerKind(layer.kind))
        << ",\"mediaAssetId\":" << quote(layer.mediaAssetId)
        << ",\"sourceUri\":" << quote(layer.sourceUri)
        << ",\"text\":" << quote(layer.text)
        << ",\"sourceTick\":" << layer.sourceTick
        << ",\"sourceWidth\":" << layer.sourceWidth
        << ",\"sourceHeight\":" << layer.sourceHeight
        << ",\"fontSize\":" << layer.fontSize
        << ",\"color\":{\"r\":" << layer.color.r
        << ",\"g\":" << layer.color.g
        << ",\"b\":" << layer.color.b
        << ",\"a\":" << layer.color.a << '}'
        << ",\"opacity\":" << layer.opacity
        << ",\"effects\":[";
    bool firstEffect = true;
    for (const auto& effect : layer.effects) {
      if (!firstEffect) out << ',';
      firstEffect = false;
      out << "{\"type\":" << quote(effect.type)
          << ",\"intensity\":" << effect.intensity << '}';
    }
    out << "],\"transform\":{\"m00\":" << layer.transform.m00
        << ",\"m01\":" << layer.transform.m01
        << ",\"m02\":" << layer.transform.m02
        << ",\"m10\":" << layer.transform.m10
        << ",\"m11\":" << layer.transform.m11
        << ",\"m12\":" << layer.transform.m12 << '}';
    if (layer.transition) {
      out << ",\"transition\":{\"kind\":"
          << quote(transitionKind(layer.transition->kind))
          << ",\"progress\":" << layer.transition->progress
          << ",\"incomingWeight\":" << layer.transition->incomingWeight
          << ",\"outgoingWeight\":" << layer.transition->outgoingWeight
          << ",\"horizontalWipeProgress\":"
          << layer.transition->horizontalWipeProgress << '}';
    }
    out << '}';
  }
  return out.str() + "]}";
}

NSString* toNSString(const std::string& value) {
  return [[NSString alloc] initWithBytes:value.data()
                                  length:value.size()
                                encoding:NSUTF8StringEncoding];
}

}  // namespace

@implementation GraphBridge

+ (int64_t)ticksPerSecond {
  return clippster::TICKS_PER_SECOND;
}

+ (NSString *)capabilitiesJSON {
  return toNSString(::capabilitiesJSON());
}

+ (nullable NSString *)parseAndEvaluate:(NSString *)sceneJSON
                                   tick:(int64_t)tick
                            previewMode:(BOOL)previewMode
                                  error:(NSError * _Nullable * _Nullable)error {
  try {
    const char* utf8 = sceneJSON.UTF8String;
    clippster::GraphEvaluator evaluator;
    evaluator.setScene(clippster::parseSceneGraph(utf8 == nullptr ? "" : utf8));
    const auto frame =
        previewMode ? evaluator.evaluatePreview(tick) : evaluator.evaluateExport(tick);
    return toNSString(frameJSON(frame));
  } catch (const std::exception& exception) {
    if (error != nullptr) {
      NSString* message = toNSString(exception.what());
      *error = [NSError errorWithDomain:@"ClippsterEditorNative"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey: message}];
    }
    return nil;
  }
}

@end
