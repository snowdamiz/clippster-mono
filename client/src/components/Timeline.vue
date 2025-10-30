<template>
  <div class="h-38 bg-[#0a0a0a]/30 border-t border-border">
    <div class="p-4 h-full">
      <!-- Timeline Header -->
      <div class="flex items-center justify-between mb-3 pr-1">
        <h3 class="text-sm font-medium text-foreground">Timeline</h3>
      </div>

      <!-- Timeline Tracks -->
      <div class="pr-1 bg-muted/20 rounded-lg h-22 relative overflow-hidden">
        <!-- Video Track -->
        <div class="flex items-center h-full px-2">
          <!-- Track Label -->
          <div class="w-16 h-16 pr-2 mt-2 flex items-center justify-center text-xs text-center text-muted-foreground/60">Video</div>

          <!-- Track Content with Timestamps -->
          <div class="flex-1 h-16 relative mt-4">
            <!-- Timestamp Ruler positioned above track content -->
            <div class="absolute -top-3 left-0 right-0 h-5 flex">
              <div class="relative flex-1">
                <!-- Timestamp markers aligned with track content -->
                <div
                  v-for="timestamp in timestamps"
                  :key="timestamp.time"
                  class="absolute flex flex-col items-center"
                  :style="{
                    left: `${timestamp.position}%`,
                    transform: 'translateX(-50%)'
                  }"
                >
                  <!-- Time label -->
                  <span class="text-xs text-foreground/60 mb-1 whitespace-nowrap">{{ timestamp.label }}</span>
                  <!-- Tick mark -->
                  <div class="w-px h-1 bg-foreground/40"></div>
                </div>
              </div>
            </div>

            <!-- Video Track Content -->
            <div
              class="flex-1 h-10 bg-[#0a0a0a]/50 rounded-md relative cursor-pointer group mt-3"
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Timestamp {
  time: number
  position: number
  label: string
}

interface Props {
  videoSrc: string | null
  currentTime: number
  duration: number
  timelineHoverTime: number | null
  timelineHoverPosition: number
  timestamps: Timestamp[]
}

defineProps<Props>()

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
.timeline-track::-webkit-scrollbar {
  height: 4px;
}

.timeline-track::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.timeline-track::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.timeline-track::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>