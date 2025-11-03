<template>
  <div class="bg-[#0a0a0a]/30 border-t border-border transition-all duration-300 ease-in-out"
       :style="{
         height: calculatedHeight + 'px'
       }">
    <div class="pt-3 px-4 h-full flex flex-col" :style="{
      paddingBottom: props.clips.length > 0 ? '64px' : '8px',
      height: props.clips.length > 0 ? 'auto' : '146px'
    }">
      <!-- Timeline Header -->
      <div class="flex items-center justify-between mb-3 pr-1 flex-shrink-0">
        <div class="flex items-center gap-3">
          <h3 class="text-sm font-medium text-foreground">Timeline</h3>
          <!-- Zoom Slider -->
          <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2 py-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            <input
              ref="zoomSlider"
              type="range"
              :min="minZoom"
              :max="maxZoom"
              :step="zoomStep"
              v-model="zoomLevel"
              class="w-20 h-1 bg-muted-foreground/30 rounded-lg appearance-none cursor-pointer slider-zoom"
              @input="onZoomSliderChange"
            />
            <span class="text-xs text-muted-foreground/70 min-w-[2rem] text-right">{{ Math.round(zoomLevel * 100) }}%</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="displayClips.length > 0" class="text-xs text-muted-foreground">{{ displayClips.length }} clips</span>
        </div>
      </div>

      <!-- Timeline Tracks Container -->
      <div :class="[
           'flex-1 pr-1 bg-muted/20 border border-border/40 rounded-lg relative overflow-x-auto',
           shouldShowScrollbar ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800' : 'overflow-y-hidden'
         ]"
           ref="timelineScrollContainer"
           :style="{ maxHeight: calculatedHeight - 56 + 'px' }"
           @mousemove="onTimelineMouseMove"
           @mouseleave="onTimelineMouseLeaveGlobal"
           @mousedown="onDragStart"
           @contextmenu.prevent>
        <!-- Timeline Content Wrapper - handles zoom width -->
        <div class="timeline-content-wrapper"
             :class="{ 'dragging': isDragging }"
             :style="{ width: `${100 * zoomLevel}%` }">
          <!-- Shared Timestamp Ruler -->
          <div class="h-8 border-b border-border/30 flex items-center bg-[#0a0a0a]/40 px-2 sticky top-0 z-10 backdrop-blur-sm timeline-ruler sticky-ruler cursor-ew-resize"
               @wheel="onRulerWheel"
               @mousedown="onPanStart"
               @mousemove="onRulerMouseMove"
               @mouseup="onPanEnd"
               @mouseleave="onRulerMouseLeave"
               title="Scroll to zoom, click and drag to pan timeline">
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
                <div
                  class="w-px bg-foreground/20 timeline-tick"
                  :class="timestamp.isMajor ? 'h-4' : 'h-2'"
                ></div>
                <!-- Time label -->
                <span
                  v-if="timestamp.isMajor"
                  class="text-xs text-foreground/40 whitespace-nowrap font-normal mt-1 timeline-label pb-2"
                >{{ timestamp.label }}</span>
              </div>
            </div>
        </div>
        <!-- Main Video Track -->
        <div class="flex items-center h-14 px-2 border-b border-border/20">
          <!-- Track Label -->
          <div class="w-16 h-10 pr-2 flex items-center justify-center text-xs text-center text-muted-foreground/60">
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
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
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
                    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-black/90"></div>
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
          class="flex items-center min-h-12 px-2 border-b border-border/20 cursor-pointer"
          @click="onTimelineClipClick(clip.id)"
        >
          <!-- Track Label -->
          <div class="w-16 h-8 pr-2 flex items-center justify-center">
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
                :ref="el => setTimelineClipRef(el, clip.id)"
                class="clip-segment absolute h-6 border rounded-md flex items-center justify-center pointer-events-auto group"
                :class="[
                  isDraggingSegment && draggedSegmentInfo?.clipId === clip.id && draggedSegmentInfo?.segmentIndex === segIndex
                    ? 'cursor-grabbing z-30 shadow-2xl border-2 border-blue-400 dragging'
                    : 'cursor-grab hover:cursor-grab transition-all duration-200 ease-out',
                  clip.run_number ? `run-${clip.run_number}` : '',
                  props.currentlyPlayingClipId === clip.id ? 'shadow-lg z-20' :
                  (hoveredClipId === clip.id || props.hoveredTimelineClipId === clip.id && !props.currentlyPlayingClipId) ? 'shadow-lg z-20' : ''
                ]"
                :style="{
                  left: `${duration ? (getSegmentDisplayTime(segment, 'start') / duration) * 100 : 0}%`,
                  width: `${duration ? ((getSegmentDisplayTime(segment, 'end') - getSegmentDisplayTime(segment, 'start')) / duration) * 100 : 0}%`,
                  ...generateClipGradient(clip.run_color),
                  ...(props.currentlyPlayingClipId === clip.id ? {
                    borderColor: '#10b981',
                    borderWidth: '2px',
                    borderStyle: 'solid'
                  } : (hoveredClipId === clip.id || props.hoveredTimelineClipId === clip.id && !props.currentlyPlayingClipId) ? {
                    borderColor: '#ffffff',
                    borderWidth: '2px',
                    borderStyle: 'solid'
                  } : {})
                }"
                :data-run-color="clip.run_color"
                :title="`${clip.title} - ${formatDuration(getSegmentDisplayTime(segment, 'start'))} to ${formatDuration(getSegmentDisplayTime(segment, 'end'))}${clip.run_number ? ` (Run ${clip.run_number})` : ''}`"
                @mouseenter="hoveredSegmentKey = `${clip.id}_${segIndex}`"
                @mouseleave="hoveredSegmentKey = null"
                @mousedown="onSegmentMouseDown($event, clip.id, segIndex, segment)"
              >
                <span class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm">{{ clip.title }}</span>

                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 hover:w-2 group-hover:opacity-100 group-hover:pointer-events-auto"
                  :class="{ 'opacity-100 pointer-events-auto': hoveredSegmentKey === `${clip.id}_${segIndex}` }"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>

                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 hover:w-2 group-hover:opacity-100 group-hover:pointer-events-auto"
                  :class="{ 'opacity-100 pointer-events-auto': hoveredSegmentKey === `${clip.id}_${segIndex}` }"
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
            v-if="Math.abs(dragEndX - dragStartX) > 80"
            class="absolute inset-0 flex items-center justify-center"
          >
            <div class="bg-blue-500/80 text-white text-xs px-2 py-1 rounded font-medium">
              {{ formatDuration(Math.min(dragStartPercent, dragEndPercent) * duration) }} - {{ formatDuration(Math.max(dragStartPercent, dragEndPercent) * duration) }}
            </div>
          </div>
        </div>

        <!-- Custom Timeline Tooltip -->
        <div
          v-if="showTimelineTooltip && !isPanning && !isDragging && !isDraggingSegment"
          class="fixed pointer-events-none z-50 transition-all duration-75"
          :style="{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%)'
          }"
        >
          <div class="bg-black/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-medium shadow-lg border border-white/20">
            {{ formatDuration(tooltipTime) }}
            <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-black/90 border-r border-b border-white/20"></div>
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
          <div class="bg-blue-600/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-md font-medium shadow-lg border border-white/20">
            <div class="text-center">
              <div class="font-semibold mb-1">Moving Segment</div>
              <div>{{ formatDuration(draggedSegmentInfo.currentStartTime) }} - {{ formatDuration(draggedSegmentInfo.currentEndTime) }}</div>
              <div class="text-xs opacity-75 mt-1">Duration: {{ formatDuration(draggedSegmentInfo.currentEndTime - draggedSegmentInfo.currentStartTime) }}</div>
            </div>
            <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-blue-600/90 border-r border-b border-white/20"></div>
          </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { updateClipSegment, getAdjacentClipSegments, realignClipSegment } from '../services/database'

