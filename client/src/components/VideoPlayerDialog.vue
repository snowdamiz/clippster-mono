<template>
  <Transition name="modal">
    <div
      v-if="showVideoPlayer"
      class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50"
      @click.self="$emit('close')"
    >
      <Transition name="dialog" appear>
        <div
          class="bg-zinc-950 rounded-xl sm:rounded-2xl max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] mx-2 sm:mx-4 border border-white/10 overflow-hidden"
          :style="dialogStyle"
        >
          <!-- Custom Video Player -->
          <div v-if="videoSrc" class="relative w-full h-full flex flex-col">
            <!-- Video Title Header -->
            <div
              class="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-3 pt-4 sm:p-6 sm:pt-8"
            >
              <h3 class="text-white text-sm sm:text-base lg:text-lg font-semibold truncate pr-10 sm:pr-12">
                {{ getVideoTitle(video) }}
              </h3>
            </div>
            <!-- Close Button (Top Right) -->
            <button
              @click="$emit('close')"
              class="absolute top-3 right-3 sm:top-6 sm:right-6 z-30 p-2 sm:p-2.5 bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-sm rounded-lg sm:rounded-xl transition-all border border-white/10"
              title="Close"
            >
              <X class="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </button>
            <!-- Video Display (Dynamic Aspect Ratio) -->
            <div class="relative flex-1 flex items-center justify-center bg-black min-h-0 overflow-hidden">
              <video
                ref="videoElement"
                :key="videoKey"
                :src="videoSrc"
                class="max-w-full max-h-full"
                :style="{ aspectRatio: `${videoWidth}/${videoHeight}` }"
                @timeupdate="onTimeUpdate"
                @loadedmetadata="onLoadedMetadata"
                @ended="onVideoEnded"
              />
              <!-- Loading Indicator -->
              <div v-if="isVideoLoading" class="absolute inset-0 flex items-center justify-center bg-black/60">
                <div class="flex flex-col items-center gap-3 sm:gap-4">
                  <div
                    class="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-violet-500/20 flex items-center justify-center"
                  >
                    <Loader2 class="animate-spin h-6 w-6 sm:h-8 sm:w-8 text-violet-400" />
                  </div>
                  <span class="text-white text-xs sm:text-sm font-medium">Loading video...</span>
                </div>
              </div>
              <!-- Center Play/Pause Overlay -->
              <button
                v-if="!isVideoLoading"
                @click="togglePlayPause"
                class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30"
                title="Play/Pause"
              >
                <div
                  class="p-3 sm:p-5 bg-white/20 backdrop-blur-md rounded-xl sm:rounded-2xl hover:bg-white/30 transition-colors border border-white/20"
                >
                  <Play v-if="!isPlaying" class="h-7 w-7 sm:h-10 sm:w-10 text-white" />
                  <Pause v-else class="h-7 w-7 sm:h-10 sm:w-10 text-white" />
                </div>
              </button>
            </div>
            <!-- Custom Video Controls -->
            <div
              class="flex-shrink-0 bg-gradient-to-t from-zinc-950 to-zinc-900/90 backdrop-blur-xl border-t border-white/10"
            >
              <!-- Timeline/Seek Bar -->
              <div
                class="relative h-1.5 sm:h-2 cursor-pointer group mx-3 sm:mx-6 mt-3 sm:mt-5"
                @click="seekTo($event)"
                @mousemove="onTimelineHover($event)"
                @mouseleave="hoverTime = null"
              >
                <!-- Background track -->
                <div class="absolute inset-0 bg-zinc-800 rounded-full"></div>
                <!-- Buffered segments indicator -->
                <div
                  class="absolute h-full bg-violet-500/30 rounded-full transition-all duration-300"
                  :style="{ width: `${duration ? (buffered / duration) * 100 : 0}%` }"
                ></div>
                <!-- Progress Bar -->
                <div
                  class="absolute h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-100"
                  :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
                ></div>
                <!-- Seek thumb -->
                <div
                  class="absolute top-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 border-2 border-violet-500"
                  :style="{
                    left: `${duration ? (currentTime / duration) * 100 : 0}%`,
                    transform: 'translate(-50%, -50%)',
                  }"
                ></div>
                <!-- Hover time preview -->
                <div
                  v-if="hoverTime !== null"
                  class="absolute -top-12 bg-zinc-900 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg font-medium border border-zinc-800"
                  :style="{ left: `${hoverPosition}%`, transform: 'translateX(-50%)' }"
                >
                  {{ formatDuration(hoverTime) }}
                  <div
                    class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-zinc-900 border-r border-b border-zinc-800"
                  ></div>
                </div>
              </div>
              <!-- Control Buttons and Time Display -->
              <div class="flex items-center justify-between p-5 pb-6">
                <!-- Left Controls -->
                <div class="flex items-center gap-4">
                  <!-- Play/Pause Button -->
                  <button
                    @click="togglePlayPause"
                    class="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all duration-200 border border-zinc-700"
                    title="Play/Pause"
                  >
                    <Play v-if="!isPlaying" class="h-5 w-5 text-white" />
                    <Pause v-else class="h-5 w-5 text-white" />
                  </button>
                  <!-- Time Display -->
                  <div
                    class="text-white text-sm font-mono font-medium bg-zinc-800/80 px-4 py-2.5 rounded-xl border border-zinc-700"
                  >
                    {{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}
                  </div>
                </div>
                <!-- Right Controls -->
                <div class="flex items-center gap-4">
                  <!-- Volume Control -->
                  <div class="flex items-center gap-3">
                    <button
                      @click="toggleMute"
                      class="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all duration-200 border border-zinc-700"
                      title="Mute/Unmute"
                    >
                      <VolumeX v-if="isMuted || volume === 0" class="h-4 w-4 text-white" />
                      <Volume2 v-else class="h-4 w-4 text-white" />
                    </button>
                    <div class="relative w-24 h-1.5 bg-zinc-800 rounded-full">
                      <div
                        class="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-200"
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
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
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
  const videoWidth = ref(16);
  const videoHeight = ref(9);

  // Compute dialog style based on video aspect ratio
  const dialogStyle = computed(() => {
    const aspectRatio = videoWidth.value / videoHeight.value;

    // For portrait videos (aspect ratio < 1), use narrower dialog with explicit height
    // For landscape videos, use wider dialog
    if (aspectRatio < 0.8) {
      // Portrait (9:16, 4:5, etc.) - use near-full viewport height and calculate width
      return {
        height: 'calc(100vh - 80px)',
        width: `calc((100vh - 80px) * ${aspectRatio})`,
        maxWidth: '90vw',
      };
    } else if (aspectRatio < 1.2) {
      // Square-ish (1:1, 4:3)
      return {
        width: '100%',
        maxWidth: '800px',
      };
    } else {
      // Landscape (16:9, 21:9)
      return {
        width: '100%',
        maxWidth: '1152px', // lg:max-w-6xl equivalent
      };
    }
  });

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

    // Capture the video's native dimensions for aspect ratio
    videoWidth.value = videoElement.value.videoWidth || 16;
    videoHeight.value = videoElement.value.videoHeight || 9;

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
    // Reset to default 16:9 aspect ratio
    videoWidth.value = 16;
    videoHeight.value = 9;
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
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Custom range input styling */
  input[type='range'].slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  input[type='range'].slider::-webkit-slider-track {
    background: transparent;
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
  }

  input[type='range'].slider::-webkit-slider-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.1);
  }

  input[type='range'].slider::-moz-range-track {
    background: transparent;
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
  }

  input[type='range'].slider::-moz-range-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.1);
  }

  /* Video element styling */
  video {
    object-fit: contain;
  }
</style>
