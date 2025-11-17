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
    <div
      class="timeline-tooltip bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-md font-medium shadow-lg border border-white/20 max-w-xs"
    >
      <!-- Timestamp -->
      <div class="timestamp text-center mb-1 pb-1">{{ formatDuration(time) }}</div>
      <!-- Transcript Words -->
      <div v-if="transcriptWords.length > 0" class="text-center">
        <div class="transcript-words space-x-1">
          <span
            v-for="(word, index) in transcriptWords"
            :key="index"
            :class="['transition-all duration-0', index === centerWordIndex ? 'word-highlight' : 'word-normal']"
          >
            {{ word.word }}
          </span>
        </div>
      </div>
      <!-- Fallback when no transcript or in dead space -->
      <div v-else class="text-center text-white/50 text-xs">Dead Space</div>

      <div
        class="absolute top-full left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-black/90 border-r border-b border-white/20"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { formatDuration } from '../utils/timelineUtils';
  import type { TimelineTooltipProps } from '../types';

  defineProps<TimelineTooltipProps>();
</script>

<style scoped>
  /* Enhanced tooltip styling */
  .timeline-tooltip {
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .timeline-tooltip .timestamp {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 4px;
    padding-bottom: 4px;
  }

  .timeline-tooltip .transcript-words {
    line-height: 1.4;
    word-spacing: 2px;
  }

  .timeline-tooltip .word-highlight {
    color: #fbbf24;
    font-weight: 600;
    transform: scale(1.05);
    display: inline-block;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .timeline-tooltip .word-normal {
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s ease;
  }
</style>
