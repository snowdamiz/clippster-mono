---
name: clip-editor-debug
description: Debug issues in the clip editor (video editor) components, composables, and commands. Use when user reports a bug, visual glitch, broken feature, timing issue, undo/redo problem, or unexpected behavior in the clip editor.
---

# Clip Editor Debugging

## When to Use

- User reports a bug or broken feature in the clip/video editor
- User sees a visual glitch, misaligned element, or rendering issue
- User reports undo/redo not working correctly
- User reports playback, timing, or sync issues
- User reports a panel, inspector, or timeline not updating
- User reports keyboard shortcuts not working
- User sees console errors originating from clip-editor components
- User describes unexpected behavior in the editor

## Architecture Quick Reference

Understanding how data flows is critical for debugging. Most bugs fall into one of the flow stages below.

### Component Hierarchy

```
ClipEditorDialog.vue          (root orchestrator — state lives here)
├── ClipEditorHeader.vue      (title editing, export, close)
├── ClipEditorSidebar.vue     (panel tabs + panel content)
│   └── panels/               (Media, Audio, Text, Stickers, Watermark, etc.)
├── ClipEditorPreview.vue     (video player + active overlays)
├── ClipEditorTimeline.vue    (tracks, segments, playhead, ruler)
├── ClipEditorToolbar.vue     (zoom, time display, undo/redo, split/delete)
├── ClipEditorInspector.vue   (property editor, routes to sub-inspectors)
│   └── inspector/            (Text, Audio, Sticker inspectors)
└── KeyboardShortcutsModal.vue
```

### Data Flow (trace bugs along this path)

```
1. User Action (click, drag, keyboard)
2. Component captures event → emits to parent
3. ClipEditorDialog handles event
4. Composable executes logic (client/src/composables/clip-editor/)
5. Command created → pushed to CommandHistory (for undo/redo)
6. Database service persists change
7. Reactive state (ref/computed) updates
8. Components re-render via Vue reactivity
```

### Key Directories

| Directory | Contains |
|-----------|----------|
| `client/src/components/clip-editor/` | Vue components |
| `client/src/components/clip-editor/panels/` | Sidebar panels (7 files) |
| `client/src/components/clip-editor/inspector/` | Property inspectors (3 files) |
| `client/src/components/clip-editor/commands/` | Undo/redo command classes (7 files) |
| `client/src/composables/clip-editor/` | Business logic (~47 composables) |

## Instructions

### Phase 1: Classify the Bug

Categorize the reported issue to narrow the search area:

| Bug Category | Likely Location | Start Here |
|-------------|-----------------|------------|
| **Visual/Layout** | Component template or Tailwind classes | The affected `.vue` file's `<template>` |
| **State not updating** | Composable reactivity or missing event wiring | Composable → component event chain |
| **Undo/redo broken** | Command class or CommandHistory | `commands/` directory |
| **Playback/timing** | PlaybackEngine or time-related composables | `useVideoSourceTime`, `useVideoSync`, `usePlayheadDrag` |
| **Inspector not showing** | Selection state or inspector routing | `useEditorSelection`, `ClipEditorInspector.vue` |
| **Panel not working** | Panel component or CRUD composable | `panels/[Type]Panel.vue`, `use[Type]CRUD` |
| **Timeline rendering** | Timeline component or segment styles | `ClipEditorTimeline.vue`, `useTimelineSegmentStyles` |
| **Keyboard shortcut** | Shortcut registration or handler | `useEditorKeyboardShortcuts` |
| **Data not persisting** | Database service or auto-save | `useEditorAutoSave`, database service functions |
| **Export issues** | Export composable or Tauri bridge | `useEditorExport` |
| **Type errors** | TypeScript types or prop mismatches | Run `vue-tsc --noEmit` |

### Phase 2: Gather Context

Read the relevant files based on the bug category. Always start with these:

#### 2.1 Read the Affected Component

