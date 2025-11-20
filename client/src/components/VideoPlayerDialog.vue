<template>
  <div
    v-if="showVideoPlayer"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-card rounded-lg max-w-6xl max-h-[calc(100vh-80px)] w-full mx-4 border border-border overflow-hidden">
      <!-- Custom Video Player -->
      <div v-if="videoSrc" class="relative w-full h-full flex flex-col">
        <!-- Video Title Header -->
        <div class="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-6 pt-8">
          <h3 class="text-white text-lg font-semibold truncate pr-12">
            {{ getVideoTitle(video) }}
          </h3>
        </div>
        <!-- Close Button (Top Right) -->
        <button
          @click="$emit('close')"
          class="absolute top-6 right-6 z-30 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-md transition-colors"
          title="Close"
        >
          <X class="h-5 w-5 text-white" />
        </button>
        <!-- Video Display (16:9 Aspect Ratio) -->
        <div class="relative flex-1 flex items-center justify-center bg-black aspect-video">
          <video
            ref="videoElement"
            :key="videoKey"
            :src="videoSrc"
            class="w-full h-full object-contain"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @ended="onVideoEnded"
          />
          <!-- Loading Indicator -->
          <div v-if="isVideoLoading" class="absolute inset-0 flex items-center justify-center bg-black/50">
            <div class="flex flex-col items-center gap-3">
              <Loader2 class="animate-spin h-12 w-12 text-white" />
              <span class="text-white text-sm">Loading video...</span>
            </div>
          </div>
          <!-- Center Play/Pause Overlay -->
          <button
            v-if="!isVideoLoading"
            @click="togglePlayPause"
            class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
            title="Play/Pause"
          >
            <div class="p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
              <Play v-if="!isPlaying" class="h-8 w-8 text-white" />
              <Pause v-else class="h-8 w-8 text-white" />
            </div>
          </button>
        </div>
        <!-- Custom Video Controls -->
        <div class="bg-gradient-to-t from-black/80 to-black/60 backdrop-blur-md border-t border-border">
          <!-- Timeline/Seek Bar -->
          <div
            class="relative h-2 cursor-pointer group mx-4 mt-4"
            @click="seekTo($event)"
            @mousemove="onTimelineHover($event)"
            @mouseleave="hoverTime = null"
          >
            <!-- Background track (darker gray) -->
            <div class="absolute inset-0 bg-gray-800 rounded-full"></div>
            <!-- Buffered segments indicator -->
            <div
              class="absolute h-full bg-purple-400/30 rounded-full transition-all duration-300"
              :style="{ width: `${duration ? (buffered / duration) * 100 : 0}%` }"
            ></div>
            <!-- Progress Bar (purple for played section) -->
            <div
              class="absolute h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-100"
              :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
            ></div>
            <!-- Seek thumb (fixed positioning) -->
            <div
              class="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 border-purple-500"
              :style="{
                left: `${duration ? (currentTime / duration) * 100 : 0}%`,
                transform: 'translate(-50%, -50%)',
              }"
            ></div>
            <!-- Hover time preview -->
            <div
              v-if="hoverTime !== null"
              class="absolute -top-10 bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-md font-medium"
              :style="{ left: `${hoverPosition}%`, transform: 'translateX(-50%)' }"
            >
              {{ formatDuration(hoverTime) }}
              <div
                class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-black/90"
              ></div>
            </div>
          </div>
          <!-- Control Buttons and Time Display -->
          <div class="flex items-center justify-between p-4 pb-6">
            <!-- Left Controls -->
            <div class="flex items-center gap-3">
              <!-- Play/Pause Button -->
              <button
                @click="togglePlayPause"
                class="px-1.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-all duration-200 backdrop-blur-sm"
                title="Play/Pause"
              >
                <Play v-if="!isPlaying" class="h-6 w-6 text-white" />
                <Pause v-else class="h-6 w-6 text-white" />
              </button>
              <!-- Time Display -->
              <div class="text-white text-sm font-mono font-medium bg-white/10 px-3 py-2 rounded-md backdrop-blur-sm">
                {{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}
              </div>
            </div>
            <!-- Right Controls -->
            <div class="flex items-center gap-4">
              <!-- Volume Control -->
              <div class="flex items-center gap-3">
                <button
                  @click="toggleMute"
                  class="p-3 bg-white/10 hover:bg-white/20 rounded-md transition-all duration-200 backdrop-blur-sm"
                  title="Mute/Unmute"
                >
                  <VolumeX v-if="isMuted || volume === 0" class="h-4 w-4 text-white" />
                  <Volume2 v-else class="h-4 w-4 text-white" />
                </button>
                <div class="relative w-24 h-1.5 bg-gray-800 rounded-md">
                  <div
                    class="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-md transition-all duration-200"
                    :style="{ width: `${volume * 100}%` }"
                  ></div>
                  <input
                    v-model="volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    class="absolute inset-0 w-full h-full cursor-pointer slider z-10 mt-0.5"
                    @input="updateVolume"
                  />
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
  import { ref, watch, onMounted, onUnmounted } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import type { RawVideo, IntroOutro } from '@/services/database';
  import { X, Loader2, Play, Pause, VolumeX, Volume2 } from 'lucide-vue-next';

  type VideoLike = RawVideo | IntroOutro;

  interface Props {
    video: VideoLike | null;
    showVideoPlayer: boolean;
  }

  interface Emits {
    (e: 'close'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  // Video player state
  const videoElement = ref<HTMLVideoElement | null>(null);
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const isVideoLoading = ref(true);
  const buffered = ref(0);
  const hoverTime = ref<number | null>(null);
  const hoverPosition = ref(0);
  const videoSrc = ref<string | null>(null);

  // Helper function to get video title for both RawVideo and IntroOutro types
  function getVideoTitle(video: VideoLike | null): string {
    if (!video) return 'Untitled Video';

    // Check if it's an IntroOutro (has 'type' property)
    if ('type' in video) {
      return video.name || video.file_path.split(/[\\\/]/).pop() || 'Untitled Asset';
    }

    // It's a RawVideo
    return (video as RawVideo).original_filename || video.file_path.split(/[\\\/]/).pop() || 'Untitled Video';
  }

  // Helper function to format duration in seconds to human readable format
  function formatDuration(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';

    if (seconds < 60) {
      return `0:${Math.round(seconds).toString().padStart(2, '0')}`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  // Video player methods
  function togglePlayPause() {
    if (!videoElement.value) return;

    if (videoElement.value.paused) {
      videoElement.value.play();
      isPlaying.value = true;
    } else {
      videoElement.value.pause();
      isPlaying.value = false;
    }
  }

  function seekTo(event: MouseEvent) {
    if (!videoElement.value) return;

    const timeline = event.currentTarget as HTMLElement;
    const rect = timeline.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));

    const videoDuration = videoElement.value.duration || duration.value;
    if (!videoDuration || isNaN(videoDuration)) return;

    const seekTime = clickPercent * videoDuration;
    videoElement.value.currentTime = seekTime;
    currentTime.value = seekTime;
  }

  function onTimelineHover(event: MouseEvent) {
    if (!videoElement.value) return;

    const timeline = event.currentTarget as HTMLElement;
    const rect = timeline.getBoundingClientRect();
    const hoverX = event.clientX - rect.left;
    const hoverPercent = Math.max(0, Math.min(1, hoverX / rect.width));

    const videoDuration = videoElement.value.duration || duration.value;
    if (!videoDuration || isNaN(videoDuration)) return;

    const hoverTimeSeconds = hoverPercent * videoDuration;

    hoverPosition.value = hoverPercent * 100;
    hoverTime.value = hoverTimeSeconds;
  }

  function updateVolume() {
    if (!videoElement.value) return;

    videoElement.value.volume = volume.value;
    if (volume.value === 0) {
      isMuted.value = true;
    } else if (isMuted.value) {
      isMuted.value = false;
    }
  }

  function toggleMute() {
    if (!videoElement.value) return;

    if (isMuted.value) {
      videoElement.value.muted = false;
      isMuted.value = false;
      volume.value = 1;
    } else {
      videoElement.value.muted = true;
      isMuted.value = true;
      volume.value = 0;
    }
  }

  function onTimeUpdate() {
    if (!videoElement.value) return;

    currentTime.value = videoElement.value.currentTime;

    const currentDuration = videoElement.value.duration;
    if (currentDuration && currentDuration !== duration.value && !isNaN(currentDuration)) {
      duration.value = currentDuration;
    }

    if (videoElement.value.buffered.length > 0) {
      buffered.value = videoElement.value.buffered.end(videoElement.value.buffered.length - 1);
    }
  }

  function onLoadedMetadata() {
    if (!videoElement.value) return;

    isVideoLoading.value = false;
    duration.value = videoElement.value.duration;

    videoElement.value.volume = volume.value;
    videoElement.value.muted = isMuted.value;

    videoElement.value.play();
    isPlaying.value = true;
  }

  function onVideoEnded() {
    isPlaying.value = false;
    currentTime.value = 0;
  }

  // Initialize video source when video changes
  async function initializeVideo() {
    if (!props.video) {
      videoSrc.value = null;
      return;
    }

    try {
      resetVideoState();

      const port = await invoke<number>('get_video_server_port');
      const encodedPath = btoa(props.video.file_path);
      // Add a timestamp to prevent caching issues
      const timestamp = Date.now();
      videoSrc.value = `http://localhost:${port}/video/${encodedPath}?t=${timestamp}`;
    } catch (err) {
      console.error('Failed to prepare video:', err);
    }
  }

  // Add a unique timestamp to force video recreation
  const videoKey = ref<string>('empty');

  function resetVideoState() {
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    isVideoLoading.value = true;
    hoverTime.value = null;
    hoverPosition.value = 0;
    videoSrc.value = null;
    // Generate a new key to force video element recreation
    videoKey.value = `video-${Date.now()}`;
  }

  // Watch for video changes
  watch(() => props.video, initializeVideo, { immediate: true });

  // Watch for dialog open/close to properly handle video state
  watch(
    () => props.showVideoPlayer,
    (newVal, oldVal) => {
      if (!newVal) {
        // Dialog is closing
        if (videoElement.value) {
          videoElement.value.pause();
          videoElement.value.currentTime = 0;
          // Clear the video source to ensure proper reload when reopened
          videoElement.value.src = '';
          videoElement.value.load();
        }
        resetVideoState();
      } else if (newVal && !oldVal && props.video) {
        // Dialog is opening, ensure video is initialized
        initializeVideo();
      }
    }
  );

  // Keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (!props.showVideoPlayer) return;

    switch (event.key) {
      case 'Escape':
        emit('close');
        break;
      case ' ':
        event.preventDefault();
        togglePlayPause();
        break;
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<style scoped>
  /* Custom range input styling */
  input[type='range'].slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  input[type='range'].slider::-webkit-slider-track {
    background: #374151;
    height: 6px;
    border-radius: 3px;
  }

  input[type='range'].slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    background: white;
    height: 14px;
    width: 14px;
    border-radius: 50%;
    margin-top: -5px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  input[type='range'].slider::-webkit-slider-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.1);
  }

  input[type='range'].slider::-moz-range-track {
    background: #374151;
    height: 6px;
    border-radius: 3px;
  }

  input[type='range'].slider::-moz-range-thumb {
    border: none;
    background: white;
    height: 14px;
    width: 14px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  input[type='range'].slider::-moz-range-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.1);
  }

  /* Timeline hover effects */
  .group:hover .group-hover\:opacity-100 {
    opacity: 1;
  }

  /* Video element styling */
  video {
    object-fit: contain;
  }

  /* Custom dialog styling improvements */
  .rounded-2xl {
    border-radius: 1rem;
  }

  /* Timeline seek thumb positioning fix */
  .group .absolute.top-1\/2 {
    top: 50%;
  }

  /* Center play overlay animation */
  .absolute.inset-0:hover {
    opacity: 1 !important;
  }

  /* Gradient backdrop effects */
  .backdrop-blur-md {
    backdrop-filter: blur(12px);
  }

  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Smooth transitions for controls */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }

  /* Loading indicator animation */
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
</style>
