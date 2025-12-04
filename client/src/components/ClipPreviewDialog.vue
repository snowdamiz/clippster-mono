<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60]"
      @click.self="$emit('close')"
    >
      <Transition name="dialog" appear>
        <div
          class="bg-zinc-950 rounded-xl sm:rounded-2xl max-w-4xl lg:max-w-5xl max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] w-full mx-2 sm:mx-4 border border-white/10 overflow-hidden"
        >
          <!-- Custom Video Player -->
          <div v-if="videoSrc" class="relative w-full h-full flex flex-col">
            <!-- Video Title Header -->
            <div
              class="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-3 pt-4 sm:p-5 sm:pt-6"
            >
              <h3 class="text-white text-sm sm:text-base lg:text-lg font-semibold truncate pr-10 sm:pr-12">
                {{ clip?.current_version?.name || clip?.name || 'Untitled Clip' }}
              </h3>
              <div class="flex items-center gap-3 mt-1.5 text-xs text-white/60">
                <span class="flex items-center gap-1.5">
                  <FolderOpen class="h-3 w-3" />
                  {{ clip?.segment_name || 'Unknown Segment' }}
                </span>
                <span class="flex items-center gap-1.5">
                  <Clock class="h-3 w-3" />
                  {{ formatTime(clipStartTime) }} - {{ formatTime(clipEndTime) }}
                </span>
                <span class="text-white/40">
                  ({{ formatDuration(clipEndTime - clipStartTime) }})
                </span>
              </div>
            </div>

            <!-- Close Button (Top Right) -->
            <button
              @click="$emit('close')"
              class="absolute top-3 right-3 sm:top-5 sm:right-5 z-30 p-2 sm:p-2.5 bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-sm rounded-lg sm:rounded-xl transition-all border border-white/10"
              title="Close (Esc)"
            >
              <X class="h-4 w-4 sm:h-5 sm:w-5 text-white" />
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
              <div v-if="isVideoLoading" class="absolute inset-0 flex items-center justify-center bg-black/60">
                <div class="flex flex-col items-center gap-3 sm:gap-4">
                  <div
                    class="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-violet-500/20 flex items-center justify-center"
                  >
                    <Loader2 class="animate-spin h-6 w-6 sm:h-8 sm:w-8 text-violet-400" />
                  </div>
                  <span class="text-white text-xs sm:text-sm font-medium">Loading clip...</span>
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

              <!-- Replay Button (shown when clip ends) -->
              <Transition name="fade">
                <button
                  v-if="showReplayButton"
                  @click="replayClip"
                  class="absolute inset-0 flex items-center justify-center bg-black/50"
                  title="Replay"
                >
                  <div
                    class="p-4 sm:p-6 bg-violet-500/20 backdrop-blur-md rounded-2xl sm:rounded-3xl hover:bg-violet-500/30 transition-colors border border-violet-500/30 flex flex-col items-center gap-2"
                  >
                    <RotateCcw class="h-8 w-8 sm:h-12 sm:w-12 text-violet-400" />
                    <span class="text-white text-sm font-medium">Replay</span>
                  </div>
                </button>
              </Transition>
            </div>

            <!-- Custom Video Controls -->
            <div class="bg-gradient-to-t from-zinc-950 to-zinc-900/90 backdrop-blur-xl border-t border-white/10">
              <!-- Progress Bar -->
              <div class="px-3 sm:px-5 pt-3 sm:pt-4">
                <div
                  class="relative h-1.5 sm:h-2 bg-white/10 rounded-full cursor-pointer group"
                  @click="seekTo"
                  @mousemove="onTimelineHover"
                  @mouseleave="hoverTime = null"
                >
                  <!-- Progress -->
                  <div
                    class="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                    :style="{ width: `${progressPercent}%` }"
                  />

                  <!-- Hover Time Indicator -->
                  <div
                    v-if="hoverTime !== null"
                    class="absolute -top-8 transform -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
                    :style="{ left: `${hoverPosition}%` }"
                  >
                    {{ formatTime(hoverTime) }}
                  </div>

                  <!-- Scrubber -->
                  <div
                    class="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow-lg transition-transform group-hover:scale-110"
                    :style="{ left: `calc(${progressPercent}% - 6px)` }"
                  />
                </div>
              </div>

              <!-- Controls Row -->
              <div class="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3">
                <!-- Left: Play/Pause + Time -->
                <div class="flex items-center gap-3 sm:gap-4">
                  <button
                    @click="togglePlayPause"
                    class="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    :title="isPlaying ? 'Pause' : 'Play'"
                  >
                    <Play v-if="!isPlaying" class="h-5 w-5 text-white" />
                    <Pause v-else class="h-5 w-5 text-white" />
                  </button>

                  <div class="text-white text-xs sm:text-sm font-mono">
                    <span>{{ formatTime(displayCurrentTime) }}</span>
                    <span class="text-white/40 mx-1">/</span>
                    <span class="text-white/60">{{ formatTime(clipDuration) }}</span>
                  </div>
                </div>

                <!-- Right: Volume + Replay -->
                <div class="flex items-center gap-2">
                  <!-- Volume -->
                  <div class="flex items-center gap-2 group/volume">
                    <button
                      @click="toggleMute"
                      class="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      :title="isMuted ? 'Unmute' : 'Mute'"
                    >
                      <VolumeX v-if="isMuted || volume === 0" class="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      <Volume2 v-else class="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      v-model.number="volume"
                      @input="updateVolume"
                      class="w-16 sm:w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer opacity-0 group-hover/volume:opacity-100 transition-opacity slider"
                    />
                  </div>

                  <!-- Replay Button -->
                  <button
                    @click="replayClip"
                    class="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Replay clip"
                  >
                    <RotateCcw class="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="videoError" class="p-8 text-center">
            <div class="text-red-400 mb-2">Failed to load video</div>
            <p class="text-white/40 text-sm">{{ videoError }}</p>
            <button
              @click="$emit('close')"
              class="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-sm transition-colors"
            >
              Close
            </button>
          </div>

          <!-- Loading State (initial) -->
          <div v-else class="p-8 flex items-center justify-center aspect-video">
            <div class="flex flex-col items-center gap-3">
              <Loader2 class="animate-spin h-8 w-8 text-violet-400" />
              <span class="text-white/60 text-sm">Preparing video...</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { X, Loader2, Play, Pause, VolumeX, Volume2, RotateCcw, FolderOpen, Clock } from 'lucide-vue-next';
