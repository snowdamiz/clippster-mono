<template>
  <div
    v-if="videoSrc && duration > 0"
    class="fixed bg-white/70 shadow-lg z-60 pointer-events-none transition-all duration-100"
    :style="{
      left: `${position}px`,
      top: `${timelineBoundsTop}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`,
      width: '1px',
    }"
  ></div>
</template>

<script setup lang="ts">
  interface Props {
    videoSrc: string | null;
    duration: number;
    position: number;
    timelineBoundsTop: number;
    timelineBoundsBottom: number;
  }

  defineProps<Props>();
</script>

<style scoped>
  /* Global playhead line styling */
  .bg-white\/70 {
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
    z-index: 60;
    pointer-events: none;
    transition: left 0.1s ease;
  }

  .bg-white\/70::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .bg-white\/70::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: -4px;
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
  }
</style>
