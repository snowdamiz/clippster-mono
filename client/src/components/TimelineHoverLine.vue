<template>
  <div
    v-if="showLine && !isPanning && !isDragging"
    class="fixed bg-white/40 z-30 pointer-events-none transition-opacity duration-150"
    :style="{
      left: `${position}px`,
      top: `${timelineBoundsTop}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`,
      width: '1px'
    }"
  >
    <div class="absolute top-0 -left-1 w-2 h-2 bg-white/60 rounded-full"></div>
    <div class="absolute bottom-0 -left-1 w-2 h-2 bg-white/60 rounded-full"></div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    showLine: boolean
    position: number
    timelineBoundsTop: number
    timelineBoundsBottom: number
    isPanning: boolean
    isDragging: boolean
  }

  defineProps<Props>()
</script>

<style scoped>
  /* Timeline hover line */
  .bg-white\/40 {
    background: rgba(255, 255, 255, 0.4);
    z-index: 30;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  .bg-white\/40::before,
  .bg-white\/40::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    left: -3.5px;
  }

  .bg-white\/40::before {
    top: 0;
  }

  .bg-white\/40::after {
    bottom: 0;
  }
</style>
