# Inspector to timeline / preview / playback matrix

This documents how the right-hand **Properties** stack ties into the rest of the editor after the preview fingerprint work. Use it when adding inspector fields so nothing silently skips the preview cache or export path.

## Routing

| UI | File |
|----|------|
| Shell | [`PropertiesPanel.vue`](../components/panels/PropertiesPanel.vue) |
| Video | [`VideoProperties.vue`](../components/panels/properties/VideoProperties.vue) |
| Audio | [`AudioProperties.vue`](../components/panels/properties/AudioProperties.vue) |
| Image | [`ImageProperties.vue`](../components/panels/properties/ImageProperties.vue) |
| Other types | Text, Sticker, Effect, Caption panels in same folder |
| Junction transition | [`TransitionProperties.vue`](../components/panels/properties/TransitionProperties.vue) |

## Write path (all types)

Updates must go through **`editor.timeline`** APIs (`updateElement`, `updateTracks`, `changeElementSpeed`, element commands, etc.), not only local component state, so `version` bumps and subscribers (preview, audio manager) observe changes.

## Preview (canvas)

| Layer | Role |
|-------|------|
| [`fingerprintTimelineElement`](../lib/scene-input-fingerprint.ts) | Must include any timeline field that changes **visual** `buildScene` output. |
| [`scene-builder.ts`](../renderer/scene-builder.ts) | Maps elements → `VideoNode` / `ImageNode` / … params. |
| [`getPreviewSceneTreeCached`](../renderer/preview-scene-sync.ts) | Skips `buildScene` when fingerprint matches. |

**Video / image / text / sticker / effect / caption** fields on the timeline affect the preview tree. **Audio-only** elements are fingerprinted for timeline consistency but are not drawn on the preview canvas.

## Audible preview

| Layer | Role |
|-------|------|
| [`AudioManager`](../core/managers/audio-manager.ts) | Subscribes to timeline + media + scenes; applies per-clip **linear** `volume` on a `GainNode`. |
| Clip volume keyframes | Stored as linear gain **0…max inspector boost** (see [`useVolumeEnvelope`](../composables/timeline/element/useVolumeEnvelope.ts)); export builds FFmpeg `volume='…'` expressions. |

## Export

| Layer | Role |
|-------|------|
| [`video_editor_export.rs`](../../../src-tauri/src/video_editor_export.rs) | `volume=` linear multiplier and keyframed volume expressions. |

## VideoProperties tabs (sanity checklist)

| Tab | Preview impact | Audio preview |
|-----|----------------|-----------------|
| Video (transform, opacity, fade) | Yes | Opacity/fade visual only |
| Audio (volume, pan, mute) | No | Yes |
| Speed | Yes (duration / trim semantics) | Yes |
| Adjust / Grade / Masks / Animate | Yes | No |

## Interactive drag

Continuous sliders in the inspector should set **`editor.setInteractiveDrag(true)`** while dragging (via `@pointerdown.capture` on a wrapper + global `pointerup` / `pointercancel`) so preview/scene sync can defer heavy work where the editor honors that flag—see **Video** / **Image** / **Audio** properties wrappers.

## Volume UX note

Inspector shows **dB** for ergonomics; persisted `element.volume` remains **linear gain** (unity = 1, max boost defined in [`audio-volume-ui.ts`](../lib/audio-volume-ui.ts)). Helpers live in [`audio-volume-ui.ts`](../lib/audio-volume-ui.ts).
