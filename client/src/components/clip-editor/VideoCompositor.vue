<template>
  <div ref="containerRef" class="video-compositor relative w-full h-full overflow-hidden bg-black">
    <!-- Video A (double-buffer slot A) -->
    <video
      ref="videoARef"
      class="absolute inset-0 w-full h-full object-contain transition-opacity duration-75"
      :class="{ 'opacity-0': activeSlot !== 'A' || showBlackScreen, 'z-10': activeSlot === 'A' }"
      :muted="videoMuted"
      crossorigin="anonymous"
      playsinline
      @loadeddata="() => onVideoLoaded('A')"
      @canplaythrough="() => onVideoCanPlay('A')"
      @error="(e) => onVideoError(e, 'A')"
      @waiting="() => onVideoWaiting('A')"
      @stalled="() => onVideoStalled('A')"
      @playing="() => onVideoPlaying('A')"
      @seeking="() => onVideoSeeking('A')"
      @seeked="() => onVideoSeeked('A')"
    />

    <!-- Video B (double-buffer slot B) -->
    <video
      ref="videoBRef"
      class="absolute inset-0 w-full h-full object-contain transition-opacity duration-75"
      :class="{ 'opacity-0': activeSlot !== 'B' || showBlackScreen, 'z-10': activeSlot === 'B' }"
      :muted="videoMuted"
      crossorigin="anonymous"
      playsinline
      @loadeddata="() => onVideoLoaded('B')"
      @canplaythrough="() => onVideoCanPlay('B')"
      @error="(e) => onVideoError(e, 'B')"
      @waiting="() => onVideoWaiting('B')"
      @stalled="() => onVideoStalled('B')"
      @playing="() => onVideoPlaying('B')"
      @seeking="() => onVideoSeeking('B')"
      @seeked="() => onVideoSeeked('B')"
    />

    <!-- Black Screen Overlay (for gaps) -->
    <div
      v-if="showBlackScreen"
      class="absolute inset-0 bg-black z-30"
    />

    <!-- Loading Indicator -->
    <div
      v-if="isLoading && !hasActiveVideo"
      class="absolute inset-0 flex items-center justify-center bg-black/50 z-40"
    >
      <div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Hls from 'hls.js';
import type { ActiveVideoSource, ActiveTransition } from '@/composables/useTimelineRenderer';
import type { VideoSource } from '@/composables/usePlaybackEngine';

type Slot = 'A' | 'B';

const props = withDefaults(
  defineProps<{
    currentTime: number;
    isPlaying: boolean;
    activeSource: ActiveVideoSource | null;
    nextSource: VideoSource | null;
    activeTransition: ActiveTransition | null;
    isInGap: boolean;
    videoServerPort: number | null;
    videoMuted?: boolean;
    playbackRate?: number;
  }>(),
  {
    videoMuted: false,
    playbackRate: 1,
  }
);

const emit = defineEmits<{
  (e: 'videoElementReady', video: HTMLVideoElement): void;
  (e: 'error', error: string): void;
}>();

// Refs for double-buffer video elements
const containerRef = ref<HTMLElement | null>(null);
const videoARef = ref<HTMLVideoElement | null>(null);
const videoBRef = ref<HTMLVideoElement | null>(null);

// Double-buffer state - which slot is currently visible
const activeSlot = ref<Slot>('A');

// Track which source is loaded in each slot (by id for segment tracking)
const slotSourceIds = ref<{ A: string | null; B: string | null }>({ A: null, B: null });

// Track which FILE is loaded in each slot (for same-file optimization)
const slotFilePaths = ref<{ A: string | null; B: string | null }>({ A: null, B: null });

// Track ready state per slot
const slotReady = ref<{ A: boolean; B: boolean }>({ A: false, B: false });

// HLS instances per slot
let hlsInstances: { A: Hls | null; B: Hls | null } = { A: null, B: null };

// State
const isLoading = ref(false);

