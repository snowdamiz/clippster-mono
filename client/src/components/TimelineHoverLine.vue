<template>
  <div
    v-if="showLine && !isPanning && !isDragging && !isCutToolActive"
    class="fixed z-50 pointer-events-none transition-opacity duration-150"
    :style="{
      left: `${position - 4}px`,
      top: `${timelineBoundsTop}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`,
      width: '9px',
      clipPath: `inset(0 0 0 ${Math.max(0, timelineBoundsLeft - position + 4)}px)`,
    }"
  >
    <!-- The line itself -->
    <div class="absolute inset-y-0 left-1 w-px bg-white/35"></div>
  </div>
</template>

<script setup lang="ts">
  import type { TimelineHoverLineProps } from '../types';

  defineProps<TimelineHoverLineProps>();
</script>