Read the component file where the bug manifests. Look for:
- Props being received correctly
- Events being emitted with correct payload
- Reactive bindings in template (`:class`, `:style`, `v-if`, `v-model`)
- Correct composable usage in `<script setup>`

#### 2.2 Trace the Data Flow

Follow the data from source to display:

1. **Where does the data originate?** (composable, prop, store)
2. **How is it transformed?** (computed properties, formatters)
3. **How is it passed down?** (props, provide/inject)
4. **How is it displayed?** (template binding)

#### 2.3 Check the Composable

Read the composable that manages the affected state:
```
client/src/composables/clip-editor/use[Feature].ts
```

Look for:
- `ref()` vs `computed()` — is reactivity set up correctly?
- `watch()` or `watchEffect()` — are watchers triggering as expected?
- Return values — is the composable returning the right reactive references?

#### 2.4 Check Related Composables

Many composables depend on others. Key dependency chains:

```
useEditorDataLoader → loads FullVideoEditorEdit (all editor data)
useTimelineItems → extracts items from edit data for display
useEditorSelection → tracks which item is selected
useInspectorOperations → bridges inspector UI to commands
usePanelCRUD → generic CRUD used by type-specific CRUDs
useEditorFormatters → time/volume/pan display formatting
useTimelineZoom → zoom level, pixel-per-second calculations
usePlayheadDrag → playhead position and seeking
useDurationCalculator → total timeline duration
```

### Phase 3: Identify the Root Cause

#### Common Bug Patterns

**1. Reactivity Lost**
- **Symptom**: UI doesn't update when data changes
- **Cause**: Destructuring a reactive object without `toRefs()`, or replacing a `ref` value instead of mutating `.value`
- **Check**: Verify `ref()` and `computed()` usage in composables; ensure `.value` is used correctly

**2. Event Not Reaching Parent**
- **Symptom**: Action in child component has no effect
- **Cause**: Missing `defineEmits`, wrong event name, or parent not listening
- **Check**: Trace the emit chain from child → parent → ClipEditorDialog
- **Pattern**: Child emits → intermediate component re-emits → Dialog handles

**3. Command Execute/Undo Mismatch**
- **Symptom**: Undo doesn't fully revert, or redo applies wrong state
- **Cause**: Command stores incorrect old/new values, or database service not called symmetrically
- **Check**: Read the Command class in `commands/`, verify `execute()` and `undo()` are mirrors

**4. Timing/Sync Issues**
- **Symptom**: Overlays appear at wrong times, playhead out of sync
- **Cause**: Mismatch between timeline time and video source time
- **Check**: `useVideoSourceTime` handles time conversion; `useVideoSync` handles playback sync
- **Key concept**: Timeline time != video source time (video may start at an offset)

**5. Selection State Stale**
- **Symptom**: Inspector shows wrong item, or actions affect wrong item
- **Cause**: `useEditorSelection` not updated or cleared properly
- **Check**: Selection is set on click, cleared on deselect/delete; inspector reads from selection

**6. Timeline Segment Positioning**
- **Symptom**: Segments overlap, wrong width, or wrong position
- **Cause**: Zoom calculations or segment style computations
- **Check**: `useTimelineZoom` for pixel calculations, `useTimelineSegmentStyles` for positioning

**7. Panel CRUD Not Reflecting**
- **Symptom**: Add/delete in panel doesn't show in timeline or vice versa
- **Cause**: CRUD composable not updating the shared reactive data
- **Check**: `use[Type]CRUD` → `usePanelCRUD` → verify the reactive array is the same reference

**8. CSS/Tailwind Visual Bugs**
- **Symptom**: Elements misaligned, wrong colors, overflow issues
- **Cause**: Missing/wrong Tailwind classes, z-index conflicts, or missing theme variables
- **Check**: Template classes; theme uses `var(--editor-*)` custom properties defined in `style.css`

