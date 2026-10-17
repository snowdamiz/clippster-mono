<template>
  <Modal
    :open="!hidden"
    title="Create clip"
    :description="`Select a range from the last ${formatTime(maxDuration)}`"
    :icon="Scissors"
    size="md"
    :dismissible="false"
    :hide-close="isCreating"
    @close="handleClose(true)"
  >
    <!-- Keyed by state so progress / result / selection ease in -->
    <div :key="isCreating ? 'creating' : clipCreated ? 'created' : error ? 'error' : 'select'" class="animate-enter">
      <!-- Progress state -->
      <div v-if="isCreating" class="flex flex-col items-center gap-1 py-6 text-center">
        <div class="relative mb-3 size-16">
          <svg class="size-16 -rotate-90">
            <circle cx="32" cy="32" r="28" stroke-width="5" stroke="var(--surface-active)" fill="none" />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke-width="5"
              stroke="var(--brand)"
              fill="none"
              :stroke-dasharray="176"
              :stroke-dashoffset="176 - (176 * progress) / 100"
              stroke-linecap="round"
              class="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <span class="tabular absolute inset-0 grid place-items-center text-sm font-semibold text-fg">
            {{ Math.round(progress) }}%
          </span>
        </div>
        <p class="text-sm font-semibold text-fg">Creating clip…</p>
        <p class="text-xs text-fg-muted">{{ progressMessage }}</p>
        <Button variant="secondary" size="sm" class="mt-3" @click="requestCancelClipExtraction">
          Cancel extraction
        </Button>
      </div>

      <!-- Success state -->
      <div v-else-if="clipCreated" class="flex flex-col items-center gap-1 py-6 text-center">
        <IconTile :icon="Check" tone="success" size="lg" class="mb-2" />
        <p class="text-sm font-semibold text-fg">Clip created</p>
        <p class="max-w-full truncate text-xs text-fg-muted">{{ clipName }}</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex flex-col items-center gap-1 py-6 text-center">
        <IconTile :icon="AlertCircle" tone="danger" size="lg" class="mb-2" />
        <p class="text-sm font-semibold text-fg">Failed to create clip</p>
        <p class="max-w-sm text-xs text-danger">{{ error }}</p>
        <Button variant="secondary" size="sm" class="mt-3" @click="resetState">Try again</Button>
      </div>

      <!-- Selection state -->
      <div v-else class="flex flex-col gap-4">
        <!-- Video preview -->
        <div
          class="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-line-subtle bg-black"
          @click="togglePlayPause"
        >
          <video
            ref="previewVideoRef"
            class="size-full object-contain"
            @timeupdate="onVideoTimeUpdate"
            @ended="onVideoEnded"
          />
          <!-- Play / pause -->
          <div
            class="absolute inset-0 grid place-items-center transition-opacity"
            :class="isPreviewPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'"
          >
            <span class="grid size-12 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
              <Play v-if="!isPreviewPlaying" class="ml-0.5 size-5" />
              <Pause v-else class="size-5" />
            </span>
          </div>
          <!-- Loading -->
          <div
            v-if="isLoadingPreview"
            class="absolute inset-0 flex items-center justify-center gap-2 bg-surface-sunken text-sm text-fg-muted"
          >
            <Loader2 class="size-4 animate-spin" />
            Loading preview…
          </div>
          <!-- Volume (bottom-left, slider on hover) -->
          <div
            class="absolute bottom-2 left-2 z-[5] flex items-center gap-1.5"
            @click.stop
            @mouseenter="showVolumeSlider = true"
            @mouseleave="showVolumeSlider = false"
          >
            <button
              type="button"
              class="grid size-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur-sm transition-colors hover:bg-black/85"
              :title="isMuted ? 'Unmute' : 'Mute'"
              @click="toggleMute"
            >
              <VolumeX v-if="isMuted || volume === 0" class="size-3.5" />
              <Volume2 v-else class="size-3.5" />
            </button>
            <Transition
              enter-active-class="transition duration-150"
              enter-from-class="-translate-x-1 opacity-0"
              leave-active-class="transition duration-100"
              leave-to-class="-translate-x-1 opacity-0"
            >
              <MediaVolumeSlider
                v-if="showVolumeSlider"
                :value="volumeSliderDisplay"
                step="0.02"
                class="w-[88px]"
                @pointerdown="onVolumeSliderPointerDown"
                @input="onVolumeSliderInput"
                @change="onVolumeSliderCommit"
                @pointercancel="onVolumeSliderCommit"
              />
            </Transition>
          </div>
          <!-- Time -->
          <span
            class="tabular pointer-events-none absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-2xs font-medium text-white"
          >
            {{ formatTime(currentPlaybackTime) }} / {{ formatTime(maxDuration) }}
          </span>
        </div>

        <!-- Clip name -->
        <Field label="Clip name">
          <template #label-end>
            <span class="tabular text-2xs text-fg-subtle">{{ clipName.length }}/50</span>
          </template>
          <Input v-model="clipName" :placeholder="defaultClipName" maxlength="50" />
        </Field>

        <!-- Range -->
        <Field label="Range">
          <template #label-end>
            <div class="flex items-center gap-1">
              <Button
                v-for="preset in [30, 60, 90]"
                :key="preset"
                variant="ghost"
                size="xs"
                class="tabular"
                :disabled="preset > maxDuration"
                @click="applyPreset(preset)"
              >
                {{ preset }}s
              </Button>
            </div>
          </template>
          <div
            ref="timelineRef"
            class="clip-timeline"
            @mousedown="handleTimelineMouseDown"
            @mousemove="handleTimelineMouseMove"
            @mouseleave="isTimelineHovering = false"
            @mouseenter="isTimelineHovering = true"
          >
            <div
              class="clip-timeline__range"
              :style="{ left: `${startPercentage}%`, width: `${endPercentage - startPercentage}%` }"
            />
            <div
              class="clip-timeline__handle"
              :style="{ left: `calc(${startPercentage}% - 6px)` }"
              @mousedown.stop="handleStartHandleMouseDown"
            ><span class="clip-timeline__grip" /></div>
            <div
              class="clip-timeline__handle"
              :style="{ left: `calc(${endPercentage}% - 6px)` }"
              @mousedown.stop="handleEndHandleMouseDown"
            ><span class="clip-timeline__grip" /></div>
            <div class="clip-timeline__playhead" :style="{ left: `${playheadPercentage}%` }" />
            <div
              v-if="isTimelineHovering && !isDragging"
              class="clip-timeline__hover"
              :style="{ left: `${hoverPercentage}%` }"
            />
          </div>
          <div class="tabular flex items-center justify-between text-xs text-fg-muted">
            <span>{{ formatTime(startTime) }}</span>
            <span class="font-semibold text-fg">{{ formatTime(endTime - startTime) }}</span>
            <span>{{ formatTime(endTime) }}</span>
          </div>
        </Field>
      </div>
    </div>

    <template v-if="clipCreated || (!isCreating && !error)" #footer>
      <template v-if="clipCreated">
        <Button variant="ghost" @click="() => handleClose()">Not now</Button>
        <Button variant="primary" @click="handlePublishNow">
          <Share2 />
          Publish now
        </Button>
      </template>
      <template v-else>
        <Button variant="ghost" @click="() => handleClose()">Cancel</Button>
        <Button variant="primary" :disabled="!isValidSelection" @click="handleCreateClip">
          <Scissors />
          Create clip
        </Button>
      </template>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { formatTime as formatTimeUtil } from '@/utils/dateTimeUtils';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { Scissors, Check, AlertCircle, Share2, Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { IconTile } from '@/components/ui/icon-tile';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import MediaVolumeSlider from '@/components/streams/MediaVolumeSlider.vue';
  import { createLivestreamClipProject, createClip as createClipRecord } from '@/services/database';
  import { createClipVersion } from '@/services/database/clip-versions';
  import { updateClip } from '@/services/database/clips';
  import { getOrCreateManualSession } from '@/services/database/clip-detection-sessions';
  import { useLivestreamStore } from '@/stores/livestream';
  import { useToast } from '@/composables/useToast';
  import Hls from 'hls.js';
  import { TauriHlsLoader, getTauriHlsUrl } from '@/composables/useTauriHlsLoader';

  interface SegmentInfo {
    segmentNumber: number;
    filePath: string;
    startTime: number;
    duration: number;
    endTime: number;
  }

  interface Props {
    availableDuration: number;
    projectId: string | null;
    sessionId: string | null;
    tempSessionId?: string | null;
    playbackPosition: number;
    watermarkSettings?: Record<string, any> | null;
    watermarkId?: string | null;
    segments: SegmentInfo[];
    displayName?: string;
    mintId?: string;
    isTempRecording?: boolean;
    streamerId?: string;
    platform?: 'PumpFun' | 'Kick' | 'YouTube' | 'Twitch' | 'Rumble' | 'Twitter' | 'Tokend' | 'Manual';
    hlsOutputDir?: string | null;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'clip-created', clipPath: string, projectId: string): void;
    (e: 'publish-clip', clipId: string, clipPath: string, projectId: string, thumbnailPath: string | null): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const livestreamStore = useLivestreamStore();

  // State
  const hidden = ref(false);
  const clipName = ref('');
  const isCreating = ref(false);
  const progress = ref(0);
  const progressMessage = ref('Preparing...');
  const clipCreated = ref(false);
  const createdClipPath = ref<string | null>(null);
  const createdClipId = ref<string | null>(null);
  const createdProjectId = ref<string | null>(null);
  const createdThumbnailPath = ref<string | null>(null);
  const error = ref<string | null>(null);

  // Timeline interaction state
  const timelineRef = ref<HTMLDivElement | null>(null);
  const previewVideoRef = ref<HTMLVideoElement | null>(null);
  const isTimelineHovering = ref(false);
  const isDragging = ref(false);
  const dragTarget = ref<'start' | 'end' | null>(null);
  const hoverPercentage = ref(0);

  // VOD preview playback state
  const isPreviewPlaying = ref(false);
  const isLoadingPreview = ref(true);
  const currentPlaybackTime = ref(0);
  const vodPlaylistPath = ref<string | null>(null);
  let hlsInstance: Hls | null = null;

  // Volume state (persisted to localStorage)
  const VOLUME_KEY = 'livestreamClipSelector.volume';
  const MUTED_KEY = 'livestreamClipSelector.muted';
  const volume = ref<number>(parseFloat(localStorage.getItem(VOLUME_KEY) ?? '1'));
  const isMuted = ref<boolean>(localStorage.getItem(MUTED_KEY) === 'true');
  const showVolumeSlider = ref(false);

  /** Live value while dragging — avoids syncing :value from Vue on every input (jank in WebView). */
  const volumeSliderLive = ref<number | null>(null);
  const volumeSliderDisplay = computed(() => {
    if (volumeSliderLive.value !== null) return volumeSliderLive.value;
    return isMuted.value ? 0 : volume.value;
  });

  let volumePersistTimer: ReturnType<typeof setTimeout> | null = null;
  let volumeWindowPointerClean: (() => void) | null = null;

  function scheduleVolumePersist() {
    if (volumePersistTimer) clearTimeout(volumePersistTimer);
    volumePersistTimer = setTimeout(() => {
      volumePersistTimer = null;
      localStorage.setItem(VOLUME_KEY, String(volume.value));
      localStorage.setItem(MUTED_KEY, String(isMuted.value));
    }, 200);
  }

  function teardownVolumeWindowPointerListeners() {
    volumeWindowPointerClean?.();
    volumeWindowPointerClean = null;
  }

  function onVolumeSliderPointerDown() {
    teardownVolumeWindowPointerListeners();
    const finish = () => {
      onVolumeSliderCommit();
      teardownVolumeWindowPointerListeners();
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    volumeWindowPointerClean = () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }

  // Sync volume/mute to video when not dragging the slider; debounce localStorage (sync writes lag the UI).
  watch([volume, isMuted], ([vol, muted]) => {
    if (volumeSliderLive.value !== null) return;
    if (previewVideoRef.value) {
      previewVideoRef.value.volume = vol;
      previewVideoRef.value.muted = muted;
    }
    scheduleVolumePersist();
  });

  function applyVolumeToVideo() {
    if (previewVideoRef.value) {
      previewVideoRef.value.volume = volume.value;
      previewVideoRef.value.muted = isMuted.value;
    }
  }

  function clipSelectorErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
  }

  /** Signals the backend to kill in-flight FFmpeg for livestream clip extraction. */
  async function requestCancelClipExtraction() {
    try {
      await invoke('cancel_livestream_clip_extraction');
    } catch (e) {
      console.warn('[ClipSelector] cancel_livestream_clip_extraction failed:', e);
    }
  }

  function toggleMute() {
    isMuted.value = !isMuted.value;
  }

  function onVolumeSliderInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    volumeSliderLive.value = val;
    if (previewVideoRef.value) {
      previewVideoRef.value.volume = val;
      previewVideoRef.value.muted = val === 0;
    }
    if (val === 0) {
      isMuted.value = true;
    } else if (isMuted.value) {
      isMuted.value = false;
    }
  }

  function onVolumeSliderCommit(e?: Event) {
    teardownVolumeWindowPointerListeners();
    let next = volumeSliderLive.value;
    if (next === null && e?.target instanceof HTMLInputElement) {
      next = parseFloat(e.target.value);
    }
    if (next !== null && Number.isFinite(next)) {
      volume.value = next;
    }
    volumeSliderLive.value = null;
    if (previewVideoRef.value) {
      previewVideoRef.value.volume = volume.value;
      previewVideoRef.value.muted = isMuted.value;
    }
    scheduleVolumePersist();
  }

  // Clip selection (in seconds from start of the 3-minute window)
  // These will be initialized in onMounted to default to the last 30 seconds
  const startTime = ref(0);
  const endTime = ref(30);

  // Max duration (3 minutes or available duration, whichever is less)
  const maxDuration = computed(() => Math.min(180, props.availableDuration));

  // Computed
  const defaultClipName = computed(() => {
    const timestamp = formatTimeUtil(new Date()).replace(/:/g, '-').replace(/\s*(AM|PM)/i, '');
    return `Clip - ${timestamp}`;
  });

  const startPercentage = computed(() => {
    if (maxDuration.value <= 0) return 0;
    return (startTime.value / maxDuration.value) * 100;
  });

  const endPercentage = computed(() => {
    if (maxDuration.value <= 0) return 100;
    return (endTime.value / maxDuration.value) * 100;
  });

  const playheadPercentage = computed(() => {
    if (maxDuration.value <= 0) return 0;
    return (currentPlaybackTime.value / maxDuration.value) * 100;
  });

  const isValidSelection = computed(() => {
    return endTime.value > startTime.value && endTime.value <= maxDuration.value;
  });

  // Initialize end time based on available duration
  watch(
    () => maxDuration.value,
    (newMax) => {
      if (endTime.value > newMax) {
        endTime.value = Math.min(30, newMax);
      }
      if (startTime.value >= endTime.value) {
        startTime.value = Math.max(0, endTime.value - 30);
      }
    },
    { immediate: true }
  );

  // Initialize VOD preview playback
  onMounted(async () => {
    // Safety check: ensure availableDuration is a valid number
    if (!props.availableDuration || !isFinite(props.availableDuration) || props.availableDuration <= 0) {
      console.warn('[ClipSelector] Invalid availableDuration:', props.availableDuration);
      isLoadingPreview.value = false;
      return;
    }

    // Initialize selection to the LAST 30 seconds of available buffer
    const availableDur = maxDuration.value;
    if (availableDur > 30) {
      startTime.value = availableDur - 30;
      endTime.value = availableDur;
    } else {
      startTime.value = 0;
      endTime.value = Math.max(0, availableDur);
    }

    // Create VOD playlist and initialize HLS playback
    await initializeVodPlayback();
  });

  async function initializeVodPlayback() {
    if (!props.hlsOutputDir || !props.segments || props.segments.length === 0) {
      console.warn('[ClipSelector] No hlsOutputDir or segments for VOD playback');
      isLoadingPreview.value = false;
      return;
    }

    try {
      // Build segment list for VOD playlist (extract filenames from full paths)
      const vodSegments = props.segments.map((seg) => {
        const filename = seg.filePath.split(/[/\\]/).pop() || '';
        return { filename, duration: seg.duration };
      });

      // Create static VOD playlist via Tauri
      const playlistFilename = 'clip_preview.m3u8';
      const playlistPath = await invoke<string>('create_vod_playlist', {
        outputDir: props.hlsOutputDir,
        segments: vodSegments,
        filename: playlistFilename,
      });
      vodPlaylistPath.value = playlistPath;

      console.log('[ClipSelector] VOD playlist created:', playlistPath, `(${vodSegments.length} segments)`);

      // Initialize hls.js in VOD mode
      if (!previewVideoRef.value) {
        console.warn('[ClipSelector] No video element available');
        isLoadingPreview.value = false;
        return;
      }

      const hlsUrl = getTauriHlsUrl(props.hlsOutputDir, playlistFilename);

      hlsInstance = new Hls({
        loader: TauriHlsLoader,
        liveDurationInfinity: false,
        enableWorker: false,
        maxBufferLength: 60,
        backBufferLength: 300,
      });

      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(previewVideoRef.value);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[ClipSelector] VOD manifest parsed, starting playback');
        isLoadingPreview.value = false;

        // Seek to the start of the selected range and auto-play
        if (previewVideoRef.value) {
          applyVolumeToVideo();
          previewVideoRef.value.currentTime = startTime.value;
          previewVideoRef.value.play().then(() => {
            isPreviewPlaying.value = true;
          }).catch((err) => {
            console.warn('[ClipSelector] Auto-play failed:', err);
            // Browsers may require muted for autoplay — mute and retry once
            if (previewVideoRef.value) {
              previewVideoRef.value.muted = true;
              previewVideoRef.value.play().then(() => {
                isPreviewPlaying.value = true;
              }).catch(() => {
                isPreviewPlaying.value = false;
              });
            }
          });
        }
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[ClipSelector] HLS error:', data.type, data.details);
        if (data.fatal) {
          isLoadingPreview.value = false;
        }
      });
    } catch (err) {
      console.error('[ClipSelector] Failed to initialize VOD playback:', err);
      isLoadingPreview.value = false;
    }
  }

  // Video playback controls
  function togglePlayPause() {
    if (!previewVideoRef.value) return;

    if (isPreviewPlaying.value) {
      previewVideoRef.value.pause();
      isPreviewPlaying.value = false;
    } else {
      // If playhead is outside selected range, seek to startTime first
      const ct = previewVideoRef.value.currentTime;
      if (ct < startTime.value || ct >= endTime.value) {
        previewVideoRef.value.currentTime = startTime.value;
      }
      previewVideoRef.value.play().then(() => {
        isPreviewPlaying.value = true;
      }).catch(() => {
        isPreviewPlaying.value = false;
      });
    }
  }

  function onVideoTimeUpdate() {
    if (!previewVideoRef.value) return;
    currentPlaybackTime.value = previewVideoRef.value.currentTime;

    // Stop/loop at endTime boundary
    if (isPreviewPlaying.value && previewVideoRef.value.currentTime >= endTime.value) {
      previewVideoRef.value.currentTime = startTime.value;
    }
  }

  function onVideoEnded() {
    // If video element fires ended, loop back to startTime
    if (previewVideoRef.value) {
      previewVideoRef.value.currentTime = startTime.value;
      isPreviewPlaying.value = false;
    }
  }

  function seekPreviewTo(time: number) {
    if (previewVideoRef.value && isFinite(time) && time >= 0) {
      previewVideoRef.value.currentTime = Math.min(time, maxDuration.value);
      currentPlaybackTime.value = previewVideoRef.value.currentTime;
    }
  }

  // Format time helper
  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Timeline interaction handlers
  function getPercentageFromEvent(event: MouseEvent): number {
    if (!timelineRef.value) return 0;
    const rect = timelineRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    return Math.max(0, Math.min(100, percentage));
  }

  function getTimeFromPercentage(percentage: number): number {
    return (percentage / 100) * maxDuration.value;
  }

  function handleTimelineMouseMove(event: MouseEvent) {
    if (!isDragging.value) {
      hoverPercentage.value = getPercentageFromEvent(event);
    }
  }

  function handleTimelineMouseDown(event: MouseEvent) {
    // Click on timeline to scrub/seek the preview video
    const percentage = getPercentageFromEvent(event);
    const time = getTimeFromPercentage(percentage);
    seekPreviewTo(time);
  }

  function handleStartHandleMouseDown(event: MouseEvent) {
    event.preventDefault();
    isDragging.value = true;
    dragTarget.value = 'start';
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }

  function handleEndHandleMouseDown(event: MouseEvent) {
    event.preventDefault();
    isDragging.value = true;
    dragTarget.value = 'end';
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }

  function handleDocumentMouseMove(event: MouseEvent) {
    if (!isDragging.value || !timelineRef.value) return;

    const percentage = getPercentageFromEvent(event);
    const time = getTimeFromPercentage(percentage);

    if (dragTarget.value === 'start') {
      startTime.value = Math.max(0, Math.min(time, endTime.value - 1));
    } else if (dragTarget.value === 'end') {
      endTime.value = Math.max(startTime.value + 1, Math.min(time, maxDuration.value));
    }
  }

  function handleDocumentMouseUp() {
    const wasDragging = dragTarget.value;
    isDragging.value = false;
    dragTarget.value = null;
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);

    // After releasing handle, seek and auto-play from new position
    if (wasDragging === 'start') {
      seekPreviewTo(startTime.value);
      autoPlayFromRange();
    } else if (wasDragging === 'end') {
      if (currentPlaybackTime.value > endTime.value) {
        seekPreviewTo(startTime.value);
      }
      autoPlayFromRange();
    }
  }

  function autoPlayFromRange() {
    if (!previewVideoRef.value) return;
    previewVideoRef.value.play().then(() => {
      isPreviewPlaying.value = true;
    }).catch(() => {
      isPreviewPlaying.value = false;
    });
  }

  // Apply preset duration — selects the most recent N seconds of the window
  function applyPreset(duration: number) {
    if (duration > maxDuration.value) return;

    endTime.value = maxDuration.value;
    startTime.value = maxDuration.value - duration;

    // Seek preview to start of selected range
    seekPreviewTo(startTime.value);
  }

  // Progress event listener
  let progressUnlisten: UnlistenFn | null = null;

  async function setupProgressListener() {
    progressUnlisten = await listen<{ progress: number; message: string }>('clip-extraction-progress', (event) => {
      progress.value = event.payload.progress;
      progressMessage.value = event.payload.message;
    });
  }

  function cleanupProgressListener() {
    if (progressUnlisten) {
      progressUnlisten();
      progressUnlisten = null;
    }
  }

  // Cleanup HLS instance and VOD playlist
  async function cleanupVodPlayback() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    if (vodPlaylistPath.value) {
      try {
        await invoke('delete_vod_playlist', { playlistPath: vodPlaylistPath.value });
        console.log('[ClipSelector] VOD playlist cleaned up');
      } catch (err) {
        console.warn('[ClipSelector] Failed to cleanup VOD playlist:', err);
      }
      vodPlaylistPath.value = null;
    }
  }

  // Create clip
  async function handleCreateClip() {
    if (isCreating.value || !isValidSelection.value) return;

    // Pause preview during clip creation
    if (previewVideoRef.value && isPreviewPlaying.value) {
      previewVideoRef.value.pause();
      isPreviewPlaying.value = false;
    }

    const clipDuration = endTime.value - startTime.value;
    const clipStartTime = startTime.value;
    const clipEndTime = endTime.value;

    // Validate
    if (clipDuration <= 0) {
      error.value = 'Invalid clip duration';
      return;
    }

    if (clipEndTime > props.availableDuration) {
      error.value = `Only ${Math.floor(props.availableDuration)}s recorded so far`;
      return;
    }

    const effectiveSessionId = props.sessionId || props.tempSessionId || props.mintId;
    if (!effectiveSessionId) {
      error.value = 'Session not available. Please try again.';
      return;
    }

    if (!props.segments || props.segments.length === 0) {
      error.value = 'No recorded segments available';
      return;
    }

    isCreating.value = true;
    progress.value = 0;
    progressMessage.value = 'Preparing clip extraction...';
    error.value = null;

    let effectiveProjectId = createdProjectId.value || props.projectId;

    if (!effectiveProjectId && props.displayName && props.mintId) {
      try {
        progressMessage.value = 'Creating project folder...';
        effectiveProjectId = await createLivestreamClipProject(props.displayName, props.mintId, props.platform);
        createdProjectId.value = effectiveProjectId;
      } catch (err) {
        console.error('[ClipSelector] Failed to create project:', err);
        error.value = 'Failed to create project folder';
        isCreating.value = false;
        return;
      }
    }

    if (!effectiveProjectId) {
      error.value = 'Unable to determine project for clip';
      isCreating.value = false;
      return;
    }

    try {
      await setupProgressListener();

      const finalClipName = clipName.value || defaultClipName.value;

      const resultJson = await invoke<string>('extract_livestream_clip', {
        sessionId: effectiveSessionId,
        clipEndTime: clipEndTime,
        clipDuration: clipDuration,
        clipName: finalClipName,
        segments: props.segments,
        projectId: effectiveProjectId,
        watermarkId: null,
        watermarkSettings: null,
      });

      const extractionResult = JSON.parse(resultJson) as { clipPath: string; thumbnailPath: string | null };
      const clipFilePath = extractionResult.clipPath;
      const thumbnailFilePath = extractionResult.thumbnailPath;
      createdThumbnailPath.value = thumbnailFilePath;

      // Save clip to database
      let clipId: string | null = null;
      try {
        clipId = await createClipRecord(effectiveProjectId, clipFilePath, {
          name: finalClipName,
          duration: clipDuration,
          startTime: clipStartTime,
          endTime: clipEndTime,
          thumbnailPath: thumbnailFilePath || undefined,
        });

        const manualSessionId = await getOrCreateManualSession(effectiveProjectId);
        const versionId = await createClipVersion(
          clipId,
          manualSessionId,
          1,
          {
            name: finalClipName,
            startTime: clipStartTime,
            endTime: clipEndTime,
          },
          'detected'
        );
        await updateClip(clipId, { current_version_id: versionId, detection_session_id: manualSessionId });

        if (thumbnailFilePath) {
          const { getProject, updateProject } = await import('@/services/database/projects');
          const project = await getProject(effectiveProjectId);
          if (project && !project.thumbnail_path) {
            await updateProject(effectiveProjectId, undefined, undefined, thumbnailFilePath);
          }
        }
      } catch (dbErr) {
        console.warn('[ClipSelector] Failed to save clip to database:', dbErr);
      }

      // Always set these values even if database save failed, so Publish Now button works
      createdClipId.value = clipId;
      createdClipPath.value = clipFilePath;
      clipCreated.value = true;
      clipName.value = finalClipName;

      emit('clip-created', clipFilePath, effectiveProjectId);
    } catch (err) {
      const msg = clipSelectorErrorMessage(err);
      if (msg.includes('FFmpeg operation cancelled')) {
        progress.value = 0;
        progressMessage.value = '';
        error.value = null;
        applyVolumeToVideo();
      } else {
        console.error('[ClipSelector] Failed to create clip:', err);
        error.value = msg || 'Failed to create clip';
      }
    } finally {
      isCreating.value = false;
      cleanupProgressListener();
    }
  }

  // Publish now
  function handlePublishNow() {
    const projectId = createdProjectId.value || props.projectId;
    if (createdClipId.value && createdClipPath.value && projectId) {
      emit('publish-clip', createdClipId.value, createdClipPath.value, projectId, createdThumbnailPath.value);
    }
  }

  // Reset state for retry
  function resetState() {
    isCreating.value = false;
    progress.value = 0;
    progressMessage.value = '';
    clipCreated.value = false;
    createdClipPath.value = null;
    createdClipId.value = null;
    error.value = null;
  }

  // Close modal
  async function handleClose(force = false) {
    if (isCreating.value && !force) {
      console.warn('[ClipSelector] Force closing while clip creation in progress');
    }
    
    // If clip was successfully created and user clicked "Not Now", save to manual project
    if (clipCreated.value && createdClipId.value && clipName.value) {
      try {
        console.log('[ClipSelector] Not Now clicked - saving clip to manual project');
        
        // Create a manual clip project
        const { createProject } = await import('@/services/database/projects');
        const projectName = `Manual Clip - ${clipName.value}`;
        const projectDescription = `Manual clip created from livestream`;
        
        const manualProjectId = await createProject(
          projectName,
          projectDescription,
          undefined, // no parent
          'Manual' // platform type
        );
        
        console.log('[ClipSelector] Created manual clip project:', manualProjectId, projectName);
        
        // Link the clip to the manual project using direct database update
        const { getDatabase, timestamp } = await import('@/services/database/core');
        const db = await getDatabase();
        const now = timestamp();
        await db.execute(
          'UPDATE clips SET project_id = ?, updated_at = ? WHERE id = ?',
          [manualProjectId, now, createdClipId.value]
        );
        
        console.log('[ClipSelector] Linked clip to manual project');
        
        const { success } = useToast();
        success('Clip Saved', `"${clipName.value}" has been saved to Manual Clips`, undefined, 'clips');
      } catch (err) {
        console.error('[ClipSelector] Failed to save to manual project:', err);
        const { error: errorToast } = useToast();
        errorToast('Error', 'Failed to save clip to manual project');
      }
    }
    
    cleanupProgressListener();
    cleanupVodPlayback();
    isCreating.value = false;
    emit('close');
  }

  // Cleanup on unmount
  onUnmounted(() => {
    teardownVolumeWindowPointerListeners();
    if (volumePersistTimer) {
      clearTimeout(volumePersistTimer);
      volumePersistTimer = null;
    }
    cleanupProgressListener();
    cleanupVodPlayback();
    if (isDragging.value) {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    }
  });
</script>

<style scoped>
  /* Range timeline — positions are driven by the script (getBoundingClientRect on timelineRef). */
  .clip-timeline {
    position: relative;
    height: 32px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface-sunken);
  }
  .clip-timeline__range {
    position: absolute;
    top: 0;
    height: 100%;
    background: var(--brand-soft);
    border-inline: 2px solid var(--brand);
  }
  .clip-timeline__handle {
    position: absolute;
    top: 0;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 12px;
    height: 100%;
    background: var(--brand);
    cursor: ew-resize;
  }
  .clip-timeline__grip {
    width: 2px;
    height: 14px;
    border-radius: 1px;
    background: var(--brand-fg);
    opacity: 0.6;
  }
  .clip-timeline__playhead {
    position: absolute;
    top: 0;
    z-index: 3;
    width: 2px;
    height: 100%;
    background: var(--fg);
    pointer-events: none;
  }
  .clip-timeline__hover {
    position: absolute;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--line-strong);
    pointer-events: none;
  }
</style>
