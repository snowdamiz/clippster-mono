<template>
  <div class="bg-[#0a0a0a]/30 border-t border-border transition-all duration-300 ease-in-out"
       :style="{
         height: calculatedHeight + 'px'
       }">
    <div class="pt-3 px-4 h-full flex flex-col" :style="{ paddingBottom: props.clips.length > 0 ? '34px' : '8px' }">
      <!-- Timeline Header -->
      <div class="flex items-center justify-between mb-3 pr-1 flex-shrink-0">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-medium text-foreground">Timeline</h3>
          <div v-if="props.clips.length > 5" class="text-xs text-muted-foreground/70 flex items-center gap-1" title="Scroll to see more clips">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span class="text-xs">scroll</span>
          </div>
        </div>
        <span class="text-xs text-muted-foreground">{{ props.clips.length + 1 }} tracks</span>
      </div>

      <!-- Timeline Tracks Container -->
      <div class="flex-1 pr-1 bg-muted/20 rounded-lg relative overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
           :style="{ maxHeight: calculatedHeight - 56 + 'px' }">
        <!-- Shared Timestamp Ruler -->
        <div class="h-8 border-b border-border/30 flex items-center bg-[#0a0a0a]/40 px-2 sticky top-0 z-10 backdrop-blur-sm timeline-ruler sticky-ruler">
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
              @click="onSeekTimeline"
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

                <!-- Playhead -->
                <div
                  class="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 transition-all duration-100"
                  :style="{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }"
                >
                  <div class="absolute -top-1 -left-1 w-3 h-3 bg-white rounded-full shadow-md"></div>
                </div>

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
          v-for="(clip, index) in props.clips"
          :key="clip.id"
          class="flex items-center min-h-12 px-2 border-b border-border/20"
        >
          <!-- Track Label -->
          <div class="w-16 h-8 pr-2 flex items-center justify-center">
            <div class="text-xs text-center">
              <div class="font-medium text-foreground/80">Clip {{ index + 1 }}</div>
            </div>
          </div>

          <!-- Clip Track Content -->
          <div class="flex-1 h-8 relative">
            <!-- Clip segments on timeline -->
            <div class="absolute inset-0 flex items-center">
              <!-- Background track -->
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md border border-border/20"></div>

              <!-- Render each segment as a clip on the timeline -->
              <div
                v-for="(segment, segIndex) in clip.segments"
                :key="`${clip.id}_${segIndex}`"
                class="clip-segment absolute h-6 border rounded-md flex items-center justify-center cursor-pointer"
                :class="[
                  'transition-all duration-150',
                  clip.run_number ? `run-${clip.run_number}` : '',
                  hoveredClipId === clip.id || props.hoveredTimelineClipId === clip.id ? 'shadow-lg scale-105 z-20' : ''
                ]"
                :style="{
                  left: `${duration ? (segment.start_time / duration) * 100 : 0}%`,
                  width: `${duration ? ((segment.end_time - segment.start_time) / duration) * 100 : 0}%`,
                  ...generateClipGradient(clip.run_color),
                  ...(hoveredClipId === clip.id || props.hoveredTimelineClipId === clip.id ? {
                    borderColor: clip.run_color || '#10B981',
                    borderWidth: '2px',
                    borderStyle: 'solid'
                  } : {})
                }"
                :data-run-color="clip.run_color"
                :title="`${clip.title} - ${formatDuration(segment.start_time)} to ${formatDuration(segment.end_time)}${clip.run_number ? ` (Run ${clip.run_number})` : ''}`"
                @mouseenter="onTimelineClipMouseEnter(clip.id)"
                @mouseleave="onTimelineClipMouseLeave"
              >
                <span class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm">{{ clip.title }}</span>
              </div>
            </div>
          </div>
        </div>

        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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
}

const props = withDefaults(defineProps<Props>(), {
  clips: () => []
})

// Calculate timeline height dynamically based on tracks
const calculatedHeight = computed(() => {
  const headerHeight = 56 // Header section height (pt-3 + content + mb-3 + spacing)
  const rulerHeight = 32 // Timeline ruler height
  const mainTrackHeight = 56 // Main video track height
  const clipTrackHeight = 48 // Height per clip track
  const minTracks = 1 // At least main video track

  const numberOfClips = props.clips.length
  const totalTracks = Math.max(minTracks, numberOfClips + 1) // +1 for main video track

  // Calculate total content height: header + ruler + main track + clip tracks
  const tracksHeight = rulerHeight + mainTrackHeight + (numberOfClips * clipTrackHeight)
  const totalHeight = headerHeight + tracksHeight

  // Apply reasonable bounds
  const minHeight = 160 // Minimum height when no clips (56 + 32 + 56)
  const maxHeight = 300 // Reasonable max height to prevent timeline from taking over dialog

  return Math.max(minHeight, Math.min(maxHeight, totalHeight))
})

interface Emits {
  (e: 'seekTimeline', event: MouseEvent): void
  (e: 'timelineTrackHover', event: MouseEvent): void
  (e: 'timelineMouseLeave'): void
  (e: 'timelineClipHover', clipId: string): void
  (e: 'timelineClipLeave'): void
}

const emit = defineEmits<Emits>()

// Intelligent timestamp generation based on video duration
const generatedTimestamps = computed(() => {
  if (!props.duration || props.duration <= 0) return []

  const timestamps: Timestamp[] = []
  const duration = props.duration

  // Determine optimal interval based on video duration
  function getOptimalInterval(duration: number): { major: number, minor: number } {
    const seconds = duration

    // For very short videos (< 30 seconds)
    if (seconds < 30) {
      return { major: 5, minor: 1 }
    }
    // For short videos (30s - 2 minutes)
    else if (seconds < 120) {
      return { major: 10, minor: 5 }
    }
    // For medium videos (2 - 10 minutes)
    else if (seconds < 600) {
      return { major: 30, minor: 10 }
    }
    // For longer videos (10 - 30 minutes)
    else if (seconds < 1800) {
      return { major: 60, minor: 20 }
    }
    // For very long videos (30 minutes - 2 hours)
    else if (seconds < 7200) {
      return { major: 300, minor: 60 } // 5min major, 1min minor
    }
    // For extremely long videos (2+ hours)
    else {
      return { major: 900, minor: 180 } // 15min major, 3min minor
    }
  }

  const { major, minor } = getOptimalInterval(duration)

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

function onTimelineTrackHover(event: MouseEvent) {
  emit('timelineTrackHover', event)
}

function onTimelineMouseLeave() {
  emit('timelineMouseLeave')
}

// Timeline clip hover event handlers
function onTimelineClipMouseEnter(clipId: string) {
  emit('timelineClipHover', clipId)
  console.log('[Timeline] Clip mouse enter:', clipId)
}

function onTimelineClipMouseLeave() {
  emit('timelineClipLeave')
  console.log('[Timeline] Clip mouse leave')
}

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

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: white;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  transition: left 0.1s ease;
  z-index: 10;
}

.playhead::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -6px;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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
  transition: all 0.15s ease;
}

/* Individual hover effect removed - clips only highlight through bidirectional system */

/* Timeline ruler styling */
.timeline-ruler {
  background: rgba(10, 10, 10, 0.6);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
</style>