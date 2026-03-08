# Pointer-Event Drag System — Partially Working

## Status (latest test)

- **Stickers drag-and-drop: WORKS** — can drag sticker from panel onto timeline, drop line appears, element is inserted
- **Everything else: DOES NOT WORK** — no cursor change, no drop line, no feedback at all
- **Effects: no drag handler exists** — EffectsView.vue is click-only, has no `@pointerdown`/`startDrag`

The fact that stickers work end-to-end proves the core pointer drag system (`usePointerDrag.ts`), the drop zone registration, the `isInsideDropZone` hit-test, `computeDropTarget`, and all `execute*Drop` functions are correct. The problem is on the **source side** — the other components' `@pointerdown` handlers are either not firing or `startDrag` is not being called.

## Critical Clue: What Makes StickerItem Different

StickerItem is the ONLY source that works. Here's how it differs from the broken sources:

### StickerItem.vue (WORKS)
```vue
<!-- Dedicated component, usePointerDrag() in its own setup -->
<button @pointerdown="handlePointerDown" @click="handleClick">
  <div><img ... /></div>
</button>
```
- Root element is a `<button>`
- `@pointerdown` binds to a named function defined in the same component
- `usePointerDrag()` is called in StickerItem's own `<script setup>`
- `handlePointerDown` is a simple function: `startDrag(e, data)`

### AssetsPanel.vue media items (BROKEN)
```vue
<!-- Inline lambda on a <div>, usePointerDrag() called in parent AssetsPanel -->
<div @pointerdown="(e: PointerEvent) => {
  if (isItemProcessing(item.id)) return;
  startDrag(e, { id: item.id, type: 'media', ... });
}" @dblclick="addToTimeline(item)">
  <div class="aspect-video"><img :src="..." /></div>
</div>
```
- Root element is a `<div>` (not a button)
- `@pointerdown` uses an **inline lambda** (not a named function)
- `usePointerDrag()` is called in the parent AssetsPanel's setup
- Contains `<img>` children — **images are `draggable="true"` by default in HTML**, which may cause WKWebView to intercept and cancel pointer events when the user starts moving

### TransitionsView.vue (BROKEN — but code looks correct)
```vue
<button @pointerdown="handlePointerDown($event, preset)"
        @click="!wasDragCompleted && applyTransition(preset)">
  <TransitionPreviewCanvas ... />
</button>
```
- Root element IS a `<button>` (same as StickerItem)
- Has a named `handlePointerDown` function
- `usePointerDrag()` called in component setup
- **This should work but doesn't** — need to verify with DevTools console logs

### BuiltClipsView.vue / ProjectClipsView.vue (BROKEN — has a guard)
```ts
function handlePointerDown(e: PointerEvent, clip: Clip) {
  if (!isAlreadyAdded(clip)) return;  // ← GUARD: only starts drag if clip is already in editor
  const mediaId = getMediaAssetId(clip);
  if (!mediaId) return;               // ← GUARD: needs valid media ID
  startDrag(e, { ... });
}
```
- Has TWO guards that silently bail — if clip isn't added yet OR media ID not found, drag silently does nothing
- This is intentional (can't drag a clip that hasn't been imported) but confusing

### EffectsView.vue (NO DRAG AT ALL)
- Has `@click="addEffectToTimeline(preset)"` only
- No `@pointerdown`, no `startDrag`, no `usePointerDrag()` import
- **Needs to be converted** — add `usePointerDrag()` and `@pointerdown` with `startDrag` passing `EffectDragData`

## Hypotheses (ordered by likelihood)

### 1. Native image drag interference (HIGH — explains media items)
`<img>` elements are `draggable="true"` by default in HTML. When user pointerdowns on an `<img>` inside a media item `<div>` and starts moving, the browser may initiate a native image drag. In WKWebView, this native drag gets immediately cancelled (the original HTML5 DnD bug), and this cancellation may also kill the pointer event sequence.

StickerItem also has `<img>` children but works — the difference might be that `<button>` elements suppress native child drag behavior, or that StickerItem's `<img>` has different sizing/CSS.

**Fix to try**: Add `draggable="false"` to all `<img>` elements inside drag source containers, OR add `@dragstart.prevent` on the drag source elements to block native drag initiation.

### 2. TransitionsView: verify it's actually broken (MEDIUM)
TransitionsView's code looks structurally identical to StickerItem. If TransitionsView also doesn't work despite identical code structure, the issue might be more subtle — perhaps related to the `<TransitionPreviewCanvas>` (a `<canvas>` element) inside the button.

