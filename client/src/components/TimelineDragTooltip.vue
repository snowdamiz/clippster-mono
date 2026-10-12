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
    <TimelineFloatingTip
      label="Moving segment"
      :primary="`${formatDuration(draggedSegmentInfo.currentStartTime)} – ${formatDuration(draggedSegmentInfo.currentEndTime)}`"
      :secondary="formatDuration(draggedSegmentInfo.currentEndTime - draggedSegmentInfo.currentStartTime)"
      :words="dragTooltipTranscriptWords"
      :center-index="dragTooltipCenterWordIndex"
      empty-text="No transcript"
    />
  </div>
</template>

<script setup lang="ts">
  import { formatDuration } from '../utils/timelineUtils'
  import TimelineFloatingTip from './TimelineFloatingTip.vue'

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
