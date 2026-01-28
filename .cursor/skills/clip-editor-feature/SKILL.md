---
name: clip-editor-feature
description: Add or update features in the clip editor (video editor) components. Use when user asks to add a feature, update behavior, create a new panel, inspector, command, composable, or overlay type in the clip editor.
---

# Clip Editor Feature Development

## When to Use

- User asks to add a new feature to the clip/video editor
- User asks to update or enhance existing editor behavior
- User asks to create a new panel, inspector, command, or overlay type
- User asks to add a new timeline track type
- User asks to add/modify keyboard shortcuts in the editor
- User mentions adding functionality to clip-editor components

## Architecture Overview

The clip editor is a video editor built with Vue 3 Composition API + TypeScript + Tailwind CSS, running inside a Tauri desktop app. Understanding this architecture is essential before making changes.

### Component Hierarchy

```
ClipEditorDialog.vue          (root container, orchestrates state)
├── ClipEditorHeader.vue      (title, export, shortcuts, close)
├── ClipEditorSidebar.vue     (panel tabs + panel content)
│   └── panels/               (MediaPanel, AudioPanel, TextPanel, StickersPanel, etc.)
├── ClipEditorPreview.vue     (video player + overlay rendering)
├── ClipEditorTimeline.vue    (multi-track timeline + playhead)
├── ClipEditorToolbar.vue     (zoom, time, undo/redo, split/delete)
├── ClipEditorInspector.vue   (context-sensitive property editor)
│   └── inspector/            (TextInspector, AudioInspector, StickerInspector)
└── KeyboardShortcutsModal.vue
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `client/src/components/clip-editor/` | Vue components (template + minimal logic) |
| `client/src/components/clip-editor/panels/` | Sidebar panel components |
| `client/src/components/clip-editor/inspector/` | Property inspector components |
| `client/src/components/clip-editor/commands/` | Command pattern for undo/redo |
| `client/src/composables/clip-editor/` | Business logic composables (~47 files) |

### Data Flow Pattern

```
User Action → Component emits event
  → ClipEditorDialog handles event
  → Composable executes logic
  → Command created (for undo/redo support)
  → Database service persists change
  → Reactive state updates
  → Components re-render
