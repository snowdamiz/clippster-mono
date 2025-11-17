<template>
  <div
    v-if="showLine && !isPanning && !isDragging && !isCutToolActive"
    class="fixed bg-white/40 z-50 pointer-events-none transition-opacity duration-150"
    :style="{
      left: `${position}px`,
      top: `${timelineBoundsTop}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`,
      width: '1px',
    }"
  >
    <div class="absolute top-0 -left-1 w-2 h-2 bg-white/60 rounded-full"></div>
    <div class="absolute bottom-0 -left-1 w-2 h-2 bg-white/60 rounded-full"></div>
  </div>
</template>

<script setup lang="ts">
  import type { TimelineHoverLineProps } from '../types';

  defineProps<TimelineHoverLineProps>();
</script>

<style scoped>
  /* Timeline hover line */
  .bg-white\/40 {
    background: rgba(255, 255, 255, 0.4);
    z-index: 50;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  .bg-white\/40::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform 0.2s ease;
  }

  .bg-white\/40::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: -4px;
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    transition: transform 0.2s ease;
  }

  .bg-white\/40::before {
    top: 0;
  }

  .bg-white\/40::after {
    bottom: 0;
  }
</style>
