<template>
  <div
    v-if="isDraggingSegment && draggedSegmentInfo"
    class="fixed pointer-events-none z-50 transition-all duration-75"
    :style="{
      left: `${draggedSegmentInfo.tooltipX || draggedSegmentInfo.originalMouseX}px`,
      top: `${draggedSegmentInfo.tooltipY || timelineBoundsTop - 60}px`,
      transform: 'translateX(-50%)'
    }"
  >
    <div
      class="bg-blue-600/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-md font-medium shadow-lg border border-white/20 max-w-xs"
    >
      <div class="text-center">
        <div class="font-semibold mb-1">Moving Segment</div>

        <div>
          {{ formatDuration(draggedSegmentInfo.currentStartTime) }} -
          {{ formatDuration(draggedSegmentInfo.currentEndTime) }}
        </div>

        <div class="text-xs opacity-75 mt-1">
          Duration: {{ formatDuration(draggedSegmentInfo.currentEndTime - draggedSegmentInfo.currentStartTime) }}
        </div>
      </div>
      <!-- Transcript Words -->
      <div v-if="dragTooltipTranscriptWords.length > 0" class="text-center mt-2 pt-2 border-t border-white/20">
        <div class="transcript-words space-x-1">
          <span
            v-for="(word, index) in dragTooltipTranscriptWords"
            :key="index"
            :class="[
              'transition-all duration-0',
              index === dragTooltipCenterWordIndex ? 'word-highlight' : 'word-normal'
            ]"
          >
            {{ word.word }}
          </span>
        </div>
      </div>
      <!-- Fallback when no transcript -->
      <div v-else class="text-center text-white/50 text-xs mt-2 pt-2 border-t border-white/20">No transcript</div>

      <div
        class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-blue-600/90 border-r border-b border-white/20"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { formatDuration } from '../utils/timelineUtils'

  interface Props {
    isDraggingSegment: boolean
    draggedSegmentInfo?: {
      clipId: string
      segmentIndex: number
      originalStartTime: number
      originalEndTime: number
      originalMouseX: number
      dragStartTime: number
      currentStartTime: number
      currentEndTime: number
      tooltipX?: number
      tooltipY?: number
    } | null
    timelineBoundsTop: number
    dragTooltipTranscriptWords: Array<{ word: string; start: number; end: number }>
    dragTooltipCenterWordIndex: number
  }

  defineProps<Props>()
</script>

<style scoped>
  /* Enhanced tooltip styling */
  .bg-blue-600\/90 {
    background: rgba(37, 99, 235, 0.9);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .transcript-words {
    line-height: 1.4;
    word-spacing: 2px;
  }

  .word-highlight {
    color: #fbbf24;
    font-weight: 600;
    transform: scale(1.05);
    display: inline-block;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .word-normal {
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s ease;
  }
</style>
