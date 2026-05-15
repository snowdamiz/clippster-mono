# WYSIWYG export architecture

This document maps responsibilities after the WYSIWYG export refactor (see plan: WYSIWYG Export Refactor).

## Visual (pixels)

| Concern | Owner | Notes |
|--------|--------|--------|
| Layout, transforms, crops, opacity | **Client** `buildScene` + node renderers | Same tree as preview (`preview-scene-sync` / `scene-builder`). |
| Effects, transitions, masks, text, stickers, captions | **Client** `CanvasRenderer` + GPU/2D paths used in preview | Exported at **final** canvas size; `previewEffectProcessing: false`, backing = layout size. |
| Branding watermark / layout / intro / outro | **FFmpeg** (overlays on encoded base) | Still composited in Rust after `[v]` so campaign/personal branding stays centralized. |
| Encode + container | **FFmpeg** (Tauri sidecar) | Reads pre-rendered `frame_%05d.png` sequence + muxes audio. |

Legacy: FFmpeg `filter_complex` branches that rebuilt every clip transform/color/transition for **video** are bypassed when `scene_frame_pattern` is set; those inputs are kept for **embedded clip audio** only.

## Audio

| Concern | Owner | Notes |
|--------|--------|--------|
| Per-clip trim, speed, reverse, volume + keyframes, pan, fades | **FFmpeg** (`video_editor_export.rs`) | Unchanged graph on `video_sources` / `audio_tracks`. |
| Standalone audio tracks | **FFmpeg** | Same as before. |
| Mix / amix / concat / acrossfade | **FFmpeg** | Same as before. |

## Client → Rust IPC

- `write_scene_export_frame` — append one PNG to `TEMP/clippster_scene_export/{session}/frame_%05d.png`.
- `finalize_scene_export_frames` — returns `frame_%05d` pattern for FFmpeg `-i`.
- `export_video_editor_project` — optional `scene_frame_pattern` + `scene_frame_count`; extra `-i` after all `video_sources` inputs.

## Export options

- `export_format`, `export_quality`, `include_audio` are serialized on `ExportConfig` and drive FFmpeg codec flags (MP4/H.264+AAC vs WebM/VP9+Opus, CRF/bitrate tiers, `-an` when audio omitted).

## Built Clips

- `registerEditorExportBuild` (`client/src/editor/services/registerEditorExportBuild.ts`) is the single place that either attaches a `clip_build` to an existing editor source clip or inserts a standalone `clips` row (no duplicate when a source clip exists).
