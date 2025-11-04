<template>
  <div
    v-if="isDragging"
    class="fixed drag-selection z-25 pointer-events-none"
    :style="{
      left: `${Math.min(dragStartX, dragEndX)}px`,
      top: `${timelineBoundsTop}px`,
      width: `${Math.abs(dragEndX - dragStartX)}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`
    }"
  >
    <div
      v-if="Math.abs(dragEndX - dragStartX) > DRAG_SELECTION_THRESHOLD"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="bg-blue-500/80 text-white text-xs px-2 py-1 rounded font-medium">
        {{ formatDuration(Math.min(dragStartPercent, dragEndPercent) * duration) }} -
        {{ formatDuration(Math.max(dragStartPercent, dragEndPercent) * duration) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { formatDuration } from '../utils/timelineUtils'
  import { TIMELINE_CONSTANTS } from '../constants/timelineConstants'

  interface Props {
    isDragging: boolean
    dragStartX: number
    dragEndX: number
    dragStartPercent: number
    dragEndPercent: number
    timelineBoundsTop: number
    timelineBoundsBottom: number
    duration: number
  }

  const props = defineProps<Props>()

  const DRAG_SELECTION_THRESHOLD = TIMELINE_CONSTANTS.DRAG_SELECTION_THRESHOLD
</script>

<style scoped>
  /* Drag selection styles */
  .drag-selection {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
    pointer-events: none;
    transition: none;
  }

  .drag-selection::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(59, 130, 246, 0.2) 50%,
      rgba(59, 130, 246, 0.1) 100%
    );
    animation: shimmer 2s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
</style>
