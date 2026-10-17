<template>
  <Modal
    :open="showVideoPlayer"
    flush
    hide-close
    class="w-auto max-w-[calc(100vw-2rem)] overflow-hidden"
    @close="$emit('close')"
  >
    <template #header>
      <header class="flex shrink-0 items-center gap-3 border-b border-line-subtle px-4 py-2.5">
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-semibold text-fg">{{ displayTitle }}</h3>
          <!-- Clip metadata (only in clip preview mode) -->
          <div v-if="isClipPreviewMode" class="mt-0.5 flex min-w-0 items-center gap-3 text-xs text-fg-muted">
            <span v-if="clipSegmentName" class="flex min-w-0 items-center gap-1.5">
              <FolderOpen class="size-3 shrink-0" />
              <span class="truncate">{{ clipSegmentName }}</span>
            </span>
            <span class="tabular flex shrink-0 items-center gap-1.5">
              <Clock class="size-3" />
              {{ formatDuration(effectiveStartTime) }} – {{ formatDuration(effectiveEndTime) }}
              <span class="text-fg-subtle">({{ formatClipDurationLabel(effectiveEndTime - effectiveStartTime) }})</span>
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" title="Close" aria-label="Close" @click="$emit('close')">
          <X />
        </Button>
      </header>
    </template>

    <div class="flex flex-col" :style="playerLayout.box">
      <template v-if="videoSrc">
        <!-- Video Display (Dynamic Aspect Ratio) -->
        <div
          class="relative flex w-full items-center justify-center overflow-hidden bg-black"
          :style="playerLayout.video"
        >
          <video
            ref="videoElement"
            :key="videoKey"
            :src="videoSrc"
            class="max-h-full max-w-full object-contain"
            :style="{ aspectRatio: `${videoWidth}/${videoHeight}` }"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @ended="onVideoEnded"
          />

          <!-- Watermark Overlay -->
          <div
            v-if="shouldShowWatermark"
            class="pointer-events-none absolute z-10 transition-opacity duration-300"
            :style="getWatermarkOverlayStyle"
          >
            <img
              :src="watermarkDataUrl ?? undefined"
              alt="Watermark"
              class="max-h-full max-w-full object-contain"
              :style="{ opacity: getWatermarkOpacity }"
              @load="onWatermarkLoad"
            />
          </div>

          <!-- Loading Indicator -->
          <div v-if="isVideoLoading" class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 class="size-6 animate-spin text-white/80" />
            <span class="text-xs font-medium text-white/80">Loading video…</span>
          </div>

          <!-- Center Play/Pause Overlay -->
          <button
            v-if="!isVideoLoading && !showReplayButton"
            type="button"
            class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100"
            :title="isPlaying ? 'Pause' : 'Play'"
            @click="togglePlayPause"
          >
            <span class="grid size-14 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
              <Play v-if="!isPlaying" class="size-6 translate-x-px" />
              <Pause v-else class="size-6" />
            </span>
          </button>

          <!-- Replay Button (shown when clip ends in clip preview mode) -->
          <Transition name="fade">
            <button
              v-if="showReplayButton && isClipPreviewMode"
              type="button"
              class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white"
              title="Replay"
              @click="replayClip"
            >
              <span class="grid size-14 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                <RotateCcw class="size-6" />
              </span>
              <span class="text-sm font-medium">Replay</span>
            </button>
          </Transition>
        </div>

        <!-- Custom Video Controls -->
        <div class="relative shrink-0 bg-surface-raised">
          <!-- Full-width Timeline/Seek Bar -->
          <div
            ref="timelineRef"
            class="group relative flex h-4 w-full cursor-pointer items-center"
            @mousedown="startDrag($event)"
            @mousemove="onTimelineHover($event)"
            @mouseleave="onTimelineLeave"
          >
            <div class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2">
              <div class="absolute inset-0 bg-white/15" />
              <!-- Buffered segments indicator (only in non-clip mode) -->
              <div
                v-if="!isClipPreviewMode"
                class="absolute h-full bg-white/20 transition-all duration-300"
                :style="{ width: `${duration ? (buffered / duration) * 100 : 0}%` }"
              />
              <!-- Progress Bar -->
              <div
                class="absolute h-full bg-brand"
                :class="{ 'transition-all duration-75': !isDragging }"
                :style="{ width: `${progressPercent}%` }"
              />
            </div>
            <!-- Seek thumb -->
            <div
              class="pointer-events-none absolute top-1/2 rounded-full bg-white shadow-[var(--shadow-sm)]"
              :class="[isDragging ? 'size-3.5' : 'size-2.5 group-hover:size-3', { 'transition-all duration-75': !isDragging }]"
              :style="{ left: `${progressPercent}%`, transform: 'translate(-50%, -50%)' }"
            />
            <!-- Hover/drag time preview -->
            <div
              v-if="hoverTime !== null || isDragging"
              class="tabular pointer-events-none absolute -top-7 z-20 whitespace-nowrap rounded-md bg-surface-raised px-1.5 py-0.5 text-2xs font-medium text-fg shadow-[var(--shadow-md)]"
              :style="{ left: `${isDragging ? progressPercent : hoverPosition}%`, transform: 'translateX(-50%)' }"
            >
              {{ formatDuration(isDragging ? (progressPercent / 100) * duration : (hoverTime ?? 0)) }}
            </div>
          </div>

          <!-- Control Buttons and Time Display -->
          <div class="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1">
            <div class="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" :title="isPlaying ? 'Pause' : 'Play'" @click="togglePlayPause">
                <Play v-if="!isPlaying" />
                <Pause v-else />
              </Button>
              <span class="tabular whitespace-nowrap text-xs text-fg-muted">
                <span class="text-fg">{{ formatDuration(displayCurrentTime) }}</span>
                / {{ formatDuration(displayDuration) }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" :title="isMuted ? 'Unmute' : 'Mute'" @click="toggleMute">
                <VolumeX v-if="isMuted || volume === 0" />
                <Volume2 v-else />
              </Button>
              <div class="relative mr-1 h-1 w-20 rounded-full bg-white/15">
                <div
                  class="absolute left-0 top-0 h-full rounded-full bg-fg transition-all duration-200"
                  :style="{ width: `${volume * 100}%` }"
                />
                <input
                  v-model="volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="volume-slider absolute inset-0 z-10 h-full w-full cursor-pointer"
                  aria-label="Volume"
                  @input="updateVolume"
                />
              </div>
              <!-- Replay Button (only in clip preview mode) -->
              <Button v-if="isClipPreviewMode" variant="ghost" size="icon-sm" title="Replay clip" @click="replayClip">
                <RotateCcw />
              </Button>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="grid place-items-center bg-black" :style="playerLayout.video">
        <Loader2 class="size-6 animate-spin text-white/60" />
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import { invoke } from '@/services/creatorProfileRuntime';
  import Hls from 'hls.js';
  import type { RawVideo, IntroOutro } from '@/services/database/types';
  import { X, Loader2, Play, Pause, VolumeX, Volume2, RotateCcw, FolderOpen, Clock } from 'lucide-vue-next';
  import { utf8ToBase64Url } from '@/utils/encoding';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';

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
    /** Optional: Watermark settings for preview */
    watermarkSettings?: any | null;
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
    watermarkSettings: null,
  });
  const emit = defineEmits<Emits>();

  // Computed: Detect clip preview mode
  const isClipPreviewMode = computed(() => {
    return props.clipStartTime !== null && props.clipEndTime !== null;
  });

  // Note: `zIndex` is kept for API compatibility; stacking is handled by <Modal>.

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

  // HLS.js instance for proper MPEG-TS (.ts) file playback with A/V sync
  let hlsInstance: Hls | null = null;

  // Check if a URL is an HLS playlist
  function isHlsUrl(url: string | null | undefined): boolean {
    return !!url && url.includes('.m3u8');
  }

  // Cleanup HLS instance
  function cleanupHls(): void {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
  }

  // Setup HLS playback for a video element
  function setupHlsPlayback(videoEl: HTMLVideoElement, hlsUrl: string): void {
    cleanupHls();

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(videoEl);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayerDialog] HLS manifest parsed, ready to play');
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[VideoPlayerDialog] HLS fatal error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[VideoPlayerDialog] Attempting to recover from network error');
              hlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[VideoPlayerDialog] Attempting to recover from media error');
              hlsInstance?.recoverMediaError();
              break;
            default:
              cleanupHls();
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoEl.src = hlsUrl;
    } else {
      console.error('[VideoPlayerDialog] HLS not supported in this browser');
    }
  }

  // Helper function to construct video URL with proper endpoint for file type
  function constructVideoUrl(filePath: string, port: number): string {
    const encodedPath = utf8ToBase64Url(filePath);

    // Check if this is a .ts file - browsers can't play MPEG-TS natively
    const isTsFile = filePath.toLowerCase().endsWith('.ts');

    if (isTsFile) {
      // Use ts-hls endpoint which wraps the .ts file in an HLS playlist
      return `http://localhost:${port}/ts-hls/${encodedPath}/playlist.m3u8`;
    }

    // Regular video file - serve directly
    return `http://localhost:${port}/video/${encodedPath}`;
  }

  // Watermark state
  const watermarkDataUrl = ref<string | null>(null);
  const watermarkDimensions = ref<{ width: number; height: number } | null>(null);
  const localWatermarkDimensions = ref<{ width: number; height: number } | null>(null);

  function onWatermarkLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      localWatermarkDimensions.value = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }
  }

  // Normalize aspect ratio for settings lookup
  const normalizedAspectRatio = computed(() => {
    const w = videoWidth.value;
    const h = videoHeight.value;
    if (!w || !h) return '16:9';

    const ratio = w / h;
    if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(ratio - 9 / 16) < 0.01) return '9:16';
    if (Math.abs(ratio - 1) < 0.01) return '1:1';
    if (Math.abs(ratio - 4 / 5) < 0.01) return '4:5';

    return `${w}:${h}`;
  });

  // Load watermark when settings or aspect ratio change
  watch(
    [() => props.watermarkSettings, normalizedAspectRatio],
    async ([settings, aspectRatio]) => {
      if (!settings || !settings.enabled) {
        watermarkDataUrl.value = null;
        watermarkDimensions.value = null;
        localWatermarkDimensions.value = null;
        return;
      }

      // Determine correct watermark ID based on aspect ratio
      let targetWatermarkId = settings.watermarkId;
      const perRatio = settings.perRatioSettings;

      if (perRatio && aspectRatio && perRatio[aspectRatio]) {
        const ratioConfig = perRatio[aspectRatio];
        if (ratioConfig && ratioConfig.watermarkId) {
          targetWatermarkId = ratioConfig.watermarkId;
        }
      }

      if (!targetWatermarkId) {
        watermarkDataUrl.value = null;
        watermarkDimensions.value = null;
        localWatermarkDimensions.value = null;
        return;
      }

      try {
        const { getWatermarkImage } = await import('@/services/creatorProfileRuntime');

        const watermark = await getWatermarkImage(targetWatermarkId);
        if (watermark) {
          const dataUrl = /^https?:|^data:|^\/(?:workspace\/)?api\/web\//.test(watermark.file_path) ? watermark.file_path : await invoke<string>('read_file_as_data_url', {
            filePath: watermark.file_path,
          });
          watermarkDataUrl.value = dataUrl;
          watermarkDimensions.value = {
            width: watermark.width || 0,
            height: watermark.height || 0,
          };
          // Reset local dimensions, will be set on load
          localWatermarkDimensions.value = null;
        }
      } catch (error) {
        console.error('[VideoPlayerDialog] Failed to load watermark:', error);
        watermarkDataUrl.value = null;
        watermarkDimensions.value = null;
        localWatermarkDimensions.value = null;
      }
    },
    { immediate: true }
  );

  // Determine if watermark should show
  const shouldShowWatermark = computed(() => {
    if (!props.watermarkSettings?.enabled) return false;
    if (!watermarkDataUrl.value) return false;

    // Check if this aspect ratio has watermark disabled in per-ratio settings
    const aspectRatioStr = normalizedAspectRatio.value;
    const perRatio = props.watermarkSettings.perRatioSettings;
    if (perRatio) {
      if (aspectRatioStr in perRatio && perRatio[aspectRatioStr] === null) {
        return false;
      }
    }
    return true;
  });

  // Get watermark opacity (using per-ratio settings if available)
  const getWatermarkOpacity = computed(() => {
    if (!props.watermarkSettings) return 0.8;

    const aspectRatioStr = normalizedAspectRatio.value;
    const perRatio = props.watermarkSettings.perRatioSettings;
    if (perRatio && perRatio[aspectRatioStr]) {
      const config = perRatio[aspectRatioStr];
      return (config.position?.opacity ?? props.watermarkSettings.opacity ?? 80) / 100;
    }

    return (props.watermarkSettings.opacity ?? 80) / 100;
  });

  // Get watermark overlay style (position and size)
  const getWatermarkOverlayStyle = computed(() => {
    if (!props.watermarkSettings) return {};

    const settings = props.watermarkSettings;
    const wmWidth = localWatermarkDimensions.value?.width ?? watermarkDimensions.value?.width ?? null;
    const wmHeight = localWatermarkDimensions.value?.height ?? watermarkDimensions.value?.height ?? null;
    const ratio = wmWidth && wmHeight ? wmWidth / wmHeight : null;
    const is16x9 = ratio ? Math.abs(ratio - 16 / 9) < 0.02 : false;

    // Check if this is a full-frame watermark
    // We check against both native 16:9 resolution and normalized aspect ratio
    const isFullFrame =
      is16x9 &&
      wmWidth !== null &&
      wmHeight !== null &&
      wmWidth >= 1600 &&
      wmHeight >= 900 &&
      normalizedAspectRatio.value === '16:9';

    // Full-frame watermarks fill the frame
    if (isFullFrame) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Get position from per-ratio settings or fall back to default
    let positionX = settings.positionX ?? 12;
    let positionY = settings.positionY ?? 92;
    let scale = settings.scale ?? 20;

    const aspectRatioStr = normalizedAspectRatio.value;
    const perRatio = settings.perRatioSettings;
    if (perRatio && perRatio[aspectRatioStr]) {
      const config = perRatio[aspectRatioStr];
      if (config.position) {
        positionX = config.position.x ?? positionX;
        positionY = config.position.y ?? positionY;
        scale = config.position.scale ?? scale;
      }
    }

    return {
      left: `${positionX}%`,
      top: `${positionY}%`,
      transform: 'translate(-50%, -50%)',
      width: `${scale}%`,
    };
  });

  // Size the player to the video's aspect ratio so it fits the window without
  // scrolling: `box` sets the width, `video` the height of the video area.
  const PLAYER_CHROME = '8.5rem'; // header + controls
  const playerLayout = computed(() => {
    const ratio = videoWidth.value / videoHeight.value || 16 / 9;
    // Portrait: use the height; square-ish: cap at 800px; landscape: cap at 1152px
    const cap = ratio < 0.8 ? '90vw' : ratio < 1.2 ? '800px' : '1152px';
    const maxWidth = `min(${cap}, calc(100vw - 2rem))`;
    const maxVideoHeight = `calc(100vh - 3rem - ${PLAYER_CHROME})`;
    return {
      box: { width: `max(min(360px, ${maxWidth}), min(${maxWidth}, calc(${maxVideoHeight} * ${ratio})))` },
      video: { height: `min(${maxVideoHeight}, calc(${maxWidth} / ${ratio}))` },
    };
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
    // Cleanup any existing HLS instance
    cleanupHls();

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

      const port = await invoke<number>('get_video_server_port', {});
      // Use constructVideoUrl to properly handle .ts files with HLS wrapper
      const timestamp = Date.now();
      const baseUrl = constructVideoUrl(filePath, port);
      // Add timestamp to prevent caching (append with ? or & depending on URL)
      videoSrc.value = baseUrl.includes('?') ? `${baseUrl}&t=${timestamp}` : `${baseUrl}?t=${timestamp}`;
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

  // Watch for video source changes to setup HLS if needed
  watch(
    () => videoSrc.value,
    (newSrc, oldSrc) => {
      if (newSrc && newSrc !== oldSrc && videoElement.value && isHlsUrl(newSrc)) {
        setupHlsPlayback(videoElement.value, newSrc);
      } else if (!isHlsUrl(newSrc)) {
        // Not HLS - cleanup any existing instance
        cleanupHls();
      }
    }
  );

  // Watch for video element becoming available to setup HLS if source is already set
  watch(videoElement, (newElement) => {
    if (newElement && videoSrc.value && isHlsUrl(videoSrc.value)) {
      setupHlsPlayback(newElement, videoSrc.value);
    }
  });

  // Watch for dialog open/close to properly handle video state
  watch(
    () => props.showVideoPlayer,
    (newVal, oldVal) => {
      if (!newVal) {
        // Dialog is closing
        cleanupHls();
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

    // Escape is handled by <Modal>, which emits `close`.
    switch (event.key) {
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
    // Cleanup HLS instance
    cleanupHls();
  });
</script>

<style scoped>
  /* Fade transition for the replay overlay */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  /* Native range input drawn invisibly over the custom volume track */
  .volume-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }

  .volume-slider::-webkit-slider-runnable-track {
    background: transparent;
    height: 4px;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border-radius: 9999px;
    background: var(--fg);
    box-shadow: var(--shadow-sm);
  }

  .volume-slider::-moz-range-track {
    background: transparent;
    height: 4px;
  }

  .volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 9999px;
    background: var(--fg);
  }
</style>
