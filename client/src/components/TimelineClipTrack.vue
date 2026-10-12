<template>
  <div
    v-for="(clip, index) in clips"
    :key="clip.id"
    class="relative flex h-10 cursor-pointer items-center border-b border-line-subtle px-2"
    @click="onTimelineClipClick(clip.id)"
  >
    <!-- Track Label -->
    <div
      class="sticky left-0 z-30 -ml-2 flex h-full w-18 shrink-0 items-center gap-1.5 border-r border-line-subtle bg-surface pl-3 pr-2"
      :title="clip.title"
    >
      <span class="size-1.5 shrink-0 rounded-full" :style="{ backgroundColor: clip.run_color || DEFAULT_RUN_COLOR }" />
      <span class="truncate text-2xs font-medium text-fg-muted">{{ getClipLabel(clip) }}</span>
    </div>
    <!-- Clip Track Content -->
    <div class="relative h-8 flex-1">
      <div
        class="absolute inset-0 cursor-pointer rounded-md bg-surface-sunken"
        @click="onClipTrackClick"
        @contextmenu="onClipTrackContextMenu($event, clip)"
      ></div>
      <!-- Clip segments on timeline -->
      <div class="pointer-events-none absolute inset-0 flex items-center">
        <!-- Render each segment as a clip on the timeline -->
        <div
          v-for="(segment, segIndex) in clip.segments"
          :key="`${clip.id}_${segIndex}`"
          :ref="(el) => setTimelineClipRef(el, clip.id)"
          class="clip-segment group pointer-events-auto absolute flex h-7 items-center justify-center overflow-hidden rounded-md border"
          :class="[
            isDraggingSegment && draggedSegmentInfo?.clipId === clip.id && draggedSegmentInfo?.segmentIndex === segIndex
              ? 'is-dragging z-30 cursor-grabbing'
              : isResizingSegment && resizeHandleInfo?.clipId === clip.id && resizeHandleInfo?.segmentIndex === segIndex
                ? 'is-resizing z-30 cursor-ew-resize'
                : isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex
                  ? 'is-cut-target cut-mode z-65'
                  : isCutToolActive
                    ? 'cut-mode z-62'
                    : 'cursor-grab',
            clip.run_number ? `run-${clip.run_number}` : '',
            !isCutToolActive && currentlyPlayingClipId === clip.id
              ? 'is-playing z-20'
              : !isCutToolActive && (hoveredClipId === clip.id || hoveredTimelineClipId === clip.id)
                ? 'is-hovered z-20'
                : '',
            selectedSegmentKeys?.has(`${clip.id}_${segIndex}`) ? 'selected-segment' : '',
            isMovingSegment && selectedSegmentKeys?.has(`${clip.id}_${segIndex}`) ? 'keyboard-moving-segment' : '',
          ]"
          :style="{
            left: `${duration ? (getSegmentDisplayTime(segment, 'start') / duration) * 100 : 0}%`,
            width: `${duration ? ((getSegmentDisplayTime(segment, 'end') - getSegmentDisplayTime(segment, 'start')) / duration) * 100 : 0}%`,
            ...segmentColorStyle(clip.run_color),
          }"
          :data-run-color="clip.run_color"
          :title="`${clip.title} - ${formatDuration(getSegmentDisplayTime(segment, 'start'))} to ${formatDuration(getSegmentDisplayTime(segment, 'end'))}${clip.run_number ? ` (Run ${clip.run_number})` : ''}`"
          :data-cut-tool-active="isCutToolActive"
          :data-cut-hover="
            isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex
          "
          @mouseenter="
            {
              if (isCutToolActive) {
                console.log(`[CUTTING] Mouseenter segment ${clip.id}_${segIndex}`);
                onSegmentHoverForCut($event, clip.id, segIndex, segment);
              } else {
                hoveredSegmentKey = `${clip.id}_${segIndex}`;
              }
            }
          "
          @mousemove="
            if (isCutToolActive) {
              console.log(`[CUTTING] Mousemove segment ${clip.id}_${segIndex}`);
              onSegmentHoverForCut($event, clip.id, segIndex, segment);
            }
          "
          @mouseleave="
            {
              if (isCutToolActive) {
                console.log(`[CUTTING] Mouseleave segment ${clip.id}_${segIndex}`);
                emit('update:cutHoverInfo', null);
              } else {
                hoveredSegmentKey = null;
              }
            }
          "
          @click="
            !isCutToolActive &&
            !isDraggingSegment &&
            !isResizingSegment &&
            onTimelineSegmentClick(clip.id, segIndex, $event)
          "
          @mousedown="
            !isResizingSegment &&
            (isCutToolActive
              ? onSegmentClickForCut($event, clip.id, segIndex, segment)
              : onSegmentMouseDown($event, clip.id, segIndex, segment))
          "
          @contextmenu="onSegmentContextMenu($event, clip.id, segIndex, segment, clip.title)"
        >
          <span class="segment-title select-none truncate px-2 text-2xs font-medium text-fg">
            {{ clip.title }}
          </span>
          <!-- Cut preview indicator -->
          <div
            v-if="isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex"
            class="absolute top-0 bottom-0 pointer-events-none z-40"
            :style="{
              left: `${cutHoverInfo.cutPosition}%`,
              transform: 'translateX(-50%)',
            }"
            @vue:mounted="console.log(`[CUTTING] Cut preview indicator mounted for ${clip.id}_${segIndex}`)"
          >
            <!-- Vertical cut line -->
            <div class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-fg"></div>
            <div class="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg"></div>
            <div class="absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-fg"></div>
          </div>
          <!-- Left resize handle -->
          <div
            v-if="!getSegmentAdjacency(clip.id, segIndex).hasPrevious"
            class="resize-handle resize-handle-left pointer-events-none absolute inset-y-0 left-0 flex w-2.5 cursor-ew-resize items-center justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
            :class="{
              'opacity-100 pointer-events-auto': !isCutToolActive && hoveredSegmentKey === `${clip.id}_${segIndex}`,
            }"
            @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'left')"
          >
            <div class="resize-grip h-3.5 w-[3px] rounded-full bg-white/85"></div>
          </div>
          <!-- Right resize handle -->
          <div
            v-if="!getSegmentAdjacency(clip.id, segIndex).hasNext"
            class="resize-handle resize-handle-right pointer-events-none absolute inset-y-0 right-0 flex w-2.5 cursor-ew-resize items-center justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
            :class="{
              'opacity-100 pointer-events-auto': !isCutToolActive && hoveredSegmentKey === `${clip.id}_${segIndex}`,
            }"
            @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'right')"
          >
            <div class="resize-grip h-3.5 w-[3px] rounded-full bg-white/85"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { formatDuration, getSegmentDisplayTime, hexToRgba } from '../utils/timelineUtils';
  import type { TimelineClipTrackProps, ClipSegment, Clip } from '../types';

  defineProps<TimelineClipTrackProps>();

  interface Emits {
    (e: 'timelineClipClick', clipId: string): void;
    (e: 'timelineSegmentClick', clipId: string, segmentIndex: number, event?: MouseEvent): void;
    (e: 'clipTrackClick', event: MouseEvent): void;
    (e: 'deselectAllSegments'): void;
    (e: 'update:cutHoverInfo', value: null): void;
    (
      e: 'segmentContextMenu',
      event: MouseEvent,
      clipId: string,
      segmentIndex: number,
      segment: ClipSegment,
      clipTitle: string
    ): void;
    (e: 'clipContextMenu', event: MouseEvent, clipId: string, clipTitle: string): void;
  }

  const emit = defineEmits<Emits>();

  // Handle segment context menu (right-click)
  function onSegmentContextMenu(
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment,
    clipTitle: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    emit('segmentContextMenu', event, clipId, segmentIndex, segment, clipTitle);
  }

  // Handle clip track context menu (right-click on empty area)
  function onClipTrackContextMenu(event: MouseEvent, clip: { id: string; title: string }) {
    event.preventDefault();
    event.stopPropagation();
    emit('clipContextMenu', event, clip.id, clip.title);
  }

  // Local state for hover tracking
  const hoveredSegmentKey = ref<string | null>(null);

  function onTimelineClipClick(clipId: string) {
    emit('timelineClipClick', clipId);
  }

  function onClipTrackClick(event: MouseEvent) {
    // Emit deselect event when clicking on empty parts of the track
    emit('deselectAllSegments');
    emit('clipTrackClick', event);
  }

  function onTimelineSegmentClick(clipId: string, segmentIndex: number, event?: MouseEvent) {
    emit('timelineSegmentClick', clipId, segmentIndex, event);
  }

  // Run colors identify detection runs (data color); manual clips fall back to emerald.
  const DEFAULT_RUN_COLOR = '#10B981';

  function segmentColorStyle(runColor: string | undefined) {
    const color = runColor || DEFAULT_RUN_COLOR;
    return {
      backgroundColor: hexToRgba(color, 0.3),
      borderColor: hexToRgba(color, 0.65),
    };
  }

  // Get a short label for the clip track
  function getClipLabel(clip: Clip): string {
    // Use clip title, truncated if too long
    const title = clip.title || 'Clip';
    // Return first 8 characters if longer
    if (title.length > 8) {
      return title.substring(0, 7) + '…';
    }
    return title;
  }