// Sync state
const SYNC_TOLERANCE = 0.1; // 100ms drift tolerance
let lastSyncTime = 0;

// Computed
const showBlackScreen = computed(() => props.isInGap && !props.activeTransition);
const hasActiveVideo = computed(() => slotReady.value[activeSlot.value]);

// Get video element for a slot
function getVideoForSlot(slot: Slot): HTMLVideoElement | null {
  return slot === 'A' ? videoARef.value : videoBRef.value;
}

// Get the inactive slot
function getInactiveSlot(): Slot {
  return activeSlot.value === 'A' ? 'B' : 'A';
}

// Get active video element
function getActiveVideo(): HTMLVideoElement | null {
  return getVideoForSlot(activeSlot.value);
}

/**
 * Build streaming URL for a video source
 */
function buildVideoUrl(source: VideoSource): string {
  if (!props.videoServerPort) {
    console.warn('[VideoCompositor] No video server port');
    return '';
  }
  const encodedPath = btoa(unescape(encodeURIComponent(source.file_path)));
  return `http://localhost:${props.videoServerPort}/video/${encodedPath}`;
}

/**
 * Check if a URL is HLS
 */
function isHlsUrl(url: string): boolean {
  return url.includes('.m3u8') || url.includes('/hls/');
}

/**
 * Load a video source into a specific slot and wait for it to be ready
 * If the same file is already loaded, just seek to the new position
 */
async function loadSourceIntoSlot(slot: Slot, source: VideoSource): Promise<void> {
  const video = getVideoForSlot(slot);
  if (!video) return;

  const url = buildVideoUrl(source);
  const isSameFile = slotFilePaths.value[slot] === source.file_path;
  
  console.log(`[VideoCompositor] Loading source into slot ${slot}:`, { 
    id: source.id, 
    trimStart: source.trim_start,
    isSameFile,
    currentFile: slotFilePaths.value[slot]
  });

  if (!url) return;

  // Mark slot as not ready while loading/seeking
  slotReady.value[slot] = false;
  slotSourceIds.value[slot] = source.id;

  // If same file is already loaded, just seek - don't reload
  if (isSameFile && video.src) {
    console.log(`[VideoCompositor] Same file already loaded in slot ${slot}, seeking to ${source.trim_start}`);
    await seekAndBuffer(video, source.trim_start, slot);
    return;
  }

  // Different file - need to load it
  slotFilePaths.value[slot] = source.file_path;

  // Cleanup existing HLS instance for this slot
  if (hlsInstances[slot]) {
    hlsInstances[slot]!.destroy();
    hlsInstances[slot] = null;
  }

  if (isHlsUrl(url) && Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30,
    });

    hls.loadSource(url);
    hls.attachMedia(video);
    hlsInstances[slot] = hls;

    await new Promise<void>((resolve) => {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log(`[VideoCompositor] HLS manifest parsed for slot ${slot}`);
        resolve();
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error(`[VideoCompositor] HLS error for slot ${slot}:`, data);
          resolve();
        }
      });
    });
  } else {
    video.src = url;
    video.load();
  }

  // Seek to the correct position and wait for buffering
  await seekAndBuffer(video, source.trim_start, slot);
}

// Minimum buffer required ahead of current position (in seconds)
const MIN_BUFFER_AHEAD = 1.0;

/**
 * Check how much data is buffered ahead of the current position
 */
function getBufferedAhead(video: HTMLVideoElement): number {
  const currentTime = video.currentTime;
  const buffered = video.buffered;
  
  for (let i = 0; i < buffered.length; i++) {
    const start = buffered.start(i);
    const end = buffered.end(i);
    
    // If current time is within this buffer range
    if (currentTime >= start && currentTime <= end) {
      return end - currentTime;
    }
  }
  
  return 0;
}

/**
 * Seek to a position and wait for the video to buffer enough data there
 */