// Simple debounce utility function with flush and cancel capabilities
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): {
  (...args: Parameters<T>): void
  flush: () => void
  cancel: () => void
} {
  let timeout: NodeJS.Timeout | null = null
  let pendingArgs: Parameters<T> | null = null

  const debounced = (...args: Parameters<T>) => {
    pendingArgs = args
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func(...pendingArgs!)
      pendingArgs = null
      timeout = null
    }, wait)
  }

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout)
      if (pendingArgs) {
        func(...pendingArgs)
        pendingArgs = null
      }
      timeout = null
    }
  }

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
      pendingArgs = null
    }
  }

  return debounced
}

interface Timestamp {
  time: number
  position: number
  label: string
  isMajor: boolean
}

interface ClipSegment {
  start_time: number
  end_time: number
  duration: number
  transcript: string
}

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
}

const props = withDefaults(defineProps<Props>(), {
  clips: () => []
})

// Calculate timeline height dynamically based on tracks
const calculatedHeight = computed(() => {
  const headerHeight = 56 // Header section height (pt-3 + content + mb-3 + spacing)
  const rulerHeight = 32 // Timeline ruler height
  const mainTrackHeight = 86 // Main video track height
  const clipTrackHeight = 48 // Height per clip track

  const numberOfClips = displayClips.value.length

  // Calculate total content height: header + ruler + main track + clip tracks
  const tracksHeight = rulerHeight + mainTrackHeight + (numberOfClips * clipTrackHeight)
  const totalHeight = headerHeight + tracksHeight

  // Apply reasonable bounds
  const minHeight = 148 // Minimum height when no clips (56 + 32 + 56)
  const maxHeight = 420 // Increased max height to allow more clips before scrollbar

  return Math.max(minHeight, Math.min(maxHeight, totalHeight))
})

