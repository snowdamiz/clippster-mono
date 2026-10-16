<template>
  <div
    class="sticky top-0 z-50 flex h-7 select-none items-stretch border-b border-line-subtle bg-surface px-2"
    @wheel="onRulerWheel"
    title="Scroll to zoom"
  >
    <!-- Track label spacer (keeps ruler aligned with the 72px track labels) -->
    <div class="sticky left-0 z-10 -ml-2 flex w-18 shrink-0 items-center border-r border-line-subtle bg-surface pl-3">
      <span class="eyebrow">Time</span>
    </div>
    <!-- Timestamp ruler -->
    <div class="relative flex-1">
      <template v-for="timestamp in generatedTimestamps" :key="timestamp.time">
        <div
          class="absolute bottom-0 w-px"
          :class="timestamp.isMajor ? 'h-2 bg-line-strong' : 'h-1 bg-line'"
          :style="{ left: `${timestamp.position}%` }"
        ></div>
        <span
          v-if="timestamp.isMajor"
          class="tabular absolute bottom-2.5 whitespace-nowrap text-2xs leading-none text-fg-subtle"
          :style="{
            left: `${timestamp.position}%`,
            transform: timestamp.position < 1 ? 'translateX(3px)' : 'translateX(-50%)',
          }"
        >
          {{ timestamp.label }}
        </span>
      </template>
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
