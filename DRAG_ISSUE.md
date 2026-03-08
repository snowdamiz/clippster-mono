# HTML5 Drag-and-Drop Is Broken in Tauri 2 / WKWebView

## Summary

HTML5 native drag-and-drop does not work for intra-webview operations in this app. The browser's `dragstart` event fires, but the native macOS drag operation is immediately cancelled by WKWebView before any `drag`, `dragover`, or `drop` events occur. This affects **all** drag sources, not just effects.

## Evidence

Diagnostic logging at every stage of the drag pipeline confirmed:

1. `dragstart` fires successfully — `dataTransfer` is populated, MIME types are set, `lastDragData` cache is stored
2. `dragend` fires **immediately** after `dragstart` — no intermediate events
3. Zero `drag` events fire on the source element (confirmed via `.once` handler)
4. Zero `dragover` events fire on `document` (confirmed via global listener)
5. Zero `handleDragEnter` / `handleDragOver` calls on the Timeline section
6. `dropEffect` on `dragend` reports `"copy"` (reflects `effectAllowed`, not an actual drop)

The drag operation is killed by the native layer before a single animation frame.

## Root Cause

The app runs as a **Tauri 2** desktop application on macOS. Tauri 2 uses **WKWebView** as its webview engine. WKWebView has known limitations with the HTML5 Drag and Drop API for operations that start and end within the same webview. The native macOS drag system intercepts the operation and cancels it before the web content can process it.

This is not a bug in application code — the drag handlers, data transfer setup, drop target computation, and execution functions are all correctly implemented. The failure occurs at the native/webview boundary.

## What Works vs What Doesn't

| Operation | Works? | Mechanism |
|-----------|--------|-----------|
| Click / double-click to add items | Yes | Standard DOM events |
| Drag media from OS Finder into app | Yes | Native-to-webview file drop (Tauri handles this) |
| Drag item within webview (e.g., panel → timeline) | **No** | HTML5 DnD — cancelled by WKWebView |
| Track reorder via drag in timeline labels | **No** | HTML5 DnD — same issue |

Items that appear to "work" (media, stickers) are added via click/double-click handlers, not drag-and-drop.

## Affected Components

All components using `draggable="true"` + `@dragstart` for intra-webview drag:

- `EffectsView.vue` — effect presets (now converted to click-to-add)
- `StickerItem.vue` — sticker icons
- `DraggableItem.vue` — generic draggable wrapper
- `AssetsPanel.vue` — media items (grid and list views)
- `TransitionsView.vue` — transition presets
- `TranscriptView.vue` — transcript paragraphs
- `BuiltClipsView.vue` / `ProjectClipsView.vue` — clip items
- `Timeline.vue` — track label reordering

## Dead Code

The entire DnD pipeline infrastructure works correctly but is never reached in Tauri:

- `useTimelineDragDrop.ts` — composable with `handleDragEnter`, `handleDragOver`, `handleDrop`
- `drop-utils.ts` — `computeDropTarget()`, `getDropLineY()`
- `drag-data.ts` — `setDragData()`, `getDragData()`, `hasDragData()`, `clearDragData()`
- Drop target visual feedback (drop lines, effect highlight overlays)
- All `execute*Drop()` functions in the composable

This code would work correctly in a standard browser. It's only non-functional in the Tauri/WKWebView context.

## Possible Solutions

### 1. Pointer-event-based drag system (recommended for full DnD UX)

Replace HTML5 DnD with `pointerdown` / `pointermove` / `pointerup` events. This bypasses the native drag system entirely and works in all webview environments.

- Track drag state manually (source element, position, drop target)
- Render a custom drag ghost via a fixed-position element (DraggableItem already has this pattern via `<Teleport>`)
- Hit-test the timeline on `pointermove` to compute drop targets
- Execute the drop on `pointerup`
- Reuse existing `computeDropTarget()` and `execute*Drop()` logic

### 2. Click-to-add (simpler, already partially implemented)

Convert all drag sources to click/double-click handlers. This matches the existing user workflow.

- EffectsView: **already converted** — click applies effect to selected element or inserts at playhead
- Stickers: already have `@click` to add
- Media: already have `@dblclick` to add
- Transitions, text, etc.: would need similar handlers

### 3. Tauri plugin or native bridge

Use Tauri's IPC to implement drag-and-drop at the native level, bridging between the webview and native macOS drag APIs. High complexity, likely not worth it for this use case.
