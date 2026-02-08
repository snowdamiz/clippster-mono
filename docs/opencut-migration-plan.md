# OpenCut Editor Migration Plan

## Current Status (Feb 2026)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1-3: Core, storage, composables | ✅ DONE | EditorCore, managers, types, storage, composables all ported |
| Phase 4: Vue components | ✅ DONE | 27 Vue SFCs ported from 39 React TSX files |
| Phase 5: Bridge + routing | ✅ DONE | project-loader.ts, OpenCutEditor.vue page, /editor route |
| Phase 6: Export pipeline | ✅ DONE | RendererManager → Tauri FFmpeg via invoke + save dialog |
| Phase 7a: VideoEditor.vue cleanup | ✅ DONE | ClipEditorDialog removed, routes to new editor |
| Phase 7b: Dead code cleanup | ✅ DONE | scene-exporter.ts deprecated |
| Phase 7c: Full legacy removal | ✅ DONE | 24 components + 41 composables + 2 bridge composables deleted |
| Phase 8: Integration testing | 🔲 TODO | Verify full flow end-to-end |

**Key files:**
- Editor page: `client/src/pages/OpenCutEditor.vue`
- Editor route: `/editor?projectId=<id>`
- Bridge: `client/src/editor/bridge/project-loader.ts`
- Export: `client/src/editor/core/managers/renderer-manager.ts` → `export_video_editor_project` Tauri command
- All editor code: `client/src/editor/`

**Legacy code removed:**
- `client/src/components/clip-editor/` — 24 components deleted, only `ExistingProjectDialog.vue` kept (used by ProjectWorkspaceDialog)
- `client/src/composables/clip-editor/` — 41 composables deleted entirely
- `client/src/composables/useEditorDataLoaderWithClipExtraction.ts` — deleted (depended on legacy)
- `client/src/composables/useTimelineClipMigration.ts` — deleted (depended on legacy)
- All 3 consumers (VideoEditor.vue, Projects.vue, ProjectWorkspaceDialog.vue) now navigate to `/editor?projectId=<id>`

---

## Overview
Replace Clippster's current clip editor with a Vue port of OpenCut's CapCut-clone editor.
OpenCut is MIT licensed. Our app keeps everything outside the editor (auth, clips, detection, etc).

## OpenCut Files to Port (editor-only, from `apps/web/src/`)

### TIER 1: Framework-Agnostic Core (copy nearly as-is)
These have ZERO React dependencies — pure TypeScript classes.

**Core Managers** (`core/`)
- `core/index.ts` — EditorCore singleton (10 managers)
- `core/managers/playback-manager.ts` — RAF clock, play/pause/seek/volume
- `core/managers/timeline-manager.ts` — tracks, elements, duration, commands
- `core/managers/scenes-manager.ts` — multi-scene support
- `core/managers/project-manager.ts` — project state
- `core/managers/media-manager.ts` — media assets (needs Tauri bridge)
- `core/managers/renderer-manager.ts` — render tree state
- `core/managers/commands/` — CommandManager (undo/redo)
- `core/managers/save-manager.ts` — auto-save (needs Tauri bridge)
- `core/managers/audio-manager.ts` — Web Audio scheduling via mediabunny
- `core/managers/selection-manager.ts` — element selection

**Commands** (`lib/commands/`)
- `lib/commands/base-command.ts`
- `lib/commands/index.ts`
- `lib/commands/media/add-media-asset.ts`
- `lib/commands/media/remove-media-asset.ts`
- `lib/commands/project/update-project-settings.ts`
- `lib/commands/scene/create-scene.ts`
- `lib/commands/scene/delete-scene.ts`
- `lib/commands/scene/rename-scene.ts`
- `lib/commands/scene/toggle-bookmark.ts`
- `lib/commands/scene/remove-bookmark.ts`
- `lib/commands/timeline/element/insert-element.ts`
- `lib/commands/timeline/element/delete-elements.ts`
- `lib/commands/timeline/element/duplicate-elements.ts`
- `lib/commands/timeline/element/move-elements.ts`
- `lib/commands/timeline/element/split-elements.ts`
- `lib/commands/timeline/element/update-element-duration.ts`
- `lib/commands/timeline/element/update-element-start-time.ts`
- `lib/commands/timeline/element/update-element-trim.ts`
- `lib/commands/timeline/element/update-text-element.ts`
- `lib/commands/timeline/element/toggle-elements-visibility.ts`
- `lib/commands/timeline/element/toggle-elements-muted.ts`
- `lib/commands/timeline/clipboard/paste.ts`
- `lib/commands/timeline/track/add-track.ts`
- `lib/commands/timeline/track/remove-track.ts`
- `lib/commands/timeline/track/toggle-track-mute.ts`
- `lib/commands/timeline/track/toggle-track-visibility.ts`

