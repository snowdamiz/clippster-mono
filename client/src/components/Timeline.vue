<template>
  <div class="bg-[#0a0a0a]/30 border-t border-border transition-all duration-300 ease-in-out" :style="{ height: calculatedHeight + 'px' }">
    <div class="pt-3 px-4 pb-1.5 h-full flex flex-col">
      <!-- Timeline Header -->
      <div class="flex items-center justify-between mb-3 pr-1">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-medium text-foreground">Timeline</h3>
          <div v-if="props.clips.length > 6" class="text-xs text-muted-foreground/70" title="Scroll to see more clips">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
        <span class="text-xs text-muted-foreground">{{ props.clips.length + 1 }} tracks</span>
      </div>

      <!-- Scrollable Timeline Tracks Container -->
      <div class="flex-1 pr-1 bg-muted/20 rounded-lg relative overflow-y-auto overflow-x-hidden">
        <!-- Shared Timestamp Ruler -->
        <!-- <div class="h-6 border-b border-border/30 flex items-center bg-[#0a0a0a]/20 px-2"> -->
          <!-- Track label spacer -->
          <!-- <div class="w-16 pr-2"></div> -->
          <!-- Timestamp ruler -->
          <!-- <div class="flex-1 relative"> -->
            <!-- Timestamp markers -->
            <!-- <div
              v-for="timestamp in timestamps"
              :key="timestamp.time"
              class="absolute flex flex-col items-center -mt-2.5"
              :style="{
                left: `${timestamp.position}%`,
                transform: 'translateX(-50%)'
              }"
            > -->
              <!-- Time label -->
              <!-- <span class="text-xs text-foreground/30 whitespace-nowrap font-normal">{{ timestamp.label }}</span> -->
              <!-- Tick mark -->
              <!-- <div class="w-px h-2 bg-foreground/40 mt-1"></div> -->
            <!-- </div> -->
          <!-- </div> -->
        <!-- </div> -->
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
                class="clip-segment absolute h-6 bg-gradient-to-r from-green-500/40 to-emerald-500/40 border border-green-400/50 rounded-md flex items-center justify-center cursor-pointer hover:from-green-500/60 hover:to-emerald-500/60"
                :style="{
                  left: `${duration ? (segment.start_time / duration) * 100 : 0}%`,
                  width: `${duration ? ((segment.end_time - segment.start_time) / duration) * 100 : 0}%`
                }"
                :title="`${clip.title} - ${formatDuration(segment.start_time)} to ${formatDuration(segment.end_time)}`"
              >
                <span class="text-xs text-white/90 font-medium truncate px-1">{{ clip.title }}</span>
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
}

interface Props {
  videoSrc: string | null
  currentTime: number
  duration: number
  timelineHoverTime: number | null
  timelineHoverPosition: number
  timestamps: Timestamp[]
  clips?: Clip[]
}

const props = withDefaults(defineProps<Props>(), {
  clips: () => []
})

// Calculate dynamic height based on content
const calculatedHeight = computed(() => {
  // Base height: header (44px) + padding (top + bottom) + video track height + container gaps
  const baseHeight = 44 + 14 + 56 + 16 // 44px header, 14px padding, 56px video track, 16px container gaps

  // Add height for each clip track (48px per clip + 8px gap except last)
  const clipsHeight = props.clips.reduce((total, clip, index) => {
    return total + 48 + (index < props.clips.length - 1 ? 8 : 0)
  }, 0)

  // Minimum height to keep timeline usable even with no clips
  const minHeight = 140

  // Maximum height before we enable scrolling (to prevent timeline from taking too much space)
  const maxHeight = 400

  const totalHeight = baseHeight + clipsHeight

  return Math.max(Math.min(totalHeight, maxHeight), minHeight)
})

interface Emits {
  (e: 'seekTimeline', event: MouseEvent): void
  (e: 'timelineTrackHover', event: MouseEvent): void
  (e: 'timelineMouseLeave'): void
}

const emit = defineEmits<Emits>()


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
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

/* Clip segment animations */
.clip-segment {
  transition: all 0.15s ease;
}

.clip-segment:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}
</style>