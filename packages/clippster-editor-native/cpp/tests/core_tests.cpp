#include "clippster/clippster_editor.hpp"

#include <algorithm>
#include <cassert>
#include <iostream>

using namespace clippster;

int main() {
  assert(secondsToTicks(1.0) == TICKS_PER_SECOND);
  assert(secondsToTicks(1.0 / 30.0) == 2'000);
  assert(ticksToSeconds(30'000) == 0.5);
  assert(frameIndexAt(60'000, 30) == 30);
  assert(tickAtFrame(15, 30) == 30'000);

  const auto capabilities = builtinCapabilities();
  const auto trim = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) { return spec.id == CapabilityId::Trim; });
  const auto blur = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) { return spec.id == CapabilityId::Blur; });
  assert(trim != capabilities.end() && isToolVisible(*trim));
  assert(blur != capabilities.end() && isToolVisible(*blur));
  const auto reframe = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) { return spec.id == CapabilityId::Reframe; });
  assert(reframe != capabilities.end() && isToolVisible(*reframe));
  const auto lut = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) { return spec.id == CapabilityId::Lut; });
  assert(lut != capabilities.end() && !isToolVisible(*lut));
  const auto text = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) { return spec.id == CapabilityId::Text; });
  const auto overlay = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) { return spec.id == CapabilityId::Overlay; });
  assert(text != capabilities.end() && isToolVisible(*text));
  assert(overlay != capabilities.end() && isToolVisible(*overlay));
  const auto captions = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) {
        return spec.id == CapabilityId::Captions;
      });
  const auto wipe = std::find_if(
      capabilities.begin(), capabilities.end(),
      [](const CapabilitySpec& spec) { return spec.id == CapabilityId::Wipe; });
  assert(captions != capabilities.end() && isToolVisible(*captions));
  assert(wipe != capabilities.end() && isToolVisible(*wipe));
  assert(capabilityName(CapabilityId::AudioMix) == "audio_mix");

  constexpr auto sceneJson = R"json({
    "schemaVersion": 3,
    "id": "project-1",
    "canvas": {
      "activeRatio": "9:16",
      "outputByRatio": {
        "9:16": {"width": 1080, "height": 1920, "fps": 30}
      }
    },
    "assets": {
      "asset-1": {
        "id": "asset-1",
        "kind": "video",
        "sourceUri": "file:///video.mp4",
        "durationTicks": 120000,
        "width": 1920,
        "height": 1080,
        "hasAudio": true
      }
    },
    "tracks": [{
      "id": "video-track",
      "kind": "video",
      "items": [{
        "id": "clip-1",
        "kind": "video",
        "assetId": "asset-1",
        "timelineStart": 0,
        "timelineEnd": 60000,
        "sourceStart": 0,
        "sourceEnd": 60000,
        "speed": 1,
        "volume": 1,
        "transform": {
          "base": {
            "positionX": 0.5, "positionY": 0.5,
            "scaleX": 1, "scaleY": 1, "rotationDeg": 0,
            "anchorX": 0.5, "anchorY": 0.5, "fit": "contain"
          }
        },
        "effectStack": []
      }],
      "transitions": []
    }]
  })json";

  SceneGraph scene = parseSceneGraph(sceneJson);
  assert(scene.schemaVersion == 3);
  assert(scene.assets.size() == 1);
  assert(scene.tracks.size() == 1);

  GraphEvaluator evaluator;
  evaluator.setScene(std::move(scene));
  const ComposedFrameDescriptor frame = evaluator.evaluatePreview(30'000);
  assert(!frame.dropped);
  assert(frame.layers.size() == 1);
  assert(frame.layers.front().kind == LayerKind::Video);
  assert(frame.layers.front().mediaAssetId == "asset-1");
  assert(frame.layers.front().sourceTick == 30'000);
  assert(evaluator.evaluatePreview(29'000, true).dropped);
  assert(!evaluator.evaluateExport(29'000).dropped);

  SceneGraph wipeScene = parseSceneGraph(sceneJson);
  VideoClip incoming = std::get<VideoClip>(wipeScene.tracks.front().clips.front());
  incoming.id = "clip-2";
  incoming.timelineStart = 30'000;
  incoming.timelineEnd = 90'000;
  wipeScene.tracks.front().clips.push_back(incoming);
  wipeScene.tracks.front().transitions.push_back(
      {"wipe-1", "clip-1", "clip-2", TransitionKind::Wipe, 30'000});
  GraphEvaluator wipeEvaluator;
  wipeEvaluator.setScene(std::move(wipeScene));
  const ComposedFrameDescriptor wipeFrame = wipeEvaluator.evaluateExport(45'000);
  assert(wipeFrame.layers.size() == 2);
  assert(wipeFrame.layers[0].transition.has_value());
  assert(wipeFrame.layers[1].transition.has_value());
  assert(wipeFrame.layers[0].transition->kind == TransitionKind::Wipe);
  assert(wipeFrame.layers[0].transition->horizontalWipeProgress == 0.5);

  constexpr auto layeredJson = R"json({
    "schemaVersion": 3,
    "id": "layered",
    "canvas": {
      "activeRatio": "9:16",
      "outputByRatio": { "9:16": {"width": 1080, "height": 1920, "fps": 30} }
    },
    "assets": {
      "asset-1": {
        "id": "asset-1", "kind": "video", "sourceUri": "file:///video.mp4",
        "durationTicks": 120000, "width": 1080, "height": 1920
      },
      "asset-2": {
        "id": "asset-2", "kind": "image", "sourceUri": "file:///overlay.png",
        "durationTicks": 120000, "width": 256, "height": 256
      }
    },
    "tracks": [
      {
        "id": "video-track", "kind": "video",
        "items": [{
          "id": "clip-1", "kind": "video", "assetId": "asset-1",
          "timelineStart": 0, "timelineEnd": 60000,
          "sourceStart": 0, "sourceEnd": 60000, "speed": 1, "volume": 1,
          "transform": { "base": {
            "positionX": 0.5, "positionY": 0.5, "scaleX": 1, "scaleY": 1,
            "rotationDeg": 0, "anchorX": 0.5, "anchorY": 0.5, "fit": "cover"
          }},
          "effectStack": [{"type": "brightness", "intensity": 50}]
        }],
        "transitions": []
      },
      {
        "id": "overlay-track", "kind": "overlay",
        "items": [{
          "id": "clip-2", "kind": "overlay", "assetId": "asset-2",
          "timelineStart": 0, "timelineEnd": 60000,
          "sourceStart": 0, "sourceEnd": 60000, "speed": 1, "volume": 0,
          "opacity": 0.5,
          "transform": { "base": {
            "positionX": 0.8, "positionY": 0.2, "scaleX": 0.3, "scaleY": 0.3,
            "rotationDeg": 0, "anchorX": 0.5, "anchorY": 0.5, "fit": "contain"
          }},
          "effectStack": []
        }]
      },
      {
        "id": "text-track", "kind": "text",
        "items": [{
          "id": "clip-3", "kind": "text", "content": "Hi",
          "timelineStart": 0, "timelineEnd": 60000,
          "style": { "fontSize": 48, "color": "#FFFFFFFF" },
          "transform": { "base": {
            "positionX": 0.5, "positionY": 0.9, "scaleX": 1, "scaleY": 1,
            "rotationDeg": 0, "anchorX": 0.5, "anchorY": 0.5, "fit": "contain"
          }}
        }]
      }
    ],
    "captionDocument": {
      "id": "captions-1",
      "enabled": true,
      "presetId": "default",
      "words": [
        {"id": "word-1", "word": "Hello", "start": 0, "end": 60000},
        {"id": "word-2", "word": "world", "start": 0, "end": 60000}
      ],
      "phrases": [{
        "id": "phrase-1",
        "wordIds": ["word-1", "word-2"],
        "start": 0,
        "end": 60000
      }],
      "settings": {"fontSize": 56, "textColor": "#FFCC00"},
      "effect": {"mode": "phrase"},
      "transform": {"base": {
        "positionX": 0.5, "positionY": 0.8, "scaleX": 1, "scaleY": 1,
        "rotationDeg": 0, "anchorX": 0.5, "anchorY": 0.5, "fit": "contain"
      }}
    }
  })json";
  GraphEvaluator layered;
  layered.setScene(parseSceneGraph(layeredJson));
  const ComposedFrameDescriptor layeredFrame = layered.evaluateExport(30'000);
  assert(layeredFrame.layers.size() == 4);
  assert(layeredFrame.layers[0].kind == LayerKind::Video);
  assert(layeredFrame.layers[0].effects.front().intensity == 50.0);
  assert(layeredFrame.layers[1].kind == LayerKind::Image);
  assert(layeredFrame.layers[1].opacity == 0.5);
  assert(layeredFrame.layers[2].kind == LayerKind::Text);
  assert(layeredFrame.layers[2].text == "Hi");
  assert(layeredFrame.layers[3].kind == LayerKind::Text);
  assert(layeredFrame.layers[3].clipId == "captions-1");
  assert(layeredFrame.layers[3].text == "Hello world");
  assert(layeredFrame.layers[3].fontSize == 56);

  ReferenceRenderer renderer;
  const Rgba8Image image = renderer.render(frame);
  assert(image.width == 1080 && image.height == 1920);
  assert(image.pixels.size() == 1080U * 1920U * 4U);

  // 16:9 golden path — same fixture semantics, alternate canvas.
  constexpr auto landscapeJson = R"json({
    "schemaVersion": 3,
    "id": "project-16x9",
    "canvas": {
      "activeRatio": "16:9",
      "outputByRatio": {
        "16:9": {"width": 1920, "height": 1080, "fps": 30}
      }
    },
    "assets": {
      "asset-1": {
        "id": "asset-1",
        "kind": "video",
        "sourceUri": "file:///video.mp4",
        "durationTicks": 120000,
        "width": 1920,
        "height": 1080
      }
    },
    "tracks": [{
      "id": "video-track",
      "kind": "video",
      "items": [{
        "id": "clip-1",
        "kind": "video",
        "assetId": "asset-1",
        "timelineStart": 0,
        "timelineEnd": 60000,
        "sourceStart": 0,
        "sourceEnd": 60000,
        "speed": 1,
        "volume": 1,
        "transform": {
          "base": {
            "positionX": 0.5, "positionY": 0.5,
            "scaleX": 1, "scaleY": 1, "rotationDeg": 0,
            "anchorX": 0.5, "anchorY": 0.5, "fit": "cover"
          }
        },
        "effectStack": []
      }],
      "transitions": []
    }]
  })json";
  GraphEvaluator landscape;
  landscape.setScene(parseSceneGraph(landscapeJson));
  const ComposedFrameDescriptor landscapeFrame = landscape.evaluateExport(0);
  const Rgba8Image landscapeImage = renderer.render(landscapeFrame);
  assert(landscapeImage.width == 1920 && landscapeImage.height == 1080);

  std::cout << "clippster_editor_core_tests: all tests passed\n";
  return 0;
}