**Renderer** (`services/renderer/`)
- `services/renderer/canvas-renderer.ts` — OffscreenCanvas renderer
- `services/renderer/scene-builder.ts` — builds render tree from tracks
- `services/renderer/scene-exporter.ts` — mediabunny export (keep for web, add FFmpeg option)
- `services/renderer/nodes/base-node.ts`
- `services/renderer/nodes/root-node.ts`
- `services/renderer/nodes/video-node.ts`
- `services/renderer/nodes/image-node.ts`
- `services/renderer/nodes/text-node.ts`
- `services/renderer/nodes/sticker-node.ts`
- `services/renderer/nodes/color-node.ts`
- `services/renderer/nodes/blur-background-node.ts`

**Video Cache** (`services/video-cache/`)
- `services/video-cache/service.ts` — mediabunny CanvasSink frame cache

**Types** (`types/`)
- `types/timeline.ts` — TScene, TimelineTrack, TimelineElement, etc.
- `types/assets.ts` — MediaAsset
- `types/project.ts` — TProject, TCanvasSize, TBackground
- `types/export.ts` — ExportFormat, ExportQuality
- `types/editor.ts` — TPlatformLayout
- `types/keybinding.ts`
- `types/sounds.ts`
- `types/stickers.ts`
- `types/time.ts`
- `types/drag.ts`
- `types/transcription.ts`

**Utilities** (`lib/`, `utils/`)
- `lib/time.ts` — time formatting, frame calculations
- `lib/scenes.ts` — scene duration helpers
- `lib/timeline/index.ts` — calculateTotalDuration
- `lib/timeline/track-utils.ts`
- `lib/timeline/element-utils.ts`
- `lib/timeline/drop-utils.ts`
- `lib/timeline/ruler-utils.ts`
- `lib/timeline/zoom-utils.ts`
- `lib/timeline/bookmarks.ts`
- `lib/media/audio.ts` — collectAudioClips, createAudioContext
- `lib/media/media-utils.ts`
- `lib/media/mediabunny.ts` — getVideoInfo wrapper
- `lib/media/processing.ts` — processMediaAssets, generateThumbnail
- `lib/drag-data.ts`
- `lib/export.ts`
- `lib/actions/definitions.ts` — action registry
- `lib/actions/registry.ts`
- `lib/actions/types.ts`
- `lib/gradients/canvas.ts`
- `lib/gradients/parser.ts`
- `lib/iconify-api.ts` — sticker search
- `lib/transcription/caption.ts`
- `utils/id.ts` — generateUUID
- `utils/math.ts`
- `utils/geometry.ts`
- `utils/string.ts`
- `utils/platform.ts`
- `utils/browser.ts`
- `utils/date.ts`
- `utils/ui.ts`

### TIER 2: Storage Layer (needs Tauri adaptation)
Replace IndexedDB/OPFS with Tauri SQLite.

- `services/storage/service.ts` → rewrite to use Tauri SQLite
- `services/storage/types.ts` → keep types, change storage backend
- `services/storage/indexeddb-adapter.ts` → replace with SQLite adapter
- `services/storage/opfs-adapter.ts` → replace with filesystem adapter
- `services/storage/migrations/` → adapt for SQLite

### TIER 3: React Hooks → Vue Composables
Each React hook becomes a Vue composable.

