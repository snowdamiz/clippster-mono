---
status: fixing
trigger: "The last item in the timeline is always partially cut off when there are many tracks."
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED. The tracks area div uses `class="relative pb-2"` with `:style="{ height: tracksAreaHeight + tracksVerticalOffset + 'px' }"`. Because CSS padding is INSIDE a fixed height (content-box), the `pb-2` (8px) doesn't extend the scrollable area — it's swallowed by the explicit height. Absolutely-positioned tracks reach exactly to the height boundary, leaving zero breathing room below the last track.
test: Applied fix — moved the 8px from `pb-2` class into the height calculation as `+ 8`, and removed the `pb-2` class.
expecting: Last track will now have 8px of scrollable space below it, matching the label sidebar's natural `pb-2` behavior.
next_action: Request human verification

## Symptoms

expected: All timeline tracks should be fully visible when scrolling, including the last one
actual: The last track in the timeline is always partially cut off / obscured. The Audio track at the bottom shows "Audio tr..." and content is barely visible, clipped.
errors: No error messages - purely a layout/CSS issue
reproduction: Add multiple tracks to the timeline (Text track, Sticker track, Image track, Main Track, Audio track). The bottom-most track will be cut off.
timeline: Current state of the app

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-11T00:00:00Z
  checked: Timeline.vue overall layout structure
  found: |
    - `<section>` is flex-col with `overflow-hidden`
    - `TimelineToolbar` is at the top (shrink-0 implied)
    - `div ref="timelineRef"` is flex-1 with overflow-hidden
    - `TimelineScrollbar` is rendered AFTER `timelineRef` at the section level (outside the scroll area)
    - `TimelineScrollbar` has `class="flex h-5 shrink-0 items-center border-t border-white/10 bg-[#18181b]"`
    - The `tracksScrollRef` div uses `class="absolute inset-0 overflow-x-auto overflow-y-auto hide-native-scrollbar"`
    - `tracksScrollRef` is inside `tracksContainerRef` which is `relative flex flex-1 flex-col overflow-hidden`
  implication: |
    The TimelineScrollbar (h-5 = 20px) sits at the bottom of the section as a flex child,
    taking up 20px of vertical space. However, `tracksContainerRef` has `overflow-hidden`,
    and `tracksScrollRef` uses `absolute inset-0` which fills 100% of `tracksContainerRef`.
    Since `tracksContainerRef` is inside the section's flex layout ABOVE the scrollbar,
    the scrollbar does NOT overlap the scroll area — it sits below it.
    BUT: the tracks area height calculation uses `tracksAreaHeight` which is just the sum of
    track heights + gaps. The `pb-2` on the tracks area div adds 8px of padding-bottom, so
    the scrollable content IS 8px taller than tracksAreaHeight. This should be fine for scrolling.

    The REAL issue may be different: Let's re-check the label sidebar scroll vs main scroll sync.

- timestamp: 2026-03-11T00:01:00Z
  checked: Track labels sidebar scroll area
  found: |
    The track labels sidebar has:
    - `div ref="trackLabelsRef"` with class `relative flex-1 min-h-0 -mt-2`
    - Inside: `div ref="trackLabelsScrollRef"` with class `absolute inset-0 overflow-y-auto overflow-x-hidden`
    - Inside that: `div class="flex flex-col gap-1 pb-2"` with paddingTop from tracksVerticalOffset

    The main content scroll area (tracksScrollRef) uses `absolute inset-0` inside tracksContainerRef.
    The tracks area div inside tracksScrollRef has `class="relative pb-2"` and an explicit height:
    `height: tracksAreaHeight + tracksVerticalOffset px`

    But `tracksAreaHeight` = getTotalTracksHeight() = sum of track heights + gaps (no bottom padding).
    The `pb-2` (8px) is ADDITIONAL to the height set. So the div is:
    height = tracksAreaHeight px, plus pb-2 = 8px of padding.

    Wait: in CSS, when you set height explicitly AND have padding-bottom, the padding is INSIDE
    the height by default (content-box). So the content inside the div is constrained to
    (height - pb) = (tracksAreaHeight - 8px).

    Actually no: padding-bottom in CSS adds to the scrollable content area when overflow occurs.
    The explicit `height` sets the element height. When content + padding exceeds height, scroll
    kicks in. But the tracks are positioned ABSOLUTELY inside this div, so their actual vertical
    extent IS exactly tracksAreaHeight (last track top + last track height). The pb-2 adds 8px
    of scroll space BELOW the absolutely positioned tracks.

    So this should provide 8px of clearance. But it may not be enough if some UI element
    obscures more than 8px at the bottom.
  implication: |
    The pb-2 gives only 8px of bottom padding. If the TimelineScrollbar (h-5 = 20px)
    were overlapping the scroll area, 8px wouldn't be enough. But layout analysis shows
    TimelineScrollbar is a flex sibling BELOW the scroll area, not overlapping it.

    Need to look more carefully at whether there's actual overlap happening.

