<template>
  <div class="flex-1 min-h-0 rounded-lg bg-black relative overflow-hidden">
    <!-- Loading State -->
    <div v-if="videoLoading" class="absolute inset-0 flex items-center justify-center bg-black z-10">
      <div class="flex flex-col items-center gap-3">
        <svg class="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-white text-sm">Loading video...</span>
      </div>
    </div>

    <!-- No Video State -->
    <div v-else-if="!videoSrc && !videoError" class="absolute inset-0 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p class="text-sm">No video assigned</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="videoError" class="absolute inset-0 flex items-center justify-center">
      <div class="text-center text-red-400 p-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p class="text-sm font-medium">Video Error</p>
        <p class="text-xs mt-1 text-red-300">{{ videoError }}</p>
        <button
          @click="$emit('retryLoad')"
          class="mt-3 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-xs text-red-300 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Video Element -->
    <video
      v-else
      ref="videoElementRef"
      :src="videoSrc || undefined"
      class="w-full h-full object-contain"
      @timeupdate="$emit('timeUpdate')"
      @loadedmetadata="$emit('loadedMetadata')"
      @ended="$emit('videoEnded')"
      @click="$emit('togglePlayPause')"
      @error="$emit('videoError', $event)"
      @loadstart="$emit('loadStart')"
      @canplay="$emit('canPlay')"
      @loadeddata="() => console.log('[VideoPlayer] Video loadeddata event')"
      data-testid="project-video"
    />

    <!-- Center Play/Pause Overlay -->
    <button
      v-if="videoSrc && !videoLoading"
      @click="$emit('togglePlayPause')"
      class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
      title="Play/Pause"
    >
      <div class="p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
        <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />
        </svg>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  videoSrc: string | null
  videoLoading: boolean
  videoError: string | null
  isPlaying: boolean
}

defineProps<Props>()

interface Emits {
  (e: 'togglePlayPause'): void
  (e: 'timeUpdate'): void
  (e: 'loadedMetadata'): void
  (e: 'videoEnded'): void
  (e: 'videoError', event: Event): void
  (e: 'loadStart'): void
  (e: 'canPlay'): void
  (e: 'retryLoad'): void
  (e: 'videoElementReady', element: HTMLVideoElement): void
}

const emit = defineEmits<Emits>()

const videoElementRef = ref<HTMLVideoElement | null>(null)

// Expose the video element ref to parent
defineExpose({
  videoElement: videoElementRef
})

// Watch for video element changes and notify parent
watch(videoElementRef, (newElement) => {
  if (newElement) {
    emit('videoElementReady', newElement)
  }
})
</script>

<style scoped>
/* Video player specific styles */
.video-container {
  position: relative;
  background: #000;
  border-radius: 0.5rem;
  overflow: hidden;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Play overlay animation */
.play-overlay {
  transition: opacity 0.2s ease;
}

.play-overlay:hover {
  opacity: 1 !important;
}

/* Loading spinner */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Smooth transitions */
.transition-opacity {
  transition-property: opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Backdrop blur effects */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}
</style>