- `hooks/use-editor.ts` → `composables/useEditor.ts`
- `hooks/use-raf-loop.ts` → `composables/useRafLoop.ts`
- `hooks/use-keybindings.ts` → `composables/useKeybindings.ts`
- `hooks/use-keyboard-shortcuts-help.ts` → `composables/useKeyboardShortcutsHelp.ts`
- `hooks/use-file-upload.ts` → `composables/useFileUpload.ts`
- `hooks/use-reveal-item.ts` → `composables/useRevealItem.ts`
- `hooks/use-sound-search.ts` → `composables/useSoundSearch.ts`
- `hooks/timeline/use-element-drag.ts` → `composables/timeline/useElementDrag.ts`
- `hooks/timeline/use-element-resize.ts` → `composables/timeline/useElementResize.ts`
- `hooks/timeline/use-external-drop.ts` → `composables/timeline/useExternalDrop.ts`
- `hooks/timeline/use-timeline-context-menu.ts` → `composables/timeline/useTimelineContextMenu.ts`
- `hooks/timeline/use-timeline-scroll.ts` → `composables/timeline/useTimelineScroll.ts`
- `hooks/timeline/use-timeline-seek.ts` → `composables/timeline/useTimelineSeek.ts`
- `hooks/timeline/use-timeline-snapping.ts` → `composables/timeline/useTimelineSnapping.ts`
- `hooks/timeline/use-timeline-zoom.ts` → `composables/timeline/useTimelineZoom.ts`

### TIER 4: React Components → Vue SFCs
Each React component becomes a Vue SFC.

**Editor Shell**
- `components/editor/editor-header.tsx` → `EditorHeader.vue`
- `components/editor/export-button.tsx` → `ExportButton.vue`
- `components/editor/layout-guide-overlay.tsx` → `LayoutGuideOverlay.vue`
- `components/editor/onboarding.tsx` → `EditorOnboarding.vue`
- `components/editor/selection-box.tsx` → `SelectionBox.vue`
- `components/editor/scenes-view.tsx` → `ScenesView.vue`

**Preview Panel**
- `components/editor/panels/preview/index.tsx` → `PreviewPanel.vue`

**Assets Panel**
- `components/editor/panels/assets/index.tsx` → `AssetsPanel.vue`
- `components/editor/panels/assets/tabbar.tsx` → `AssetsTabbar.vue`
- `components/editor/panels/assets/draggable-item.tsx` → `DraggableItem.vue`
- `components/editor/panels/assets/drag-overlay.tsx` → `DragOverlay.vue`
- `components/editor/panels/assets/views/media.tsx` → `MediaView.vue`
- `components/editor/panels/assets/views/text.tsx` → `TextView.vue`
- `components/editor/panels/assets/views/sounds.tsx` → `SoundsView.vue`
- `components/editor/panels/assets/views/stickers.tsx` → `StickersView.vue`
- `components/editor/panels/assets/views/captions.tsx` → `CaptionsView.vue`
- `components/editor/panels/assets/views/settings.tsx` → `SettingsView.vue`

**Properties Panel**
- `components/editor/panels/properties/index.tsx` → `PropertiesPanel.vue`
- `components/editor/panels/properties/property-item.tsx` → `PropertyItem.vue`
- `components/editor/panels/properties/text-properties.tsx` → `TextProperties.vue`
- `components/editor/panels/properties/video-properties.tsx` → `VideoProperties.vue`
- `components/editor/panels/properties/audio-properties.tsx` → `AudioProperties.vue`

**Timeline**
- `components/editor/timeline/index.tsx` → `EditorTimeline.vue`
- `components/editor/timeline/timeline-toolbar.tsx` → `TimelineToolbar.vue`
- `components/editor/timeline/timeline-ruler.tsx` → `TimelineRuler.vue`
- `components/editor/timeline/timeline-tick.tsx` → `TimelineTick.vue`
- `components/editor/timeline/timeline-track.tsx` → `TimelineTrack.vue`
- `components/editor/timeline/timeline-element.tsx` → `TimelineElement.vue`
- `components/editor/timeline/timeline-playhead.tsx` → `TimelinePlayhead.vue`
- `components/editor/timeline/audio-waveform.tsx` → `AudioWaveform.vue`
- `components/editor/timeline/bookmarks.tsx` → `TimelineBookmarks.vue`
- `components/editor/timeline/drag-line.tsx` → `DragLine.vue`
- `components/editor/timeline/snap-indicator.tsx` → `SnapIndicator.vue`