import { getRawVideosByProjectId } from '@/services/database';
import type { ClipWithVersionAndSegment } from '@/services/database';

interface Props {
  clip: ClipWithVersionAndSegment | null;
  show: boolean;
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
const volume = ref(1);
const isMuted = ref(false);
const isVideoLoading = ref(true);
const hoverTime = ref<number | null>(null);
const hoverPosition = ref(0);
const videoSrc = ref<string | null>(null);
const videoError = ref<string | null>(null);
const videoKey = ref<string>('empty');
const showReplayButton = ref(false);

// Clip timing
const clipStartTime = computed(() => props.clip?.current_version?.start_time || 0);
const clipEndTime = computed(() => props.clip?.current_version?.end_time || 0);
const clipDuration = computed(() => clipEndTime.value - clipStartTime.value);

// Display current time relative to clip start
const displayCurrentTime = computed(() => {
  return Math.max(0, currentTime.value - clipStartTime.value);
});

// Progress as percentage of clip duration
const progressPercent = computed(() => {
  if (clipDuration.value <= 0) return 0;
  const progress = (displayCurrentTime.value / clipDuration.value) * 100;
  return Math.min(100, Math.max(0, progress));
});

// Helper functions
function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// Video player methods
function togglePlayPause() {
  if (!videoElement.value) return;

  showReplayButton.value = false;

  if (videoElement.value.paused) {
    // If at or past end, restart from beginning
    if (currentTime.value >= clipEndTime.value - 0.1) {
      videoElement.value.currentTime = clipStartTime.value;
    }
    videoElement.value.play();
    isPlaying.value = true;
  } else {
    videoElement.value.pause();
    isPlaying.value = false;
  }
}

function replayClip() {
  if (!videoElement.value) return;

  showReplayButton.value = false;
  videoElement.value.currentTime = clipStartTime.value;
  videoElement.value.play();
  isPlaying.value = true;
}

function seekTo(event: MouseEvent) {
  if (!videoElement.value) return;

  const timeline = event.currentTarget as HTMLElement;
  const rect = timeline.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));

  // Map click position to time within clip
  const seekTime = clipStartTime.value + clickPercent * clipDuration.value;
  videoElement.value.currentTime = seekTime;
  currentTime.value = seekTime;
  showReplayButton.value = false;
}