async function seekAndBuffer(video: HTMLVideoElement, targetTime: number, slot: Slot): Promise<void> {
  console.log(`[VideoCompositor] Seeking slot ${slot} to ${targetTime}`);
  
  // First, seek to the target position
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      console.log(`[VideoCompositor] Slot ${slot} seeked to ${video.currentTime}`);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = targetTime;
    
    // Timeout fallback
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 1000);
  });

  // Now wait for enough data to be buffered at this position
  // We need at least MIN_BUFFER_AHEAD seconds buffered before considering ready
  const checkBuffer = (): boolean => {
    const bufferedAhead = getBufferedAhead(video);
    const hasEnoughBuffer = bufferedAhead >= MIN_BUFFER_AHEAD;
    console.log(`[VideoCompositor] Slot ${slot} buffer check: ${bufferedAhead.toFixed(2)}s ahead, readyState=${video.readyState}, enough=${hasEnoughBuffer}`);
    return hasEnoughBuffer;
  };

  // Check if we already have enough data
  if (video.readyState >= 3 && checkBuffer()) {
    console.log(`[VideoCompositor] Slot ${slot} already has enough data`);
    slotReady.value[slot] = true;
    return;
  }

  // Wait for sufficient buffer
  await new Promise<void>((resolve) => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let resolved = false;
    
    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (checkInterval) clearInterval(checkInterval);
      video.removeEventListener('canplaythrough', onCanPlay);
      video.removeEventListener('progress', onProgress);
      slotReady.value[slot] = true;
      resolve();
    };
    
    const onCanPlay = () => {
      if (checkBuffer()) {
        console.log(`[VideoCompositor] Slot ${slot} ready via canplaythrough with sufficient buffer`);
        finish();
      }
    };
    
    const onProgress = () => {
      if (checkBuffer()) {
        console.log(`[VideoCompositor] Slot ${slot} ready via progress with sufficient buffer`);
        finish();
      }
    };
    
    video.addEventListener('canplaythrough', onCanPlay);
    video.addEventListener('progress', onProgress);
    
    // Also poll periodically in case events are missed
    checkInterval = setInterval(() => {
      if (checkBuffer()) {
        console.log(`[VideoCompositor] Slot ${slot} ready via polling with sufficient buffer`);
        finish();
      }
    }, 100);
    
    // Timeout fallback - mark ready anyway after 3 seconds
    setTimeout(() => {
      if (!resolved) {
        const bufferedAhead = getBufferedAhead(video);
        console.warn(`[VideoCompositor] Slot ${slot} buffer timeout - only ${bufferedAhead.toFixed(2)}s buffered, readyState=${video.readyState}`);
        finish();
      }
    }, 3000);
  });
}

/**
 * Sync video element time to timeline
 * Only seeks if video is ready and not waiting for data
 */
function syncVideoToTimeline(video: HTMLVideoElement, targetTime: number): void {
  // Don't seek if video is not ready or is waiting for data
  // readyState < 3 means not enough data buffered for smooth playback
  // networkState 2 means NETWORK_LOADING (actively fetching)
  if (video.readyState < 3 || video.seeking) {
    console.log(`[VideoCompositor] ⏭️ Sync SKIPPED: readyState=${video.readyState}, seeking=${video.seeking}, currentTime=${video.currentTime.toFixed(3)}, target=${targetTime.toFixed(3)}`);
    return;
  }
  
  const drift = Math.abs(video.currentTime - targetTime);
  if (drift > SYNC_TOLERANCE) {
    console.log(`[VideoCompositor] 🔄 Sync SEEKING: drift=${drift.toFixed(3)}s, from=${video.currentTime.toFixed(3)} to=${targetTime.toFixed(3)}`);
    video.currentTime = targetTime;
  }
}

/**
 * Main update function - handles source changes with double-buffering
 */