**Dialogs**
- `components/editor/dialogs/shortcuts-dialog.tsx` → `ShortcutsDialog.vue`
- `components/editor/dialogs/rename-project-dialog.tsx` → `RenameProjectDialog.vue`
- `components/editor/dialogs/delete-project-dialog.tsx` → `DeleteProjectDialog.vue`
- `components/editor/dialogs/project-info-dialog.tsx` → `ProjectInfoDialog.vue`
- `components/editor/dialogs/migration-dialog.tsx` → `MigrationDialog.vue`

**Shared**
- `components/editable-timecode.tsx` → `EditableTimecode.vue`
- `components/editor/panels/panel-base-view.tsx` → `PanelBaseView.vue`

**Stores** (Zustand → Pinia or reactive singletons)
- `stores/editor-store.ts` → already in EditorCore
- `stores/timeline-store.ts` → already in EditorCore
- `stores/panel-store.ts` → `stores/panelStore.ts`
- `stores/assets-panel-store.tsx` → `stores/assetsPanelStore.ts`
- `stores/keybindings-store.ts` → `stores/keybindingsStore.ts`
- `stores/sounds-store.ts` → `stores/soundsStore.ts`
- `stores/stickers-store.ts` → `stores/stickersStore.ts`
- `stores/text-properties-store.ts` → `stores/textPropertiesStore.ts`

---

## Legacy Clippster Files to REMOVE

### Components (`client/src/components/clip-editor/`)
- `ClipEditorDialog.vue` — replaced by new editor page
- `ClipEditorPreview.vue` — replaced by PreviewPanel.vue
- `ClipEditorTimeline.vue` — replaced by EditorTimeline.vue
- `ClipEditorToolbar.vue` — replaced by TimelineToolbar.vue
- `ClipEditorHeader.vue` — replaced by EditorHeader.vue
- `ClipEditorSidebar.vue` — replaced by AssetsPanel.vue
- `ClipEditorInspector.vue` — replaced by PropertiesPanel.vue
- `KeyboardShortcutsModal.vue` — replaced by ShortcutsDialog.vue
- `EditorErrorModal.vue` — keep or adapt
- `inspector/AudioInspector.vue` — replaced by AudioProperties.vue
- `inspector/TextInspector.vue` — replaced by TextProperties.vue
- `inspector/StickerInspector.vue` — replaced by sticker properties
- All panel components in `panels/` subdirectory

### Composables (`client/src/composables/clip-editor/`)
- `index.ts` — barrel file, replace entirely
- `useEditorFormatters.ts` — replaced by lib/time.ts
- `useEditorSelection.ts` — replaced by SelectionManager
- `useVideoSourceTime.ts` — replaced by timeline element model
- `useTimelineItems.ts` — replaced by TimelineManager
- `useVideoEffects.ts` — replaced by renderer nodes
- `useDurationCalculator.ts` — replaced by calculateTotalDuration
- `useEditorSplit.ts` — replaced by SplitElementsCommand
- `useEditorDelete.ts` — replaced by DeleteElementsCommand
- `useEditorExport.ts` — replaced by SceneExporter
- `useInspectorOperations.ts` — replaced by PropertiesPanel
- `useTextTemplates.ts` — keep/adapt for text presets
- `useVideoSync.ts` — replaced by PlaybackManager + AudioManager
- `useEditorKeyboardShortcuts.ts` — replaced by keybindings system
- `usePlayheadDrag.ts` — replaced by use-timeline-seek
- `useTimelineZoomControl.ts` — replaced by use-timeline-zoom
- `useVideoUrlBuilder.ts` — replaced by MediaManager + video-cache
- `useWebCodecsPlayback.ts` — **THE BIG ONE** — replaced by mediabunny VideoCache
- `usePanelCRUD.ts` — replaced by commands
- `useTextOverlaysCRUD.ts` — replaced by commands
- `useStickersCRUD.ts` — replaced by commands
- `useAudioTracksCRUD.ts` — replaced by commands
- `useTimelineReload.ts` — no longer needed (reactive state)
- `useWatermarkSettingsTransform.ts` — keep/adapt
- `useEditorAutoSave.ts` — replaced by SaveManager
- `useTitleManagement.ts` — replaced by ProjectManager

