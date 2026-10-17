<template>
  <div
    v-if="isDragging"
    :class="[
      'pointer-events-none fixed z-25 border bg-brand-soft',
      isAddClipMode ? 'border-dashed border-brand' : 'border-brand-line',
    ]"
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
        class="tabular flex items-center gap-1 whitespace-nowrap rounded-md bg-surface-raised px-2 py-1 text-2xs font-medium text-fg shadow-[var(--shadow-md)]"
      >
        <Plus v-if="isAddClipMode" class="size-3 text-brand" />
        <span>
          {{ formatDuration(Math.min(dragStartPercent, dragEndPercent) * duration) }} –
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