**To verify**: Open DevTools console, go to Transitions tab, try to drag a transition. Check if `[PointerDrag] startDrag called` appears. If it does, the issue is downstream. If it doesn't, the `@pointerdown` isn't firing.

### 3. `@pointerdown` on `<div>` vs `<button>` (MEDIUM)
Buttons have different default behavior for pointer events vs divs. A `<button>` may implicitly prevent the browser from starting a native drag on its children, while a `<div>` does not. This would explain why StickerItem (button) works and AssetsPanel media items (div) don't.

**Fix to try**: Wrap media items in `<button>` instead of `<div>`, or add `@dragstart.prevent` to the `<div>` elements.

### 4. Inline lambda vs named function (LOW)
Vue should handle inline lambdas identically to named functions for event handlers. But worth testing — replace the inline lambda in AssetsPanel with a named function to rule it out.

## Diagnostic Steps for Next Agent

1. **Open DevTools Console**, filter for `[PointerDrag]`
2. **Test each source type** and note which `console.debug` messages appear:

   | Source | Expected log on pointerdown | Tab in AssetsPanel |
   |--------|---------------------------|-------------------|
   | Media item | `startDrag called, type: media` | Media (first tab) |
   | Sticker | `startDrag called, type: sticker` | Stickers |
   | Transition | `startDrag called, type: transition` | Transitions |
   | Built clip | `startDrag called, type: media` | Built Clips (only if clip is already added) |
   | Effect | **NO LOG** (no handler) | Effects |

3. **If `startDrag called` appears but `Drag started` doesn't** → pointer events are being eaten after pointerdown. Try the `@dragstart.prevent` fix on the source element.

4. **If `startDrag called` doesn't appear at all** → the `@pointerdown` handler isn't firing. Check if `pointer-events: none` is applied via CSS, or if a parent is intercepting the event.

5. **If both `startDrag called` and `Drag started` appear but not `Entered drop zone`** → the drop zone bounds check is failing. Add a log inside `isInsideDropZone` to print the rect bounds vs cursor position.

## Quick Fixes to Try (in order)

1. **Add `@dragstart.prevent` to all drag source elements** — prevents the browser from trying to start a native drag on images/canvases, which may cancel pointer events in WKWebView:
   ```vue
   <div @pointerdown="..." @dragstart.prevent>
   ```

2. **Add `draggable="false"` to `<img>` elements inside drag sources** — explicitly tells the browser not to make images natively draggable:
   ```vue
   <img :src="..." draggable="false" />
   ```

3. **Add `@pointerdown` + `startDrag` to EffectsView.vue** — it currently has no drag handler at all

4. **Test with `mousemove`/`mouseup` instead of `pointermove`/`pointerup`** — if WKWebView is interfering with pointer events specifically, mouse events may work (they're lower-level)

## Files Reference

| File | Path | Has drag? | Status |
|------|------|-----------|--------|
| usePointerDrag.ts | `composables/usePointerDrag.ts` | Provider | Has debug logs |
| useTimelineDragDrop.ts | `composables/timeline/useTimelineDragDrop.ts` | Drop target | Registers via `onMounted` |
| EditorLayout.vue | `components/EditorLayout.vue` | `providePointerDrag()` | OK |
| StickerItem.vue | `components/panels/assets/StickerItem.vue` | `@pointerdown` → `startDrag` | **WORKS** |
| AssetsPanel.vue | `components/panels/AssetsPanel.vue` | `@pointerdown` inline lambda → `startDrag` | **BROKEN** |
| TransitionsView.vue | `components/panels/assets/TransitionsView.vue` | `@pointerdown` → `startDrag` | **BROKEN** (untested?) |
| BuiltClipsView.vue | `components/panels/assets/BuiltClipsView.vue` | `@pointerdown` → guarded `startDrag` | **BROKEN** (guard may prevent) |
| ProjectClipsView.vue | `components/panels/assets/ProjectClipsView.vue` | `@pointerdown` → guarded `startDrag` | **BROKEN** (guard may prevent) |
| EffectsView.vue | `components/panels/assets/EffectsView.vue` | **NONE** — click-only | **NEEDS DRAG ADDED** |
| TranscriptView.vue | `components/panels/assets/TranscriptView.vue` | Paragraph reorder via pointer | Untested |
| Timeline.vue | `components/timeline/Timeline.vue` | Track label reorder via pointer | Untested |
| drag-data.ts | `lib/drag-data.ts` | Dead code | Can be deleted |

All paths are relative to `client/src/editor/`.