function onTimelineHover(event: MouseEvent) {
  const timeline = event.currentTarget as HTMLElement;
  const rect = timeline.getBoundingClientRect();
  const hoverX = event.clientX - rect.left;
  const hoverPercent = Math.max(0, Math.min(1, hoverX / rect.width));

  // Show time relative to clip start
  hoverPosition.value = hoverPercent * 100;
  hoverTime.value = hoverPercent * clipDuration.value;
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
    isMuted.value = false;
    videoElement.value.muted = false;
    if (volume.value === 0) {
      volume.value = 0.5;
      videoElement.value.volume = 0.5;
    }
  } else {
    isMuted.value = true;
    videoElement.value.muted = true;
  }
}

function onTimeUpdate() {
  if (!videoElement.value) return;

  currentTime.value = videoElement.value.currentTime;

  // Stop at clip end time
  if (currentTime.value >= clipEndTime.value) {
    videoElement.value.pause();
    videoElement.value.currentTime = clipEndTime.value;
    isPlaying.value = false;
    showReplayButton.value = true;
  }
}

function onLoadedMetadata() {
  if (!videoElement.value) return;

  isVideoLoading.value = false;

  // Seek to clip start time
  videoElement.value.currentTime = clipStartTime.value;
  currentTime.value = clipStartTime.value;

  // Set volume
  videoElement.value.volume = volume.value;
  videoElement.value.muted = isMuted.value;

  // Auto-play
  videoElement.value.play();
  isPlaying.value = true;
}

function onVideoEnded() {
  isPlaying.value = false;
  showReplayButton.value = true;
}

// Initialize video source when clip changes
async function initializeVideo() {
  if (!props.clip) {
    videoSrc.value = null;
    return;
  }

  try {
    resetVideoState();
    videoError.value = null;

    // Get the raw video for this clip's segment
    const segmentId = props.clip.segment_id || props.clip.project_id;
    const rawVideos = await getRawVideosByProjectId(segmentId);

    if (rawVideos.length === 0) {
      videoError.value = 'No video found for this segment';
      return;
    }

    const rawVideo = rawVideos[0];
    const port = await invoke<number>('get_video_server_port');
    const encodedPath = btoa(rawVideo.file_path);
    const timestamp = Date.now();
    videoSrc.value = `http://localhost:${port}/video/${encodedPath}?t=${timestamp}`;
  } catch (err) {
    console.error('Failed to prepare video:', err);
    videoError.value = err instanceof Error ? err.message : 'Failed to load video';
  }
}

function resetVideoState() {
  isPlaying.value = false;
  currentTime.value = 0;
  isVideoLoading.value = true;
  hoverTime.value = null;
  hoverPosition.value = 0;
  videoSrc.value = null;
  showReplayButton.value = false;
  videoKey.value = `video-${Date.now()}`;
}

// Watch for clip changes
watch(() => props.clip, initializeVideo, { immediate: true });

// Watch for dialog open/close
watch(
  () => props.show,
  (newVal, oldVal) => {
    if (!newVal) {
      // Dialog is closing
      if (videoElement.value) {
        videoElement.value.pause();
        videoElement.value.currentTime = 0;
        videoElement.value.src = '';
        videoElement.value.load();
      }
      resetVideoState();
    } else if (newVal && !oldVal && props.clip) {
      // Dialog is opening
      initializeVideo();
    }
  }
);

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  if (!props.show) return;

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

/* Fade transition for replay button */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Custom range input styling */
input[type='range'].slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}

input[type='range'].slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  margin-top: -4px;
}

input[type='range'].slider::-webkit-slider-runnable-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

input[type='range'].slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

input[type='range'].slider::-moz-range-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}
</style>

