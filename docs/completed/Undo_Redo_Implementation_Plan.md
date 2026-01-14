# Undo/Redo Implementation Plan for ClipEditorDialog

## Current State

The project already has a **solid Command Pattern infrastructure** in place:

- **`CommandHistory`** class (`@/services/commands/CommandHistory.ts`) - manages undo/redo stacks with max 100 history
- **`ICommand`** interface with `execute()`, `undo()`, `canMerge()`, `merge()` methods
- **Existing Commands** (~15 commands implemented):
  - `SplitCommand`, `DeleteCommand`, `PasteCommand`
  - `MoveCommand`, `ResizeCommand`, `LayerChangeCommand`
  - `ExtractAudioCommand`, `AddItemCommand`
  - `RippleEditCommand`, `RollEditCommand`, `SlipEditCommand`, `SlideEditCommand`
  - `UpdateOverlayPropertyCommand` (position, scale, rotation, width)

**Currently using commands** (20 usages found in ClipEditorDialog):
- Timeline split, delete, paste, resize
- Overlay drag/resize/rotate operations
- Track move operations
- Ripple/Roll/Slip/Slide edits
- Audio extraction

---

## Gap Analysis: Actions NOT Using Commands

### 1. Text Overlays (High Priority)
- `addTextOverlay()` - creates text overlay
- `updateTextOverlayLocal()` - updates text content, style, timing
- `deleteTextOverlayLocal()` - removes text overlay

### 2. Stickers (High Priority)
- `addStickerLocal()` - adds sticker
- `updateStickerLocal()` - updates sticker properties
- `deleteStickerLocal()` - removes sticker

### 3. Watermarks (High Priority)
- `addWatermarkLocal()` - adds watermark
- `updateWatermarkLocal()` - updates watermark properties
- `deleteWatermarkLocal()` - removes watermark

### 4. Audio Tracks (High Priority)
- `addAudioTrack()` - adds audio track
- `updateAudioTrackLocal()` - updates volume, timing, effects
- `deleteAudioTrackLocal()` - removes audio track
- `updateOriginalDb()` - changes main video volume
- `updateTrackDb()` / `updateTrackPan()` - mixer changes
- `addKeyframe()` - adds audio keyframe

### 5. Captions/Subtitles (Medium Priority)
- `updateSubtitleSettings()` - font, size, color, position, style changes

### 6. Effects & Transitions (Medium Priority)
- `onAddTransition()`, `onUpdateTransition()`, `onDeleteTransition()`
- `onAddEffect()`, `onUpdateEffect()`, `onDeleteEffect()`

### 7. Framing/Aspect Ratio (Medium Priority)
- `updateFramingConfigs()` - POI/framing changes per aspect ratio
- `updateSelectedAspectRatios()` - toggle aspect ratios
- `updateFramingMode()` - auto/manual framing

### 8. Media/Sources (Medium Priority - Editor Mode)
- `onAddSource()` - adds video source
- `onImportFile()` - imports media
- `onAddProjectMedia()` - adds from project library
- `onAddIntro()` / `onAddOutro()` / `onRemoveIntro()` / `onRemoveOutro()`

### 9. Markers (Low Priority)
- Add/remove/edit timeline markers

### 10. Filter Segments (Low Priority)
- Filter/color grading changes

---

## Implementation Plan

### Phase 1: Create Missing Command Classes

Create new commands in `ClipEditorCommands.ts`:

| Command | Purpose |
|---------|---------|
| `AddTextOverlayCommand` | Add text with full undo |
| `UpdateTextOverlayCommand` | Update text properties (mergeable) |
| `DeleteTextOverlayCommand` | Delete text with restore |
| `AddStickerCommand` | Add sticker |
| `UpdateStickerCommand` | Update sticker (mergeable) |
| `DeleteStickerCommand` | Delete sticker |
| `AddWatermarkCommand` | Add watermark |
| `UpdateWatermarkCommand` | Update watermark (mergeable) |
| `DeleteWatermarkCommand` | Delete watermark |
| `AddAudioTrackCommand` | Add audio track |
| `UpdateAudioTrackCommand` | Update audio (volume, timing) |
| `DeleteAudioTrackCommand` | Delete audio track |
| `UpdateSubtitleSettingsCommand` | Subtitle style changes (mergeable) |
| `AddTransitionCommand` | Add transition |
| `UpdateTransitionCommand` | Modify transition |
| `DeleteTransitionCommand` | Remove transition |
| `AddEffectCommand` | Add effect |
| `UpdateEffectCommand` | Modify effect |
| `DeleteEffectCommand` | Remove effect |
| `UpdateFramingCommand` | Framing/POI changes |
| `AddSourceCommand` | Add video source (editor mode) |
| `DeleteSourceCommand` | Remove video source |

