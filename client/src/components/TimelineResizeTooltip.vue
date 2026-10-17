<template>
  <div
    v-if="isResizingSegment && resizeHandleInfo"
    class="fixed pointer-events-none z-50 transition-all duration-75"
    :style="{
      left: `${resizeHandleInfo.tooltipX || resizeHandleInfo.originalMouseX}px`,
      top: `${resizeHandleInfo.tooltipY || timelineBoundsTop - 60}px`,
      transform: 'translateX(-50%)'
    }"
  >
    <TimelineFloatingTip
      :label="resizeHandleInfo.handleType === 'left' ? 'Resizing start' : 'Resizing end'"
      :primary="`${formatDuration(resizeHandleInfo.currentStartTime)} – ${formatDuration(resizeHandleInfo.currentEndTime)}`"
      :secondary="formatDuration(resizeHandleInfo.currentEndTime - resizeHandleInfo.currentStartTime)"
      :words="resizeTooltipTranscriptWords"
      :center-index="resizeTooltipCenterWordIndex"
      empty-text="No transcript"
    />
  </div>
</template>

<script setup lang="ts">
  import { formatDuration } from '../utils/timelineUtils'
  import TimelineFloatingTip from './TimelineFloatingTip.vue'

  interface Props {
    isResizingSegment: boolean
    resizeHandleInfo?: {
      clipId: string
      segmentIndex: number
      handleType: 'left' | 'right'
      originalStartTime: number
      originalEndTime: number
      originalMouseX: number
      resizeStartTime: number
      currentStartTime: number
      currentEndTime: number
      minStartTime: number
      maxEndTime: number
      tooltipX?: number
      tooltipY?: number
    } | null
    timelineBoundsTop: number
    resizeTooltipTranscriptWords: Array<{ word: string; start: number; end: number }>
    resizeTooltipCenterWordIndex: number
  }

  defineProps<Props>()
</script>
