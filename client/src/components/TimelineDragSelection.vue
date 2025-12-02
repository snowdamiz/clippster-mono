<template>
  <div
    v-if="isDragging"
    :class="['fixed z-25 pointer-events-none', isAddClipMode ? 'drag-selection-clip' : 'drag-selection']"
    :style="{
      left: `${Math.min(dragStartX, dragEndX)}px`,
      top: `${timelineBoundsTop}px`,
      width: `${Math.abs(dragEndX - dragStartX)}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`,
    }"
  >
    <div
      v-if="Math.abs(dragEndX - dragStartX) > DRAG_SELECTION_THRESHOLD"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div
        :class="[
          'text-white text-xs px-2 py-1 rounded font-medium flex items-center gap-1.5',
          isAddClipMode ? 'bg-green-500/90' : 'bg-blue-500/80',
        ]"
      >
        <Plus v-if="isAddClipMode" class="w-3 h-3" />
        <span>
          {{ formatDuration(Math.min(dragStartPercent, dragEndPercent) * duration) }} -
          {{ formatDuration(Math.max(dragStartPercent, dragEndPercent) * duration) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Plus } from 'lucide-vue-next';
  import { formatDuration } from '../utils/timelineUtils';
  import { TIMELINE_CONSTANTS } from '../constants/timelineConstants';

  interface Props {
    isDragging: boolean;
    dragStartX: number;
    dragEndX: number;
    dragStartPercent: number;
    dragEndPercent: number;
    timelineBoundsTop: number;
    timelineBoundsBottom: number;
    duration: number;
    isAddClipMode?: boolean;
  }

  defineProps<Props>();

  const DRAG_SELECTION_THRESHOLD = TIMELINE_CONSTANTS.DRAG_SELECTION_THRESHOLD;
</script>

<style scoped>
  /* Drag selection styles - for zoom mode */
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

  /* Drag selection styles - for add clip mode */
  .drag-selection-clip {
    background: rgba(34, 197, 94, 0.2);
    border: 2px dashed rgba(34, 197, 94, 0.6);
    pointer-events: none;
    transition: none;
  }

  .drag-selection-clip::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(34, 197, 94, 0.1) 0%,
      rgba(34, 197, 94, 0.25) 50%,
      rgba(34, 197, 94, 0.1) 100%
    );
    animation: shimmer-clip 1.5s ease-in-out infinite;
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

  @keyframes shimmer-clip {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
</style>
