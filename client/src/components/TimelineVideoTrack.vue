<template>
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
        data-video-track="true"
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
</template>

<script setup lang="ts">
  import { formatDuration } from '../utils/timelineUtils'

  interface Props {
    videoSrc: string | null
    currentTime: number
    duration: number
    timelineHoverTime: number | null
    timelineHoverPosition: number
  }

  const props = defineProps<Props>()

  interface Emits {
    (e: 'videoTrackClick', event: MouseEvent): void
    (e: 'timelineTrackHover', event: MouseEvent): void
    (e: 'timelineMouseLeave'): void
  }

  const emit = defineEmits<Emits>()

  function onVideoTrackClick(event: MouseEvent) {
    emit('videoTrackClick', event)
  }

  function onTimelineTrackHover(event: MouseEvent) {
    emit('timelineTrackHover', event)
  }

  function onTimelineMouseLeave() {
    emit('timelineMouseLeave')
  }
</script>

<style scoped>
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
</style>
