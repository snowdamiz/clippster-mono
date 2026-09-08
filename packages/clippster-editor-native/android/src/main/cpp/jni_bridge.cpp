#include <jni.h>

#include "clippster/capabilities.hpp"
#include "clippster/graph_evaluator.hpp"
#include "clippster/scene_graph.hpp"
#include "clippster/types.hpp"

#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>

namespace {

std::string fromJString(JNIEnv* env, jstring value) {
  if (value == nullptr) return {};
  const char* chars = env->GetStringUTFChars(value, nullptr);
  if (chars == nullptr) throw std::runtime_error("Unable to read Java string");
  std::string result(chars);
  env->ReleaseStringUTFChars(value, chars);
  return result;
}

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
      default:
        if (static_cast<unsigned char>(c) < 0x20) {
          out << "\\u" << std::hex << std::setw(4) << std::setfill('0')
              << static_cast<int>(static_cast<unsigned char>(c));
        } else {
          out << c;
        }
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

std::string serializeCapabilities() {
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

std::string serializeFrame(const clippster::ComposedFrameDescriptor& frame) {
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

jstring errorJson(JNIEnv* env, const std::exception& error) {
  return env->NewStringUTF(
      ("{\"error\":" + quote(error.what()) + ",\"layers\":[]}").c_str());
}

}  // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_app_clippster_editor_engine_ClippsterEditorNativeModule_nativeGetCapabilitiesJson(
    JNIEnv* env, jobject) {
  try {
    return env->NewStringUTF(serializeCapabilities().c_str());
  } catch (const std::exception& error) {
    return errorJson(env, error);
  }
}

extern "C" JNIEXPORT jstring JNICALL
Java_app_clippster_editor_engine_ClippsterEditorNativeModule_nativeParseAndEvaluate(
    JNIEnv* env, jobject, jstring scene_json, jlong tick,
    jboolean preview_mode) {
  try {
    clippster::GraphEvaluator evaluator;
    evaluator.setScene(clippster::parseSceneGraph(fromJString(env, scene_json)));
    const auto frame = preview_mode
                           ? evaluator.evaluatePreview(static_cast<clippster::Tick>(tick))
                           : evaluator.evaluateExport(static_cast<clippster::Tick>(tick));
    return env->NewStringUTF(serializeFrame(frame).c_str());
  } catch (const std::exception& error) {
    return errorJson(env, error);
  }
}

extern "C" JNIEXPORT jlong JNICALL
Java_app_clippster_editor_engine_ClippsterEditorNativeModule_nativeTicksPerSecond(
    JNIEnv*, jobject) {
  return static_cast<jlong>(clippster::TICKS_PER_SECOND);
}
