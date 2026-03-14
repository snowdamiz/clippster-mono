---
status: fixing
trigger: "Investigate issue: timeline-horizontal-scrollbar-hidden"
created: 2026-03-11T07:08:31Z
updated: 2026-03-11T07:29:00Z
---

## Current Focus

hypothesis: The timeline fits the full duration into view at minimum zoom, and the custom scrollbar was still allowed to hide the entire bottom row when there was no measured overflow. That made the editor appear to have no persistent horizontal scrollbar at all.
test: Keep the custom scrollbar mounted and visible at all times, attach it to the real scroll container as soon as the ref resolves, and render a full-width inactive thumb when the timeline currently fits.
expecting: The bottom scrollbar row remains visible in the screenshot scenario, and becomes draggable as soon as horizontal overflow exists.
next_action: User verification after reload/hot update.

## Symptoms

expected: A persistent, usable horizontal scrollbar is visible whenever the timeline content is wider than the viewport.
actual: The timeline only exposes the horizontal scrollbar during active scrolling; otherwise it is hidden.
errors: No runtime error reported.
reproduction: Open the clip editor, load or create enough timeline content to overflow horizontally, then inspect the timeline at rest. The scrollbar is not persistently visible.
started: Reported on 2026-03-11. Prior working state is unknown.

## Eliminated

## Evidence

- timestamp: 2026-03-11T07:15:24Z
  checked: client/src/editor/components/timeline/Timeline.vue
  found: The main scroll container `tracksScrollRef` uses `overflow-x-auto overflow-y-auto hide-native-scrollbar`, and the stylesheet forces native scrollbars hidden with `scrollbar-width: none` and `::-webkit-scrollbar { display: none }`.
  implication: The native horizontal scrollbar is intentionally suppressed, so a separate scrollbar implementation must remain visible for the user to have a persistent horizontal scrollbar.

- timestamp: 2026-03-11T07:15:24Z
  checked: client/src/editor/components/timeline/Timeline.vue and client/src/editor/components/timeline/TimelineScrollbar.vue
  found: The bottom row is a separate `TimelineScrollbar` component placed after `timelineRef`, and it is fully hidden by `v-show=\"isVisible\"`.
  implication: If `isVisible` is false, the entire bottom scrollbar row disappears exactly as described in the checkpoint response.

- timestamp: 2026-03-11T07:15:24Z
  checked: client/src/editor/components/timeline/TimelineScrollbar.vue
  found: `isVisible` is computed solely from `scrollWidth.value > clientWidth.value`, where those values are copied from `props.scrollContainer`.
  implication: The next investigation step is to prove whether the custom scrollbar is measuring the wrong overflow state rather than merely styling the thumb incorrectly.

- timestamp: 2026-03-11T07:29:00Z
  checked: client/src/editor/lib/timeline/zoom-utils.ts
  found: `getTimelineZoomMin()` intentionally computes a fit-to-viewport zoom level, and `getTimelinePaddingPx()` adds right padding while still allowing the fully zoomed-out timeline to fit within the viewport width.
  implication: In the fully zoomed-out state, there may be no real horizontal overflow, so hiding the entire bottom scrollbar row creates exactly the "no scrollbar at all" experience shown in the screenshot.

- timestamp: 2026-03-11T07:29:00Z
  checked: client/src/editor/components/timeline/TimelineScrollbar.vue
  found: The component now stays mounted, watches a nullable `scrollContainer`, resets stale measurements when detached, and renders a full-width inactive thumb when there is no overflow.
  implication: The hidden native scrollbar now has a persistent visible replacement even before the user starts scrolling or zooms into an overflow state.

## Resolution

root_cause:
The editor hid the native horizontal scrollbar, but the custom replacement was still allowed to disappear entirely when the timeline fit the viewport or when overflow had not been measured yet.
fix:
- Keep `TimelineScrollbar` mounted from `Timeline.vue`.
- Watch the nullable scroll container ref and sync after it resolves.
- Always render the bottom scrollbar row.
- Use a full-width inactive thumb when the timeline fits, and a draggable thumb when overflow exists.
verification:
Manual user verification pending after reload.
files_changed:
- client/src/editor/components/timeline/Timeline.vue
- client/src/editor/components/timeline/TimelineScrollbar.vue
