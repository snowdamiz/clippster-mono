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
    <div class="absolute top-0 bottom-0 left-1 w-px bg-white/40"></div>
    <!-- Top circle -->
    <div class="absolute top-0 left-0 w-2 h-2 bg-white/60 rounded-full"></div>
    <!-- Bottom circle -->
    <div class="absolute bottom-0 left-0 w-2 h-2 bg-white/60 rounded-full"></div>
  </div>
</template>

<script setup lang="ts">
  import type { TimelineHoverLineProps } from '../types';

  defineProps<TimelineHoverLineProps>();
</script>

<style scoped>
  /* Timeline hover line - styling handled via Tailwind classes */
</style>
