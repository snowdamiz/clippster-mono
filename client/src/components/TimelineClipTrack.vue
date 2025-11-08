<template>
  <div
    v-for="(clip, index) in clips"
    :key="clip.id"
    class="flex items-center min-h-12 px-2 border-b border-border/20 cursor-pointer relative"
    @click="onTimelineClipClick(clip.id)"
  >
    <!-- Track Label -->
    <div class="w-1 h-8 pr-2 -ml-2 flex items-center justify-center sticky left-0 z-30 bg-[#101010] backdrop-blur-sm">
      <div class="text-xs text-center">
        <div class="font-medium text-foreground/80">Clip {{ index + 1 }}</div>
      </div>
    </div>
    <!-- Clip Track Content -->
    <div class="flex-1 h-8 relative">
      <div
        class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md border border-border/20 cursor-pointer"
        @click="onClipTrackClick"
      ></div>
      <!-- Clip segments on timeline -->
      <div class="absolute inset-0 flex items-center pointer-events-none">
        <!-- Render each segment as a clip on the timeline -->
        <div
          v-for="(segment, segIndex) in clip.segments"
          :key="`${clip.id}_${segIndex}`"
          :ref="(el) => setTimelineClipRef(el, clip.id)"
          class="clip-segment absolute h-6 border rounded-md flex items-center justify-center pointer-events-auto group"
          :class="[
            isDraggingSegment && draggedSegmentInfo?.clipId === clip.id && draggedSegmentInfo?.segmentIndex === segIndex
              ? 'cursor-grabbing z-30 shadow-2xl border-2 border-blue-400 dragging'
              : isResizingSegment && resizeHandleInfo?.clipId === clip.id && resizeHandleInfo?.segmentIndex === segIndex
                ? 'cursor-ew-resize z-30 shadow-2xl border-2 border-green-400 resizing'
                : isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex
                  ? 'cursor-crosshair z-25 shadow-xl border-2 border-orange-400 ring-2 ring-orange-400/50 ring-offset-1 ring-offset-transparent'
                  : 'cursor-grab hover:cursor-grab transition-all duration-200 ease-out',
            clip.run_number ? `run-${clip.run_number}` : '',
            currentlyPlayingClipId === clip.id
              ? 'shadow-lg z-20'
              : hoveredClipId === clip.id || (hoveredTimelineClipId === clip.id && !currentlyPlayingClipId)
                ? 'shadow-lg z-20'
                : '',
          ]"
          :style="{
            left: `${duration ? (getSegmentDisplayTime(segment, 'start') / duration) * 100 : 0}%`,
            width: `${duration ? ((getSegmentDisplayTime(segment, 'end') - getSegmentDisplayTime(segment, 'start')) / duration) * 100 : 0}%`,
            ...generateClipGradient(clip.run_color),
            ...(currentlyPlayingClipId === clip.id
              ? {
                  borderColor: '#10b981',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                }
              : hoveredClipId === clip.id || (hoveredTimelineClipId === clip.id && !currentlyPlayingClipId)
                ? {
                    borderColor: '#ffffff',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                  }
                : {}),
          }"
          :data-run-color="clip.run_color"
          :title="`${clip.title} - ${formatDuration(getSegmentDisplayTime(segment, 'start'))} to ${formatDuration(getSegmentDisplayTime(segment, 'end'))}${clip.run_number ? ` (Run ${clip.run_number})` : ''}`"
          @mouseenter="
            !isCutToolActive
              ? (hoveredSegmentKey = `${clip.id}_${segIndex}`)
              : onSegmentHoverForCut($event, clip.id, segIndex, segment)
          "
          @mousemove="isCutToolActive && onSegmentHoverForCut($event, clip.id, segIndex, segment)"
          @mouseleave="!isCutToolActive ? (hoveredSegmentKey = null) : emit('update:cutHoverInfo', null)"
          @mousedown="
            !isResizingSegment &&
            (isCutToolActive
              ? onSegmentClickForCut($event, clip.id, segIndex, segment)
              : onSegmentMouseDown($event, clip.id, segIndex, segment))
          "
        >
          <span class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm">{{ clip.title }}</span>
          <!-- Cut preview indicator -->
          <div
            v-if="isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex"
            class="absolute top-0 bottom-0 pointer-events-none z-40"
            :style="{
              left: `${cutHoverInfo.cutPosition}%`,
              transform: 'translateX(-50%)',
            }"
          >
            <!-- Vertical cut line -->
            <div
              class="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-orange-400 shadow-lg shadow-orange-400/50"
            ></div>
            <!-- Top cut indicator -->
            <div
              class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-orange-400 rounded-full shadow-md shadow-orange-400/50 border border-white/80 cut-indicator flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-1.5 w-1.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <!-- Bottom cut indicator -->
            <div
              class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-orange-400 rounded-full shadow-md shadow-orange-400/50 border border-white/80 cut-indicator flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-1.5 w-1.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <!-- Left resize handle -->
          <div
            v-if="!getSegmentAdjacency(clip.id, segIndex).hasPrevious"
            class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 hover:w-2 group-hover:opacity-100 group-hover:pointer-events-auto"
            :class="{
              'opacity-100 pointer-events-auto': hoveredSegmentKey === `${clip.id}_${segIndex}`,
            }"
            @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'left')"
          >
            <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
          </div>
          <!-- Right resize handle -->
          <div
            v-if="!getSegmentAdjacency(clip.id, segIndex).hasNext"
            class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 hover:w-2 group-hover:opacity-100 group-hover:pointer-events-auto"
            :class="{
              'opacity-100 pointer-events-auto': hoveredSegmentKey === `${clip.id}_${segIndex}`,
            }"
            @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'right')"
          >
            <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import {
    formatDuration,
    generateClipGradient,
    getSegmentDisplayTime,
    type ClipSegment,
  } from '../utils/timelineUtils';

  interface Clip {
    id: string;
    title: string;
    filename: string;
    type: 'continuous' | 'spliced';
    segments: ClipSegment[];
    total_duration: number;
    combined_transcript: string;
    virality_score: number;
    reason: string;
    socialMediaPost: string;
    run_number?: number;
    run_color?: string;
  }

  interface Props {
    clips: Clip[];
    duration: number;
    currentlyPlayingClipId?: string | null;
    hoveredClipId?: string | null;
    hoveredTimelineClipId?: string | null;
    isDraggingSegment: boolean;
    draggedSegmentInfo?: {
      clipId: string;
      segmentIndex: number;
      originalStartTime: number;
      originalEndTime: number;
      originalMouseX: number;
      dragStartTime: number;
      currentStartTime: number;
      currentEndTime: number;
      tooltipX?: number;
      tooltipY?: number;
    } | null;
    isResizingSegment: boolean;
    resizeHandleInfo?: {
      clipId: string;
      segmentIndex: number;
      handleType: 'left' | 'right';
      originalStartTime: number;
      originalEndTime: number;
      originalMouseX: number;
      resizeStartTime: number;
      currentStartTime: number;
      currentEndTime: number;
      minStartTime: number;
      maxEndTime: number;
      tooltipX?: number;
      tooltipY?: number;
    } | null;
    isCutToolActive: boolean;
    cutHoverInfo?: {
      clipId: string;
      segmentIndex: number;
      cutTime: number;
      cutPosition: number;
      cursorPosition: number;
    } | null;
    getSegmentAdjacency: (clipId: string, segmentIndex: number) => { hasPrevious: boolean; hasNext: boolean };
    setTimelineClipRef: (el: any, clipId: string) => void;
    onSegmentHoverForCut: (event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) => void;
    onSegmentClickForCut: (event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) => void;
    onSegmentMouseDown: (event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) => void;
    onResizeMouseDown: (
      event: MouseEvent,
      clipId: string,
      segmentIndex: number,
      segment: ClipSegment,
      handleType: 'left' | 'right'
    ) => void;
  }

  defineProps<Props>();

  interface Emits {
    (e: 'timelineClipClick', clipId: string): void;
    (e: 'clipTrackClick', event: MouseEvent): void;
    (e: 'update:cutHoverInfo', value: null): void;
  }

  const emit = defineEmits<Emits>();

  // Local state for hover tracking
  const hoveredSegmentKey = ref<string | null>(null);

  function onTimelineClipClick(clipId: string) {
    emit('timelineClipClick', clipId);
  }

  function onClipTrackClick(event: MouseEvent) {
    emit('clipTrackClick', event);
  }