### Other composables to remove
- `composables/usePlaybackEngine.ts` — replaced by PlaybackManager
- `composables/useAudioMixer.ts` — replaced by AudioManager
- `composables/useTimelineRenderer.ts` — replaced by CanvasRenderer
- `composables/useProxyWorkflow.ts` — KEEP (Tauri-specific, needed for long VODs)
- `composables/useProPlaybackEngine.ts` — replaced by mediabunny

### Services to remove
- `services/commands/CommandHistory.ts` — replaced by CommandManager
- `services/video-editor-project-creator.ts` — adapt for new project model
- `services/database/video-editor-edits.ts` — replaced by storage layer

### Rust backend changes
- `src-tauri/src/video/frame_decoder.rs` — REMOVE (mediabunny handles decoding)
- `src-tauri/src/video/frame_cache.rs` — REMOVE
- `src-tauri/src/video/decoder_pool.rs` — REMOVE
- `src-tauri/src/video/mod.rs` — simplify to just FFmpeg export commands
- Keep FFmpeg export commands for high-quality desktop export

---

## Implementation Phases

### Phase 1: Foundation (no UI changes yet)
1. Install `mediabunny` package
2. Copy all TIER 1 files into `client/src/editor/` directory
3. Adapt imports (remove @/ aliases, fix paths)
4. Verify TypeScript compilation

### Phase 2: Storage Bridge
1. Create `TauriStorageAdapter` implementing same interface as IndexedDB/OPFS
2. Bridge media files: local path → File/Blob for mediabunny
3. Bridge project save/load to SQLite

### Phase 3: Vue Composables
1. Port each React hook to Vue composable
2. Create `useEditor()` composable (Vue equivalent of their hook)
3. Port timeline hooks (drag, resize, zoom, seek, snap)

### Phase 4: Vue Components
1. Port PreviewPanel (canvas + mediabunny playback)
2. Port EditorTimeline (tracks, elements, ruler, playhead)
3. Port AssetsPanel (media, text, sounds, stickers)
4. Port PropertiesPanel (inspector)
5. Port EditorHeader + dialogs
6. Wire up the editor page

### Phase 5: Clippster Bridge
1. "Open in Editor" from detected clips → create project + add media
2. "Import Built Clip" → add existing clip as media asset
3. "Upload Local Media" → file picker + add media asset
4. Export via FFmpeg (Tauri) instead of mediabunny export

### Phase 6: Legacy Cleanup
1. Remove all legacy clip-editor components
2. Remove all legacy clip-editor composables
3. Remove legacy services (CommandHistory, video-editor-edits)
4. Remove Rust frame decoder (keep FFmpeg export)
5. Remove unused dependencies (web-demuxer, etc.)

### Phase 7: Polish & Test
1. Verify full clip detection → editor → export flow
2. Test with long VODs (proxy workflow)
3. Test all timeline operations (split, trim, drag, resize)
4. Test audio playback and mixing
5. Test export quality

---

## New Directory Structure

```
client/src/editor/           # All OpenCut-ported code lives here
├── core/                    # EditorCore + managers (TIER 1, as-is)
├── commands/                # Command classes (TIER 1, as-is)
├── renderer/                # Canvas renderer + scene graph (TIER 1, as-is)
├── video-cache/             # mediabunny VideoCache (TIER 1, as-is)
├── storage/                 # Tauri SQLite adapter (TIER 2, rewritten)
├── types/                   # TypeScript types (TIER 1, as-is)
├── lib/                     # Utilities (TIER 1, as-is)
├── composables/             # Vue composables (TIER 3, ported from hooks)
├── components/              # Vue SFCs (TIER 4, ported from React)
│   ├── timeline/
│   ├── panels/
│   │   ├── preview/
│   │   ├── assets/
│   │   └── properties/
│   ├── dialogs/
│   └── shared/
└── stores/                  # Pinia stores (TIER 4, ported from Zustand)
```

## Dependencies to Add
- `mediabunny` (^1.29.1) — WebCodecs video/audio processing
- `eventemitter3` (^5.0.1) — event emitter for SceneExporter
- `use-deep-compare-effect` equivalent for Vue (or implement manually)

## Dependencies to Remove (after migration)
- `web-demuxer` — replaced by mediabunny
- Any MP4Box.js remnants