async function updatePlayback(): Promise<void> {
  const source = props.activeSource;

  console.log('[VideoCompositor] updatePlayback:', {
    sourceId: source?.id,
    filePath: source?.file_path,
    activeSlot: activeSlot.value,
    slotASrc: slotSourceIds.value.A,
    slotBSrc: slotSourceIds.value.B,
    slotAFile: slotFilePaths.value.A,
    slotBFile: slotFilePaths.value.B,
    isInGap: props.isInGap,
  });

  // No source - pause active video
  if (!source) {
    const activeVideo = getActiveVideo();
    if (activeVideo && !activeVideo.paused) {
      activeVideo.pause();
    }
    return;
  }

  // Check if source is already loaded in active slot (same segment)
  if (slotSourceIds.value[activeSlot.value] === source.id) {
    // Source already in active slot - just sync time and play state
    const video = getActiveVideo();
    if (video) {
      syncVideoToTimeline(video, source.videoTime);
      video.playbackRate = props.playbackRate;

      if (props.isPlaying && video.paused && video.readyState >= 2) {
        video.play().catch((e) => console.warn('[VideoCompositor] Play failed:', e));
      } else if (!props.isPlaying && !video.paused) {
        video.pause();
      }
    }
    return;
  }

  // Check if source segment is preloaded in inactive slot (by segment id)
  // This is the key to seamless playback - the next segment must be pre-seeked and buffered
  const inactiveSlot = getInactiveSlot();
  console.log(`[VideoCompositor] Checking inactive slot ${inactiveSlot}: sourceId=${slotSourceIds.value[inactiveSlot]}, ready=${slotReady.value[inactiveSlot]}, looking for=${source.id}`);
  
  // If source is already in inactive slot (even if not ready yet), wait for it instead of reloading
  if (slotSourceIds.value[inactiveSlot] === source.id) {
    if (slotReady.value[inactiveSlot]) {
      // Source is ready in inactive slot - SWAP slots (instant transition!)
      console.log(`[VideoCompositor] Swapping to preloaded slot ${inactiveSlot}`);

      // Pause old active video
      const oldVideo = getActiveVideo();
      if (oldVideo && !oldVideo.paused) {
        oldVideo.pause();
      }

      // Switch active slot - this is instant because video is already buffered at correct position
      activeSlot.value = inactiveSlot;

      // Sync and play new active video
      const newVideo = getActiveVideo();
      if (newVideo) {
        syncVideoToTimeline(newVideo, source.videoTime);
        newVideo.playbackRate = props.playbackRate;

        if (props.isPlaying && newVideo.readyState >= 3) {
          newVideo.play().catch((e) => console.warn('[VideoCompositor] Play failed:', e));
        }
      }
      return;
    } else {
      // Source is being preloaded but not ready yet - just wait, don't reload
      console.log(`[VideoCompositor] Source already loading in slot ${inactiveSlot}, waiting for it to be ready`);
      return;
    }
  }

  // Source not loaded anywhere - load into inactive slot then swap
  console.log(`[VideoCompositor] Loading new source into slot ${inactiveSlot}`);
  isLoading.value = true;

  await loadSourceIntoSlot(inactiveSlot, source);

  // Wait for video to be ready before swapping
  const video = getVideoForSlot(inactiveSlot);
  if (video && video.readyState >= 3) {
    // Ready immediately - swap now
    activeSlot.value = inactiveSlot;
    syncVideoToTimeline(video, source.videoTime);
    video.playbackRate = props.playbackRate;

    if (props.isPlaying) {
      video.play().catch(() => {});
    }
    isLoading.value = false;
  }
  // Otherwise, wait for canplaythrough event to trigger swap
}

/**
 * Preload next source into inactive slot
 */
async function preloadNextSource(): Promise<void> {
  const source = props.nextSource;
  if (!source) return;

  const inactiveSlot = getInactiveSlot();

  // Don't preload if already loaded
  if (slotSourceIds.value[inactiveSlot] === source.id) return;

  // Don't preload if inactive slot has current source (we might need to swap back)
  if (slotSourceIds.value[inactiveSlot] === props.activeSource?.id) return;

  console.log(`[VideoCompositor] Preloading next source into slot ${inactiveSlot}:`, source.id);
  await loadSourceIntoSlot(inactiveSlot, source);
}

