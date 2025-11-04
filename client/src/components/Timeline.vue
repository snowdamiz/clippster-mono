<template>
  <div
    class="bg-[#0a0a0a]/30 border-t border-border transition-all duration-300 ease-in-out"
    :style="{
      height:
        props.clips.length >= 6
          ? calculatedHeight + 30 + 'px'
          : props.clips.length >= 5
            ? calculatedHeight + 14 + 'px'
            : calculatedHeight + 'px'
    }"
  >
    <div
      class="pt-3 px-4 h-full flex flex-col"
      :style="{
        height: props.clips.length > 0 ? 'auto' : '146px'
      }"
    >
      <!-- Timeline Header -->
      <TimelineHeader
        :isCutToolActive="isCutToolActive"
        :isSeeking="isSeeking"
        :seekDirection="seekDirection"
        :zoomLevel="zoomLevel"
        :minZoom="minZoom"
        :maxZoom="maxZoom"
        :zoomStep="zoomStep"
        :clipCount="displayClips.length"
        @toggleCutTool="toggleCutTool"
        @startContinuousSeeking="startContinuousSeeking"
        @stopContinuousSeeking="stopContinuousSeeking"
        @zoomChanged="onZoomSliderChange"
        ref="timelineHeaderRef"
      />
      <!-- Timeline Tracks Container -->
      <div
        :class="[
          'flex-1 pr-1 bg-muted/20 border border-border/40 rounded-lg relative overflow-x-auto',
          shouldShowScrollbar
            ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800'
            : 'overflow-y-hidden'
        ]"
        ref="timelineScrollContainer"
        :style="{ maxHeight: calculatedHeight - 56 + 'px' }"
        @mousemove="onTimelineMouseMove"
        @mouseleave="onTimelineMouseLeaveGlobal"
        @mousedown="onDragStart"
        @wheel="onTimelineWheel"
        @contextmenu.prevent
      >
        <!-- Timeline Content Wrapper - handles zoom width -->
        <div
          class="timeline-content-wrapper"
          :class="{ dragging: isDragging }"
          :style="{ width: `${100 * zoomLevel}%` }"
        >
          <!-- Shared Timestamp Ruler -->
          <div
            class="h-8 border-b border-border/30 flex items-center bg-[#0a0a0a]/40 px-2 sticky top-0 z-10 backdrop-blur-sm timeline-ruler sticky-ruler"
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
                  transform: 'translateX(-50%)'
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
          <!-- Main Video Track -->
          <div class="flex items-center h-14 px-2 border-b border-border/20 relative">
            <!-- Track Label -->
            <div
              class="w-16 h-10 pr-2 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-30 bg-[#101010] backdrop-blur-sm"
            >
              <div>
                <div class="font-medium">Main</div>

                <div class="text-xs opacity-70">Video</div>
              </div>
            </div>
            <!-- Video Track Content -->
            <div class="flex-1 h-10 relative flex items-center">
              <div
                class="flex-1 h-8 bg-[#0a0a0a]/50 rounded-md relative cursor-pointer group"
                @click="onVideoTrackClick"
                @mousemove="onTimelineTrackHover"
                @mouseleave="onTimelineMouseLeave"
              >
                <!-- Video Track Background -->
                <div v-if="!videoSrc" class="absolute inset-0 flex items-center justify-center">
                  <div class="text-center text-muted-foreground/40">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 mx-auto mb-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p class="text-xs">No video</p>
                  </div>
                </div>
                <!-- Video Track Progress -->
                <div v-else>
                  <!-- Full video duration background -->
                  <div class="absolute inset-0 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 rounded-md"></div>
                  <!-- Played progress -->
                  <div
                    class="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500/60 to-indigo-500/60 rounded-l-md transition-all duration-100"
                    :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
                  ></div>
                  <!-- Hover time indicator -->
                  <div
                    v-if="timelineHoverTime !== null"
                    class="absolute -top-2 transform -translate-x-1/2 z-20"
                    :style="{ left: `${timelineHoverPosition}%` }"
                  >
                    <div class="bg-black/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-medium mb-1">
                      {{ formatDuration(timelineHoverTime) }}
                      <div
                        class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-black/90"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Clip Tracks -->
          <div
            v-for="(clip, index) in displayClips"
            :key="clip.id"
            class="flex items-center min-h-12 px-2 border-b border-border/20 cursor-pointer relative"
            @click="onTimelineClipClick(clip.id)"
          >
            <!-- Track Label -->
            <div
              class="w-16 h-8 pr-2 flex items-center justify-center sticky left-0 z-30 bg-[#101010] backdrop-blur-sm"
            >
              <div class="text-xs text-center">
                <div class="font-medium text-foreground/80">Clip {{ index + 1 }}</div>
              </div>
            </div>
            <!-- Clip Track Content -->
            <div class="flex-1 h-8 relative">
              <div
                class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md border border-border/20 cursor-pointer"
                @click="onClipTrackClick"
              ></div>
              <!-- Clip segments on timeline -->
              <div class="absolute inset-0 flex items-center pointer-events-none">
                <!-- Render each segment as a clip on the timeline -->
                <div
                  v-for="(segment, segIndex) in clip.segments"
                  :key="`${clip.id}_${segIndex}`"
                  :ref="(el) => setTimelineClipRef(el, clip.id)"
                  class="clip-segment absolute h-6 border rounded-md flex items-center justify-center pointer-events-auto group"
                  :class="[
                    isDraggingSegment &&
                    draggedSegmentInfo?.clipId === clip.id &&
                    draggedSegmentInfo?.segmentIndex === segIndex
                      ? 'cursor-grabbing z-30 shadow-2xl border-2 border-blue-400 dragging'
                      : isResizingSegment &&
                          resizeHandleInfo?.clipId === clip.id &&
                          resizeHandleInfo?.segmentIndex === segIndex
                        ? 'cursor-ew-resize z-30 shadow-2xl border-2 border-green-400 resizing'
                        : isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex
                          ? 'cursor-crosshair z-25 shadow-xl border-2 border-orange-400 ring-2 ring-orange-400/50 ring-offset-1 ring-offset-transparent'
                          : 'cursor-grab hover:cursor-grab transition-all duration-200 ease-out',
                    clip.run_number ? `run-${clip.run_number}` : '',
                    props.currentlyPlayingClipId === clip.id
                      ? 'shadow-lg z-20'
                      : hoveredClipId === clip.id ||
                          (props.hoveredTimelineClipId === clip.id && !props.currentlyPlayingClipId)
                        ? 'shadow-lg z-20'
                        : ''
                  ]"
                  :style="{
                    left: `${duration ? (getSegmentDisplayTime(segment, 'start') / duration) * 100 : 0}%`,
                    width: `${duration ? ((getSegmentDisplayTime(segment, 'end') - getSegmentDisplayTime(segment, 'start')) / duration) * 100 : 0}%`,
                    ...generateClipGradient(clip.run_color),
                    ...(props.currentlyPlayingClipId === clip.id
                      ? {
                          borderColor: '#10b981',
                          borderWidth: '2px',
                          borderStyle: 'solid'
                        }
                      : hoveredClipId === clip.id ||
                          (props.hoveredTimelineClipId === clip.id && !props.currentlyPlayingClipId)
                        ? {
                            borderColor: '#ffffff',
                            borderWidth: '2px',
                            borderStyle: 'solid'
                          }
                        : {})
                  }"
                  :data-run-color="clip.run_color"
                  :title="`${clip.title} - ${formatDuration(getSegmentDisplayTime(segment, 'start'))} to ${formatDuration(getSegmentDisplayTime(segment, 'end'))}${clip.run_number ? ` (Run ${clip.run_number})` : ''}`"
                  @mouseenter="
                    !isCutToolActive
                      ? (hoveredSegmentKey = `${clip.id}_${segIndex}`)
                      : onSegmentHoverForCut($event, clip.id, segIndex, segment)
                  "
                  @mousemove="isCutToolActive && onSegmentHoverForCut($event, clip.id, segIndex, segment)"
                  @mouseleave="!isCutToolActive ? (hoveredSegmentKey = null) : (cutHoverInfo = null)"
                  @mousedown="
                    !isResizingSegment &&
                    (isCutToolActive
                      ? onSegmentClickForCut($event, clip.id, segIndex, segment)
                      : onSegmentMouseDown($event, clip.id, segIndex, segment))
                  "
                >
                  <span class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm">{{ clip.title }}</span>
                  <!-- Cut preview indicator -->
                  <div
                    v-if="
                      isCutToolActive && cutHoverInfo?.clipId === clip.id && cutHoverInfo?.segmentIndex === segIndex
                    "
                    class="absolute top-0 bottom-0 pointer-events-none z-40"
                    :style="{
                      left: `${cutHoverInfo.cutPosition}%`,
                      transform: 'translateX(-50%)'
                    }"
                  >
                    <!-- Vertical cut line -->
                    <div
                      class="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-orange-400 shadow-lg shadow-orange-400/50"
                    ></div>
                    <!-- Top cut indicator -->
                    <div
                      class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-orange-400 rounded-full shadow-md shadow-orange-400/50 border border-white/80 cut-indicator flex items-center justify-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-1.5 w-1.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="3"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <!-- Bottom cut indicator -->
                    <div
                      class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-orange-400 rounded-full shadow-md shadow-orange-400/50 border border-white/80 cut-indicator flex items-center justify-center"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-1.5 w-1.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="3"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                  </div>
                  <!-- Left resize handle -->
                  <div
                    v-if="!getSegmentAdjacency(clip.id, segIndex).hasPrevious"
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 hover:w-2 group-hover:opacity-100 group-hover:pointer-events-auto"
                    :class="{
                      'opacity-100 pointer-events-auto': hoveredSegmentKey === `${clip.id}_${segIndex}`
                    }"
                    @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'left')"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle -->
                  <div
                    v-if="!getSegmentAdjacency(clip.id, segIndex).hasNext"
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 hover:w-2 group-hover:opacity-100 group-hover:pointer-events-auto"
                    :class="{
                      'opacity-100 pointer-events-auto': hoveredSegmentKey === `${clip.id}_${segIndex}`
                    }"
                    @mousedown="onResizeMouseDown($event, clip.id, segIndex, segment, 'right')"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- End Timeline Content Wrapper -->
      </div>
      <!-- Timeline Hover Line - positioned relative to viewport but constrained to timeline bounds -->

      <div
        v-if="showTimelineHoverLine && !isPanning && !isDragging"
        class="fixed bg-white/40 z-30 pointer-events-none transition-opacity duration-150"
        :style="{
          left: `${timelineHoverLinePosition}px`,
          top: `${timelineBounds.top}px`,
          height: `${timelineBounds.bottom - timelineBounds.top}px`,
          width: '1px'
        }"
      >
        <div class="absolute top-0 -left-1 w-2 h-2 bg-white/60 rounded-full"></div>

        <div class="absolute bottom-0 -left-1 w-2 h-2 bg-white/60 rounded-full"></div>
      </div>
      <!-- Global Playhead Line - positioned like hover line but follows video time -->
      <div
        v-if="videoSrc && duration > 0"
        class="fixed bg-white/70 shadow-lg z-25 pointer-events-none transition-all duration-100"
        :style="{
          left: `${globalPlayheadPosition}px`,
          top: `${timelineBounds.top}px`,
          height: `${timelineBounds.bottom - timelineBounds.top}px`,
          width: '1px'
        }"
      >
        <div class="absolute top-0 -left-1 w-2 h-2 bg-white rounded-full shadow-md"></div>

        <div class="absolute bottom-0 -left-1 w-2 h-2 bg-white/80 rounded-full"></div>
      </div>
      <!-- Drag Selection Area -->
      <div
        v-if="isDragging"
        class="fixed drag-selection z-25 pointer-events-none"
        :style="{
          left: `${Math.min(dragStartX, dragEndX)}px`,
          top: `${timelineBounds.top}px`,
          width: `${Math.abs(dragEndX - dragStartX)}px`,
          height: `${timelineBounds.bottom - timelineBounds.top}px`
        }"
      >
        <div
          v-if="Math.abs(dragEndX - dragStartX) > TIMELINE_CONSTANTS.DRAG_SELECTION_THRESHOLD"
          class="absolute inset-0 flex items-center justify-center"
        >
          <div class="bg-blue-500/80 text-white text-xs px-2 py-1 rounded font-medium">
            {{ formatDuration(Math.min(dragStartPercent, dragEndPercent) * duration) }} -
            {{ formatDuration(Math.max(dragStartPercent, dragEndPercent) * duration) }}
          </div>
        </div>
      </div>
      <!-- Custom Timeline Tooltip -->
      <div
        v-if="showTimelineTooltip && !isPanning && !isDragging && !isDraggingSegment && !isResizingSegment"
        class="fixed pointer-events-none z-50 transition-all duration-0"
        :style="{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          transform: 'translateX(-50%)'
        }"
      >
        <div
          class="timeline-tooltip bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-md font-medium shadow-lg border border-white/20 max-w-xs"
        >
          <!-- Timestamp -->
          <div class="timestamp text-center mb-1 pb-1">{{ formatDuration(tooltipTime) }}</div>
          <!-- Transcript Words -->
          <div v-if="tooltipTranscriptWords.length > 0" class="text-center">
            <div class="transcript-words space-x-1">
              <span
                v-for="(word, index) in tooltipTranscriptWords"
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
      <!-- Segment Drag Tooltip -->
      <div
        v-if="isDraggingSegment && draggedSegmentInfo"
        class="fixed pointer-events-none z-50 transition-all duration-75"
        :style="{
          left: `${draggedSegmentInfo.tooltipX || draggedSegmentInfo.originalMouseX}px`,
          top: `${draggedSegmentInfo.tooltipY || timelineBounds.top - 60}px`,
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
      <!-- Segment Resize Tooltip -->
      <div
        v-if="isResizingSegment && resizeHandleInfo"
        class="fixed pointer-events-none z-50 transition-all duration-75"
        :style="{
          left: `${resizeHandleInfo.tooltipX || resizeHandleInfo.originalMouseX}px`,
          top: `${resizeHandleInfo.tooltipY || timelineBounds.top - 60}px`,
          transform: 'translateX(-50%)'
        }"
      >
        <div
          class="bg-green-600/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-md font-medium shadow-lg border border-white/20 max-w-xs"
        >
          <div class="text-center">
            <div class="font-semibold mb-1">
              {{ resizeHandleInfo.handleType === 'left' ? 'Resizing Start' : 'Resizing End' }}
            </div>

            <div>
              {{ formatDuration(resizeHandleInfo.currentStartTime) }} -
              {{ formatDuration(resizeHandleInfo.currentEndTime) }}
            </div>

            <div class="text-xs opacity-75 mt-1">
              Duration: {{ formatDuration(resizeHandleInfo.currentEndTime - resizeHandleInfo.currentStartTime) }}
            </div>
          </div>
          <!-- Transcript Words -->
          <div v-if="resizeTooltipTranscriptWords.length > 0" class="text-center mt-2 pt-2 border-t border-white/20">
            <div class="transcript-words space-x-1">
              <span
                v-for="(word, index) in resizeTooltipTranscriptWords"
                :key="index"
                :class="[
                  'transition-all duration-0',
                  index === resizeTooltipCenterWordIndex ? 'word-highlight' : 'word-normal'
                ]"
              >
                {{ word.word }}
              </span>
            </div>
          </div>
          <!-- Fallback when no transcript -->
          <div v-else class="text-center text-white/50 text-xs mt-2 pt-2 border-t border-white/20">No transcript</div>

          <div
            class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-green-600/90 border-r border-b border-white/20"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
  import TimelineHeader from './TimelineHeader.vue'
  import {
    updateClipSegment,
    getAdjacentClipSegments,
    realignClipSegment,
    splitClipSegment
  } from '../services/database'
  import {
    debounce,
    throttle,
    formatDuration,
    generateClipGradient,
    getSegmentDisplayTime,
    generateTimestamps,
    type ClipSegment
  } from '../utils/timelineUtils'
  import { seekVideoBySeconds, createSeekEvent } from '../utils/videoSeekUtils'
  import { TIMELINE_HEIGHTS, TIMELINE_BOUNDS, TRACK_DIMENSIONS, SELECTORS } from '../utils/timelineConstants'
  import { TIMELINE_CONSTANTS, SEEK_CONFIG } from '../constants/timelineConstants'
  import { useTranscriptData } from '../composables/useTranscriptData'
  import { useTimelineInteraction } from '../composables/useTimelineInteraction'
  import { getXPositionAtTime, calculateTimePercent, canPositionPlayhead } from '../utils/timelinePlayhead'
  import {
    calculateMovementConstraints as calcMovementConstraints,
    calculateResizeConstraints as calcResizeConstraints
  } from '../utils/timelineConstraints'
  import { createCutHoverInfo } from '../utils/timelineCut'

  interface Clip {
    id: string
    title: string
    filename: string
    type: 'continuous' | 'spliced'
    segments: ClipSegment[]
    total_duration: number
    combined_transcript: string
    virality_score: number
    reason: string
    socialMediaPost: string
    run_number?: number
    run_color?: string
  }

  interface Props {
    videoSrc: string | null
    currentTime: number
    duration: number
    timelineHoverTime: number | null
    timelineHoverPosition: number
    clips?: Clip[]
    hoveredClipId?: string | null
    hoveredTimelineClipId?: string | null
    currentlyPlayingClipId?: string | null
    projectId?: string | null
  }

  const props = withDefaults(defineProps<Props>(), {
    clips: () => []
  })

  // Calculate timeline height dynamically based on tracks
  const calculatedHeight = computed(() => {
    const numberOfClips = displayClips.value.length

    // Calculate total content height: header + ruler + main track + clip tracks
    const tracksHeight =
      TIMELINE_HEIGHTS.RULER + TIMELINE_HEIGHTS.MAIN_TRACK + numberOfClips * TIMELINE_HEIGHTS.CLIP_TRACK
    const totalHeight = TIMELINE_HEIGHTS.HEADER + tracksHeight

    // Apply reasonable bounds
    return Math.max(TIMELINE_BOUNDS.MIN_HEIGHT, Math.min(TIMELINE_BOUNDS.MAX_HEIGHT, totalHeight))
  })

  // Determine if scrollbar should be shown based on content vs container height
  const shouldShowScrollbar = computed(() => {
    const numberOfClips = displayClips.value.length
    const bottomPadding =
      props.clips.length > 0 ? TIMELINE_HEIGHTS.BOTTOM_PADDING_WITH_CLIPS : TIMELINE_HEIGHTS.BOTTOM_PADDING_NO_CLIPS

    const contentHeight =
      TIMELINE_HEIGHTS.RULER + TIMELINE_HEIGHTS.MAIN_TRACK + numberOfClips * TIMELINE_HEIGHTS.CLIP_TRACK + bottomPadding
    const availableHeight = calculatedHeight.value - TIMELINE_HEIGHTS.HEADER

    // Only show scrollbar when content actually exceeds available height (small buffer for precision)
    return contentHeight > availableHeight
  })

  interface Emits {
    (e: 'seekTimeline', event: MouseEvent): void
    (e: 'timelineTrackHover', event: MouseEvent): void
    (e: 'timelineMouseLeave'): void
    (e: 'timelineClipHover', clipId: string): void
    (e: 'scrollToClipsPanel', clipId: string): void
    (e: 'zoomChanged', zoomLevel: number): void
    (e: 'segmentUpdated', clipId: string, segmentIndex: number, newStartTime: number, newEndTime: number): void
    (e: 'refreshClipsData'): void
  }

  const emit = defineEmits<Emits>()

  // Refs for scroll containers
  const timelineScrollContainer = ref<HTMLElement | null>(null)
  const timelineClipElements = ref<Map<string, HTMLElement>>(new Map())
  const timelineHeaderRef = ref<{ zoomSlider: HTMLInputElement | null } | null>(null)
  const zoomSlider = computed(() => timelineHeaderRef.value?.zoomSlider || null)

  // Use timeline interaction composable
  const {
    zoomState,
    panState,
    dragSelectionState,
    timelineBounds,
    handleRulerWheel,
    updateSliderProgress,
    movePan,
    endPan,
    startDragSelection,
    moveDragSelection,
    endDragSelection,
    updateTimelineBounds,
    setZoomLevel
  } = useTimelineInteraction(
    timelineScrollContainer,
    computed(() => props.duration),
    {
      onZoomChange: (zoomLevel) => emit('zoomChanged', zoomLevel),
      onDragSelection: () => {
        // Handle drag selection zoom if needed
      }
    }
  )

  // Zoom, pan, and drag selection state is now managed by useTimelineInteraction composable
  const zoomLevel = computed(() => zoomState.value.zoomLevel)
  const minZoom = computed(() => zoomState.value.minZoom)
  const maxZoom = computed(() => zoomState.value.maxZoom)
  const zoomStep = computed(() => zoomState.value.zoomStep)

  const isPanning = computed(() => panState.value.isPanning)
  const isDragging = computed(() => dragSelectionState.value.isDragging)
  const dragStartX = computed(() => dragSelectionState.value.dragStartX)
  const dragEndX = computed(() => dragSelectionState.value.dragEndX)
  const dragStartPercent = computed(() => dragSelectionState.value.dragStartPercent)
  const dragEndPercent = computed(() => dragSelectionState.value.dragEndPercent)

  // Timeline bounds for constraining interactions
  // timelineBounds is now managed by useTimelineInteraction composable

  // Local reactive copy of clips for immediate visual updates
  const localClips = ref(props.clips ? [...props.clips] : [])

  // Sync localClips with props.clips
  watch(
    () => props.clips,
    (newClips) => {
      if (newClips) {
        localClips.value = [...newClips]
      }
    },
    { immediate: true, deep: true }
  )

  // Computed clips that updates during dragging or resizing
  const displayClips = computed(() => {
    // Handle dragging
    if (isDraggingSegment.value && draggedSegmentInfo.value) {
      const updatedClips = [...localClips.value]
      const { clipId, segmentIndex, currentStartTime, currentEndTime } = draggedSegmentInfo.value

      const clipIndex = updatedClips.findIndex((clip) => clip.id === clipId)
      if (clipIndex !== -1 && updatedClips[clipIndex].segments[segmentIndex]) {
        updatedClips[clipIndex] = {
          ...updatedClips[clipIndex],
          segments: [...updatedClips[clipIndex].segments]
        }
        updatedClips[clipIndex].segments[segmentIndex] = {
          ...updatedClips[clipIndex].segments[segmentIndex],
          start_time: currentStartTime,
          end_time: currentEndTime,
          duration: currentEndTime - currentStartTime
        }
      }

      return updatedClips
    }

    // Handle resizing
    if (isResizingSegment.value && resizeHandleInfo.value) {
      const updatedClips = [...localClips.value]
      const { clipId, segmentIndex, currentStartTime, currentEndTime } = resizeHandleInfo.value

      const clipIndex = updatedClips.findIndex((clip) => clip.id === clipId)
      if (clipIndex !== -1 && updatedClips[clipIndex].segments[segmentIndex]) {
        updatedClips[clipIndex] = {
          ...updatedClips[clipIndex],
          segments: [...updatedClips[clipIndex].segments]
        }
        updatedClips[clipIndex].segments[segmentIndex] = {
          ...updatedClips[clipIndex].segments[segmentIndex],
          start_time: currentStartTime,
          end_time: currentEndTime,
          duration: currentEndTime - currentStartTime
        }
      }

      return updatedClips
    }

    return localClips.value
  })

  // Global playhead state
  const globalPlayheadPosition = ref(0) // X position in pixels for the global playhead line
  const isPlayheadInitialized = ref(false) // Track if playhead has been properly initialized

  // Timeline hover line state
  const showTimelineHoverLine = ref(false)
  const timelineHoverLinePosition = ref(0) // X position in pixels relative to timeline container

  // Custom tooltip state
  const showTimelineTooltip = ref(false)
  const tooltipPosition = ref({ x: 0, y: 0 })
  const tooltipTime = ref(0)

  // Segment hover state
  const hoveredSegmentKey = ref<string | null>(null) // Track which specific segment is hovered

  // Segment dragging state
  const isDraggingSegment = ref(false)
  const draggedSegmentInfo = ref<{
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
  } | null>(null)

  // Segment resizing state
  const isResizingSegment = ref(false)
  const resizeHandleInfo = ref<{
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
  } | null>(null)

  // Cut tool state
  const isCutToolActive = ref(false)
  const cutHoverInfo = ref<{
    clipId: string
    segmentIndex: number
    cutTime: number
    cutPosition: number // percentage (0-100)
    cursorPosition: number // percentage (0-100) for custom cursor position
  } | null>(null)

  // Continuous seeking state
  const isSeeking = ref(false)
  const seekDirection = ref<'forward' | 'reverse' | null>(null)
  const seekInterval = ref<NodeJS.Timeout | null>(null)

  // Movement constraints
  const movementConstraints = ref<{
    minStartTime: number
    maxEndTime: number
  }>({
    minStartTime: 0,
    maxEndTime: Infinity
  })

  // Debounced database update function for smoother performance
  const debouncedUpdateClip = debounce(
    async (clipId: string, segmentIndex: number, newStartTime: number, newEndTime: number) => {
      try {
        await updateClipSegment(clipId, segmentIndex, newStartTime, newEndTime)

        // Update local clip data for immediate visual feedback
        const clipIndex = localClips.value.findIndex((clip) => clip.id === clipId)
        if (clipIndex !== -1 && localClips.value[clipIndex].segments[segmentIndex]) {
          // Create a new clips array to trigger reactivity
          const updatedClips = [...localClips.value]
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            segments: [...updatedClips[clipIndex].segments]
          }
          updatedClips[clipIndex].segments[segmentIndex] = {
            ...updatedClips[clipIndex].segments[segmentIndex],
            start_time: newStartTime,
            end_time: newEndTime,
            duration: newEndTime - newStartTime
          }
          localClips.value = updatedClips
        }
      } catch (error) {
        console.error('Error updating clip segment:', error)
      }
    },
    TRACK_DIMENSIONS.DEBOUNCE_DELAY
  ) // Debounce for smoother performance

  // Transcript-related state is now managed by useTranscriptData composable

  // Use transcript data composable
  const {
    transcriptData,
    tooltipTranscriptWords,
    centerWordIndex,
    dragTooltipTranscriptWords,
    dragTooltipCenterWordIndex,
    resizeTooltipTranscriptWords,
    resizeTooltipCenterWordIndex,
    debouncedUpdateTooltipWords,
    updateDragTooltipWords,
    updateResizeTooltipWords,
    clearTooltipData,
    clearDragTooltipData,
    clearResizeTooltipData,
    loadTranscriptData
  } = useTranscriptData(computed(() => props.projectId || null))

  // Check if a segment has adjacent segments using local data (synchronous)
  function getSegmentAdjacencySync(clipId: string, segmentIndex: number): { hasPrevious: boolean; hasNext: boolean } {
    const clip = localClips.value.find((c) => c.id === clipId)
    if (!clip || !clip.segments || clip.segments.length <= 1) {
      return { hasPrevious: false, hasNext: false }
    }

    const currentSegment = clip.segments[segmentIndex]
    if (!currentSegment) {
      return { hasPrevious: false, hasNext: false }
    }

    // Check if previous segment exists and is touching in time
    let hasPrevious = false
    if (segmentIndex > 0) {
      const previousSegment = clip.segments[segmentIndex - 1]
      // Check if segments are touching (allowing for very small gaps due to floating point precision)
      hasPrevious = Math.abs(previousSegment.end_time - currentSegment.start_time) < 0.01
    }

    // Check if next segment exists and is touching in time
    let hasNext = false
    if (segmentIndex < clip.segments.length - 1) {
      const nextSegment = clip.segments[segmentIndex + 1]
      // Check if segments are touching (allowing for very small gaps due to floating point precision)
      hasNext = Math.abs(nextSegment.start_time - currentSegment.end_time) < 0.01
    }

    return { hasPrevious, hasNext }
  }

  // Get adjacency status for a segment
  function getSegmentAdjacency(clipId: string, segmentIndex: number): { hasPrevious: boolean; hasNext: boolean } {
    return getSegmentAdjacencySync(clipId, segmentIndex)
  }

  function setTimelineClipRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      timelineClipElements.value.set(clipId, el)
    } else {
      timelineClipElements.value.delete(clipId)
    }
  }

  // Transcript-related functions are now managed by useTranscriptData composable

  // Throttled function for immediate tooltip updates (position)
  const throttledUpdateTooltipPosition = throttle((timestamp: number) => {
    tooltipTime.value = timestamp
  }, TRACK_DIMENSIONS.TOOLTIP_THROTTLE) // ~60fps

  // Function to scroll timeline clip into view
  function scrollTimelineClipIntoView(clipId: string) {
    const clipElement = timelineClipElements.value.get(clipId)
    const container = timelineScrollContainer.value

    if (clipElement && container) {
      // Get the position of the clip relative to the container
      const clipRect = clipElement.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Check if the clip is partially or fully outside the visible area
      const isAboveVisible = clipRect.top < containerRect.top
      const isBelowVisible = clipRect.bottom > containerRect.bottom

      if (isAboveVisible || isBelowVisible) {
        // Scroll the clip into view with smooth behavior
        clipElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        })
      }
    }
  }

  // Expose functions to parent
  defineExpose({
    scrollTimelineClipIntoView,
    zoomLevel,
    loadTranscriptData
  })

  // Intelligent timestamp generation based on video duration and zoom level
  const generatedTimestamps = computed(() => {
    return generateTimestamps(props.duration, zoomLevel.value)
  })

  // formatDuration is now imported from timelineUtils

  function onSeekTimeline(event: MouseEvent) {
    emit('seekTimeline', event)
  }

  function onVideoTrackClick(event: MouseEvent) {
    // Only seek if we're not in the middle of a drag selection
    if (!isDragging.value) {
      onSeekTimeline(event)
    }
  }

  function onTimelineTrackHover(event: MouseEvent) {
    emit('timelineTrackHover', event)
  }

  function onTimelineMouseLeave() {
    emit('timelineMouseLeave')
  }

  function onClipTrackClick(event: MouseEvent) {
    // Only seek if we're not in the middle of a drag selection
    if (!isDragging.value) {
      onSeekTimeline(event)
    }
  }

  // Timeline clip click event handler
  function onTimelineClipClick(clipId: string) {
    emit('timelineClipHover', clipId)
    emit('scrollToClipsPanel', clipId)
  }

  // Zoom, pan, and drag selection functions are now managed by useTimelineInteraction composable

  // Zoom slider change handler
  function onZoomSliderChange(newZoomLevel: number) {
    // Update the zoom level in the composable
    setZoomLevel(newZoomLevel)

    // Update CSS variable for filled track
    updateSliderProgress(zoomSlider.value)
  }

  // Event handler wrappers that call composable functions
  function onTimelineWheel(event: WheelEvent) {
    // Check if Ctrl/Cmd key is pressed for horizontal scrolling
    const isCtrlPressed = event.ctrlKey || event.metaKey // metaKey is Cmd on Mac

    if (isCtrlPressed) {
      // Prevent default vertical scrolling
      event.preventDefault()

      // Handle horizontal scrolling/panning
      const container = timelineScrollContainer.value
      if (container) {
        // Scroll horizontally based on wheel delta
        const scrollAmount = event.deltaY * TIMELINE_CONSTANTS.HORIZONTAL_SCROLL_MULTIPLIER // Adjust multiplier for desired speed
        container.scrollLeft -= scrollAmount
      }
    } else {
      // Regular zoom functionality
      handleRulerWheel(event)
    }
  }

  // Use the same function for both ruler and timeline wheel events
  function onRulerWheel(event: WheelEvent) {
    onTimelineWheel(event)
  }

  function onDragStart(event: MouseEvent) {
    // Hide tooltip when dragging starts
    showTimelineTooltip.value = false
    clearTooltipData()
    startDragSelection(event)
    // Hide hover line during drag
    showTimelineHoverLine.value = false
  }

  // Timeline hover line handlers
  function onTimelineMouseMove(event: MouseEvent) {
    if (isPanning.value || isDragging.value) return

    const container = timelineScrollContainer.value
    if (!container) return

    const rect = container.getBoundingClientRect()
    const relativeX = event.clientX - rect.left

    // Update timeline bounds for constraining both hover line and global playhead
    timelineBounds.value = {
      top: rect.top,
      bottom: rect.bottom
    }

    // Only show hover line if we're in the timeline content area (after track labels)
    if (relativeX >= TRACK_DIMENSIONS.LABEL_WIDTH) {
      showTimelineHoverLine.value = true
      // Position the line exactly where the cursor is (absolute viewport position)
      timelineHoverLinePosition.value = event.clientX

      // Calculate time for tooltip using more accurate positioning
      const timelineContent = container.querySelector('.timeline-content-wrapper')
      if (timelineContent) {
        const contentRect = timelineContent.getBoundingClientRect()

        // Account for track label width - only the area after track labels represents the timeline
        const contentRelativeX = Math.max(0, event.clientX - contentRect.left - TRACK_DIMENSIONS.LABEL_WIDTH)
        const contentWidth = Math.max(1, contentRect.width - TRACK_DIMENSIONS.LABEL_WIDTH)
        const timePercent = Math.max(0, Math.min(1, contentRelativeX / contentWidth))
        const hoverTime = timePercent * props.duration

        // Update custom tooltip
        showTimelineTooltip.value = true
        tooltipPosition.value = {
          x: event.clientX,
          y: event.clientY - TIMELINE_CONSTANTS.TOOLTIP_OFFSET_Y // Position further above cursor to avoid text
        }

        // Update timestamp immediately (throttled)
        throttledUpdateTooltipPosition(hoverTime)

        // Update transcript words for enhanced tooltip
        if (transcriptData.value && transcriptData.value.words.length > 0) {
          debouncedUpdateTooltipWords(hoverTime)
        } else {
          tooltipTranscriptWords.value = []
          centerWordIndex.value = 0
        }
      }
    } else {
      showTimelineHoverLine.value = false
      showTimelineTooltip.value = false
      clearTooltipData()
    }
  }

  function onTimelineMouseLeaveGlobal() {
    showTimelineHoverLine.value = false
    showTimelineTooltip.value = false
    clearTooltipData()
    // Cancel drag if mouse leaves timeline
    if (isDragging.value) {
      endDragSelection()
    }
  }

  // Update global playhead position based on current time
  function updateGlobalPlayheadPosition() {
    if (!canPositionPlayhead(props.videoSrc, props.duration, props.currentTime)) {
      return
    }

    const container = timelineScrollContainer.value
    if (!container) return

    // Find the video track content element to get its current playhead position as reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement
    if (!videoTrack) {
      // Video track doesn't exist yet, retry during initialization
      if (!isPlayheadInitialized.value) {
        requestAnimationFrame(() => {
          updateGlobalPlayheadPosition()
        })
      }
      return
    }

    // Calculate the time percentage
    const timePercent = calculateTimePercent(props.currentTime, props.duration)

    // Get the absolute position using the extracted utility
    const targetX = getXPositionAtTime(videoTrack, timePercent)
    globalPlayheadPosition.value = targetX
    isPlayheadInitialized.value = true
  }

  // Watch for changes that affect global playhead position and slider
  watch(
    [() => props.currentTime, () => props.duration, () => props.videoSrc, zoomLevel],
    () => {
      updateGlobalPlayheadPosition()
      updateSliderProgress(zoomSlider.value)
    },
    { immediate: true }
  )

  // Update tooltip position when zoom changes during drag
  watch(zoomLevel, () => {
    if (isDraggingSegment.value) {
      updateSegmentDragTooltip()
    }
  })

  // projectId watching is now handled by useTranscriptData composable

  // Handle scroll events to update global playhead position
  function handleScroll() {
    // Use immediate update for scroll events as they need to feel responsive
    updateGlobalPlayheadPosition()
  }

  // Global mouse event handlers for better panning and drag selection experience
  function handleGlobalMouseMove(event: MouseEvent) {
    if (isPanning.value) {
      movePan(event)
    } else if (isDragging.value) {
      moveDragSelection(event)
    } else if (isDraggingSegment.value) {
      onSegmentMouseMove(event)
    } else if (isResizingSegment.value) {
      onResizeMouseMove(event)
    } else {
      // Check if we're still over the timeline area
      const container = timelineScrollContainer.value
      if (container) {
        const rect = container.getBoundingClientRect()
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          onTimelineMouseMove(event)
        } else {
          showTimelineHoverLine.value = false
          showTimelineTooltip.value = false
          clearTooltipData()
        }
      }
    }
  }

  function handleGlobalMouseUp() {
    if (isDragging.value) {
      endDragSelection()
    } else if (isDraggingSegment.value) {
      onSegmentMouseUp()
    } else if (isResizingSegment.value) {
      onResizeMouseUp()
    } else {
      endPan()
    }
  }

  // Handle keyboard events
  function handleKeyDown(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Activate cut tool when 'x' key is pressed
    if (event.key === 'x' || event.key === 'X') {
      event.preventDefault()
      if (!isCutToolActive.value) {
        toggleCutTool()
      }
    }

    // Deactivate cut tool when Escape key is pressed
    if (event.key === 'Escape' && isCutToolActive.value) {
      event.preventDefault()
      toggleCutTool()
    }

    // Video navigation with arrow keys (continuous seeking)
    if (!isCutToolActive.value && props.videoSrc && props.duration) {
      if (event.key === 'ArrowLeft' && !isSeeking.value) {
        event.preventDefault()
        startContinuousSeeking('reverse')
      } else if (event.key === 'ArrowRight' && !isSeeking.value) {
        event.preventDefault()
        startContinuousSeeking('forward')
      }
    }
  }

  // Handle keyboard key up events
  function handleKeyUp(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Stop continuous seeking when arrow keys are released
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && isSeeking.value) {
      event.preventDefault()
      stopContinuousSeeking()
    }
  }

  // Setup and cleanup global event listeners
  onMounted(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    // Initialize timeline bounds for hover line
    const container = timelineScrollContainer.value
    if (container) {
      const rect = container.getBoundingClientRect()
      timelineBounds.value = {
        top: rect.top,
        bottom: rect.bottom
      }

      // Add scroll listener to update global playhead position
      container.addEventListener('scroll', handleScroll)

      // Add resize observer to update positions when container resizes
      const resizeObserver = new ResizeObserver(() => {
        // Update timeline bounds
        updateTimelineBounds()

        // Update global playhead position
        updateGlobalPlayheadPosition()
      })

      resizeObserver.observe(container)
      ;(container as any)._resizeObserver = resizeObserver

      // Initialize playhead position after DOM is fully rendered
      nextTick(() => {
        // Set initial bounds
        updateTimelineBounds()

        // Try positioning with increasing delays
        const tryPositioning = (delay: number) => {
          setTimeout(() => {
            const wasInitialized = isPlayheadInitialized.value
            updateGlobalPlayheadPosition()

            // If still not initialized after this attempt, try again with longer delay
            if (!isPlayheadInitialized.value && !wasInitialized && delay < 1000) {
              tryPositioning(delay * 2)
            }
          }, delay)
        }

        // Start with 200ms delay but also check if container height is stable
        const checkHeightAndPosition = (delay: number) => {
          setTimeout(() => {
            const currentRect = container.getBoundingClientRect()
            const expectedMinHeight = TIMELINE_CONSTANTS.EXPECTED_MIN_HEIGHT // Timeline should be at least this tall when fully rendered

            if (currentRect.height < expectedMinHeight && delay < 1000) {
              // Container is still expanding, wait longer
              checkHeightAndPosition(delay * 2)
              return
            }

            // Update bounds with the correct container rect
            updateTimelineBounds()

            tryPositioning(delay)
          }, delay)
        }

        // Start with 200ms delay
        checkHeightAndPosition(200)
      })
    }
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleGlobalMouseMove)
    document.removeEventListener('mouseup', handleGlobalMouseUp)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)

    // Clean up continuous seeking
    stopContinuousSeeking()

    // Clean up event listeners and observers
    const container = timelineScrollContainer.value
    if (container) {
      container.removeEventListener('scroll', handleScroll)

      const resizeObserver = (container as any)._resizeObserver
      if (resizeObserver) {
        resizeObserver.disconnect()
        delete (container as any)._resizeObserver
      }
    }

    // Reset cursor in case component is unmounted while panning
    document.body.style.cursor = ''

    // Transcript cleanup is now handled by useTranscriptData composable
  })

  // hexToDarkerHex, generateClipGradient, and getSegmentDisplayTime are now imported from timelineUtils

  // Calculate movement constraints for a segment
  async function calculateMovementConstraints(clipId: string, segmentIndex: number): Promise<void> {
    try {
      const adjacent = await getAdjacentClipSegments(clipId, segmentIndex)

      // Get original duration from the dragged segment info
      const originalDuration =
        (draggedSegmentInfo.value?.originalEndTime || 0) - (draggedSegmentInfo.value?.originalStartTime || 0) || 0

      // Use the extracted utility function
      const constraints = calcMovementConstraints(
        originalDuration,
        adjacent.previous,
        adjacent.next,
        props.duration || Infinity
      )

      movementConstraints.value = constraints

      // Constraints calculated successfully
    } catch (error) {
      console.error('Error calculating movement constraints:', error)
      movementConstraints.value = {
        minStartTime: 0,
        maxEndTime: props.duration || Infinity
      }
    }
  }

  // Calculate resize constraints for a segment
  async function calculateResizeConstraints(
    clipId: string,
    segmentIndex: number,
    handleType: 'left' | 'right'
  ): Promise<{
    minStartTime: number
    maxEndTime: number
  }> {
    try {
      const adjacent = await getAdjacentClipSegments(clipId, segmentIndex)

      // Get the current segment
      const currentSegment = localClips.value.find((clip) => clip.id === clipId)?.segments[segmentIndex]

      if (!currentSegment) {
        throw new Error('Current segment not found')
      }

      // Use the extracted utility function
      const constraints = calcResizeConstraints(
        handleType,
        currentSegment,
        adjacent.previous,
        adjacent.next,
        props.duration || Infinity
      )

      return constraints
    } catch (error) {
      console.error('Error calculating resize constraints:', error)
      return {
        minStartTime: 0,
        maxEndTime: props.duration || Infinity
      }
    }
  }

  // Handle mouse down on segment
  async function onSegmentMouseDown(event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) {
    // Only start drag with left mouse button
    if (event.button !== 0) return

    // Prevent text selection during drag
    event.preventDefault()
    event.stopPropagation()

    // Initialize drag state
    isDraggingSegment.value = true
    draggedSegmentInfo.value = {
      clipId,
      segmentIndex,
      originalStartTime: segment.start_time,
      originalEndTime: segment.end_time,
      originalMouseX: event.clientX,
      dragStartTime: Date.now(),
      currentStartTime: segment.start_time,
      currentEndTime: segment.end_time
    }

    // Calculate movement constraints
    await calculateMovementConstraints(clipId, segmentIndex)

    // Change cursor globally
    document.body.style.cursor = 'grabbing'

    // Hide tooltip during drag
    showTimelineTooltip.value = false
    clearTooltipData()

    // Initialize tooltip position
    updateSegmentDragTooltip()
  }

  // Update segment drag tooltip position to follow the segment
  function updateSegmentDragTooltip() {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value || !timelineScrollContainer.value) return

    const { currentStartTime } = draggedSegmentInfo.value
    const container = timelineScrollContainer.value

    // Find the video track content element to use as positioning reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement
    if (!videoTrack) return

    // Calculate the time percentage for the segment start time
    const timePercent = props.duration ? currentStartTime / props.duration : 0

    // Get the absolute position using the extracted utility
    const targetX = getXPositionAtTime(videoTrack, timePercent)

    // Update tooltip position
    draggedSegmentInfo.value.tooltipX = targetX
    draggedSegmentInfo.value.tooltipY = container.getBoundingClientRect().top - TIMELINE_CONSTANTS.DRAG_TOOLTIP_OFFSET_Y

    // Update transcript words for drag tooltip
    updateDragTooltipWords(currentStartTime)
  }

  // Handle mouse move for segment dragging
  function onSegmentMouseMove(event: MouseEvent) {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value || !props.duration) return

    const { clipId, segmentIndex } = draggedSegmentInfo.value
    const deltaX = event.clientX - draggedSegmentInfo.value.originalMouseX
    const timelineWidth = timelineScrollContainer.value?.clientWidth || 1
    const timeDelta = ((deltaX / timelineWidth) * props.duration) / zoomLevel.value

    let newStartTime = draggedSegmentInfo.value.originalStartTime + timeDelta
    let newEndTime = draggedSegmentInfo.value.originalEndTime + timeDelta

    // Preserve original duration
    const originalDuration = draggedSegmentInfo.value.originalEndTime - draggedSegmentInfo.value.originalStartTime

    // Apply constraints that prevent shrinking
    if (newStartTime < movementConstraints.value.minStartTime) {
      // Moving left would violate constraint, stop at boundary
      newStartTime = movementConstraints.value.minStartTime
      newEndTime = newStartTime + originalDuration
    } else if (newEndTime > movementConstraints.value.maxEndTime) {
      // Moving right would violate constraint, stop at boundary
      newEndTime = movementConstraints.value.maxEndTime
      newStartTime = newEndTime - originalDuration
    }

    // Also ensure we stay within video bounds while preserving duration
    if (newStartTime < 0) {
      newStartTime = 0
      newEndTime = Math.min(originalDuration, props.duration)
    } else if (newEndTime > props.duration) {
      newEndTime = props.duration
      newStartTime = Math.max(props.duration - originalDuration, 0)
    }

    // Final check: if we still can't maintain original duration, don't move at all
    if (newEndTime - newStartTime < originalDuration * 0.99) {
      // Allow tiny floating point errors
      // Revert to original position - constraint hit, can't move further in this direction
      newStartTime = draggedSegmentInfo.value.originalStartTime
      newEndTime = draggedSegmentInfo.value.originalEndTime
    }

    // Update drag state
    draggedSegmentInfo.value.currentStartTime = newStartTime
    draggedSegmentInfo.value.currentEndTime = newEndTime

    // Update tooltip position to follow the segment
    updateSegmentDragTooltip()

    // Use debounced update for smoother performance during drag
    debouncedUpdateClip(clipId, segmentIndex, newStartTime, newEndTime)
  }

  // Handle mouse up to finish segment dragging
  async function onSegmentMouseUp() {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value) return

    const { clipId, segmentIndex, currentStartTime, currentEndTime, originalStartTime, originalEndTime } =
      draggedSegmentInfo.value

    // Store the original values before we modify them
    const originalOriginalStartTime = originalStartTime
    const originalOriginalEndTime = originalEndTime

    // Update the drag info to commit the final position first
    if (draggedSegmentInfo.value) {
      draggedSegmentInfo.value.originalStartTime = currentStartTime
      draggedSegmentInfo.value.originalEndTime = currentEndTime
    }

    // Cancel any pending debounced updates to prevent ghost flashing
    debouncedUpdateClip.cancel()

    // Now reset drag state (the final position is now the "original" position)
    isDraggingSegment.value = false
    draggedSegmentInfo.value = null
    document.body.style.cursor = ''

    // Clear drag transcript data
    clearDragTooltipData()

    // Final database update and transcript realignment (only if significant change)
    if (
      Math.abs(currentStartTime - originalOriginalStartTime) > 0.1 ||
      Math.abs(currentEndTime - originalOriginalEndTime) > 0.1
    ) {
      try {
        // Final immediate database update to ensure latest state is saved
        await updateClipSegment(clipId, segmentIndex, currentStartTime, currentEndTime)

        // Realign transcript if needed
        await realignClipSegment(
          clipId,
          segmentIndex,
          originalOriginalStartTime,
          originalOriginalEndTime,
          currentStartTime,
          currentEndTime
        )

        // Emit update to parent
        emit('segmentUpdated', clipId, segmentIndex, currentStartTime, currentEndTime)
      } catch (error) {
        console.error('[Timeline] Error in final segment update:', error)
      }
    }
  }

  // Handle mouse down on resize handle
  async function onResizeMouseDown(
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment,
    handleType: 'left' | 'right'
  ) {
    // Only start resize with left mouse button
    if (event.button !== 0) return

    // Prevent text selection and stop event propagation
    event.preventDefault()
    event.stopPropagation()

    // Calculate resize constraints
    const constraints = await calculateResizeConstraints(clipId, segmentIndex, handleType)

    // Initialize resize state
    isResizingSegment.value = true
    resizeHandleInfo.value = {
      clipId,
      segmentIndex,
      handleType,
      originalStartTime: segment.start_time,
      originalEndTime: segment.end_time,
      originalMouseX: event.clientX,
      resizeStartTime: Date.now(),
      currentStartTime: segment.start_time,
      currentEndTime: segment.end_time,
      minStartTime: constraints.minStartTime,
      maxEndTime: constraints.maxEndTime
    }

    // Change cursor globally
    document.body.style.cursor = 'ew-resize'

    // Hide tooltip during resize
    showTimelineTooltip.value = false
    clearTooltipData()

    // Initialize tooltip position
    updateResizeTooltip()
  }

  // Update resize tooltip position to follow the handle
  function updateResizeTooltip() {
    if (!isResizingSegment.value || !resizeHandleInfo.value || !timelineScrollContainer.value) return

    const { currentStartTime, currentEndTime, handleType } = resizeHandleInfo.value
    const container = timelineScrollContainer.value

    // Find the video track content element to use as positioning reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement
    if (!videoTrack) return

    // Calculate the position of the handle being dragged
    const handleTime = handleType === 'left' ? currentStartTime : currentEndTime
    const timePercent = props.duration ? handleTime / props.duration : 0

    // Get the absolute position using the extracted utility
    const targetX = getXPositionAtTime(videoTrack, timePercent)

    // Update tooltip position
    resizeHandleInfo.value.tooltipX = targetX
    resizeHandleInfo.value.tooltipY = container.getBoundingClientRect().top - TIMELINE_CONSTANTS.DRAG_TOOLTIP_OFFSET_Y

    // Update transcript words for resize tooltip
    updateResizeTooltipWords(handleTime)
  }

  // Handle mouse move for segment resizing
  function onResizeMouseMove(event: MouseEvent) {
    if (!isResizingSegment.value || !resizeHandleInfo.value || !props.duration) return

    const { clipId, segmentIndex, handleType, originalStartTime, originalEndTime } = resizeHandleInfo.value
    const deltaX = event.clientX - resizeHandleInfo.value.originalMouseX
    const timelineWidth = timelineScrollContainer.value?.clientWidth || 1
    const timeDelta = ((deltaX / timelineWidth) * props.duration) / zoomLevel.value

    let newStartTime = originalStartTime
    let newEndTime = originalEndTime

    if (handleType === 'left') {
      // Resize left handle: change start_time, keep end_time fixed
      newStartTime = originalStartTime + timeDelta

      // Apply constraints
      newStartTime = Math.max(resizeHandleInfo.value.minStartTime, newStartTime)
      newStartTime = Math.min(resizeHandleInfo.value.maxEndTime, newStartTime)

      // Ensure minimum duration
      if (newEndTime - newStartTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
        newStartTime = newEndTime - TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION
      }
    } else {
      // Resize right handle: change end_time, keep start_time fixed
      newEndTime = originalEndTime + timeDelta

      // Apply constraints
      newEndTime = Math.max(resizeHandleInfo.value.minStartTime, newEndTime)
      newEndTime = Math.min(resizeHandleInfo.value.maxEndTime, newEndTime)

      // Ensure minimum duration
      if (newEndTime - newStartTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
        newEndTime = newStartTime + TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION
      }
    }

    // Update resize state
    resizeHandleInfo.value.currentStartTime = newStartTime
    resizeHandleInfo.value.currentEndTime = newEndTime

    // Update tooltip position to follow the handle
    updateResizeTooltip()

    // Use debounced update for smoother performance during resize
    debouncedUpdateClip(clipId, segmentIndex, newStartTime, newEndTime)
  }

  // Handle mouse up to finish segment resizing
  async function onResizeMouseUp() {
    if (!isResizingSegment.value || !resizeHandleInfo.value) return

    const { clipId, segmentIndex, currentStartTime, currentEndTime, originalStartTime, originalEndTime } =
      resizeHandleInfo.value

    // Cancel any pending debounced updates to prevent ghost flashing
    debouncedUpdateClip.cancel()

    // Reset resize state
    isResizingSegment.value = false
    resizeHandleInfo.value = null
    document.body.style.cursor = ''

    // Clear resize transcript data
    clearResizeTooltipData()

    // Final database update and transcript realignment (only if significant change)
    if (Math.abs(currentStartTime - originalStartTime) > 0.1 || Math.abs(currentEndTime - originalEndTime) > 0.1) {
      try {
        // Final immediate database update to ensure latest state is saved
        await updateClipSegment(clipId, segmentIndex, currentStartTime, currentEndTime)

        // Realign transcript if needed
        await realignClipSegment(
          clipId,
          segmentIndex,
          originalStartTime,
          originalEndTime,
          currentStartTime,
          currentEndTime
        )

        // Emit update to parent
        emit('segmentUpdated', clipId, segmentIndex, currentStartTime, currentEndTime)
      } catch (error) {
        console.error('[Timeline] Error in final segment resize update:', error)
      }
    }
  }

  // Video seek functions

  // Seek video by specified number of seconds
  function seekVideo(seconds: number) {
    if (!props.videoSrc || !props.duration) return

    const newTime = seekVideoBySeconds(props.currentTime, props.duration, seconds)

    // Calculate the position as a percentage of the timeline
    const container = timelineScrollContainer.value
    if (container) {
      const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement
      if (videoTrack) {
        const syntheticEvent = createSeekEvent(newTime, props.duration, videoTrack)
        if (syntheticEvent) {
          // Trigger the seek
          onVideoTrackClick(syntheticEvent)
        }
      }
    }
  }

  // Start continuous seeking
  function startContinuousSeeking(direction: 'forward' | 'reverse') {
    if (!props.videoSrc || !props.duration) return

    isSeeking.value = true
    seekDirection.value = direction

    // Start continuous seeking at high speed immediately (no initial jump)
    seekInterval.value = setInterval(() => {
      const seekAmount =
        seekDirection.value === 'forward' ? SEEK_CONFIG.SECONDS_PER_INTERVAL : -SEEK_CONFIG.SECONDS_PER_INTERVAL
      seekVideo(seekAmount)
    }, SEEK_CONFIG.INTERVAL_MS)
  }

  // Stop continuous seeking
  function stopContinuousSeeking() {
    if (seekInterval.value) {
      clearInterval(seekInterval.value)
      seekInterval.value = null
    }

    isSeeking.value = false
    seekDirection.value = null
  }

  // Cut tool functions

  // Toggle cut tool on/off
  function toggleCutTool() {
    isCutToolActive.value = !isCutToolActive.value

    // Reset cut hover state when deactivating
    if (!isCutToolActive.value) {
      cutHoverInfo.value = null
      hoveredSegmentKey.value = null
    }

    // Disable other interactions when cut tool is active
    if (isCutToolActive.value) {
      // Clear any existing drag/resize states
      isDraggingSegment.value = false
      isResizingSegment.value = false
      draggedSegmentInfo.value = null
      resizeHandleInfo.value = null
    }
  }

  // Handle segment hover for cut preview
  function onSegmentHoverForCut(event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) {
    if (!isCutToolActive.value || !props.duration) return

    // Find the actual segment element, not a child element
    let segmentElement = event.target as HTMLElement

    // If the target is a child element, traverse up to find the segment container
    while (segmentElement && !segmentElement.classList.contains('clip-segment')) {
      segmentElement = segmentElement.parentElement as HTMLElement
    }

    if (!segmentElement) return

    // Use the extracted utility function
    const cutInfo = createCutHoverInfo(event, segmentElement, segment, props.duration, clipId, segmentIndex)

    cutHoverInfo.value = cutInfo
  }

  // Handle segment click for cut operation
  async function onSegmentClickForCut(event: MouseEvent, clipId: string, segmentIndex: number, _segment: ClipSegment) {
    if (!isCutToolActive.value || !cutHoverInfo.value) return

    event.preventDefault()
    event.stopPropagation()

    try {
      // Perform the cut operation
      const result = await splitClipSegment(clipId, segmentIndex, cutHoverInfo.value.cutTime)

      // Refresh the clips data to show the split segments
      emit('refreshClipsData')

      // Reset cut tool state
      isCutToolActive.value = false
      cutHoverInfo.value = null

      console.log(
        `[Timeline] Successfully split segment ${segmentIndex} into segments ${result.leftSegmentIndex} and ${result.rightSegmentIndex}`
      )
    } catch (error) {
      console.error('[Timeline] Failed to split segment:', error)
      // Show error feedback to user (could add a toast/notification here)
      alert(`Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
</script>

<style scoped>
  /* Timeline controls */
  .timeline-controls {
    background: rgba(10, 10, 10, 0.5);
    backdrop-filter: blur(4px);
    border-radius: 0.5rem;
    padding: 0.75rem;
  }

  .timeline-seek-bar {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .timeline-seek-bar:hover .seek-thumb {
    opacity: 1;
  }

  .seek-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transition: all 0.2s ease;
    transform: translate(-50%, -50%);
    border: 2px solid rgb(147, 51, 234);
  }

  /* Timeline track */
  .timeline-track {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .timeline-track:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  /* Video track styling */
  .video-track {
    background: linear-gradient(to right, rgba(147, 51, 234, 0.3), rgba(99, 102, 241, 0.3));
    border-radius: 0.375rem;
    position: relative;
    overflow: hidden;
  }

  .video-track-progress {
    background: linear-gradient(to right, rgba(147, 51, 234, 0.6), rgba(99, 102, 241, 0.6));
    transition: width 0.1s ease;
  }

  /* Hover time preview */
  .hover-preview {
    position: absolute;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    z-index: 20;
    pointer-events: none;
  }

  .hover-preview::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) translateY(50%) rotate(45deg);
    width: 6px;
    height: 6px;
    background: rgba(0, 0, 0, 0.9);
  }

  /* Smooth transitions */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }

  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Custom scrollbar for timeline */
  .overflow-y-auto::-webkit-scrollbar {
    width: 8px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }

  /* Custom scrollbar classes */
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
  }

  .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
    background: rgb(75 85 99 / 0.7);
  }

  .scrollbar-track-gray-800::-webkit-scrollbar-track {
    background: rgb(31 41 55 / 0.5);
  }

  /* Clip segment animations */
  .clip-segment {
    transition:
      transform 0.2s ease-out,
      box-shadow 0.2s ease-out,
      border-color 0.15s ease;
    will-change: transform, box-shadow;
  }

  /* No transitions during drag for smoother performance */
  .clip-segment.dragging {
    transition: none !important;
  }

  /* No transitions during resize for smoother performance */
  .clip-segment.resizing {
    transition: none !important;
  }

  /* Individual hover effect removed - clips only highlight through bidirectional system */

  /* Enhanced hover state for clip segments with handles */
  .clip-segment:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  /* Ensure resize handles are visible on segment hover */
  .clip-segment:hover .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

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
    z-index: 10;
  }

  /* Timeline content wrapper for zoom */
  .timeline-content-wrapper {
    min-width: 100%;
  }

  /* Timeline hover line */
  .timeline-hover-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.4);
    z-index: 30;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  .timeline-hover-line::before,
  .timeline-hover-line::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    left: -3.5px;
  }

  .timeline-hover-line::before {
    top: 0;
  }

  .timeline-hover-line::after {
    bottom: 0;
  }

  /* Drag selection styles */
  .drag-selection {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
    pointer-events: none;
    transition: none;
  }

  .drag-selection::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(59, 130, 246, 0.1) 0%,
      rgba(59, 130, 246, 0.2) 50%,
      rgba(59, 130, 246, 0.1) 100%
    );
    animation: shimmer 2s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  /* Timeline cursor changes */
  .timeline-content-wrapper {
    user-select: none;
  }

  .timeline-content-wrapper.dragging {
    cursor: crosshair;
  }

  /* Prevent text selection during drag */
  .timeline-content-wrapper.dragging,
  .timeline-content-wrapper.dragging * {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  /* Global playhead line styling */
  .global-playhead-line {
    position: fixed;
    background: white;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
    z-index: 25;
    pointer-events: none;
    transition: left 0.1s ease;
  }

  .global-playhead-line::before {
    content: '';
    position: absolute;
    top: -4px;
    left: -6px;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .global-playhead-line::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: -4px;
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
  }

  /* Segment dragging styles */
  .clip-segment.dragging {
    z-index: 30 !important;
    transform: scale(1.02);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5);
    border-color: rgb(59, 130, 246) !important;
    border-width: 2px !important;
  }

  /* Segment resizing styles */
  .clip-segment.resizing {
    z-index: 30 !important;
    transform: scale(1.01);
    box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
    border-color: rgb(34, 197, 94) !important;
    border-width: 2px !important;
  }

  .clip-segment.dragging::before {
    content: '';
    position: absolute;
    inset: -2px;
    background: linear-gradient(45deg, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 0.3));
    border-radius: 6px;
    z-index: -1;
    animation: pulse-drag 2s ease-in-out infinite;
  }

  @keyframes pulse-drag {
    0%,
    100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.02);
    }
  }

  /* Collision warning styles */
  .clip-segment.collision-previous {
    border-left: 3px solid #ef4444 !important;
    box-shadow: -4px 0 12px rgba(239, 68, 68, 0.4);
  }

  .clip-segment.collision-next {
    border-right: 3px solid #ef4444 !important;
    box-shadow: 4px 0 12px rgba(239, 68, 68, 0.4);
  }

  /* Enhanced cursor states */
  .clip-segment:not(.dragging):hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  /* Active resize handle styling */
  .clip-segment.resizing .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
    background: rgba(255, 255, 255, 0.8) !important;
  }

  .clip-segment.dragging {
    cursor: grabbing !important;
    transform: scale(1.02);
  }

  /* Smooth transitions for non-dragging states */
  .clip-segment:not(.dragging) {
    transition:
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.15s ease;
  }

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

  /* Prevent text selection during drag */
  .timeline-content-wrapper.dragging-segment {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  /* Snap indicator */
  .snap-indicator {
    position: absolute;
    width: 2px;
    height: 100%;
    background: #3b82f6;
    z-index: 25;
    pointer-events: none;
    animation: snap-pulse 1s ease-in-out infinite;
  }

  @keyframes snap-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  /* Cut tool styles */
  .clip-segment.cursor-crosshair {
    background: linear-gradient(to right, rgba(251, 146, 60, 0.3), rgba(251, 146, 60, 0.4)) !important;
    border-color: rgb(251, 146, 60) !important;
    transform: translateY(-1px);
  }

  .clip-segment.cursor-crosshair:hover {
    background: linear-gradient(to right, rgba(251, 146, 60, 0.4), rgba(251, 146, 60, 0.5)) !important;
    transform: translateY(-2px);
  }

  /* Enhanced cut preview animations */
  @keyframes cut-line-pulse {
    0%,
    100% {
      opacity: 0.9;
      box-shadow: 0 0 10px rgba(251, 146, 60, 0.8);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 20px rgba(251, 146, 60, 1);
    }
  }

  @keyframes cut-indicator-float {
    0%,
    100% {
      transform: translateY(-50%) translateX(-50%) scale(1);
    }
    50% {
      transform: translateY(-50%) translateX(-50%) scale(1.1);
    }
  }

  /* Cut tool active button styling */
  button.text-blue-600 {
    animation: cut-pulse 2s ease-in-out infinite;
  }

  button.text-blue-600:hover {
    animation-play-state: paused;
  }

  /* Cut line styling enhancement */
  .bg-orange-400 {
    animation: cut-line-pulse 2s ease-in-out infinite;
  }

  /* Force consistent rendering for cut indicators */
  .cut-indicator {
    transform: translateZ(0); /* Force hardware acceleration */
    backface-visibility: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Hide crosshair cursor during cut mode but maintain rendering consistency */
  .clip-segment.cursor-crosshair {
    cursor:
      url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/></svg>'),
      none !important;
  }
</style>