</script>

<style scoped>
  /* Clip segment animations */
  .clip-segment {
    transition:
      transform 0.2s ease-out,
      box-shadow 0.2s ease-out,
      border-color 0.15s ease;
    will-change: transform, box-shadow;
  }

  /* No transitions during drag for smoother performance */
  .clip-segment.dragging {
    transition: none !important;
  }

  /* No transitions during resize for smoother performance */
  .clip-segment.resizing {
    transition: none !important;
  }

  /* Enhanced hover state for clip segments with handles */
  .clip-segment:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  /* Ensure resize handles are visible on segment hover */
  .clip-segment:hover .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  /* Individual hover effect removed - clips only highlight through bidirectional system */

  /* Enhanced cursor states */
  .clip-segment:not(.dragging):hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  /* Active resize handle styling */
  .clip-segment.resizing .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
    background: rgba(255, 255, 255, 0.8) !important;
  }

  .clip-segment.dragging {
    cursor: grabbing !important;
    transform: scale(1.02);
  }

  /* Smooth transitions for non-dragging states */
  .clip-segment:not(.dragging) {
    transition:
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.15s ease;
  }

  /* Cut tool styles */
  .clip-segment.cursor-crosshair {
    background: linear-gradient(to right, rgba(251, 146, 60, 0.3), rgba(251, 146, 60, 0.4)) !important;
    border-color: rgb(251, 146, 60) !important;
    transform: translateY(-1px);
  }

  .clip-segment.cursor-crosshair:hover {
    background: linear-gradient(to right, rgba(251, 146, 60, 0.4), rgba(251, 146, 60, 0.5)) !important;
    transform: translateY(-2px);
  }

  /* Enhanced cut preview animations */
  @keyframes cut-line-pulse {
    0%,
    100% {
      opacity: 0.9;
      box-shadow: 0 0 10px rgba(251, 146, 60, 0.8);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 20px rgba(251, 146, 60, 1);
    }
  }

  @keyframes cut-indicator-float {
    0%,
    100% {
      transform: translateY(-50%) translateX(-50%) scale(1);
    }
    50% {
      transform: translateY(-50%) translateX(-50%) scale(1.1);
    }
  }

  /* Cut line styling enhancement */
  .bg-orange-400 {
    animation: cut-line-pulse 2s ease-in-out infinite;
  }

  /* Force consistent rendering for cut indicators */
  .cut-indicator {
    transform: translateZ(0); /* Force hardware acceleration */
    backface-visibility: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Hide crosshair cursor during cut mode but maintain rendering consistency */
  .clip-segment.cursor-crosshair {
    cursor:
      url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/></svg>'),
      none !important;
  }
</style>
