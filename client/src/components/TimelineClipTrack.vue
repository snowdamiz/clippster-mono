<template>
  <div
    v-for="(clip, index) in clips"
    :key="clip.id"
    class="flex items-center min-h-12 px-2 border-b border-border/20 cursor-pointer relative"
    @click="onTimelineClipClick(clip.id)"
  >
    <!-- Track Label -->
    <div
      class="w-18 h-8 -ml-2 flex items-center justify-center sticky left-0 z-30 bg-gradient-to-r from-[#141416] to-[#141416]/80 backdrop-blur-md border-r border-white/[0.04]"
    >
      <div class="text-xs text-center px-1.5">
        <div class="font-medium text-white/70 truncate max-w-16 text-[10px] tracking-wide" :title="clip.title">
          {{ getClipLabel(clip) }}
        </div>
      </div>
    </div>
    <!-- Clip Track Content -->
    <div class="flex-1 h-8 relative">
      <div
        class="absolute inset-0 bg-gradient-to-b from-[#161618]/40 to-[#0d0d0e]/30 rounded-md border border-white/[0.03] cursor-pointer"
        @click="onClipTrackClick"
        @contextmenu="onClipTrackContextMenu($event, clip)"
      ></div>
      <!-- Clip segments on timeline -->
      <div class="absolute inset-0 flex items-center pointer-events-none">
        <!-- Render each segment as a clip on the timeline -->
        <div
          v-for="(segment, segIndex) in clip.segments"
          :key="`${clip.id}_${segIndex}`"
          :ref="(el) => setTimelineClipRef(el, clip.id)"
          class="clip-segment absolute h-6 rounded-md flex items-center justify-center pointer-events-auto group overflow-hidden"
          :class="[
            isDraggingSegment && draggedSegmentInfo?.clipId === clip.id && draggedSegmentInfo?.segmentIndex === segIndex
              ? 'cursor-grabbing z-30 shadow-2xl border-2 border-blue-400 dragging'
              : isResizingSegment && resizeHandleInfo?.clipId === clip.id && resizeHandleInfo?.segmentIndex === segIndex
                ? 'cursor-ew-resize z-30 shadow-2xl border-2 border-green-400 resizing'
                : isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex
                  ? 'cursor-crosshair z-65 shadow-xl border-2 border-orange-400 ring-2 ring-orange-400/50 ring-offset-1 ring-offset-transparent'
                  : isCutToolActive
                    ? 'cursor-crosshair z-62 transition-all duration-200 ease-out'
                    : 'cursor-grab hover:cursor-grab transition-all duration-200 ease-out',
            clip.run_number ? `run-${clip.run_number}` : '',
            !isCutToolActive && currentlyPlayingClipId === clip.id
              ? 'shadow-lg z-20 ring-2 ring-emerald-400/70 border border-emerald-400/50'
              : !isCutToolActive &&
                  (hoveredClipId === clip.id || hoveredTimelineClipId === clip.id)
                ? 'shadow-lg z-20 ring-1 ring-white/40'
                : '',
            selectedSegmentKeys?.has(`${clip.id}_${segIndex}`)
              ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-transparent selected-segment'
              : '',
            isMovingSegment && selectedSegmentKeys?.has(`${clip.id}_${segIndex}`) ? 'keyboard-moving-segment' : '',
          ]"
          :style="{
            left: `${duration ? (getSegmentDisplayTime(segment, 'start') / duration) * 100 : 0}%`,
            width: `${duration ? ((getSegmentDisplayTime(segment, 'end') - getSegmentDisplayTime(segment, 'start')) / duration) * 100 : 0}%`,
            ...generateClipGradient(clip.run_color),
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
          <span class="segment-title text-[11px] text-white font-medium truncate px-2 select-none">
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
            <div
              class="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-orange-400 shadow-lg shadow-orange-400/50"
            ></div>
            <!-- Top cut indicator -->
            <div
              class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-orange-400 rounded-full shadow-md shadow-orange-400/50 border border-white/80 cut-indicator flex items-center justify-center"
            >
              <X :size="6" class="text-white" stroke-width="3" />
            </div>
            <!-- Bottom cut indicator -->
            <div
              class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-orange-400 rounded-full shadow-md shadow-orange-400/50 border border-white/80 cut-indicator flex items-center justify-center"
            >
              <X :size="6" class="text-white" stroke-width="3" />
            </div>
          </div>
          <!-- Left resize handle -->
          <div
            v-if="!getSegmentAdjacency(clip.id, segIndex).hasPrevious"
            class="resize-handle resize-handle-left absolute left-0 top-0 bottom-0 w-3 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center group-hover:opacity-100 group-hover:pointer-events-auto"
            :class="{
              'opacity-100 pointer-events-auto': !isCutToolActive && hoveredSegmentKey === `${clip.id}_${segIndex}`,
            }"
            @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'left')"
          >
            <div
              class="w-1 h-3 bg-white/80 rounded-full shadow-sm transition-all duration-150 group-hover:h-4 group-hover:bg-white"
            ></div>
          </div>
          <!-- Right resize handle -->
          <div
            v-if="!getSegmentAdjacency(clip.id, segIndex).hasNext"
            class="resize-handle resize-handle-right absolute right-0 top-0 bottom-0 w-3 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center group-hover:opacity-100 group-hover:pointer-events-auto"
            :class="{
              'opacity-100 pointer-events-auto': !isCutToolActive && hoveredSegmentKey === `${clip.id}_${segIndex}`,
            }"
            @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'right')"
          >
            <div
              class="w-1 h-3 bg-white/80 rounded-full shadow-sm transition-all duration-150 group-hover:h-4 group-hover:bg-white"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { X } from 'lucide-vue-next';
  import { formatDuration, generateClipGradient, getSegmentDisplayTime } from '../utils/timelineUtils';
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
  /* ============================================
     CLIP SEGMENT - Base Styles
     ============================================ */
  .clip-segment {
    transition:
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      filter 0.2s ease;
    will-change: transform, box-shadow;
    backdrop-filter: blur(4px);
  }

  /* Segment title text styling */
  .segment-title {
    text-shadow:
      0 1px 2px rgba(0, 0, 0, 0.5),
      0 0 8px rgba(0, 0, 0, 0.3);
    letter-spacing: 0.01em;
  }

  /* ============================================
     HOVER States
     ============================================ */
  .clip-segment:hover {
    transform: translateY(-1px);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    filter: brightness(1.1);
  }

  .clip-segment:hover .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  /* ============================================
     SELECTED State
     ============================================ */
  .clip-segment.selected-segment {
    z-index: 15;
    transform: translateY(-1px);
    box-shadow:
      0 0 0 2px rgba(59, 130, 246, 0.8),
      0 4px 16px rgba(59, 130, 246, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    filter: brightness(1.15);
  }

  .clip-segment.selected-segment:not(.dragging):not(.resizing) {
    animation: selection-glow 2s ease-in-out infinite;
  }

  @keyframes selection-glow {
    0%,
    100% {
      box-shadow:
        0 0 0 2px rgba(59, 130, 246, 0.8),
        0 4px 16px rgba(59, 130, 246, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
    50% {
      box-shadow:
        0 0 0 2px rgba(59, 130, 246, 1),
        0 4px 20px rgba(59, 130, 246, 0.5),
        0 0 24px rgba(59, 130, 246, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
  }

  /* ============================================
     PLAYING State (green glow)
     ============================================ */
  .clip-segment.shadow-lg.z-20 {
    box-shadow:
      0 0 0 2px rgba(16, 185, 129, 0.7),
      0 4px 16px rgba(16, 185, 129, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    filter: brightness(1.12);
  }

  /* ============================================
     DRAGGING State
     ============================================ */
  .clip-segment.dragging {
    cursor: grabbing !important;
    transform: translateY(-2px) scale(1.02);
    transition: none !important;
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.35),
      0 0 0 2px rgba(59, 130, 246, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    filter: brightness(1.15);
  }

  /* ============================================
     RESIZING State
     ============================================ */
  .clip-segment.resizing {
    transition: none !important;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 0 0 2px rgba(34, 197, 94, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
    filter: brightness(1.1);
  }

  .clip-segment.resizing .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  .clip-segment.resizing .resize-handle > div {
    background: white !important;
    height: 1rem !important;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
  }

  /* ============================================
     KEYBOARD MOVEMENT State
     ============================================ */
  .clip-segment.keyboard-moving-segment {
    z-index: 35;
    transform: translateY(-2px) scale(1.01);
    box-shadow:
      0 0 0 2px rgba(59, 130, 246, 0.9),
      0 8px 24px rgba(59, 130, 246, 0.4),
      0 0 32px rgba(59, 130, 246, 0.2);
    transition: all 0.1s ease-out;
    filter: brightness(1.2);
  }

  .clip-segment.keyboard-moving-segment::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 8px;
    background: linear-gradient(45deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.2));
    z-index: -1;
    animation: keyboard-move-pulse 0.6s ease-in-out infinite;
  }

  @keyframes keyboard-move-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  /* ============================================
     RESIZE HANDLES
     ============================================ */
  .resize-handle {
    z-index: 10;
  }

  .resize-handle-left {
    background: linear-gradient(to right, rgba(0, 0, 0, 0.3), transparent);
    border-radius: 6px 0 0 6px;
  }

  .resize-handle-right {
    background: linear-gradient(to left, rgba(0, 0, 0, 0.3), transparent);
    border-radius: 0 6px 6px 0;
  }

  .resize-handle:hover > div {
    transform: scaleY(1.2);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
  }

  /* ============================================
     CUT TOOL States
     ============================================ */
  .clip-segment.cursor-crosshair {
    background: linear-gradient(
      180deg,
      rgba(251, 146, 60, 0.5) 0%,
      rgba(251, 146, 60, 0.35) 50%,
      rgba(251, 146, 60, 0.45) 100%
    ) !important;
    box-shadow:
      0 0 0 2px rgba(251, 146, 60, 0.7),
      0 4px 16px rgba(251, 146, 60, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
    transform: translateY(-1px);
    cursor:
      url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/></svg>'),
      none !important;
  }

  .clip-segment.cursor-crosshair:hover {
    transform: translateY(-2px);
    filter: brightness(1.15);
  }

  /* Cut line animation */
  @keyframes cut-line-pulse {
    0%,
    100% {
      opacity: 0.9;
      box-shadow: 0 0 8px rgba(251, 146, 60, 0.8);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 16px rgba(251, 146, 60, 1);
    }
  }

  .bg-orange-400 {
    animation: cut-line-pulse 1.5s ease-in-out infinite;
  }

  .cut-indicator {
    transform: translateZ(0);
    backface-visibility: hidden;
  }
</style>