```

### State Management

- **Composables** manage reactive state (refs, computed) — this is the primary pattern
- **CommandHistory** manages undo/redo via the Command pattern
- **PlaybackEngine** is the master clock for currentTime and isPlaying
- **Pinia store** (`useInEditorClips`) for cross-session persistence
- **No centralized editor store** — data loaded per session via `useEditorDataLoader`

## Instructions

### Phase 1: Understand the Scope

Before writing any code:

1. **Read the relevant existing components** to understand current patterns
2. **Identify which layer(s) the feature touches:**
   - UI only → component change
   - Business logic → new/updated composable
   - Undoable action → new Command class
   - New data type → database type + CRUD composable
   - New sidebar content → new Panel component
   - New property editor → new Inspector component

3. **Check for existing composables** that may already handle part of the feature:
   ```
   ls client/src/composables/clip-editor/
   ```

4. **Check for existing types** in the database layer:
   ```
   Search for: FullVideoEditorEdit, VideoEditor*Record
   ```

### Phase 2: Plan the Implementation

Map the feature to the correct architectural layers:

#### Adding a New Overlay/Track Type (e.g., shapes, captions)

You need ALL of these:
1. **Database type** — Add record type to video-editor types
2. **CRUD composable** — `use[Type]CRUD.ts` following `useTextOverlaysCRUD` pattern
3. **Panel component** — `[Type]Panel.vue` in `panels/`
4. **Inspector component** — `[Type]Inspector.vue` in `inspector/`
5. **Command classes** — `Add[Type]Command.ts`, update `DeleteItemCommand.ts`
6. **Timeline rendering** — Add track in `ClipEditorTimeline.vue`
7. **Preview rendering** — Add overlay in `ClipEditorPreview.vue`
8. **Panel registration** — Add to `usePanelDefinitions` composable
9. **Inspector routing** — Add case in `ClipEditorInspector.vue`
10. **Selection support** — Update `useEditorSelection` if needed

#### Adding a New Panel Feature (no new data type)

1. **Panel component** — Create or update in `panels/`
2. **Composable** — Extract logic into composable if non-trivial
3. **Panel registration** — Add icon/tab to `usePanelDefinitions`
4. **Wire to ClipEditorSidebar** — Add component import and rendering

#### Adding a New Undoable Action

1. **Command class** — Create in `commands/` extending base Command
2. **Implement `execute()` and `undo()`** — Each must be self-contained
3. **Support command merging** if it's a slider/continuous value (see `UpdatePropertyCommand.ts`)
4. **Register in calling composable** — Push to CommandHistory

#### Adding/Updating Inspector Properties

1. **Inspector component** — Add form controls in the inspector `.vue` file
2. **Inspector logic composable** — Add formatting/validation in `use[Type]InspectorLogic`
3. **Update command** — Ensure `UpdatePropertyCommand` handles the new property
4. **Wire the event** — Emit update from inspector → `useInspectorOperations` → command

#### Adding a Keyboard Shortcut

1. **Register in `useEditorKeyboardShortcuts`**
2. **Add to `KeyboardShortcutsModal.vue`** display
3. **Wire handler** in `ClipEditorDialog.vue` if it needs root-level access

### Phase 3: Implement Following Conventions

#### Component Conventions

- **Template**: Use Tailwind utility classes (no BEM, no scoped CSS unless unavoidable)
- **Script**: `<script setup lang="ts">` with Composition API
- **Props**: Use `defineProps<{}>()` with TypeScript interfaces
- **Events**: Use `defineEmits<{}>()` with typed event signatures
- **Icons**: Import from `lucide-vue-next`
- **Theming**: Use CSS custom properties (`var(--editor-bg)`, `var(--editor-accent)`, etc.)

#### Composable Conventions

- **One responsibility per composable** — keep files 30-100 lines
- **Return reactive state** — use `ref()`, `computed()`, `watch()`
- **Accept dependencies as parameters** — don't import stores directly inside composables
- **Name pattern**: `use[Feature].ts` or `use[Feature][Aspect].ts`
- **Example**: `useAudioInspectorLogic.ts` handles formatting for AudioInspector

#### Command Conventions

- **Extend base Command** from `commands/Command.ts`
- **Store old + new values** for undo/redo
- **`execute()` applies change** via database service
- **`undo()` reverts change** via database service
- **Support merging** for rapid-fire updates (sliders) via `canMerge()` and `merge()`

#### File Size Guidelines

| Type | Target | Max |
|------|--------|-----|
| Root container (Dialog) | ~400 lines | 600 lines |
| Major component (Timeline, Preview) | ~300 lines | 450 lines |
| Panel / Inspector | ~150 lines | 250 lines |
| Composable | ~50-80 lines | 120 lines |
| Command | ~40-60 lines | 100 lines |

If a component exceeds the max, extract logic into a composable. If a composable exceeds the max, split into focused sub-composables.

### Phase 4: Wire Everything Together

1. **Import and register** new components in parent components
2. **Connect events** through the component hierarchy (props down, events up)
3. **Add to ClipEditorDialog** if the feature needs root-level coordination
4. **Update `useEditorKeyboardShortcuts`** if the feature has shortcuts
5. **Ensure undo/redo works** by testing the CommandHistory integration

### Phase 5: Verify

After implementation:

1. **Type-check**: `cd client && yarn vue-tsc --noEmit`
2. **Visual check**: Verify the feature renders correctly in the editor
3. **Undo/redo**: If the feature creates commands, verify undo and redo work
4. **No regressions**: Existing features still work (playback, selection, timeline)
5. **File sizes**: No component exceeds the max line limits above
6. **DRY check**: No duplicated logic — extract to composables if needed

## Code Quality Checklist

Before considering the feature complete:

- [ ] Logic extracted to composables (components only handle template + events)
- [ ] No inline business logic in `<template>` beyond simple conditionals
- [ ] TypeScript types are explicit (no `any` unless unavoidable)
- [ ] Tailwind classes used for all styling (no new `<style>` blocks unless necessary)
- [ ] Editor theme variables used for colors (not hardcoded values)
- [ ] New undoable actions use the Command pattern
- [ ] Events flow correctly: child emits → parent handles → composable executes
- [ ] File sizes within guidelines
- [ ] No duplicate logic across components or composables

## Common Pitfalls

### Don't

- Add business logic directly in component templates or `<script setup>` — extract to composables
- Create a Pinia store for editor state — use composables and props/events
- Hardcode colors — use `var(--editor-*)` CSS custom properties
- Skip the Command pattern for user-facing actions — they must be undoable
- Make components do too many things — split into sub-components + composables
- Import composables inside other composables without passing as parameters

### Do

- Follow the existing CRUD pattern (`usePanelCRUD` → `use[Type]CRUD`) for new data types
- Use `useEditorFormatters` for time/volume/pan display formatting
- Test with the playback engine running (timing-dependent features)
- Keep the ClipEditorDialog as the single orchestrator — don't bypass it
- Use `lucide-vue-next` icons consistently
