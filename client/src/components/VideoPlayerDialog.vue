<template>
  <Transition name="modal">
    <div
      v-if="showVideoPlayer"
      class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50"
      :class="zIndexClass"
      @click.self="$emit('close')"
    >
      <Transition name="dialog" appear>
        <div
          class="bg-zinc-950 rounded-xl sm:rounded-2xl max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] mx-2 sm:mx-4 border border-white/10 overflow-hidden flex flex-col"
          :style="dialogStyle"
        >
          <!-- Custom Video Player -->
          <div v-if="videoSrc" class="relative w-full flex-1 min-h-0 flex flex-col">
            <!-- Video Title Header -->
            <div
              class="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-3 pt-4 sm:p-5 sm:pt-6"
            >
              <h3 class="text-white text-sm sm:text-base lg:text-lg font-semibold truncate pr-10 sm:pr-12">
                {{ displayTitle }}
              </h3>
              <!-- Clip metadata (only in clip preview mode) -->
              <div v-if="isClipPreviewMode" class="flex items-center gap-3 mt-1.5 text-xs text-white/60">
                <span v-if="clipSegmentName" class="flex items-center gap-1.5">
                  <FolderOpen class="h-3 w-3" />
                  {{ clipSegmentName }}
                </span>
                <span class="flex items-center gap-1.5">
                  <Clock class="h-3 w-3" />
                  {{ formatDuration(effectiveStartTime) }} - {{ formatDuration(effectiveEndTime) }}
                </span>
                <span class="text-white/40">
                  ({{ formatClipDurationLabel(effectiveEndTime - effectiveStartTime) }})
                </span>
              </div>
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
                v-if="!isVideoLoading && !showReplayButton"
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
              <!-- Replay Button (shown when clip ends in clip preview mode) -->
              <Transition name="fade">
                <button
                  v-if="showReplayButton && isClipPreviewMode"
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
            <div class="flex-shrink-0 bg-black/60 backdrop-blur-sm">
              <!-- Full-width Timeline/Seek Bar -->
              <div
                ref="timelineRef"
                class="relative h-4 w-full cursor-pointer group flex items-center"
                @mousedown="startDrag($event)"
                @mousemove="onTimelineHover($event)"
                @mouseleave="onTimelineLeave"
              >
                <!-- Visual track (centered in larger hit area) -->
                <div class="absolute inset-x-0 h-1 top-1/2 -translate-y-1/2">
                  <!-- Background track -->
                  <div class="absolute inset-0 bg-white/20"></div>
                  <!-- Buffered segments indicator (only in non-clip mode) -->
                  <div
                    v-if="!isClipPreviewMode"
                    class="absolute h-full bg-violet-500/30 transition-all duration-300"
                    :style="{ width: `${duration ? (buffered / duration) * 100 : 0}%` }"
                  ></div>
                  <!-- Progress Bar -->
                  <div
                    class="absolute h-full bg-violet-500"
                    :class="{ 'transition-all duration-75': !isDragging }"
                    :style="{ width: `${progressPercent}%` }"
                  ></div>
                </div>
                <!-- Seek thumb - always visible, larger during drag -->
                <div
                  class="absolute top-1/2 bg-violet-400 rounded-full shadow-md pointer-events-none"
                  :class="[isDragging ? 'w-4 h-4' : 'w-3 h-3', { 'transition-all duration-75': !isDragging }]"
                  :style="{
                    left: `${progressPercent}%`,
                    transform: 'translate(-50%, -50%)',
                  }"
                ></div>
                <!-- Hover/drag time preview -->
                <div
                  v-if="hoverTime !== null || isDragging"
                  class="absolute -top-8 bg-black/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium whitespace-nowrap z-20 pointer-events-none"
                  :style="{ left: `${isDragging ? progressPercent : hoverPosition}%`, transform: 'translateX(-50%)' }"
                >
                  {{ formatDuration(isDragging ? (progressPercent / 100) * duration : (hoverTime ?? 0)) }}
                </div>
              </div>
              <!-- Control Buttons and Time Display -->
              <div class="flex items-center justify-between px-4 py-3">
                <!-- Left Controls -->
                <div class="flex items-center gap-4">
                  <!-- Play/Pause Button -->
                  <button
                    @click="togglePlayPause"
                    class="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all duration-200 border border-zinc-700"
                    :title="isPlaying ? 'Pause' : 'Play'"
                  >
                    <Play v-if="!isPlaying" class="h-5 w-5 text-white" />
                    <Pause v-else class="h-5 w-5 text-white" />
                  </button>
                  <!-- Time Display -->
                  <div
                    class="text-white text-sm font-mono font-medium bg-zinc-800/80 px-4 py-2.5 rounded-xl border border-zinc-700"
                  >
                    {{ formatDuration(displayCurrentTime) }} / {{ formatDuration(displayDuration) }}
                  </div>
                </div>
                <!-- Right Controls -->
                <div class="flex items-center gap-4">
                  <!-- Volume Control -->
                  <div class="flex items-center gap-3">
                    <button
                      @click="toggleMute"
                      class="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all duration-200 border border-zinc-700"
                      :title="isMuted ? 'Unmute' : 'Mute'"
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
                  <!-- Replay Button (only in clip preview mode) -->
                  <button
                    v-if="isClipPreviewMode"
                    @click="replayClip"
                    class="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-all duration-200 border border-zinc-700"
                    title="Replay clip"
                  >
                    <RotateCcw class="h-4 w-4 text-white" />
                  </button>
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
  import { X, Loader2, Play, Pause, VolumeX, Volume2, RotateCcw, FolderOpen, Clock } from 'lucide-vue-next';
  import { utf8ToBase64 } from '@/utils/encoding';

  type VideoLike = RawVideo | IntroOutro;

  interface Props {
    video: VideoLike | null;
    showVideoPlayer: boolean;
    /** Optional: Video file path for clip preview mode (when video prop is not provided) */
    videoFilePath?: string | null;
    /** Optional: Direct video URL (bypasses local video server - for cloud/remote videos) */
    videoUrl?: string | null;
    /** Optional: Video title to display when using videoUrl */
    videoTitle?: string | null;
    /** Optional: Clip start time in seconds (enables clip preview mode) */
    clipStartTime?: number | null;
    /** Optional: Clip end time in seconds (enables clip preview mode) */
    clipEndTime?: number | null;
    /** Optional: Clip name/title for clip preview mode */
    clipName?: string | null;
    /** Optional: Segment name for clip preview mode */
    clipSegmentName?: string | null;
    /** Optional: Higher z-index for nested dialogs */
    zIndex?: number;
  }

  interface Emits {
    (e: 'close'): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    videoFilePath: null,
    videoUrl: null,
    videoTitle: null,
    clipStartTime: null,
    clipEndTime: null,
    clipName: null,
    clipSegmentName: null,
    zIndex: 50,
  });
  const emit = defineEmits<Emits>();

  // Computed: Detect clip preview mode
  const isClipPreviewMode = computed(() => {
    return props.clipStartTime !== null && props.clipEndTime !== null;
  });

  // Computed: z-index class
  const zIndexClass = computed(() => {
    return props.zIndex === 60 ? 'z-[60]' : 'z-50';
  });

  // Computed: Effective start/end times
  const effectiveStartTime = computed(() => props.clipStartTime ?? 0);
  const effectiveEndTime = computed(() => props.clipEndTime ?? duration.value);

  // Computed: Display title (uses clipName in clip mode, videoTitle prop, or video title)
  const displayTitle = computed(() => {
    if (isClipPreviewMode.value && props.clipName) {
      return props.clipName;
    }
    if (props.videoTitle) {
      return props.videoTitle;
    }
    return getVideoTitle(props.video);
  });

  // Computed: Display current time (relative to clip start in clip mode)
  const displayCurrentTime = computed(() => {
    if (isClipPreviewMode.value) {
      return Math.max(0, currentTime.value - effectiveStartTime.value);
    }
    return currentTime.value;
  });

  // Computed: Display duration (clip duration in clip mode, full duration otherwise)
  const displayDuration = computed(() => {
    if (isClipPreviewMode.value) {
      return effectiveEndTime.value - effectiveStartTime.value;
    }
    return duration.value;
  });

  // Computed: Progress percentage (adjusted for clip mode, use drag position while dragging)
  const progressPercent = computed(() => {
    if (isDragging.value) return dragPercent.value;
    if (isClipPreviewMode.value) {
      const clipDuration = effectiveEndTime.value - effectiveStartTime.value;
      if (clipDuration <= 0) return 0;
      const progress = ((currentTime.value - effectiveStartTime.value) / clipDuration) * 100;
      return Math.min(100, Math.max(0, progress));
    }
    return duration.value ? (currentTime.value / duration.value) * 100 : 0;
  });

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
  const timelineRef = ref<HTMLElement | null>(null);
  const isDragging = ref(false);
  const dragPercent = ref(0);
  const videoWidth = ref(16);
  const videoHeight = ref(9);
  const showReplayButton = ref(false);

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
      // Square-ish (1:1, 4:3) - constrain height to ensure controls fit
      // Account for ~120px of controls/header space
      return {
        width: '100%',
        maxWidth: '800px',
        maxHeight: 'calc(100vh - 80px)',
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

  // Helper function to format clip duration as label (e.g. "30s", "1m 30s")
  function formatClipDurationLabel(seconds: number): string {
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
      // In clip preview mode, restart from beginning if at or past end
      if (isClipPreviewMode.value && currentTime.value >= effectiveEndTime.value - 0.1) {
        videoElement.value.currentTime = effectiveStartTime.value;
      }
      videoElement.value.play();
      isPlaying.value = true;
    } else {
      videoElement.value.pause();
      isPlaying.value = false;
    }
  }

  // Replay clip (for clip preview mode)
  function replayClip() {
    if (!videoElement.value) return;

    showReplayButton.value = false;
    videoElement.value.currentTime = effectiveStartTime.value;
    videoElement.value.play();
    isPlaying.value = true;
  }

  // Calculate percent from mouse position on timeline
  function getPercentFromEvent(event: MouseEvent): number {
    if (!timelineRef.value) return 0;
    const rect = timelineRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  }

  // Seek video to a specific percent
  function seekToPercent(percent: number) {
    if (!videoElement.value) return;

    let seekTime: number;
    if (isClipPreviewMode.value) {
      // Map percent to time within clip range
      const clipDuration = effectiveEndTime.value - effectiveStartTime.value;
      seekTime = effectiveStartTime.value + (percent / 100) * clipDuration;
    } else {
      const videoDuration = videoElement.value.duration || duration.value;
      if (!videoDuration || isNaN(videoDuration)) return;
      seekTime = (percent / 100) * videoDuration;
    }

    videoElement.value.currentTime = seekTime;
    currentTime.value = seekTime;
    showReplayButton.value = false;
  }

  // Start dragging
  function startDrag(event: MouseEvent) {
    if (!videoElement.value) return;

    isDragging.value = true;
    dragPercent.value = getPercentFromEvent(event);
    seekToPercent(dragPercent.value);

    // Add document-level listeners for drag
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);

    event.preventDefault();
  }

  // Handle drag movement
  function onDrag(event: MouseEvent) {
    if (!isDragging.value) return;
    dragPercent.value = getPercentFromEvent(event);
    seekToPercent(dragPercent.value);
  }

  // Stop dragging
  function stopDrag() {
    if (!isDragging.value) return;
    isDragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  function onTimelineHover(event: MouseEvent) {
    if (isDragging.value) return; // Don't update hover during drag

    const percent = getPercentFromEvent(event);

    let hoverTimeSeconds: number;
    if (isClipPreviewMode.value) {
      // Show time relative to clip start
      const clipDuration = effectiveEndTime.value - effectiveStartTime.value;
      hoverTimeSeconds = (percent / 100) * clipDuration;
    } else {
      const videoDuration = videoElement.value?.duration || duration.value;
      if (!videoDuration || isNaN(videoDuration)) return;
      hoverTimeSeconds = (percent / 100) * videoDuration;
    }

    hoverPosition.value = percent;
    hoverTime.value = hoverTimeSeconds;
  }

  // Clear hover state when leaving timeline
  function onTimelineLeave() {
    if (!isDragging.value) {
      hoverTime.value = null;
    }
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

    // In clip preview mode, stop at clip end time
    if (isClipPreviewMode.value && currentTime.value >= effectiveEndTime.value) {
      videoElement.value.pause();
      videoElement.value.currentTime = effectiveEndTime.value;
      isPlaying.value = false;
      showReplayButton.value = true;
    }
  }

  function onLoadedMetadata() {
    if (!videoElement.value) return;

    isVideoLoading.value = false;
    duration.value = videoElement.value.duration;

    // Capture the video's native dimensions for aspect ratio
    videoWidth.value = videoElement.value.videoWidth || 16;
    videoHeight.value = videoElement.value.videoHeight || 9;

    // In clip preview mode, seek to clip start time
    if (isClipPreviewMode.value) {
      videoElement.value.currentTime = effectiveStartTime.value;
      currentTime.value = effectiveStartTime.value;
    }

    videoElement.value.volume = volume.value;
    videoElement.value.muted = isMuted.value;

    videoElement.value.play();
    isPlaying.value = true;
  }

  function onVideoEnded() {
    isPlaying.value = false;
    if (isClipPreviewMode.value) {
      showReplayButton.value = true;
    } else {
      currentTime.value = 0;
    }
  }

  // Initialize video source when video changes
  async function initializeVideo() {
    // If a direct videoUrl is provided, use it directly (for cloud/remote videos)
    if (props.videoUrl) {
      resetVideoState();
      videoSrc.value = props.videoUrl;
      return;
    }

    // Determine the file path from either video prop or videoFilePath prop
    const filePath = props.video?.file_path || props.videoFilePath;

    if (!filePath) {
      videoSrc.value = null;
      return;
    }

    try {
      resetVideoState();

      const port = await invoke<number>('get_video_server_port');
      // Use utf8ToBase64 to handle Unicode characters (like emojis) in file paths
      const encodedPath = utf8ToBase64(filePath);
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
    showReplayButton.value = false;
    // Reset to default 16:9 aspect ratio
    videoWidth.value = 16;
    videoHeight.value = 9;
    // Generate a new key to force video element recreation
    videoKey.value = `video-${Date.now()}`;
  }

  // Watch for video changes (video prop, videoFilePath, or videoUrl)
  watch(() => [props.video, props.videoFilePath, props.videoUrl], initializeVideo, { immediate: true });

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
      } else if (newVal && !oldVal && (props.video || props.videoFilePath || props.videoUrl)) {
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
    // Cleanup drag listeners
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
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