// Determine if scrollbar should be shown based on content vs container height
const shouldShowScrollbar = computed(() => {
  const headerHeight = 56 // Header section height
  const rulerHeight = 32 // Timeline ruler height (h-8)
  const mainTrackHeight = 56 // Main video track height (h-14)
  const clipTrackHeight = 48 // Height per clip track (min-h-12)
  const bottomPadding = props.clips.length > 0 ? 34 : 8 // Dynamic bottom padding

  const numberOfClips = displayClips.value.length
  const contentHeight = rulerHeight + mainTrackHeight + (numberOfClips * clipTrackHeight) + bottomPadding
  const availableHeight = calculatedHeight.value - headerHeight

  // Only show scrollbar when content actually exceeds available height (small buffer for precision)
  const needsScrollbar = contentHeight > availableHeight

  // console.log('[Timeline] Scrollbar calculation:', {
  //   clips: numberOfClips,
  //   contentHeight,
  //   availableHeight,
  //   calculatedHeight: calculatedHeight.value,
  //   bottomPadding,
  //   needsScrollbar,
  //   difference: contentHeight - availableHeight
  // })

  return needsScrollbar
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
const zoomSlider = ref<HTMLInputElement | null>(null)

// Zoom state
const zoomLevel = ref(1.0) // 1.0 = normal zoom, >1.0 = zoomed in
const minZoom = 1.0
const maxZoom = 10.0
const zoomStep = 0.1

// Debounced database update function for smoother performance
const debouncedUpdateClip = debounce(async (clipId: string, segmentIndex: number, newStartTime: number, newEndTime: number) => {
  try {
    await updateClipSegment(clipId, segmentIndex, newStartTime, newEndTime)

    // Update local clip data for immediate visual feedback
    const clipIndex = localClips.value.findIndex(clip => clip.id === clipId)
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
}, 100) // 100ms debounce for smoother performance

// Panning state
const isPanning = ref(false)
const panStartX = ref(0)
const panScrollLeft = ref(0)

// Drag selection state for zoom
const isDragging = ref(false)
const dragStartX = ref(0)
const dragEndX = ref(0)
const dragStartPercent = ref(0)
const dragEndPercent = ref(0)

// Timeline hover line state
const showTimelineHoverLine = ref(false)
const timelineHoverLinePosition = ref(0) // X position in pixels relative to timeline container
const timelineBounds = ref({ top: 0, bottom: 0 }) // Timeline container bounds

// Custom tooltip state
const showTimelineTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipTime = ref(0)

// Global playhead state
const globalPlayheadPosition = ref(0) // X position in pixels for the global playhead line
const isPlayheadInitialized = ref(false) // Track if playhead has been properly initialized

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

// Movement constraints
const movementConstraints = ref<{
  minStartTime: number
  maxEndTime: number
}>({
  minStartTime: 0,
  maxEndTime: Infinity
})

// Local reactive copy of clips for immediate visual updates
const localClips = ref(props.clips ? [...props.clips] : [])

// Computed clips that updates during dragging
const displayClips = computed(() => {
  if (!isDraggingSegment.value || !draggedSegmentInfo.value) {
    return localClips.value
  }

  // Create a copy with the dragged segment's position updated
  const updatedClips = [...localClips.value]
  const { clipId, segmentIndex, currentStartTime, currentEndTime } = draggedSegmentInfo.value

  const clipIndex = updatedClips.findIndex(clip => clip.id === clipId)
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
})

function setTimelineClipRef(el: any, clipId: string) {
  if (el && el instanceof HTMLElement) {
    timelineClipElements.value.set(clipId, el)
  } else {
    timelineClipElements.value.delete(clipId)
  }
}

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

// Expose function to parent
defineExpose({
  scrollTimelineClipIntoView,
  zoomLevel
})

// Intelligent timestamp generation based on video duration and zoom level
const generatedTimestamps = computed(() => {
  if (!props.duration || props.duration <= 0) return []

  const timestamps: Timestamp[] = []
  const duration = props.duration

  // Determine optimal interval based on video duration and zoom level
  function getOptimalInterval(duration: number, zoom: number): { major: number, minor: number } {
    const seconds = duration / zoom // Apply zoom to make intervals smaller when zoomed in

    // For very short videos (< 30 seconds at current zoom)
    if (seconds < 30) {
      return { major: 5, minor: 1 }
    }
    // For short videos (30s - 2 minutes at current zoom)
    else if (seconds < 120) {
      return { major: 10, minor: 5 }
    }
    // For medium videos (2 - 10 minutes at current zoom)
    else if (seconds < 600) {
      return { major: 30, minor: 10 }
    }
    // For longer videos (10 - 30 minutes at current zoom)
    else if (seconds < 1800) {
      return { major: 60, minor: 20 }
    }
    // For very long videos (30 minutes - 2 hours at current zoom)
    else if (seconds < 7200) {
      return { major: 300, minor: 60 } // 5min major, 1min minor
    }
    // For extremely long videos (2+ hours at current zoom)
    else {
      return { major: 900, minor: 180 } // 15min major, 3min minor
    }
  }

  const { major, minor } = getOptimalInterval(duration, zoomLevel.value)

  // Generate major timestamps
  for (let time = 0; time <= duration; time += major) {
    const clampedTime = Math.min(time, duration) // Ensure we don't exceed duration
    timestamps.push({
      time: clampedTime,
      position: (clampedTime / duration) * 100,
      label: formatDuration(clampedTime),
      isMajor: true
    })
  }

  // Generate minor timestamps (in between major ones)
  for (let time = minor; time < duration; time += minor) {
    // Skip if this coincides with a major timestamp
    if (time % major !== 0) {
      timestamps.push({
        time: time,
        position: (time / duration) * 100,
        label: formatDuration(time),
        isMajor: false
      })
    }
  }

  // Sort by time to ensure proper order
  timestamps.sort((a, b) => a.time - b.time)

  return timestamps
})


function formatDuration(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'

  const totalSeconds = Math.floor(seconds)

  if (totalSeconds < 60) {
    return `0:${totalSeconds.toString().padStart(2, '0')}`
  } else if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = totalSeconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const remainingSeconds = totalSeconds % 60
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

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

// Zoom handler for timeline ruler
function onRulerWheel(event: WheelEvent) {
  event.preventDefault()

  // Determine zoom direction
  const delta = event.deltaY > 0 ? -zoomStep : zoomStep

  // Calculate new zoom level
  const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel.value + delta))

  // Get current hover position as a percentage of the visible timeline
  const container = timelineScrollContainer.value
  const timelineContent = container?.querySelector('.timeline-content-wrapper')
  if (container && timelineContent) {
    const contentRect = timelineContent.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const relativeX = event.clientX - containerRect.left

    // Calculate the timeline position being hovered over
    const currentScrollLeft = container.scrollLeft
    const currentContentWidth = contentRect.width
    const hoveredTimelinePosition = currentScrollLeft + (relativeX)
    const hoveredPercentOfContent = Math.max(0, Math.min(1, hoveredTimelinePosition / currentContentWidth))

    // Update zoom level
    zoomLevel.value = newZoom

    // Wait for DOM to update, then calculate new scroll position
    nextTick(() => {
      if (container) {
        const newContentRect = timelineContent.getBoundingClientRect()
        const newContentWidth = newContentRect.width

        // Calculate new scroll position to keep the same content position under cursor
        const newScrollLeft = (hoveredPercentOfContent * newContentWidth) - relativeX

        // Apply smooth scrolling to new position
        container.scrollLeft = Math.max(0, newScrollLeft)
      }
    })
  } else {
    // Fallback: just update zoom level
    zoomLevel.value = newZoom
  }

  // Emit zoom change to parent
  emit('zoomChanged', newZoom)
}

// Zoom slider change handler
function onZoomSliderChange() {
  // Update CSS variable for filled track
  updateSliderProgress()

  // Emit zoom change to parent
  emit('zoomChanged', zoomLevel.value)
}

// Update slider progress background
function updateSliderProgress() {
  if (zoomSlider.value) {
    const percentage = ((zoomLevel.value - minZoom) / (maxZoom - minZoom)) * 100
    const background = `linear-gradient(to right,
      rgba(255, 255, 255, 0.6) 0%,
      rgba(255, 255, 255, 0.6) ${percentage}%,
      rgba(255, 255, 255, 0.2) ${percentage}%,
      rgba(255, 255, 255, 0.2) 100%)`
    zoomSlider.value.style.background = background
  }
}

// Panning handlers for timeline ruler
function onPanStart(event: MouseEvent) {
  // Only pan with left mouse button
  if (event.button !== 0) return

  isPanning.value = true
  panStartX.value = event.clientX
  panScrollLeft.value = timelineScrollContainer.value?.scrollLeft || 0

  // Hide tooltip when panning starts
  showTimelineTooltip.value = false

  // Change cursor to indicate panning
  document.body.style.cursor = 'grabbing'
  event.preventDefault()
}

function onPanMove(event: MouseEvent) {
  if (!isPanning.value) return

  event.preventDefault()

  const deltaX = event.clientX - panStartX.value
  const newScrollLeft = panScrollLeft.value - deltaX

  if (timelineScrollContainer.value) {
    timelineScrollContainer.value.scrollLeft = newScrollLeft
  }
}

function onPanEnd() {
  if (isPanning.value) {
    isPanning.value = false
    // Reset cursor
    document.body.style.cursor = ''
  }
}

// Drag selection handlers
function onDragStart(event: MouseEvent) {
  // Only start drag with left mouse button and not on clips
  if (event.button !== 0 || event.target instanceof HTMLElement && event.target.closest('.clip-segment')) return

  const container = timelineScrollContainer.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  const relativeX = event.clientX - rect.left

  // Only allow drag selection in timeline content area (after track labels)
  const trackLabelWidth = 64 // 4rem = 64px (w-16)
  if (relativeX < trackLabelWidth) return

  // Initialize drag selection
  isDragging.value = true
  dragStartX.value = event.clientX
  dragEndX.value = event.clientX

  // Hide tooltip when dragging starts
  showTimelineTooltip.value = false

  // Calculate percentages relative to the zoomed timeline content
  const timelineContent = container.querySelector('.timeline-content-wrapper')
  if (timelineContent) {
    const contentRect = timelineContent.getBoundingClientRect()
    const contentRelativeX = event.clientX - contentRect.left
    dragStartPercent.value = Math.max(0, Math.min(1, contentRelativeX / contentRect.width))
    dragEndPercent.value = dragStartPercent.value
  }

  // Update timeline bounds for selection area
  timelineBounds.value = {
    top: rect.top,
    bottom: rect.bottom
  }

  // Hide hover line during drag
  showTimelineHoverLine.value = false

  event.preventDefault()
}

function onDragMove(event: MouseEvent) {
  if (!isDragging.value) return

  dragEndX.value = event.clientX

  const container = timelineScrollContainer.value
  if (!container) return

  // Update end percentage based on current mouse position
  const timelineContent = container.querySelector('.timeline-content-wrapper')
  if (timelineContent) {
    const contentRect = timelineContent.getBoundingClientRect()
    const contentRelativeX = event.clientX - contentRect.left
    dragEndPercent.value = Math.max(0, Math.min(1, contentRelativeX / contentRect.width))
  }

  event.preventDefault()
}

function onDragEnd() {
  if (!isDragging.value) return

  // Calculate the selected time range
  const startPercent = Math.min(dragStartPercent.value, dragEndPercent.value)
  const endPercent = Math.max(dragStartPercent.value, dragEndPercent.value)
  const selectionDuration = endPercent - startPercent

  // Only zoom if the selection is meaningful (at least 5% of timeline)
  if (selectionDuration >= 0.05) {
    // Calculate new zoom level to fit the selection
    const targetZoom = Math.min(maxZoom, Math.max(minZoom, 1.0 / selectionDuration))

    // Update zoom level first
    zoomLevel.value = targetZoom

    // Wait for the zoom to be applied and DOM to update, then set scroll position
    nextTick(() => {
      if (timelineScrollContainer.value) {
        const container = timelineScrollContainer.value
        const contentWidth = container.scrollWidth // This will be updated after zoom
        const containerWidth = container.clientWidth
        const maxScrollLeft = contentWidth - containerWidth

        // Calculate the position of the selection in the zoomed content
        // The selection start position in the zoomed content
        const selectionStartPositionInContent = startPercent * contentWidth
        const selectionWidthInContent = selectionDuration * contentWidth

        // Calculate the target scroll position to show the selection
        // We want to center the selection, or show it starting from the left if it's very wide
        let targetScrollLeft: number
        if (selectionWidthInContent >= containerWidth) {
          // Selection is wider than container, show it starting from left
          targetScrollLeft = Math.max(0, Math.min(maxScrollLeft, selectionStartPositionInContent - 20)) // 20px padding
        } else {
          // Center the selection in the viewport
          const centerOfSelection = selectionStartPositionInContent + (selectionWidthInContent / 2)
          targetScrollLeft = Math.max(0, Math.min(maxScrollLeft, centerOfSelection - (containerWidth / 2)))
        }

        container.scrollLeft = targetScrollLeft
      }
    })

    // Emit zoom change to parent
    emit('zoomChanged', targetZoom)
  }

  // Reset drag state
  isDragging.value = false
  dragStartX.value = 0
  dragEndX.value = 0
  dragStartPercent.value = 0
  dragEndPercent.value = 0
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
  const trackLabelWidth = 64 // 4rem = 64px (w-16)
  if (relativeX >= trackLabelWidth) {
    showTimelineHoverLine.value = true
    // Position the line exactly where the cursor is (absolute viewport position)
    timelineHoverLinePosition.value = event.clientX

    // Calculate time for tooltip
    const timelineContent = container.querySelector('.timeline-content-wrapper')
    if (timelineContent) {
      const contentRect = timelineContent.getBoundingClientRect()
      const contentRelativeX = event.clientX - contentRect.left
      const timePercent = Math.max(0, Math.min(1, contentRelativeX / contentRect.width))
      const hoverTime = timePercent * props.duration

      // Update custom tooltip
      showTimelineTooltip.value = true
      tooltipPosition.value = {
        x: event.clientX,
        y: event.clientY - 40 // Position above cursor
      }
      tooltipTime.value = hoverTime
    }
  } else {
    showTimelineHoverLine.value = false
    showTimelineTooltip.value = false
  }
}

function onTimelineMouseLeaveGlobal() {
  showTimelineHoverLine.value = false
  showTimelineTooltip.value = false
  // Cancel drag if mouse leaves timeline
  if (isDragging.value) {
    onDragEnd()
  }
}

function onRulerMouseMove(event: MouseEvent) {
  if (isPanning.value) return

  // Also update hover line when over ruler
  onTimelineMouseMove(event)
}

function onRulerMouseLeave() {
  onPanEnd()
  showTimelineHoverLine.value = false
  showTimelineTooltip.value = false
}

// Update global playhead position based on current time
function updateGlobalPlayheadPosition() {
  if (!props.videoSrc || !props.duration || props.duration <= 0 || props.currentTime < 0) {
    return
  }

  const container = timelineScrollContainer.value
  if (!container) return

  // CRITICAL: Update timeline bounds first - this is what positions the playhead correctly!
  const rect = container.getBoundingClientRect()
  timelineBounds.value = {
    top: rect.top,
    bottom: rect.bottom
  }
  console.log('[Timeline] Timeline bounds updated:', timelineBounds.value)

  // Get the timeline content wrapper to account for zoom and scroll
  const timelineContent = container.querySelector('.timeline-content-wrapper') as HTMLElement
  if (!timelineContent) return

  // Check if the timeline content has proper dimensions
  const contentWidth = timelineContent.offsetWidth
  if (contentWidth <= 0) {
    // Timeline content is not properly sized yet, try again later
    if (!isPlayheadInitialized.value) {
      console.log('[Timeline] Content width is 0, retrying...', { contentWidth })
      requestAnimationFrame(() => {
        updateGlobalPlayheadPosition()
      })
    }
    return
  }

  // Calculate the time percentage, ensuring it's bounded between 0 and 1
  const timePercent = Math.max(0, Math.min(1, props.currentTime / props.duration))

  // Get the container rectangle and current scroll position
  const containerRect = container.getBoundingClientRect()
  const scrollLeft = container.scrollLeft

  // Define track label width (same as used in other parts of the component)
  const trackLabelWidth = 64 // 4rem = 64px (w-16)

  // Calculate the X position of the playhead relative to the viewport
  // Account for track labels, zoom (contentWidth), and scroll position
  const playheadX = containerRect.left + trackLabelWidth + (timePercent * contentWidth) - scrollLeft

  // Validate the calculated position is reasonable
  const minX = containerRect.left + trackLabelWidth
  const maxX = containerRect.left + trackLabelWidth + contentWidth

  if (playheadX < minX || playheadX > maxX) {
    // Position is invalid, likely due to layout issues
    if (!isPlayheadInitialized.value) {
      console.log('[Timeline] Invalid playhead position, retrying...', {
        playheadX,
        minX,
        maxX,
        contentWidth,
        timePercent,
        currentTime: props.currentTime,
        duration: props.duration
      })
      requestAnimationFrame(() => {
        updateGlobalPlayheadPosition()
      })
    }
    return
  }

  // Only update if this would result in a meaningful position change
  // This prevents initial animation from incorrect positions
  if (!isPlayheadInitialized.value || Math.abs(globalPlayheadPosition.value - playheadX) > 1) {
    const previousPosition = globalPlayheadPosition.value
    globalPlayheadPosition.value = playheadX
    isPlayheadInitialized.value = true

    if (previousPosition !== playheadX) {
      console.log('[Timeline] Playhead position updated:', {
        previousPosition,
        newPosition: playheadX,
        timePercent,
        currentTime: props.currentTime,
        duration: props.duration,
        contentWidth,
        containerRectLeft: containerRect.left,
        trackLabelWidth,
        scrollLeft,
        initialized: isPlayheadInitialized.value,
        timestamp: Date.now()
      })
    }
  }
}

// Debounced version for smoother updates during component initialization
const debouncedUpdatePlayhead = debounce(updateGlobalPlayheadPosition, 50)

// Watch for changes that affect global playhead position and slider
watch(
  [() => props.currentTime, () => props.duration, () => props.videoSrc, zoomLevel],
  ([newCurrentTime, newDuration, newVideoSrc, newZoomLevel], [oldCurrentTime, oldDuration, oldVideoSrc, oldZoomLevel]) => {
    // Reset initialization flag when video source or duration changes
    if (newVideoSrc !== oldVideoSrc || newDuration !== oldDuration) {
      isPlayheadInitialized.value = false
    }

    // Use debounced version during initialization (first few updates)
    // Use immediate version for normal time updates during video playback
    const isInitializing = newVideoSrc !== oldVideoSrc || newDuration !== oldDuration

    if (isInitializing) {
      debouncedUpdatePlayhead()
    } else {
      updateGlobalPlayheadPosition()
    }

    updateSliderProgress()
  },
  { immediate: true }
)

// Update tooltip position when zoom changes during drag
watch(
  zoomLevel,
  () => {
    if (isDraggingSegment.value) {
      updateSegmentDragTooltip()
    }
  }
)

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

// Handle scroll events to update global playhead position
function handleScroll() {
  // Use immediate update for scroll events as they need to feel responsive
  updateGlobalPlayheadPosition()
}

// Global mouse event handlers for better panning and drag selection experience
function handleGlobalMouseMove(event: MouseEvent) {
  if (isPanning.value) {
    onPanMove(event)
  } else if (isDragging.value) {
    onDragMove(event)
  } else if (isDraggingSegment.value) {
    onSegmentMouseMove(event)
  } else {
    // Check if we're still over the timeline area
    const container = timelineScrollContainer.value
    if (container) {
      const rect = container.getBoundingClientRect()
      if (event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom) {
        onTimelineMouseMove(event)
      } else {
        showTimelineHoverLine.value = false
        showTimelineTooltip.value = false
      }
    }
  }
}

function handleGlobalMouseUp() {
  if (isDragging.value) {
    onDragEnd()
  } else if (isDraggingSegment.value) {
    onSegmentMouseUp()
  } else {
    onPanEnd()
  }
}


// Setup and cleanup global event listeners
onMounted(() => {
  document.addEventListener('mousemove', handleGlobalMouseMove)
  document.addEventListener('mouseup', handleGlobalMouseUp)

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
      const newRect = container.getBoundingClientRect()
      timelineBounds.value = {
        top: newRect.top,
        bottom: newRect.bottom
      }

      // Update global playhead position
      updateGlobalPlayheadPosition()
    })

    resizeObserver.observe(container)
    ;(container as any)._resizeObserver = resizeObserver

    // Initialize playhead position after DOM is fully rendered
    nextTick(() => {
      // Use a longer delay to ensure all layout calculations are complete
      setTimeout(() => {
        isPlayheadInitialized.value = false
        console.log('[Timeline] Initial playhead positioning attempt')
        updateGlobalPlayheadPosition()
      }, 300) // Increased delay to 300ms

      // Also try again after an even longer delay as a fallback
      setTimeout(() => {
        if (!isPlayheadInitialized.value) {
          console.log('[Timeline] Fallback playhead positioning attempt')
          isPlayheadInitialized.value = false
          updateGlobalPlayheadPosition()
        }
      }, 1000) // Fallback after 1 second
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  document.removeEventListener('mouseup', handleGlobalMouseUp)

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
})

// Utility function to convert hex color to darker version for timeline clips
function hexToDarkerHex(hex: string, opacity: number = 0.4): string {
  // Remove the # if present
  const cleanHex = hex.replace('#', '')

  // Parse the hex values
  const r = parseInt(cleanHex.substr(0, 2), 16)
  const g = parseInt(cleanHex.substr(2, 2), 16)
  const b = parseInt(cleanHex.substr(4, 2), 16)

  // Create darker version by reducing brightness (multiply by opacity factor)
  const darkerR = Math.round(r * opacity)
  const darkerG = Math.round(g * opacity)
  const darkerB = Math.round(b * opacity)

  // Convert back to hex
  return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`
}

// Generate gradient colors based on run color
function generateClipGradient(runColor: string | undefined) {
  const color = runColor || '#10B981' // Default green if no run color
  const bgColor = hexToDarkerHex(color, 0.4)
  const hoverBgColor = hexToDarkerHex(color, 0.6)
  const borderColor = hexToDarkerHex(color, 0.7)

  return {
    background: `linear-gradient(to right, ${bgColor}, ${hexToDarkerHex(color, 0.5)})`,
    borderLeftColor: borderColor,
    borderRightColor: borderColor,
    borderTopColor: borderColor,
    borderBottomColor: borderColor,
    hoverBackground: `linear-gradient(to right, ${hoverBgColor}, ${hexToDarkerHex(color, 0.7)})`
  }
}

// Get display time for segment
function getSegmentDisplayTime(segment: ClipSegment, type: 'start' | 'end'): number {
  return type === 'start' ? segment.start_time : segment.end_time
}

// Calculate movement constraints for a segment
async function calculateMovementConstraints(clipId: string, segmentIndex: number): Promise<void> {
  try {
    const adjacent = await getAdjacentClipSegments(clipId, segmentIndex)

    let minStartTime = 0
    let maxEndTime = props.duration || Infinity

    // Can't go past previous segment's end time
    if (adjacent.previous) {
      minStartTime = adjacent.previous.end_time
      console.log('[Timeline] Previous segment constraint:', {
        previousEnd: adjacent.previous.end_time.toFixed(2),
        segmentIndex
      })
    }

    // Can't go past next segment's start time
    if (adjacent.next) {
      maxEndTime = adjacent.next.start_time
      console.log('[Timeline] Next segment constraint:', {
        nextStart: adjacent.next.start_time.toFixed(2),
        segmentIndex
      })
    }

    // Get original duration from the dragged segment info
    const originalDuration = (draggedSegmentInfo.value?.originalEndTime || 0) - (draggedSegmentInfo.value?.originalStartTime || 0) || 0
    console.log('[Timeline] Duration preservation constraint:', {
      originalDuration: originalDuration.toFixed(2),
      minStartTime: minStartTime.toFixed(2),
      initialMaxEndTime: maxEndTime.toFixed(2),
      maxPossibleWithMinStart: (minStartTime + originalDuration).toFixed(2)
    })

    // IMPORTANT: Ensure we have enough space for the original duration
    // If the maxEndTime doesn't allow the original duration, we need to adjust it
    if (maxEndTime < minStartTime + originalDuration) {
      console.log('[Timeline] Constraint too small, adjusting maxEndTime:', {
        oldMaxEndTime: maxEndTime.toFixed(2),
        newMaxEndTime: (minStartTime + originalDuration).toFixed(2)
      })
      maxEndTime = minStartTime + originalDuration
    }

    movementConstraints.value = {
      minStartTime,
      maxEndTime
    }

    // Constraints calculated successfully
  } catch (error) {
    console.error('Error calculating movement constraints:', error)
    movementConstraints.value = {
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

  // Initialize tooltip position
  updateSegmentDragTooltip()
}

// Update segment drag tooltip position to follow the segment
function updateSegmentDragTooltip() {
  if (!isDraggingSegment.value || !draggedSegmentInfo.value || !timelineScrollContainer.value) return

  const { currentStartTime, currentEndTime } = draggedSegmentInfo.value
  const container = timelineScrollContainer.value
  const containerRect = container.getBoundingClientRect()
  const scrollLeft = container.scrollLeft

  // Calculate the position of the segment center in the timeline
  const segmentCenterTime = (currentStartTime + currentEndTime) / 2
  const timePercent = props.duration ? segmentCenterTime / props.duration : 0

  // Get the timeline content wrapper to account for zoom
  const timelineContent = container.querySelector('.timeline-content-wrapper') as HTMLElement
  if (!timelineContent) return

  const contentWidth = timelineContent.offsetWidth
  const segmentCenterX = contentWidth * timePercent

  // Calculate the viewport position (account for scroll and container offset)
  const viewportX = containerRect.left + segmentCenterX - scrollLeft

  // Update tooltip position
  draggedSegmentInfo.value.tooltipX = viewportX
  draggedSegmentInfo.value.tooltipY = containerRect.top - 60
}

// Handle mouse move for segment dragging
function onSegmentMouseMove(event: MouseEvent) {
  if (!isDraggingSegment.value || !draggedSegmentInfo.value || !props.duration) return

  const { clipId, segmentIndex } = draggedSegmentInfo.value
  const deltaX = event.clientX - draggedSegmentInfo.value.originalMouseX
  const timelineWidth = timelineScrollContainer.value?.clientWidth || 1
  const timeDelta = (deltaX / timelineWidth) * props.duration / zoomLevel.value

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
  if (newEndTime - newStartTime < originalDuration * 0.99) { // Allow tiny floating point errors
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

  const { clipId, segmentIndex, currentStartTime, currentEndTime, originalStartTime, originalEndTime } = draggedSegmentInfo.value

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

  // Final database update and transcript realignment (only if significant change)
  if (Math.abs(currentStartTime - originalOriginalStartTime) > 0.1 || Math.abs(currentEndTime - originalOriginalEndTime) > 0.1) {
    try {
      // Final immediate database update to ensure latest state is saved
      await updateClipSegment(clipId, segmentIndex, currentStartTime, currentEndTime)

      // Realign transcript if needed
      await realignClipSegment(clipId, segmentIndex, originalOriginalStartTime, originalOriginalEndTime, currentStartTime, currentEndTime)

      // Emit update to parent
      emit('segmentUpdated', clipId, segmentIndex, currentStartTime, currentEndTime)
    } catch (error) {
      console.error('[Timeline] Error in final segment update:', error)
    }
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
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.15s ease;
  will-change: transform, box-shadow;
}

/* No transitions during drag for smoother performance */
.clip-segment.dragging {
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
  cursor: grab;
  user-select: none;
}

.timeline-ruler:active {
  cursor: grabbing;
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
  background: linear-gradient(90deg,
    rgba(59, 130, 246, 0.1) 0%,
    rgba(59, 130, 246, 0.2) 50%,
    rgba(59, 130, 246, 0.1) 100%);
  animation: shimmer 2s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
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

/* Zoom slider styling */
.slider-zoom {
  -webkit-appearance: none;
  appearance: none;
  outline: none;
  transition: opacity 0.2s;
}

/* Base track styling - will be updated by JavaScript */
.slider-zoom::-webkit-slider-track {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
}

.slider-zoom::-moz-range-track {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
}

.slider-zoom::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.slider-zoom::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.slider-zoom:hover::-webkit-slider-thumb {
  transform: scale(1.2);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.slider-zoom:hover::-moz-range-thumb {
  transform: scale(1.2);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.slider-zoom:active::-webkit-slider-thumb {
  transform: scale(1.1);
}

.slider-zoom:active::-moz-range-thumb {
  transform: scale(1.1);
}

/* Segment dragging styles */
.clip-segment.dragging {
  z-index: 30 !important;
  transform: scale(1.02);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5);
  border-color: rgb(59, 130, 246) !important;
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
  0%, 100% {
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

.clip-segment.dragging {
  cursor: grabbing !important;
  transform: scale(1.02);
}

/* Smooth transitions for non-dragging states */
.clip-segment:not(.dragging) {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.15s ease;
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
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>