- timestamp: 2026-03-11T00:02:00Z
  checked: The actual section flex layout in Timeline.vue template
  found: |
    ```html
    <section class="relative flex h-full flex-col overflow-hidden rounded-sm bg-[#18181b]">
      <TimelineToolbar ... />                    <!-- shrink-0 -->
      <div ref="timelineRef" class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        ...
        <div class="flex flex-1 overflow-hidden">
          <!-- Track labels sidebar -->
          <div class="flex w-44 shrink-0 flex-col border-r border-white/10 bg-[#18181b]" ...>
            ...
          </div>
          <!-- Main timeline content area -->
          <div ref="tracksContainerRef" class="relative flex flex-1 flex-col overflow-hidden">
            ...
            <div ref="tracksScrollRef" class="absolute inset-0 overflow-x-auto overflow-y-auto hide-native-scrollbar" ...>
              <div class="relative" :style="{ width: dynamicTimelineWidth }">
                <div ref="timelineHeaderRef" class="sticky top-0 z-30 ...">  <!-- TimelineRuler -->
                <TimelinePlayhead ... />
                <div class="relative pb-2" :style="{ height: tracksAreaHeight + tracksVerticalOffset }">
                  <!-- tracks rendered here -->
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <TimelineContextMenu ... />
      <TimelineScrollbar ... />   <!-- h-5 = 20px, shrink-0, outside timelineRef -->
      <KeyframePopup ... />
    </section>
    ```

    TimelineScrollbar is a DIRECT child of <section>, rendered AFTER <div ref="timelineRef">.
    The section is `flex h-full flex-col`. So the layout is:
    - TimelineToolbar: takes some height
    - timelineRef: flex-1 (takes remaining space)
    - TimelineContextMenu: position absolute (doesn't affect flow)
    - TimelineScrollbar: h-5 shrink-0 (takes 20px)
    - KeyframePopup: conditional

    Wait! TimelineScrollbar IS in the flex column layout. It takes 20px at the bottom.
    But timelineRef has flex-1 — so with TimelineScrollbar present, timelineRef gets:
    (total height - toolbar height - 20px for scrollbar).

    The tracksScrollRef fills tracksContainerRef via `absolute inset-0`, which fills the
    correct remaining area. So the scroll area ENDS where timelineRef ends, which is
    20px ABOVE the bottom of the section — the scrollbar sits below.

    This means the scroll area's bottom IS correct. But when you scroll to the bottom,
    the last track should be fully visible within tracksScrollRef.

    UNLESS: the tracks area height calculation doesn't include any bottom breathing room,
    and there's something at the bottom of tracksScrollRef itself cutting the view off.
  implication: |
    Let's check if pb-2 is truly the only bottom padding, and what the actual pixel math is.
    With 5 tracks:
    - video(80) + gap(4) + text(25) + gap(4) + sticker(25) + gap(4) + video/main(80) + gap(4) + audio(25)
    = 80+4+25+4+25+4+80+4+25 = 251px total
    tracksAreaHeight = 251
    The div height = 251 + tracksVerticalOffset (0 when content > container)
    pb-2 = 8px added below the absolutely positioned tracks
    So scroll bottom shows the last 8px below the last track.

    8px might not be enough visual breathing room, but the track itself should be visible.
    But wait — what about the TimelineRuler (sticky header) at the top?
    The ruler is sticky inside tracksScrollRef. When scrolled down, the ruler takes up
    height at the top of the visible viewport. So the VISIBLE area for tracks is:
    (tracksScrollRef height - ruler height)

    And the SCROLLABLE content total height = ruler height (not scrollable as sticky) + tracks area
    When at maximum scroll, the bottom of the tracks area aligns with the bottom of
    tracksScrollRef. So the last track should be fully visible.

    CONCLUSION: The pb-2 = 8px may not be sufficient, but the core issue needs visual confirmation.
    However, there's also the `gap-1` (4px) in the LABEL sidebar flex-col that creates gaps
    between label items. The main content uses absolute positioning with TRACK_GAP (4px). These should match.
    The label sidebar uses `flex flex-col gap-1` (gap = 4px = 1 tailwind gap unit). TRACK_GAP = 4.
    These match, so alignment is correct.

    ROOT CAUSE IDENTIFIED: The pb-2 on the tracks area is 8px, but this is overridden because
    the div has an EXPLICIT height set via inline style. When CSS `height` is set AND `padding-bottom`
    is set on the same element, the padding is INSIDE the height for content-box (default).
    So the actual scrollable height of the tracks area div = tracksAreaHeight (the height style value).
    The pb-2 does NOT add extra space beyond the height! It just compresses the content area.
    Since tracks are absolutely positioned, they don't care about padding — they position from the
    div's top edge based on their `top` style. The last track's bottom edge is at:
    tracksVerticalOffset + getTotalTracksHeight() = tracksAreaHeight
    And the div's height is exactly tracksAreaHeight.
    So the div ends EXACTLY at the last track's bottom. There is NO bottom breathing room at all,
    because pb-2 is cancelled out by the explicit height constraint!

## Resolution

root_cause: |
  The tracks area div in Timeline.vue has `class="relative pb-2"` combined with
  `:style="{ height: tracksAreaHeight + tracksVerticalOffset px }"`.
  Since tracks are absolutely positioned, they fill from 0 to exactly `getTotalTracksHeight()`.
  The `pb-2` (8px padding-bottom) is INSIDE the fixed height, so it doesn't add scrollable space
  below the last track. The last track's bottom edge sits exactly at the container's height boundary.
  When the user scrolls to the bottom, there is zero padding below the last track, making it
  appear cut off (the bottom of the last track is right at the scroll boundary with no breathing room).
  Additionally, the TimelineScrollbar (h-5 = 20px) at the bottom of the section takes 20px from
  the available height, further compressing the view.

  FIX: Add explicit bottom padding to the tracks area height calculation, so the scrollable content
  extends beyond the last track. Change the height calculation to include extra padding:
  `height: tracksAreaHeight + tracksVerticalOffset + BOTTOM_PADDING px`
  where BOTTOM_PADDING is e.g. 8px. This ensures the pb-2 is actually visible beyond the last track.

fix: |
  In Timeline.vue (line 871-877), changed the tracks area div:
  - Removed `pb-2` class (8px padding-bottom was being swallowed by the explicit height)
  - Added `+ 8` to the height style calculation so the scrollable area extends 8px past the last track
  Before: `class="relative pb-2"` + `height: tracksAreaHeight + tracksVerticalOffset px`
  After:  `class="relative"`     + `height: tracksAreaHeight + tracksVerticalOffset + 8 px`

  This also aligns with the label sidebar which uses `flex flex-col gap-1 pb-2` — a natural
  flow layout where pb-2 does add real space. Both sides now have matching 8px bottom clearance.

verification: pending human verification
files_changed:
  - client/src/editor/components/timeline/Timeline.vue
