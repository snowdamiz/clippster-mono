<template>
  <div
    v-if="showTooltip && !isPanning && !isDragging && !isDraggingSegment && !isResizingSegment"
    class="fixed pointer-events-none z-50 transition-all duration-0"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: 'translateX(-50%)',
    }"
  >
    <TimelineFloatingTip
      :primary="formatDuration(time)"
      :words="transcriptWords"
      :center-index="centerWordIndex"
      empty-text="Dead space"
    />
  </div>
</template>

<script setup lang="ts">
  import { formatDuration } from '../utils/timelineUtils';
  import TimelineFloatingTip from './TimelineFloatingTip.vue';
  import type { TimelineTooltipProps } from '../types';

  defineProps<TimelineTooltipProps>();
</script>