</script>

<style scoped>
  /* Segment state chrome: one calm ring system (brand = selected / active edit). */
  .clip-segment {
    transition:
      box-shadow 0.15s ease,
      filter 0.15s ease;
  }

  .clip-segment:hover {
    filter: brightness(1.15);
  }

  .clip-segment:hover .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  .segment-title {
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);
  }

  .clip-segment.is-hovered {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35);
  }

  .clip-segment.is-playing {
    box-shadow: 0 0 0 1.5px var(--fg);
  }

  .clip-segment.selected-segment {
    z-index: 15;
    box-shadow: 0 0 0 2px var(--brand);
    filter: brightness(1.15);
  }

  .clip-segment.is-dragging {
    cursor: grabbing !important;
    transition: none !important;
    box-shadow:
      0 0 0 2px var(--brand),
      var(--shadow-md);
    filter: brightness(1.2);
  }

  .clip-segment.is-resizing {
    transition: none !important;
    box-shadow: 0 0 0 2px var(--brand);
  }

  .clip-segment.is-resizing .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  .clip-segment.keyboard-moving-segment {
    z-index: 35;
    box-shadow:
      0 0 0 2px var(--brand),
      0 0 0 5px var(--brand-soft);
    transition: box-shadow 0.1s ease-out;
  }

  /* Cut tool: the white cut line replaces the cursor */
  .clip-segment.cut-mode {
    cursor: none !important;
  }

  .clip-segment.is-cut-target {
    box-shadow: 0 0 0 1px var(--fg);
  }

  .resize-handle {
    z-index: 10;
  }

  .resize-handle-left {
    background: linear-gradient(to right, rgba(0, 0, 0, 0.35), transparent);
  }

  .resize-handle-right {
    background: linear-gradient(to left, rgba(0, 0, 0, 0.35), transparent);
  }

  .resize-handle:hover .resize-grip,
  .clip-segment.is-resizing .resize-grip {
    background: var(--fg);
  }
</style>