**9. Keyboard Shortcut Conflicts**
- **Symptom**: Shortcut doesn't fire or fires wrong action
- **Cause**: Event not prevented, shortcut registered wrong, or input field captures keypress
- **Check**: `useEditorKeyboardShortcuts` — shortcuts should be disabled when input is focused

**10. Waveform/Media Loading**
- **Symptom**: Waveform doesn't render, media fails to load
- **Cause**: File path issues (Tauri convertFileSrc), async loading race conditions
- **Check**: `useWaveformRenderer`, `useVideoUrlBuilder`, `convertFileSrc` usage

### Phase 4: Fix the Bug

#### Before Fixing

1. **Confirm the root cause** — don't guess. Read the code and trace the data flow.
2. **Check if a composable already handles this** — the fix may be a wiring issue, not a logic issue.
3. **Understand the blast radius** — will this fix affect other features?

#### Fixing Guidelines

- **Minimal fix**: Change only what's necessary to fix the bug
- **Same layer**: Fix at the correct architectural layer (don't put logic fixes in templates)
- **Preserve undo/redo**: If fixing a command, ensure both `execute()` and `undo()` are updated symmetrically
- **Keep reactivity intact**: When fixing state issues, ensure Vue reactivity is maintained (`ref`, `computed`, `watch`)
- **Don't move code around**: Avoid refactoring while debugging — fix the bug, nothing else

#### Fix Verification

After applying the fix:

1. **Type-check**: Run `cd client && yarn vue-tsc --noEmit`
2. **Reproduce**: Attempt to reproduce the original bug — it should be fixed
3. **Undo/redo**: If the fix involves commands, verify undo and redo still work
4. **Related features**: Test adjacent features that share the same composables
5. **Edge cases**: Test with no items, one item, and many items

### Phase 5: Report

Provide a clear summary:

1. **Root cause**: What was wrong and why
2. **Fix applied**: What was changed and in which file(s)
3. **Verification**: What was tested to confirm the fix
4. **Risk**: Any other features that could be affected (low/medium/high)

## Debugging Tools

### TypeScript Check

```bash
cd client && yarn vue-tsc --noEmit
```
Catches type errors, missing props, wrong event signatures.

### Browser DevTools (when applicable)

- **Vue DevTools**: Inspect component tree, props, reactive state
- **Console**: Look for Vue warnings ("Invalid prop", "Missing required prop", "Component emitted event but not declared")
- **Network**: Check if database/API calls succeed
- **Elements**: Inspect computed Tailwind styles and layout

### Quick File Search

Find composables related to a feature:
```bash
ls client/src/composables/clip-editor/ | grep -i [keyword]
```

Find where a composable is used:
```bash
grep -r "use[ComposableName]" client/src/components/clip-editor/ client/src/composables/clip-editor/
```

Find where an event is emitted or handled:
```bash
grep -r "emit.*eventName\|@eventName\|v-on:eventName" client/src/components/clip-editor/
```

## Common Quick Fixes Reference

| Symptom | Quick Check |
|---------|-------------|
| Inspector doesn't open | Is `useEditorSelection` setting the selected item? |
| Panel button does nothing | Is the emit chain complete from panel → sidebar → dialog? |
| Timeline segment wrong size | Check `useTimelineZoom` pixel-per-second calculation |
| Playhead jumps | Check `usePlayheadDrag` and `useVideoSync` |
| Overlay wrong position | Check percentage-based X/Y in the overlay record |
| Volume/pan display wrong | Check `useAudioInspectorLogic` formatting |
| Text not rendering on preview | Check `useTimelineItems` extracts text overlays for current time |
| Undo does nothing | Check CommandHistory has the command; check `undo()` calls the right DB function |
| Auto-save not working | Check `useEditorAutoSave` debounce and trigger |
| Sticker upload fails | Check `useStickerUpload` and Tauri file system permissions |
