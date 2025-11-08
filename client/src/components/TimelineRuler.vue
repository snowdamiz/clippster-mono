<template>
  <div
    class="h-8 border-b border-border/30 flex items-center bg-[#0a0a0a]/40 px-2 sticky top-0 z-50 backdrop-blur-sm timeline-ruler sticky-ruler"
    @wheel="onRulerWheel"
    title="Scroll to zoom"
  >
    <!-- Track label spacer -->
    <div class="w-16 pr-2 flex items-center justify-center">
      <span class="text-xs text-muted-foreground/50 font-medium">Time</span>
    </div>
    <!-- Timestamp ruler -->
    <div class="flex-1 relative h-full flex items-center">
      <!-- Timestamp markers -->
      <div
        v-for="timestamp in generatedTimestamps"
        :key="timestamp.time"
        class="absolute flex flex-col items-center"
        :style="{
          left: `${timestamp.position}%`,
          transform: 'translateX(-50%)',
        }"
      >
        <!-- Tick mark -->
        <div class="w-px bg-foreground/20 timeline-tick" :class="timestamp.isMajor ? 'h-4' : 'h-2'"></div>
        <!-- Time label -->
        <span
          v-if="timestamp.isMajor"
          class="text-xs text-foreground/40 whitespace-nowrap font-normal mt-1 timeline-label pb-2"
        >
          {{ timestamp.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { generateTimestamps } from '../utils/timelineUtils';

  interface Props {
    duration: number;
    zoomLevel: number;
  }

  const props = defineProps<Props>();

  interface Emits {
    (e: 'rulerWheel', event: WheelEvent): void;
  }

  const emit = defineEmits<Emits>();

  // Intelligent timestamp generation based on video duration and zoom level
  const generatedTimestamps = computed(() => {
    return generateTimestamps(props.duration, props.zoomLevel);
  });

  function onRulerWheel(event: WheelEvent) {
    emit('rulerWheel', event);
  }
</script>

<style scoped>
  /* Timeline ruler styling */
  .timeline-ruler {
    background: rgba(10, 10, 10, 0.6);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    user-select: none;
  }

  .timeline-tick {
    transition: all 0.2s ease;
  }

  .timeline-tick:hover {
    background: rgba(255, 255, 255, 0.6);
  }

  .timeline-label {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    transition: all 0.2s ease;
  }

  .timeline-label:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  /* Sticky ruler positioning */
  .sticky-ruler {
    position: sticky;
    top: 0;
    z-index: 50;
  }
</style>