### Phase 2: Refactor ClipEditorDialog Functions

Replace direct state mutations with command execution:

```typescript
// Before
async function addTextOverlay(data) {
  const overlay = await createTextOverlay(editId, data);
  textOverlays.value.push(overlay);
}

// After
async function addTextOverlay(data) {
  const command = new AddTextOverlayCommand(editorMode.value, {
    editId: clipEditId.value,
    overlayData: data,
    onReload: reloadCallback,
  });
  await commandHistory.executeCommand(command);
  undoRedoTrigger.value++;
}
```

### Phase 3: Implement Command Merging for Continuous Operations

For properties that change rapidly (dragging, sliders):
- Store start value on `mousedown`/`dragstart`
- Create single command on `mouseup`/`dragend`
- Use `canMerge()` for rapid sequential changes (e.g., typing text)

### Phase 4: Add Keyboard Shortcuts

Ensure `Ctrl+Z` / `Ctrl+Shift+Z` (or `Cmd` on Mac) are bound:

```typescript
// Already exists but verify coverage
function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (e.shiftKey) {
      performRedo();
    } else {
      performUndo();
    }
  }
}
```

### Phase 5: UI Enhancements

- Show undo/redo buttons with tooltips showing next action description
- Use `commandHistory.getNextUndoDescription()` / `getNextRedoDescription()`
- Visual feedback when undo/redo occurs

---

## Estimated Effort

| Phase | Effort | Files Modified |
|-------|--------|----------------|
| Phase 1 | ~4-6 hours | `ClipEditorCommands.ts`, `index.ts` |
| Phase 2 | ~6-8 hours | `ClipEditorDialog.vue`, tab components |
| Phase 3 | ~2-3 hours | Various event handlers |
| Phase 4 | ~1 hour | `ClipEditorDialog.vue` |
| Phase 5 | ~1-2 hours | UI components |

**Total: ~14-20 hours of implementation**

---

## Key Design Decisions

1. **Snapshot vs. Delta**: Commands should store both original and new state for reliable undo
2. **Merge Window**: Use time-based merging (e.g., 500ms) for rapid changes
3. **Reload Strategy**: Each command has `onReload` callback to refresh UI state from DB
4. **Dual Mode Support**: All commands must handle both `editorMode` (video editor) and clip mode

---

## Files Involved

### Primary Files
- `client/src/services/commands/ClipEditorCommands.ts` - Command implementations
- `client/src/services/commands/CommandHistory.ts` - History manager
- `client/src/services/commands/Command.ts` - Base interface
- `client/src/services/commands/index.ts` - Exports
- `client/src/components/clip-editor/ClipEditorDialog.vue` - Main editor component

### Tab Components (emit events to ClipEditorDialog)
- `client/src/components/clip-editor/tabs/TextOverlayTab.vue`
- `client/src/components/clip-editor/tabs/AudioMixerTab.vue`
- `client/src/components/clip-editor/tabs/WatermarkTab.vue`
- `client/src/components/clip-editor/tabs/OverlaysTab.vue`
- `client/src/components/clip-editor/tabs/CaptionsTab.vue`
- `client/src/components/clip-editor/tabs/EffectsTab.vue`
- `client/src/components/clip-editor/tabs/StyleTab.vue`
- `client/src/components/clip-editor/tabs/MediaTab.vue`

### Database Services
- `client/src/services/database/clip-edits.ts`
- `client/src/services/database/video-editor-edits.ts`