// Event handlers
function onVideoLoaded(slot: Slot): void {
  console.log(`[VideoCompositor] Video loaded in slot ${slot}`);
  const video = getVideoForSlot(slot);
  if (video && slot === activeSlot.value) {
    emit('videoElementReady', video);
  }
}

function onVideoCanPlay(slot: Slot): void {
  const video = getVideoForSlot(slot);
  const readyState = video?.readyState ?? 0;
  const bufferedAhead = video ? getBufferedAhead(video) : 0;
  console.log(`[VideoCompositor] Video canplaythrough in slot ${slot}, readyState: ${readyState}, currentTime: ${video?.currentTime?.toFixed(3)}, bufferedAhead: ${bufferedAhead.toFixed(2)}s`);
  
  // Only mark as ready if we have enough data buffered
  // readyState >= 3 means HAVE_FUTURE_DATA, but we also need actual buffer
  if (readyState < 3 || bufferedAhead < MIN_BUFFER_AHEAD) {
    console.log(`[VideoCompositor] Slot ${slot} not ready enough yet (readyState ${readyState}, buffer ${bufferedAhead.toFixed(2)}s < ${MIN_BUFFER_AHEAD}s)`);
    return;
  }
  
  slotReady.value[slot] = true;

  // If this is the slot we're waiting to swap to, do the swap now
  const source = props.activeSource;
  if (source && slotSourceIds.value[slot] === source.id && slot !== activeSlot.value) {
    console.log(`[VideoCompositor] Swapping to newly ready slot ${slot} with ${bufferedAhead.toFixed(2)}s buffer`);

    // Pause old video
    const oldVideo = getActiveVideo();
    if (oldVideo && !oldVideo.paused) {
      oldVideo.pause();
    }

    // Switch to new slot
    activeSlot.value = slot;
    isLoading.value = false;

    // Sync and play
    if (video) {
      syncVideoToTimeline(video, source.videoTime);
      video.playbackRate = props.playbackRate;

      if (props.isPlaying) {
        video.play().catch((e) => console.warn('[VideoCompositor] Play failed:', e));
      }
    }
  } else if (slot === activeSlot.value) {
    isLoading.value = false;

    // Start playback if needed
    if (props.isPlaying && source) {
      if (video && video.paused) {
        video.play().catch((e) => console.warn('[VideoCompositor] Play failed:', e));
      }
    }
  }
}

function onVideoError(e: Event, slot: Slot): void {
  const video = e.target as HTMLVideoElement;
  console.error(`[VideoCompositor] Video error in slot ${slot}:`, video.error);
  emit('error', video.error?.message || 'Video load error');
  slotReady.value[slot] = false;
  isLoading.value = false;
}

// Helper to get buffer info as string
function getBufferInfo(video: HTMLVideoElement): string {
  const buffered = video.buffered;
  if (buffered.length === 0) return 'no buffer';
  const ranges: string[] = [];
  for (let i = 0; i < buffered.length; i++) {
    ranges.push(`${buffered.start(i).toFixed(2)}-${buffered.end(i).toFixed(2)}`);
  }
  return ranges.join(', ');
}

function onVideoWaiting(slot: Slot): void {
  const video = getVideoForSlot(slot);
  const isActive = slot === activeSlot.value;
  console.warn(`[VideoCompositor] ⏸️ WAITING in slot ${slot} (active=${isActive}):`, {
    currentTime: video?.currentTime?.toFixed(3),
    readyState: video?.readyState,
    networkState: video?.networkState,
    buffer: video ? getBufferInfo(video) : 'no video',
    paused: video?.paused,
    seeking: video?.seeking,
  });
}

function onVideoStalled(slot: Slot): void {
  const video = getVideoForSlot(slot);
  const isActive = slot === activeSlot.value;
  console.warn(`[VideoCompositor] 🚫 STALLED in slot ${slot} (active=${isActive}):`, {
    currentTime: video?.currentTime?.toFixed(3),
    readyState: video?.readyState,
    networkState: video?.networkState,
    buffer: video ? getBufferInfo(video) : 'no video',
  });
}

function onVideoPlaying(slot: Slot): void {
  const video = getVideoForSlot(slot);
  const isActive = slot === activeSlot.value;
  console.log(`[VideoCompositor] ▶️ PLAYING in slot ${slot} (active=${isActive}):`, {
    currentTime: video?.currentTime?.toFixed(3),
    readyState: video?.readyState,
    buffer: video ? getBufferInfo(video) : 'no video',
  });
}

function onVideoSeeking(slot: Slot): void {
  const video = getVideoForSlot(slot);
  const isActive = slot === activeSlot.value;
  console.log(`[VideoCompositor] 🔍 SEEKING in slot ${slot} (active=${isActive}):`, {
    currentTime: video?.currentTime?.toFixed(3),
    readyState: video?.readyState,
  });
}

function onVideoSeeked(slot: Slot): void {
  const video = getVideoForSlot(slot);
  const isActive = slot === activeSlot.value;
  console.log(`[VideoCompositor] ✅ SEEKED in slot ${slot} (active=${isActive}):`, {
    currentTime: video?.currentTime?.toFixed(3),
    readyState: video?.readyState,
    buffer: video ? getBufferInfo(video) : 'no video',
  });
}

// Watchers
// Watch for source ID changes (actual segment changes)
watch(
  () => props.activeSource?.id,
  () => {
    updatePlayback();
  },
  { immediate: true }
);

watch(
  () => props.nextSource,
  () => {
    preloadNextSource();
  }
);

// Single watcher for time sync - throttled to avoid excessive seeks
watch(
  () => props.currentTime,
  () => {
    // Throttle sync to avoid excessive seeks
    const now = performance.now();
    if (now - lastSyncTime < 50) return;
    lastSyncTime = now;

    if (props.activeSource) {
      const video = getActiveVideo();
      if (video && slotSourceIds.value[activeSlot.value] === props.activeSource.id) {
        syncVideoToTimeline(video, props.activeSource.videoTime);
      }
    }
  }
);

watch(
  () => props.isPlaying,
  (playing) => {
    const video = getActiveVideo();
    if (!video) return;

    if (playing && video.paused && video.readyState >= 3 && !props.isInGap) {
      video.play().catch(() => {});
    } else if (!playing && !video.paused) {
      video.pause();
    }
  }
);

watch(
  () => props.playbackRate,
  (rate) => {
    const video = getActiveVideo();
    if (video) {
      video.playbackRate = rate;
    }
  }
);

// Watch for muted state changes and apply to both video elements immediately
watch(
  () => props.videoMuted,
  (muted) => {
    console.log('[VideoCompositor] videoMuted changed to:', muted);
    if (videoARef.value) {
      videoARef.value.muted = muted;
    }
    if (videoBRef.value) {
      videoBRef.value.muted = muted;
    }
  },
  { immediate: true }
);

// Lifecycle
onMounted(() => {
  const video = getActiveVideo();
  if (video) {
    emit('videoElementReady', video);
  }
});

onUnmounted(() => {
  // Cleanup HLS instances
  if (hlsInstances.A) {
    hlsInstances.A.destroy();
    hlsInstances.A = null;
  }
  if (hlsInstances.B) {
    hlsInstances.B.destroy();
    hlsInstances.B = null;
  }
});

// Expose methods for parent component
defineExpose({
  getActiveVideo,
  forceSync: () => {
    if (props.activeSource) {
      const video = getActiveVideo();
      if (video) {
        video.currentTime = props.activeSource.videoTime;
      }
    }
  },
});
</script>
