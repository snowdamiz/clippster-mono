<template>
  <div
    ref="fullscreenContainerRef"
    class="flex-1 flex flex-col min-h-0 min-w-0 relative items-center justify-center"
    :class="isFullscreen ? 'p-0 bg-black' : 'p-0'"
  >
    <!-- Video Container - constrained to aspect ratio -->
    <div
      ref="videoContainerRef"
      class="flex items-center justify-center bg-black overflow-hidden relative"
      :class="isFullscreen ? 'rounded-none' : 'rounded-lg'"
      :style="{
        aspectRatio: previewAspectRatio.replace(':', '/'),
        maxHeight: '100%',
        maxWidth: '100%',
        width: 'auto',
        height: 'auto',
      }"
    >
      <!-- Framed container for non-16:9 aspect ratios - always rendered but hidden when not needed -->
      <div
        v-show="showFramedPreview"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black overflow-hidden"
        :style="getFramedContainerStyle()"
      >
        <!-- Framed video element - used for non-16:9 single region mode -->
        <video
          v-show="showFramedPreview && isSingleRegion"
          ref="framedVideoRef"
          :src="videoSrc || ''"
          class="absolute max-w-none"
          :style="getSingleRegionVideoStyle()"
          @loadedmetadata="onFramedVideoLoadedMetadata"
          @timeupdate="onFramedVideoTimeUpdate"
          @ended="onEnded"
          @play="onPlay"
          @pause="onPause"
        />

        <!-- Multi-region: Render each region from the framing config -->
        <template v-if="showFramedPreview && !isSingleRegion">
          <div
            v-for="(region, idx) in currentFramingConfig?.regions || []"
            :key="region.id"
            class="absolute overflow-hidden"
            :style="getRegionOutputStyle(region)"
          >
            <!-- Video crop preview - matches POI editor exactly -->
            <video
              :ref="(el) => setRegionVideoRef(idx, el as HTMLVideoElement)"
              :src="videoSrc || ''"
              class="absolute max-w-none pointer-events-none"
              :style="getCroppedVideoStyle(region)"
              muted
              playsinline
              @loadedmetadata="onRegionVideoLoaded"
            />
          </div>

          <!-- Click handler overlay for multi-region -->
          <div class="absolute inset-0" />
        </template>
      </div>

      <!-- Default 16:9 mode: Normal video display - always rendered, invisible when framed -->
      <!-- Use visibility:hidden instead of v-show to maintain container dimensions -->
      <video
        ref="videoRef"
        :src="videoSrc || ''"
        class="max-w-full max-h-full object-contain"
        :style="{
          ...(editorMode ? getMainVideoStyle() : getVideoFilterStyle()),
          visibility: showFramedPreview ? 'hidden' : 'visible',
          pointerEvents: 'none',
        }"
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @play="onPlay"
        @pause="onPause"
      />

      <!-- Hidden audio-only video for framed multi-region mode -->
      <video
        v-if="showFramedPreview && !isSingleRegion"
        ref="audioVideoRef"
        :src="videoSrc || ''"
        class="sr-only"
        @loadedmetadata="onAudioVideoLoadedMetadata"
        @timeupdate="onAudioVideoTimeUpdate"
        @ended="onEnded"
        @play="onPlay"
        @pause="onPause"
      />

      <!-- Preload video for seamless transitions / crossfade (editor mode only) -->
      <!-- Keep element alive if it's the active video OR if there's a preload source -->
      <video
        v-if="editorMode && (preloadVideoSrc || activeVideoIndex === 1)"
        ref="preloadVideoRef"
        :src="activePreloadSrc"
        class="max-w-full max-h-full object-contain absolute inset-0 m-auto pointer-events-none"
        :style="getPreloadVideoStyle()"
        preload="auto"
        @canplaythrough="onPreloadCanPlay"
        @loadeddata="onPreloadLoadedData"
        @timeupdate="onPreloadTimeUpdate"
        @ended="onEnded"
        @play="onPlay"
        @pause="onPause"
      />

      <!-- Overlay Container - matches video dimensions -->
      <div
        ref="overlayContainerRef"
        class="absolute overflow-hidden z-10"
        :style="getOverlayContainerPositionStyle()"
        @click.self="onOverlayContainerClick"
      >
        <!-- Aspect ratio indicator for framed mode -->
        <div
          v-if="showFramedPreview"
          class="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-[10px] text-white font-medium pointer-events-none z-20"
        >
          {{ previewAspectRatio }}
        </div>

        <!-- Unified Track Rendering (New Architecture) -->
        <template v-if="tracks && tracks.length > 0">
          <TrackRenderer
            v-for="track in overlayTracks"
            :key="track.id"
            :track="track"
            :current-time="currentTime"
            :is-playing="isPlaying"
            :selected-item-ids="effectiveSelectedItemIds"
            :canvas-size="containerSize"
            :aspect-ratio="previewAspectRatio"
            :scale-overrides="unifiedScaleOverrides"
            :rotation-overrides="unifiedRotationOverrides"
            :width-overrides="unifiedWidthOverrides"
            :position-overrides="unifiedPositionOverrides"
            :item-style-overrides="unifiedItemStyleOverrides"
            @item-mousedown="handleTrackItemMousedown"
            @item-image-load="onItemImageLoad"
            @item-resize-start="handleTrackItemResizeStart"
            @item-rotate-start="handleTrackItemRotateStart"
          />
        </template>

        <!-- Creator Profile Watermark (Background watermark - not draggable) -->
        <div
          v-if="shouldShowCreatorWatermark"
          class="absolute pointer-events-none z-10 transition-opacity duration-300"
          :style="getCreatorWatermarkOverlayStyle"
        >
          <img
            :src="creatorWatermarkDataUrl ?? undefined"
            alt="Creator Watermark"
            class="max-w-full max-h-full object-contain"
            :style="{ opacity: getCreatorWatermarkOpacity }"
            @load="onCreatorWatermarkLoad"
          />
        </div>

        <!-- Vignette Overlay (applied as overlay since it's a radial gradient effect) -->
        <div
          v-if="filterSettings?.vignette && filterSettings.vignette > 0"
          class="absolute inset-0 pointer-events-none"
          :style="getVignetteStyle()"
        />

        <!-- Temperature Overlay (warm/cool color tint) -->
        <div
          v-if="filterSettings?.temperature && filterSettings.temperature !== 0"
          class="absolute inset-0 pointer-events-none"
          :style="getTemperatureStyle()"
        />
      </div>
    </div>

    <!-- Controls Bar -->
    <div
      class="bg-black/40 backdrop-blur-sm rounded-lg border border-white/[0.04]"
      :class="isFullscreen ? 'absolute bottom-4 left-4 right-4 mt-0 z-50' : 'mt-2'"
      :style="!isFullscreen && containerSize.width > 0 ? { width: containerSize.width + 'px' } : undefined"
    >
      <div class="flex items-center justify-between px-1 py-1">
        <!-- Left Controls -->
        <div class="flex items-center gap-1">
          <!-- Go to Beginning Button -->
          <button
            @click="goToBeginning"
            class="p-2 hover:bg-white/[0.08] rounded-lg transition-all duration-200 group text-[12px]"
            title="Go to Beginning"
          >
            <SkipBack class="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors" />
          </button>
          <!-- Play/Pause Button -->
          <button
            @click="emit('togglePlay')"
            class="p-2 hover:bg-white/[0.08] rounded-lg transition-all duration-200 group text-[12px]"
            title="Play/Pause (Space)"
          >
            <Play v-if="!isPlaying" class="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors" />
            <Pause v-else class="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors" />
          </button>
          <!-- Time Display -->
          <div
            class="text-white/80 text-[11px] font-mono bg-white/[0.04] px-2.5 py-1.5 rounded-lg ml-1 tabular-nums tracking-tight"
          >
            <span class="text-white/90">{{ formatDuration(displayCurrentTime) }}</span>
            <span class="text-white/40 mx-1">/</span>
            <span class="text-white/50">{{ formatDuration(displayDuration) }}</span>
          </div>
        </div>
        <!-- Right Controls -->
        <div class="flex items-center gap-2 pr-1">
          <!-- Playback Speed Control -->
          <div class="relative">
            <button
              @click="showSpeedMenu = !showSpeedMenu"
              class="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group text-[11px] font-medium text-white/80"
              title="Playback Speed"
            >
              <span>{{ playbackRate }}x</span>
            </button>

            <!-- Speed Menu -->
            <div
              v-if="showSpeedMenu"
              class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[60px] flex flex-col z-50 py-1"
            >
              <button
                v-for="rate in [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]"
                :key="rate"
                @click="setPlaybackRate(rate)"
                class="px-3 py-1.5 text-[11px] hover:bg-white/10 transition-colors text-left flex items-center justify-between gap-2"
                :class="playbackRate === rate ? 'text-violet-400 font-bold bg-violet-500/10' : 'text-white/70'"
              >
                <span>{{ rate }}x</span>
                <Check v-if="playbackRate === rate" :size="10" />
              </button>
            </div>

            <!-- Click outside handler -->
            <div v-if="showSpeedMenu" class="fixed inset-0 z-40" @click="showSpeedMenu = false"></div>
          </div>

          <!-- Volume Control -->
          <div class="flex items-center gap-2 px-1.5 py-1">
            <button
              @click="toggleMute"
              class="p-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group"
              title="Mute/Unmute"
            >
              <VolumeX
                v-if="isMuted || volume === 0"
                class="h-3.5 w-3.5 text-white/50 group-hover:text-white/80 transition-colors"
              />
              <Volume2 v-else class="h-3.5 w-3.5 text-white/60 group-hover:text-white/90 transition-colors" />
            </button>
            <div class="relative w-20 h-1 bg-white/10 rounded-full">
              <div
                class="absolute left-0 top-0 h-full bg-white/40 rounded-full transition-all duration-150"
                :style="{ width: `${volume * 100}%` }"
              ></div>
              <input
                :value="volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10 pt-0.5"
                @input="onVolumeChange"
              />
            </div>
          </div>
          <!-- Fullscreen Button -->
          <button
            @click="toggleFullscreen"
            class="p-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group"
            title="Toggle Fullscreen"
          >
            <Minimize2
              v-if="isFullscreen"
              class="h-3.5 w-3.5 text-white/60 group-hover:text-white/90 transition-colors"
            />
            <Maximize2 v-else class="h-3.5 w-3.5 text-white/60 group-hover:text-white/90 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { Play, Pause, Volume2, VolumeX, RotateCw, SkipBack, Maximize2, Minimize2, Check } from 'lucide-vue-next';
  import Hls from 'hls.js';
  import TrackRenderer from './TrackRenderer.vue';
  import { AnimationService } from '@/services/AnimationService';
  import { useAudioEffects } from '@/composables/useAudioEffects';
  import type {
    TextOverlay,
    Sticker,
    FilterSettings,
    ManualFramingConfigs,
    ClipWatermark,
    ClipWatermarkRatioConfig,
    ClipSubtitleSettings,
    WordInfo,
    WhisperSegment,
    VideoEditorTransition,
    TransitionState,
    ClipSegment,
    AudioTrackEffect,
  } from '@/types';
  import type { Track, TimelineItem } from '@/types/timeline-model';
  import { calculateTransitionState } from '@/types';

  interface DragState {
    isDragging: boolean;
    type: 'text' | 'sticker' | 'watermark' | 'subtitle' | null;
    id: string | null;
    startX: number;
    startY: number;
    startPosition: { x: number; y: number };
  }

  interface WatermarkResizeState {
    isResizing: boolean;
    id: string | null;
    centerX: number;
    centerY: number;
    startDistance: number;
    startScale: number;
  }

  interface ResizeState {
    isResizing: boolean;
    id: string | null;
    side: 'left' | 'right' | null;
    startX: number;
    startWidth: number; // Width as percentage
    startPositionX: number; // Position X as percentage
  }

  interface StickerResizeState {
    isResizing: boolean;
    id: string | null;
    centerX: number;
    centerY: number;
    startDistance: number;
    startScale: number;
  }

  interface StickerRotateState {
    isRotating: boolean;
    id: string | null;
    itemType: 'sticker' | 'text' | 'watermark' | null; // Track item type for proper emit
    startAngle: number;
    startRotation: number;
    centerX: number;
    centerY: number;
  }

  interface SubtitleResizeState {
    isResizing: boolean;
    side: 'left' | 'right' | null;
    startX: number;
    startWidth: number; // Width as percentage (maxWidth)
  }

  const props = withDefaults(
    defineProps<{
      videoSrc: string | null;
      preloadVideoSrc?: string | null; // Next video source for seamless transitions (editor mode)
      currentTime: number;
      effectiveTime: number; // Time position accounting for segment cuts
      isPlaying: boolean;
      clipStart: number;
      clipEnd: number;
      textOverlays: TextOverlay[];
      stickers: Sticker[];
      watermarks?: ClipWatermark[];
      creatorProfileWatermarkSettings?: any | null; // Creator profile watermark (background watermark for all exports)
      filterSettings: FilterSettings | null;
      segments?: ClipSegment[];
      previewAspectRatio: string; // Currently previewed aspect ratio (e.g., "16:9")
      selectedAspectRatios: string[]; // All selected aspect ratios
      framingConfigs: ManualFramingConfigs; // Framing configurations per aspect ratio
      // Subtitle settings
      subtitleSettings?: ClipSubtitleSettings | null;
      transcriptWords?: WordInfo[]; // Words from transcript for subtitle display
      transcriptSegments?: WhisperSegment[]; // Segments from transcript for word grouping
      // Time in source video for subtitle lookup (accounts for trim_start in editor mode)
      subtitleSourceTime?: number;
      // Editor mode - when true, bypass segment-based time management
      editorMode?: boolean;
      // Total duration for editor mode (sum of all source durations)
      editorTotalDuration?: number;
      // Active transition (crossfade, slide, wipe, etc.)
      activeTransition?: VideoEditorTransition | null;
      // Video sources for editor mode (to check audio_extracted flag)
      videoSources?: any[];
      // Unified timeline tracks (new architecture)
      tracks?: Track[];
      // Selected item IDs for unified renderer
      selectedItemIds?: Set<string>;
      // User-controlled video mute state (from timeline mute button)
      isVideoMuted?: boolean;
      // Audio tracks to check if audio was extracted from video
      audioTracks?: Array<{ id: string; name?: string; linkedSourceId?: string; startTime: number; endTime: number }>;
      // Audio effects for Web Audio API preview
      audioEffects?: AudioTrackEffect[];
    }>(),
    {
      watermarks: () => [],
      creatorProfileWatermarkSettings: null,
      preloadVideoSrc: null,
      subtitleSettings: null,
      transcriptWords: () => [],
      transcriptSegments: () => [],
      subtitleSourceTime: 0,
      editorMode: false,
      editorTotalDuration: 0,
      activeTransition: null,
      videoSources: () => [],
      tracks: () => [],
      selectedItemIds: () => new Set(),
      isVideoMuted: false,
      audioTracks: () => [],
      audioEffects: () => [],
    }
  );

  const emit = defineEmits<{
    (e: 'timeUpdate', time: number): void;
    (e: 'togglePlay'): void;
    (e: 'videoElementReady', element: HTMLVideoElement): void;
    (e: 'videoEnded'): void;
    (e: 'videoSwapped'): void; // Emitted when video buffer swap completes
    (e: 'crossfadeCompleted', endTime: number): void; // Emitted when crossfade completes early (video media ended)
    (
      e: 'updateOverlayPosition',
      type: 'text' | 'sticker' | 'watermark',
      id: string,
      position: { x: number; y: number }
    ): void;
    (e: 'updateOverlayWidth', id: string, width: number): void;
    (e: 'updateOverlayRotation', id: string, rotation: number): void;
    (e: 'updateOverlayScale', id: string, scale: number): void;
    (e: 'updateStickerScale', id: string, scale: number): void;
    (e: 'updateStickerRotation', id: string, rotation: number): void;
    (e: 'updateWatermarkScale', id: string, scale: number): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
    (e: 'updateSubtitlePosition', position: { x: number; y: number }): void;
    (e: 'updateSubtitleMaxWidth', maxWidth: number): void;
    // Completion events for undo/redo
    (e: 'overlayDragEnd', type: 'text' | 'sticker' | 'watermark', id: string): void;
    (e: 'overlayResizeEnd', id: string): void;
    (e: 'overlayRotateEnd', id: string): void;
    (e: 'overlayScaleEnd', id: string): void;
    (e: 'stickerResizeEnd', id: string): void;
    (e: 'stickerRotateEnd', id: string): void;
    (e: 'watermarkResizeEnd', id: string): void;
    (e: 'subtitleDragEnd'): void;
    (e: 'subtitleResizeEnd'): void;
    // Track events
    (e: 'trackItemSelect', itemId: string, type: string): void;
  }>();

  // ... existing refs ...

  // Unified Track Rendering Logic
  // (Moved to lower section to avoid duplication)

  function handleTrackItemResizeStart(event: MouseEvent, item: TimelineItem, handle: 'tl' | 'tr' | 'bl' | 'br') {
    console.log('[ClipEditorPreview] handleTrackItemResizeStart called', {
      itemType: item.type,
      itemId: item.id,
      handle,
    });
    // Map unified resize to legacy handlers
    if (item.type === 'sticker') {
      const sticker = props.stickers.find((s) => s.id === item.id);
      if (sticker) startStickerResize(event, sticker);
    } else if (item.type === 'watermark') {
      const watermark = props.watermarks.find((w) => w.id === item.id);
      if (watermark) startWatermarkResize(event, watermark);
    } else if (item.type === 'text') {
      // Use scale-based resize for text (like stickers) for visual feedback
      const overlay = props.textOverlays.find((o) => o.id === item.id);
      if (overlay) startTextResize(event, overlay);
    }
  }

  function handleTrackItemRotateStart(event: MouseEvent, item: TimelineItem) {
    // Unified Rotation Handler
    event.preventDefault();
    event.stopPropagation();

    // Find the track item element using the event target (handle is inside the item)
    const itemEl = (event.target as HTMLElement).closest('.timeline-item') as HTMLElement;
    if (!itemEl) return;

    const rect = itemEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Determine current rotation - for text, check perRatioConfigs first
    const relativeTime = props.currentTime - item.startTime;
    let currentRotation = 0;

    if (item.type === 'text') {
      // For text, get rotation from perRatioConfigs or default
      const overlay = props.textOverlays.find((o) => o.id === item.id);
      if (overlay) {
        const ratioConfig = overlay.perRatioConfigs?.[props.previewAspectRatio];
        currentRotation = ratioConfig?.rotation ?? overlay.rotation ?? 0;
      }
    } else {
      currentRotation = AnimationService.getValueAtTime(item, 'rotation', relativeTime, item.rotation ?? 0);
    }

    // Reuse stickerRotateState as generic rotate state
    stickerRotateState.isRotating = true;
    stickerRotateState.id = item.id;
    stickerRotateState.itemType = item.type as 'sticker' | 'text' | 'watermark';
    stickerRotateState.centerX = centerX;
    stickerRotateState.centerY = centerY;
    stickerRotateState.startRotation = currentRotation;

    // Calculate initial angle
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    stickerRotateState.startAngle = startAngle;

    document.addEventListener('mousemove', onUnifiedRotateMove);
    document.addEventListener('mouseup', onUnifiedRotateEnd);
  }

  // Refs
  const videoRef = ref<HTMLVideoElement | null>(null);
  const framedVideoRef = ref<HTMLVideoElement | null>(null); // Video for framed single-region mode
  const audioVideoRef = ref<HTMLVideoElement | null>(null); // Audio-only video for multi-region mode
  const preloadVideoRef = ref<HTMLVideoElement | null>(null); // Second video for seamless transitions

  // Audio effects preview using Web Audio API
  const audioEffectsRef = computed(() => props.audioEffects || []);
  const currentTimeRef = computed(() => props.currentTime);
  useAudioEffects(videoRef, audioEffectsRef, currentTimeRef);
  const videoContainerRef = ref<HTMLElement | null>(null);
  // ... rest of the code remains the same ...
  const overlayContainerRef = ref<HTMLElement | null>(null);
  const fullscreenContainerRef = ref<HTMLElement | null>(null);
  const regionVideoRefs = ref<(HTMLVideoElement | null)[]>([]);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const isFullscreen = ref(false);
  const isDraggingProgress = ref(false);
  const containerSize = ref({ width: 0, height: 0 });
  const playbackRate = ref(1);
  const showSpeedMenu = ref(false);

  // Double-buffer state for seamless transitions (editor mode)
  const activeVideoIndex = ref<0 | 1>(0); // 0 = main video, 1 = preload video
  const preloadVideoReady = ref(false); // Whether preload video is ready to play
  const lastPreloadSrc = ref<string | null>(null); // Track last loaded preload src to keep it alive

  // Crossfade animation state - uses requestAnimationFrame for smooth 60fps opacity transitions
  const crossfadeAnimationId = ref<number | null>(null);
  const crossfadeActive = ref(false);

  // HLS.js instances for proper MPEG-TS (.ts) file playback with A/V sync
  // We need separate instances for each video element that may play HLS content
  const hlsInstances = new Map<string, Hls>();

  // Check if a URL is an HLS playlist
  function isHlsUrl(url: string | null | undefined): boolean {
    return !!url && url.includes('.m3u8');
  }

  // Setup HLS playback for a video element
  function setupHlsPlayback(videoElement: HTMLVideoElement, hlsUrl: string, instanceKey: string): void {
    // Cleanup existing instance for this key
    cleanupHlsInstance(instanceKey);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log(`[ClipEditorPreview] HLS manifest parsed for ${instanceKey}`);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error(`[ClipEditorPreview] HLS fatal error for ${instanceKey}:`, data.type, data.details);
          // Try to recover from fatal errors
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log(`[ClipEditorPreview] Attempting to recover from network error for ${instanceKey}`);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log(`[ClipEditorPreview] Attempting to recover from media error for ${instanceKey}`);
              hls.recoverMediaError();
              break;
            default:
              cleanupHlsInstance(instanceKey);
              break;
          }
        }
      });

      hlsInstances.set(instanceKey, hls);
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoElement.src = hlsUrl;
    } else {
      console.error('[ClipEditorPreview] HLS not supported in this browser');
    }
  }

  // Cleanup a specific HLS instance
  function cleanupHlsInstance(instanceKey: string): void {
    const hls = hlsInstances.get(instanceKey);
    if (hls) {
      hls.destroy();
      hlsInstances.delete(instanceKey);
    }
  }

  // Cleanup all HLS instances
  function cleanupAllHlsInstances(): void {
    hlsInstances.forEach((hls, key) => {
      hls.destroy();
    });
    hlsInstances.clear();
  }

  // Setup or update HLS for a video element based on source
  function updateVideoSource(
    videoElement: HTMLVideoElement | null,
    src: string | null | undefined,
    instanceKey: string
  ): void {
    if (!videoElement) return;

    if (isHlsUrl(src)) {
      setupHlsPlayback(videoElement, src!, instanceKey);
    } else {
      // Not HLS - cleanup any existing HLS instance and let native video handle it
      cleanupHlsInstance(instanceKey);
      // For non-HLS sources, the :src binding in the template handles it
    }
  }

  // Active preload src - keeps last src when preload is active video
  const activePreloadSrc = computed(() => {
    // CRITICAL: If the preload video is currently the ACTIVE video (after a swap),
    // do NOT change its src to the next preload source - that would interrupt playback!
    // Keep using the current source that's playing.
    if (activeVideoIndex.value === 1 && lastPreloadSrc.value) {
      return lastPreloadSrc.value;
    }
    // Only use the new preload source when main video is active
    if (props.preloadVideoSrc) {
      return props.preloadVideoSrc;
    }
    return '';
  });

  function setPlaybackRate(rate: number) {
    playbackRate.value = rate;
    showSpeedMenu.value = false;

    // Apply to main video
    if (videoRef.value) {
      videoRef.value.playbackRate = rate;
    }

    // Apply to preload video
    if (preloadVideoRef.value) {
      preloadVideoRef.value.playbackRate = rate;
    }

    // Apply to region videos (multi-region mode)
    regionVideoRefs.value.forEach((video) => {
      if (video) {
        video.playbackRate = rate;
      }
    });
  }

  // Ensure playback rate is applied when video elements change or become ready
  watch(videoRef, (el) => {
    if (el) el.playbackRate = playbackRate.value;
  });

  watch(preloadVideoRef, (el) => {
    if (el) el.playbackRate = playbackRate.value;
  });

  // Watch for video mute state changes from parent (timeline mute button)
  watch(
    () => props.isVideoMuted,
    (muted) => {
      // Sync internal mute state with prop
      isMuted.value = muted;
      // Use updateVideoMuteState to properly handle both user mute and auto-mute from extracted audio
      const currentTime = videoRef.value?.currentTime ?? 0;
      updateVideoMuteState(currentTime);
    }
  );

  // Watch for video sources changes to update auto-mute state when audio is extracted
  watch(
    () => props.videoSources,
    () => {
      // When videoSources change (e.g., audio_extracted flag set), update mute state
      const currentTime = videoRef.value?.currentTime ?? 0;
      updateVideoMuteState(currentTime);
    },
    { deep: true }
  );

  // Watch for audio tracks changes (for clip mode) to update auto-mute state
  watch(
    () => props.audioTracks,
    () => {
      // When audioTracks change (e.g., audio extracted from main video), update mute state
      const currentTime = videoRef.value?.currentTime ?? 0;
      updateVideoMuteState(currentTime);
    },
    { deep: true }
  );

  // Track the preload src when it changes (avoid side effects in computed)
  // IMPORTANT: Also reset preloadVideoReady when src changes, so we don't swap to stale content
  watch(
    () => props.preloadVideoSrc,
    (newSrc, oldSrc) => {
      if (newSrc) {
        // CRITICAL: Only update lastPreloadSrc when preload is NOT the active video
        // If preload IS active (after a swap), we must keep lastPreloadSrc unchanged
        // so the currently playing video doesn't get interrupted
        if (activeVideoIndex.value !== 1) {
          lastPreloadSrc.value = newSrc;

          // Only reset ready state when we're actually updating the preload src
          if (oldSrc && newSrc !== oldSrc) {
            console.log('[ClipEditorPreview] Preload src changed from', oldSrc?.slice(-30), 'to', newSrc?.slice(-30));
            preloadVideoReady.value = false;
          }
        } else {
          console.log('[ClipEditorPreview] Ignoring preload src change - preload is active video');
        }
      }
    },
    { immediate: true }
  );

  // Transition state - for non-animated states (initial/final)
  // During active transition, the animation loop handles styles directly
  const transitionState = computed<TransitionState | null>(() => {
    // If transition animation is running, return neutral values (animation loop handles it)
    if (crossfadeActive.value) {
      return null;
    }

    // If no active transition, return full visibility for active video
    if (!props.editorMode || !props.activeTransition) {
      return {
        opacityA: activeVideoIndex.value === 0 ? 1 : 0,
        opacityB: activeVideoIndex.value === 1 ? 1 : 0,
        zIndexA: activeVideoIndex.value === 0 ? 1 : 0,
        zIndexB: activeVideoIndex.value === 1 ? 1 : 0,
      };
    }

    // Transition exists but animation not started yet - calculate initial state
    return calculateTransitionState(props.currentTime, props.activeTransition);
  });

  // Crossfade/Transition animation state tracking
  const crossfadeStartTime = ref<number>(0); // Wall-clock time when transition started
  const crossfadeInitialProgress = ref<number>(0); // Progress into transition when started
  const crossfadePausedAt = ref<number | null>(null); // Progress when animation was paused (for pause/resume)

  // Smooth transition animation loop using requestAnimationFrame (60fps)
  // This bypasses Vue's reactivity for smooth interpolation of all style properties
  function startCrossfadeAnimation() {
    if (crossfadeAnimationId.value !== null || !props.activeTransition) {
      return;
    }

    const transition = props.activeTransition;
    const mainVideo = videoRef.value;
    const preloadVideo = preloadVideoRef.value;

    if (!mainVideo || !preloadVideo) {
      console.warn('[startTransitionAnimation] Missing video refs');
      return;
    }

    // Calculate current progress into transition (when starts)
    const currentProgress =
      transition.duration > 0
        ? Math.max(0, Math.min(1, (props.currentTime - transition.startTime) / transition.duration))
        : 0;

    // Store the start state for time-based interpolation
    crossfadeStartTime.value = performance.now();
    crossfadeInitialProgress.value = currentProgress;
    crossfadeActive.value = true;

    // Calculate remaining duration in milliseconds
    const remainingDuration = transition.duration * (1 - currentProgress) * 1000;

    console.log(
      '[startTransitionAnimation] Starting smooth animation',
      'type:',
      transition.type,
      'range:',
      transition.startTime.toFixed(3),
      '-',
      transition.endTime.toFixed(3),
      'initialProgress:',
      (currentProgress * 100).toFixed(1) + '%',
      'remainingDuration:',
      remainingDuration.toFixed(0) + 'ms'
    );

    function animate() {
      // Check if we should continue animating
      if (!crossfadeActive.value) {
        return;
      }

      const mainVideo = videoRef.value;
      const preloadVideo = preloadVideoRef.value;

      if (!mainVideo || !preloadVideo || !props.activeTransition) {
        stopCrossfadeAnimation(true); // Reset styles on abort
        return;
      }

      const transition = props.activeTransition;

      // Handle pause/resume - if video is paused, save progress and wait
      const isPaused = mainVideo.paused && preloadVideo.paused;
      if (isPaused) {
        // Calculate current progress before pausing
        if (crossfadePausedAt.value === null) {
          const elapsedMs = performance.now() - crossfadeStartTime.value;
          const transitionDurationMs = transition.duration * 1000;
          const progressSinceStart = transitionDurationMs > 0 ? elapsedMs / transitionDurationMs : 1;
          crossfadePausedAt.value = Math.min(1, crossfadeInitialProgress.value + progressSinceStart);
        }
        // Continue the loop but don't advance progress while paused
        crossfadeAnimationId.value = requestAnimationFrame(animate);
        return;
      } else if (crossfadePausedAt.value !== null) {
        // Resuming from pause - reset timing based on saved progress
        crossfadeInitialProgress.value = crossfadePausedAt.value;
        crossfadeStartTime.value = performance.now();
        crossfadePausedAt.value = null;
      }

      // Calculate progress using wall-clock time for smooth animation
      const elapsedMs = performance.now() - crossfadeStartTime.value;
      const transitionDurationMs = transition.duration * 1000;

      // Calculate how much progress we've made since animation started
      const progressSinceStart = transitionDurationMs > 0 ? elapsedMs / transitionDurationMs : 1;

      // Total progress
      const progress = Math.max(0, Math.min(1, crossfadeInitialProgress.value + progressSinceStart));

      // Calculate state for this progress point
      const effectiveTime = transition.startTime + progress * transition.duration;
      const state = calculateTransitionState(effectiveTime, transition);

      // Apply styles directly to DOM elements
      // Opacity
      mainVideo.style.opacity = String(state.opacityA);
      preloadVideo.style.opacity = String(state.opacityB);

      // Transform
      mainVideo.style.transform = state.transformA || 'none';
      preloadVideo.style.transform = state.transformB || 'none';

      // Clip Path
      mainVideo.style.clipPath = state.clipPathA || 'none';
      preloadVideo.style.clipPath = state.clipPathB || 'none';

      // Z-Index
      mainVideo.style.zIndex = String(state.zIndexA);
      preloadVideo.style.zIndex = String(state.zIndexB);

      // Apply volume crossfade (always crossfade audio regardless of visual transition type)
      // Use linear fade for audio
      mainVideo.volume = 1 - progress;
      preloadVideo.volume = progress;

      // Check if complete
      if (progress >= 1) {
        console.log(
          '[transitionAnimation] Complete, progress:',
          (progress * 100).toFixed(1) + '%',
          'elapsed:',
          elapsedMs.toFixed(0) + 'ms'
        );
        // Don't stop animation here - let parent call completeCrossfade
        return;
      }

      // Continue animation
      crossfadeAnimationId.value = requestAnimationFrame(animate);
    }

    // Start the animation loop
    crossfadeAnimationId.value = requestAnimationFrame(animate);
  }

  function stopCrossfadeAnimation(resetStyles: boolean = false) {
    if (crossfadeAnimationId.value !== null) {
      cancelAnimationFrame(crossfadeAnimationId.value);
      crossfadeAnimationId.value = null;
    }
    crossfadeActive.value = false;
    crossfadePausedAt.value = null;

    // Reset styles if requested
    if (resetStyles) {
      const mainVideo = videoRef.value;
      const preloadVideo = preloadVideoRef.value;

      [mainVideo, preloadVideo].forEach((video) => {
        if (video) {
          video.style.opacity = '';
          video.style.transform = '';
          video.style.clipPath = '';
          video.style.zIndex = '';
        }
      });
    }
  }

  // Computed display values for time indicator
  const displayCurrentTime = computed(() => {
    // In editor mode, currentTime prop is already the global timeline position
    if (props.editorMode) {
      return props.currentTime;
    }
    // In clip mode, show the current time RELATIVE to clip start (0-based)
    return Math.max(0, props.currentTime - props.clipStart);
  });

  const displayDuration = computed(() => {
    // In editor mode, use the total duration from all sources
    if (props.editorMode && props.editorTotalDuration > 0) {
      return props.editorTotalDuration;
    }
    // In clip mode, show the CLIP duration, not full video duration
    return Math.max(0, props.clipEnd - props.clipStart);
  });

  // Track actual image dimensions for stickers (stickerId -> {width, height})
  const stickerImageDimensions = ref<Record<string, { width: number; height: number }>>({});

  // Store time to restore after aspect ratio switch
  const pendingSeekTime = ref<number | null>(null);

  // Set region video ref
  function setRegionVideoRef(index: number, el: HTMLVideoElement | null) {
    if (el) {
      regionVideoRefs.value[index] = el;
      // Set initial time to match main video
      if (videoRef.value) {
        el.currentTime = videoRef.value.currentTime;
      }
    }
  }

  // Handle region video loaded - sync time and play state
  function onRegionVideoLoaded(event: Event) {
    const regionVideo = event.target as HTMLVideoElement;
    if (!regionVideo || !videoRef.value) return;

    // Sync time with main video
    regionVideo.currentTime = videoRef.value.currentTime;

    // If main video is playing, start playing this region video too
    if (!videoRef.value.paused) {
      regionVideo.play().catch(() => {});
    }
  }

  // Get style for single region video (uses main video element directly - no sync needed)
  function getSingleRegionVideoStyle(): Record<string, string> {
    const region = currentFramingConfig.value?.regions?.[0];
    if (!region) return { display: 'none' };

    const filterStyle = getVideoFilterStyle();

    // Guard against invalid dimensions
    if (!region.source.width || !region.source.height) {
      return { display: 'none' };
    }

    // Same calculation as getCroppedVideoStyle
    const scaleX = 100 / region.source.width;
    const scaleY = 100 / region.source.height;
    const offsetX = -region.source.x * scaleX;
    const offsetY = -region.source.y * scaleY;

    return {
      width: `${scaleX}%`,
      height: `${scaleY}%`,
      left: `${offsetX}%`,
      top: `${offsetY}%`,
      objectFit: 'fill',
      filter: filterStyle.filter || 'none',
    };
  }

  // Sync region videos with main video - only called on seek/play/pause, not continuously
  // Continuous syncing causes lag due to multiple video decoding
  function syncRegionVideos(forceTimeSync: boolean = false) {
    if (!videoRef.value) return;
    const mainVideo = videoRef.value;
    const currentTime = mainVideo.currentTime;
    const isPaused = mainVideo.paused;

    regionVideoRefs.value.forEach((regionVideo) => {
      if (regionVideo && regionVideo.readyState >= 1) {
        // Only sync time when explicitly requested (on seek) or if significantly out of sync
        const timeDiff = Math.abs(regionVideo.currentTime - currentTime);
        if (forceTimeSync || timeDiff > 0.5) {
          regionVideo.currentTime = currentTime;
        }

        // Sync play state
        if (isPaused) {
          if (!regionVideo.paused) {
            regionVideo.pause();
          }
        } else {
          if (regionVideo.paused) {
            regionVideo.play().catch(() => {});
          }
        }
      }
    });
  }

  // Unified sync function - only needed for multi-region mode now
  // Single region uses the main video directly, no sync needed
  function syncAllPreviewVideos(forceTimeSync: boolean = false) {
    if (!showFramedPreview.value || !videoRef.value) return;

    // Only sync if multi-region mode (single region uses main video directly)
    if (!isSingleRegion.value) {
      syncRegionVideos(forceTimeSync);
    }
  }

  // No longer using animation frame loop - too expensive with multiple videos
  function startSyncLoop() {
    // Just do an initial sync, don't start continuous loop
    syncAllPreviewVideos(true);
  }

  function stopSyncLoop() {
    // No-op now, kept for compatibility
  }

  // Drag state
  const dragState = reactive<DragState>({
    isDragging: false,
    type: null,
    id: null,
    startX: 0,
    startY: 0,
    startPosition: { x: 0, y: 0 },
  });

  // Resize state for text overlay width handles
  const resizeState = reactive<ResizeState>({
    isResizing: false,
    id: null,
    side: null,
    startX: 0,
    startWidth: 0,
    startPositionX: 0,
  });

  // Sticker resize state (for scale)
  const stickerResizeState = reactive<StickerResizeState>({
    isResizing: false,
    id: null,
    centerX: 0,
    centerY: 0,
    startDistance: 0,
    startScale: 1,
  });

  // Sticker rotate state (also used for text rotation)
  const stickerRotateState = reactive<StickerRotateState>({
    isRotating: false,
    id: null,
    itemType: null,
    startAngle: 0,
    startRotation: 0,
    centerX: 0,
    centerY: 0,
  });

  // Local sticker scale/rotation tracking for instant feedback during drag
  const localStickerScales = ref<Record<string, number>>({});
  const localStickerRotations = ref<Record<string, number>>({});

  // Text resize state (for scale-based resizing like stickers)
  const textResizeState = reactive<{
    isResizing: boolean;
    id: string | null;
    centerX: number;
    centerY: number;
    startDistance: number;
    startScale: number;
  }>({
    isResizing: false,
    id: null,
    centerX: 0,
    centerY: 0,
    startDistance: 0,
    startScale: 1,
  });

  // Local text scale tracking for instant feedback during resize
  const localTextScales = ref<Record<string, number>>({});

  // Watermark resize state (for scale)
  const watermarkResizeState = reactive<WatermarkResizeState>({
    isResizing: false,
    id: null,
    centerX: 0,
    centerY: 0,
    startDistance: 0,
    startScale: 1,
  });

  // Track actual image dimensions for watermarks (watermarkId -> {width, height})
  const watermarkImageDimensions = ref<Record<string, { width: number; height: number }>>({});

  // Local watermark scale tracking for instant feedback during drag
  const localWatermarkScales = ref<Record<string, number>>({});

  // Subtitle resize state (for maxWidth)
  const subtitleResizeState = reactive<SubtitleResizeState>({
    isResizing: false,
    side: null,
    startX: 0,
    startWidth: 90,
  });

  // Local subtitle maxWidth tracking for instant feedback during resize
  const localSubtitleMaxWidth = ref<number | null>(null);

  // Local width tracking to prevent reflow during drag (before Vue updates)
  const localDragWidths = ref<Record<string, number>>({});

  // Local position tracking for smooth drag feedback
  const localDragPositions = ref<Record<string, { x: number; y: number }>>({});

  // Unified Track Logic
  const overlayTracks = computed(() => {
    if (!props.tracks) return [];
    // Sort tracks by orderIndex (ascending for visual stacking)
    // Higher orderIndex means higher z-index (rendered later)
    // Exclude the main video track (index 0) because it is rendered by the specialized main video player
    // to support seamless looping, preloading, and complex crossfades that TrackRenderer doesn't handle yet.
    // In TimelineAdapter, video tracks have IDs starting with 'track-video-'
    return props.tracks.filter((t) => t.id !== 'track-video-0').sort((a, b) => a.orderIndex - b.orderIndex);
  });

  // Track selection state
  // Derived from prop + current interaction
  const effectiveSelectedItemIds = computed(() => {
    // Start with explicitly selected items from prop
    const set = new Set<string>(props.selectedItemIds);

    // Add currently interacting items
    if (dragState.id) set.add(dragState.id);
    if (resizeState.id) set.add(resizeState.id);
    if (stickerResizeState.id) set.add(stickerResizeState.id);
    if (watermarkResizeState.id) set.add(watermarkResizeState.id);
    if (stickerRotateState.id) set.add(stickerRotateState.id);
    if (textResizeState.id) set.add(textResizeState.id);

    return set;
  });

  // Overrides for immediate feedback during interaction
  const unifiedScaleOverrides = computed(() => {
    return {
      ...localStickerScales.value,
      ...localWatermarkScales.value,
      ...localTextScales.value,
    };
  });

  const unifiedRotationOverrides = computed(() => {
    return {
      ...localStickerRotations.value,
    };
  });

  const unifiedWidthOverrides = computed(() => {
    return {
      ...localDragWidths.value,
    };
  });

  const unifiedPositionOverrides = computed(() => {
    return {
      ...localDragPositions.value,
    };
  });

  const unifiedItemStyleOverrides = computed(() => {
    const overrides: Record<string, Record<string, string>> = {};
    if (!props.tracks) return overrides;

    for (const track of props.tracks) {
      // Skip main video track
      if (track.id === 'track-video-0') continue;

      for (const item of track.items) {
        if (item.type === 'sticker' && item.originalData) {
          overrides[item.id] = getStickerImageStyle(item.originalData as Sticker);
        } else if (item.type === 'watermark' && item.originalData) {
          overrides[item.id] = getWatermarkImageStyle(item.originalData as ClipWatermark);
        } else if (item.type === 'text' && item.originalData) {
          overrides[item.id] = getTextOverlayStyle(item.originalData as TextOverlay);
        }
      }
    }
    return overrides;
  });

  function onItemImageLoad(event: Event, item: TimelineItem) {
    const img = event.target as HTMLImageElement;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;

    const dimensions = { width: img.naturalWidth, height: img.naturalHeight };

    if (item.type === 'sticker') {
      stickerImageDimensions.value[item.id] = dimensions;
    } else if (item.type === 'watermark') {
      watermarkImageDimensions.value[item.id] = dimensions;
    }
  }

  function handleTrackItemMousedown(e: MouseEvent, item: TimelineItem) {
    // Emit selection event
    emit('trackItemSelect', item.id, item.type);

    if (item.type === 'text') {
      startDrag(e, 'text', item.id, { x: (item.positionX ?? 0.5) * 100, y: (item.positionY ?? 0.5) * 100 });
    } else if (item.type === 'sticker') {
      if (item.originalData) startStickerDrag(e, item.originalData);
    } else if (item.type === 'video') {
      // Check if it's a watermark (legacy/fallback check)
      if (item.originalData && 'watermarkId' in item.originalData) {
        startWatermarkDrag(e, item.originalData);
      }
      // TODO: Handle generic video PiP drag
    } else if (item.type === 'watermark') {
      if (item.originalData) startWatermarkDrag(e, item.originalData);
    }
  }

  // Computed
  // Get sorted segments for playback control
  const sortedSegments = computed(() => {
    if (!props.segments || props.segments.length === 0) {
      return [{ start_time: props.clipStart, end_time: props.clipEnd }];
    }
    return [...props.segments].sort((a, b) => a.start_time - b.start_time);
  });

  // Creator profile watermark support
  const creatorWatermarkDataUrl = ref<string | null>(null);
  const creatorWatermarkDimensions = ref<{ width: number; height: number } | null>(null);

  function onCreatorWatermarkLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      creatorWatermarkDimensions.value = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }
  }

  // Load creator profile watermark when settings or aspect ratio change
  watch(
    [() => props.creatorProfileWatermarkSettings, () => props.previewAspectRatio],
    async ([settings, aspectRatio]) => {
      if (!settings || !settings.enabled) {
        creatorWatermarkDataUrl.value = null;
        creatorWatermarkDimensions.value = null;
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
        creatorWatermarkDataUrl.value = null;
        creatorWatermarkDimensions.value = null;
        return;
      }

      console.log('[ClipEditorPreview] Loading creator watermark for ratio:', aspectRatio, 'ID:', targetWatermarkId);

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { getWatermarkImage } = await import('@/services/database/watermarks');
        const { getWatermarkByServerId } = await import('@/services/database');

        let dataUrl: string | null = null;
        let dimensions: { width: number; height: number } | null = null;

        // Check if this is an organization asset (ID format: org-asset-{serverId})
        if (targetWatermarkId.startsWith('org-asset-')) {
          const serverId = parseInt(targetWatermarkId.replace('org-asset-', ''), 10);
          console.log('[ClipEditorPreview] Loading org watermark with serverId:', serverId);

          if (!isNaN(serverId)) {
            // First try to load from local cache
            const localWatermark = await getWatermarkByServerId(serverId);
            if (localWatermark) {
              console.log('[ClipEditorPreview] Found cached org watermark:', localWatermark.name);
              dataUrl = await invoke<string>('read_file_as_data_url', { filePath: localWatermark.file_path });
              dimensions = { width: localWatermark.width || 0, height: localWatermark.height || 0 };
            } else {
              // Not cached locally - download through Tauri (bypasses CORS)
              console.log('[ClipEditorPreview] Org watermark not cached, downloading from server...');
              const { getUserOrganizationAssets } = await import('@/services/organizationAssetsApi');
              const { ensureAssetDownloaded } = await import('@/services/orgAssetSync');
              const serverResponse = await getUserOrganizationAssets();
              if (serverResponse.success && serverResponse.assets) {
                const serverAsset = serverResponse.assets.find(
                  (a) => a.id === serverId && a.asset_type === 'watermark'
                );
                if (serverAsset && serverAsset.url) {
                  console.log('[ClipEditorPreview] Downloading org watermark:', serverAsset.name);
                  // Download and cache the asset locally (bypasses CORS)
                  const downloadResult = await ensureAssetDownloaded(serverAsset);
                  if (downloadResult.success && downloadResult.filePath) {
                    console.log('[ClipEditorPreview] Org watermark downloaded to:', downloadResult.filePath);
                    dataUrl = await invoke<string>('read_file_as_data_url', { filePath: downloadResult.filePath });
                    dimensions = { width: serverAsset.width || 0, height: serverAsset.height || 0 };
                  } else {
                    console.error('[ClipEditorPreview] Failed to download org watermark:', downloadResult.error);
                  }
                }
              }
            }
          }
        } else {
          // Regular watermark lookup by ID
          const watermark = await getWatermarkImage(targetWatermarkId);
          if (watermark) {
            dataUrl = await invoke<string>('read_file_as_data_url', { filePath: watermark.file_path });
            dimensions = { width: watermark.width || 0, height: watermark.height || 0 };
          }
        }

        if (dataUrl) {
          creatorWatermarkDataUrl.value = dataUrl;
          creatorWatermarkDimensions.value = dimensions;
          console.log('[ClipEditorPreview] Loaded creator watermark successfully');
        } else {
          console.log('[ClipEditorPreview] No watermark data found for ID:', targetWatermarkId);
          creatorWatermarkDataUrl.value = null;
          creatorWatermarkDimensions.value = null;
        }
      } catch (error) {
        console.error('[ClipEditorPreview] Failed to load creator watermark:', error);
        creatorWatermarkDataUrl.value = null;
        creatorWatermarkDimensions.value = null;
      }
    },
    { immediate: true }
  );

  // Determine if creator watermark should show
  const shouldShowCreatorWatermark = computed(() => {
    if (!props.creatorProfileWatermarkSettings?.enabled) return false;
    if (!creatorWatermarkDataUrl.value) return false;

    // Don't show creator watermark if timeline watermarks exist
    // Timeline watermarks handle display (and will use creator settings as fallback for positioning)
    if (props.watermarks && props.watermarks.length > 0) {
      return false;
    }

    // Check if this aspect ratio has watermark disabled in per-ratio settings
    const perRatio = props.creatorProfileWatermarkSettings.perRatioSettings;
    if (perRatio) {
      const ratioKey = props.previewAspectRatio;
      if (ratioKey in perRatio && perRatio[ratioKey] === null) {
        return false;
      }
    }
    return true;
  });

  // Get watermark opacity (using per-ratio settings if available)
  const getCreatorWatermarkOpacity = computed(() => {
    if (!props.creatorProfileWatermarkSettings) return 0.8;

    const perRatio = props.creatorProfileWatermarkSettings.perRatioSettings;
    if (perRatio && perRatio[props.previewAspectRatio]) {
      const config = perRatio[props.previewAspectRatio];
      const opacity = config.position?.opacity ?? props.creatorProfileWatermarkSettings.opacity ?? 80;
      return opacity / 100;
    }

    return (props.creatorProfileWatermarkSettings.opacity ?? 80) / 100;
  });

  // Get creator watermark overlay style (position and size)
  const getCreatorWatermarkOverlayStyle = computed(() => {
    if (!props.creatorProfileWatermarkSettings) return {};

    const settings = props.creatorProfileWatermarkSettings;
    const wmWidth = creatorWatermarkDimensions.value?.width ?? null;
    const wmHeight = creatorWatermarkDimensions.value?.height ?? null;
    const ratio = wmWidth && wmHeight ? wmWidth / wmHeight : null;
    const is16x9 = ratio ? Math.abs(ratio - 16 / 9) < 0.02 : false;

    // Parse aspect ratio to check if we're in 16:9
    const parts = props.previewAspectRatio.split(':').map(Number);
    const isPreview16x9 = parts.length === 2 && parts[0] === 16 && parts[1] === 9;

    // Check if this is a full-frame watermark
    const isFullFrame =
      is16x9 && wmWidth !== null && wmHeight !== null && wmWidth >= 1600 && wmHeight >= 900 && isPreview16x9;

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

    const perRatio = settings.perRatioSettings;
    console.log('[ClipEditorPreview] getCreatorWatermarkOverlayStyle:', {
      previewAspectRatio: props.previewAspectRatio,
      hasPerRatio: !!perRatio,
      perRatioKeys: perRatio ? Object.keys(perRatio) : [],
      ratioConfig: perRatio ? perRatio[props.previewAspectRatio] : null,
      defaultPosition: { x: positionX, y: positionY, scale },
    });
    if (perRatio && perRatio[props.previewAspectRatio]) {
      const config = perRatio[props.previewAspectRatio];
      if (config.position) {
        positionX = config.position.x ?? positionX;
        positionY = config.position.y ?? positionY;
        scale = config.position.scale ?? scale;
        console.log('[ClipEditorPreview] Using per-ratio position:', { x: positionX, y: positionY, scale });
      }
    }

    return {
      left: `${positionX}%`,
      top: `${positionY}%`,
      transform: 'translate(-50%, -50%)',
      width: `${scale}%`,
    };
  });

  // Calculate max words based on aspect ratio (matches VideoPlayer)
  const maxWordsForAspectRatio = computed(() => {
    // Parse preview aspect ratio (e.g., "16:9" -> 16/9)
    const parts = props.previewAspectRatio.split(':').map(Number);
    const aspectRatioValue = parts.length === 2 && parts[1] !== 0 ? parts[0] / parts[1] : 16 / 9;

    if (aspectRatioValue > 1.5) {
      return 6; // wide formats (16:9, 21:9)
    } else if (aspectRatioValue > 0.9) {
      return 4; // squarish (1:1, 4:3)
    } else {
      return 3; // vertical (9:16, 4:5)
    }
  });

  // Get the time to use for subtitle lookups (source video time in editor mode)
  const subtitleLookupTime = computed(() => {
    // In editor mode with subtitleSourceTime, use that (maps to actual source video time)
    if (props.editorMode && props.subtitleSourceTime !== undefined) {
      return props.subtitleSourceTime;
    }
    // Otherwise use currentTime
    return props.currentTime || 0;
  });

  // Find the current whisper segment (matches VideoPlayer)
  const currentSegment = computed((): WhisperSegment | null => {
    if (!props.subtitleSettings?.enabled || !props.transcriptSegments || props.transcriptSegments.length === 0) {
      return null;
    }

    const time = subtitleLookupTime.value;

    // Find segment that contains the current time
    for (const segment of props.transcriptSegments) {
      if (time >= segment.start && time <= segment.end) {
        return segment;
      }
    }

    // Return null if in dead space between segments
    return null;
  });

  // Get all words from the current segment (matches VideoPlayer)
  const segmentWords = computed((): WordInfo[] => {
    if (!currentSegment.value) return [];

    // If segment has words attached, use those
    if (currentSegment.value.words && currentSegment.value.words.length > 0) {
      return currentSegment.value.words;
    }

    // Otherwise, filter from all transcript words
    if (!props.transcriptWords || props.transcriptWords.length === 0) return [];

    const segment = currentSegment.value;
    return props.transcriptWords.filter((word) => {
      // Include word if it starts within segment OR ends within segment OR spans the entire segment
      return (
        (word.start >= segment.start && word.start < segment.end) ||
        (word.end > segment.start && word.end <= segment.end) ||
        (word.start <= segment.start && word.end >= segment.end)
      );
    });
  });

  // Get visible words (chunked display - matches VideoPlayer)
  const visibleSubtitleWords = computed((): WordInfo[] => {
    const allSegmentWords = segmentWords.value;
    if (allSegmentWords.length === 0) return [];

    const maxWords = maxWordsForAspectRatio.value;
    const time = subtitleLookupTime.value;

    // If segment has fewer words than the limit, show all
    if (allSegmentWords.length <= maxWords) {
      return allSegmentWords;
    }

    // Find the current word being spoken
    let currentWordIndex = -1;
    for (let i = 0; i < allSegmentWords.length; i++) {
      const word = allSegmentWords[i];
      if (time >= word.start && time < word.end) {
        currentWordIndex = i;
        break;
      }
    }

    // If no word is currently being spoken, find the next upcoming word
    if (currentWordIndex === -1) {
      for (let i = 0; i < allSegmentWords.length; i++) {
        if (allSegmentWords[i].start > time) {
          currentWordIndex = i;
          break;
        }
      }
    }

    // If still no match, default to first chunk
    if (currentWordIndex === -1) {
      currentWordIndex = 0;
    }

    // Calculate which "chunk" (page) this word belongs to
    const chunkIndex = Math.floor(currentWordIndex / maxWords);
    const startIndex = chunkIndex * maxWords;
    const endIndex = Math.min(startIndex + maxWords, allSegmentWords.length);

    return allSegmentWords.slice(startIndex, endIndex);
  });

  // Check if a word is currently being spoken
  function isCurrentWord(word: { start: number; end: number }): boolean {
    const time = subtitleLookupTime.value;
    return time >= word.start && time <= word.end;
  }

  // Get the animation class based on animation style
  const getSubtitleAnimationClass = computed(() => {
    const style = props.subtitleSettings?.animationStyle;
    if (!style || style === 'none') return {};

    return {
      'animation-zoom': style === 'zoom',
      'animation-karaoke': style === 'karaoke',
      'animation-pop': style === 'pop',
      'animation-glow': style === 'glow',
      'animation-box-highlight': style === 'box-highlight',
      'animation-typewriter': style === 'typewriter',
      'animation-wave': style === 'wave',
    };
  });

  // Get typewriter style (controls visibility for typewriter effect)
  function getTypewriterStyle(word: { start: number; end: number }): Record<string, string> {
    const style = props.subtitleSettings?.animationStyle;
    if (style !== 'typewriter') return {};

    const time = subtitleLookupTime.value;
    const isVisible = time >= word.start;

    return {
      opacity: isVisible ? '1' : '0',
      transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
    };
  }

  // Calculate animation duration for a specific word based on its timing
  function getWordAnimationDuration(word: { start: number; end: number }): number {
    const wordDuration = word.end - word.start;

    // For very short words (under 50ms), use instant transition
    if (wordDuration < 0.05) return 0;
    // For short words (50-100ms), use 30% of duration
    if (wordDuration < 0.1) return wordDuration * 0.3;
    // For medium words (100-200ms), use 35% of duration
    if (wordDuration < 0.2) return wordDuration * 0.35;
    // For normal words (200-400ms), use 40% of duration
    if (wordDuration < 0.4) return wordDuration * 0.4;
    // For longer words (400ms+), use 45% but cap at 200ms
    const calculatedDuration = wordDuration * 0.45;
    return Math.min(0.2, calculatedDuration);
  }

  // Calculate word gap (spacing between words) - matches VideoPlayer implementation
  const wordGapStyle = computed(() => {
    if (!props.subtitleSettings) return '0.35em';
    const wordSpacing = props.subtitleSettings.wordSpacing || 0.35;
    return `${wordSpacing}em`;
  });

  // Scaled font size for SVG text
  const scaledFontSize = computed(() => {
    const fontSize = subtitleFontSizeForRatio.value;
    return Math.round(fontSize * overlayScaleFactor.value);
  });

  // Scaled letter spacing for SVG text
  const scaledLetterSpacing = computed(() => {
    if (!props.subtitleSettings) return 0;
    return (props.subtitleSettings.letterSpacing || 0) * overlayScaleFactor.value;
  });

  // Style for hidden sizing span
  const getWordTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;

    return {
      color: settings.textColor,
      fontFamily: `"${settings.fontFamily}", Arial, sans-serif`,
      fontWeight: String(settings.fontWeight),
      fontSize: `${scaledFontSize.value}px`,
      letterSpacing: `${scaledLetterSpacing.value}px`,
    };
  });

  // Get subtitle container style (position, width, background)
  function getSubtitleContainerStyle(): Record<string, string> {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    const position = subtitlePositionForRatio.value;
    const scale = overlayScaleFactor.value;

    // Calculate scaled values
    const scaledPadding = Math.round((settings.padding || 0) * scale);
    const scaledBorderRadius = Math.round((settings.borderRadius || 0) * scale);
    const scaledLineHeight = settings.lineHeight || 1.2;

    // Use local maxWidth during resize for instant feedback, otherwise use per-ratio config
    const maxWidth = localSubtitleMaxWidth.value ?? subtitleMaxWidthForRatio.value;

    // Determine text alignment for flex justify-content
    let justifyContent = 'center';
    if (settings.textAlign === 'left') justifyContent = 'flex-start';
    else if (settings.textAlign === 'right') justifyContent = 'flex-end';

    const baseStyles: Record<string, string> = {
      top: `${position.y}%`,
      left: `${position.x}%`,
      transform: 'translate(-50%, -50%)',
      width: `${maxWidth}%`,
      display: 'flex',
      justifyContent,
      alignItems: 'center',
      lineHeight: String(scaledLineHeight),
      textAlign: settings.textAlign,
    };

    // Add background styles if enabled
    if (settings.backgroundEnabled) {
      baseStyles.backgroundColor = settings.backgroundColor || '#000000';
      baseStyles.padding = `${scaledPadding}px`;
      baseStyles.borderRadius = `${scaledBorderRadius}px`;
    }

    return baseStyles;
  }

  // Get subtitle text container style (inner flex container for word alignment)
  function getSubtitleTextContainerStyle(): Record<string, string> {
    if (!props.subtitleSettings) return { gap: wordGapStyle.value };

    const settings = props.subtitleSettings;

    // Determine text alignment for flex justify-content
    let justifyContent = 'center';
    if (settings.textAlign === 'left') justifyContent = 'flex-start';
    else if (settings.textAlign === 'right') justifyContent = 'flex-end';

    return {
      gap: wordGapStyle.value,
      justifyContent,
    };
  }

  // Get subtitle position for current aspect ratio
  const subtitlePositionForRatio = computed(() => {
    if (!props.subtitleSettings) {
      return { x: 50, y: 85 };
    }

    const ratio = props.previewAspectRatio;
    const ratioConfig = props.subtitleSettings.perRatioConfigs?.[ratio];

    if (ratioConfig?.position) {
      return ratioConfig.position;
    }

    return {
      x: props.subtitleSettings.positionX,
      y: props.subtitleSettings.positionY,
    };
  });

  // Get subtitle font size for current aspect ratio
  const subtitleFontSizeForRatio = computed(() => {
    if (!props.subtitleSettings) {
      return 32;
    }

    const ratio = props.previewAspectRatio;
    const ratioConfig = props.subtitleSettings.perRatioConfigs?.[ratio];

    if (ratioConfig?.fontSize) {
      return ratioConfig.fontSize;
    }

    return props.subtitleSettings.fontSize;
  });

  // Get subtitle max width for current aspect ratio
  const subtitleMaxWidthForRatio = computed(() => {
    if (!props.subtitleSettings) {
      return 90;
    }

    const ratio = props.previewAspectRatio;
    const ratioConfig = props.subtitleSettings.perRatioConfigs?.[ratio];

    if (ratioConfig?.maxWidth !== undefined) {
      return ratioConfig.maxWidth;
    }

    return props.subtitleSettings.maxWidth;
  });

  // Helper to check if a watermark is the creator profile watermark
  function isCreatorProfileWatermark(watermark: ClipWatermark): boolean {
    if (!props.creatorProfileWatermarkSettings?.watermarkId) return false;
    const creatorWmId = props.creatorProfileWatermarkSettings.watermarkId;
    const wmId = watermark.watermarkId;
    // Check match handling both raw ID and potential prefix differences
    return wmId === creatorWmId || wmId === `org-asset-${creatorWmId}` || creatorWmId === `org-asset-${wmId}`;
  }

  // Get watermark config for current aspect ratio
  function getWatermarkConfigForRatio(watermark: ClipWatermark): ClipWatermarkRatioConfig {
    const ratio = props.previewAspectRatio;

    // FIRST: Try to use creator profile settings if watermark matches
    // This ensures we always use the source-of-truth positioning for creator watermarks
    const creatorSettings = props.creatorProfileWatermarkSettings;
    if (creatorSettings?.perRatioSettings && watermark.watermarkId) {
      const creatorWmId = creatorSettings.watermarkId;
      const wmId = watermark.watermarkId;

      // Check if IDs match (handle both raw and org-asset-X formats)
      const idsMatch =
        creatorWmId === wmId ||
        (creatorWmId &&
          wmId &&
          (creatorWmId === `org-asset-${wmId}` ||
            wmId === `org-asset-${creatorWmId}` ||
            creatorWmId.replace('org-asset-', '') === wmId.replace('org-asset-', '')));

      if (idsMatch) {
        const ratioSettings = creatorSettings.perRatioSettings[ratio];
        if (ratioSettings?.position) {
          console.log('[ClipEditorPreview] Using creator profile settings for ratio:', ratio, {
            watermarkId: wmId,
            position: ratioSettings.position,
          });
          return {
            position: { x: ratioSettings.position.x, y: ratioSettings.position.y },
            scale: ratioSettings.position.scale,
            opacity: ratioSettings.position.opacity,
            isFullFrameOverlay: ratioSettings.position.isFullFrameOverlay,
          };
        }
      }
    }

    // SECOND: Fall back to stored perRatioConfigs (for non-creator watermarks)
    const perRatioConfig = watermark.perRatioConfigs?.[ratio];
    if (perRatioConfig) {
      return perRatioConfig;
    }

    // THIRD: Fall back to default values
    return {
      position: { ...watermark.position },
      scale: watermark.scale,
      opacity: watermark.opacity,
    };
  }

  // Get the content style for watermark scaling
  function getWatermarkImageStyle(watermark: ClipWatermark): Record<string, string> {
    const config = getWatermarkConfigForRatio(watermark);

    // Full-frame overlay mode: fill the entire container
    if (config.isFullFrameOverlay) {
      return {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      };
    }

    // Creator profile watermarks use percentage-based sizing (wrapper has width: X%)
    // Image should fill the wrapper while maintaining aspect ratio - matches creator watermark styling
    if (isCreatorProfileWatermark(watermark)) {
      return {
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
      };
    }

    const containerScale = overlayScaleFactor.value;
    // Base width at current container scale
    const baseWidth = 162 * containerScale;

    // Get cached dimensions for this watermark
    const dims = watermarkImageDimensions.value[watermark.id];

    if (dims) {
      // Check for full-frame watermark
      const ratio = dims.width / dims.height;
      const is16x9 = Math.abs(ratio - 16 / 9) < 0.02;
      const isFullFrame = is16x9 && dims.width >= 1600 && dims.height >= 900 && props.previewAspectRatio === '16:9';

      // Full-frame: render at 100% (wrapper handles it)
      if (isFullFrame) {
        return {
          width: '100%',
          height: '100%',
        };
      }

      // Regular watermark: scale based on base width
      const aspectRatio = dims.width / dims.height;
      const width = baseWidth;
      const height = baseWidth / aspectRatio;

      return {
        width: `${width}px`,
        height: `${height}px`,
      };
    }

    // Fallback before image loads
    return {
      width: `${baseWidth}px`,
      height: 'auto',
    };
  }

  // Helper to start watermark drag (position)
  function startWatermarkDrag(e: MouseEvent, watermark: ClipWatermark) {
    const config = getWatermarkConfigForRatio(watermark);
    startDrag(e, 'watermark', watermark.id, config.position);
  }

  // Watermark resize handlers (for scale) - uses distance from center for intuitive resizing
  function startWatermarkResize(e: MouseEvent, watermark: ClipWatermark) {
    e.preventDefault();
    e.stopPropagation();

    // Get the watermark element to find its center
    const watermarkEl = (e.target as HTMLElement).closest('[data-item-id]') as HTMLElement;
    if (!watermarkEl) return;

    const rect = watermarkEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial distance from center to mouse
    const startDistance = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));

    const config = getWatermarkConfigForRatio(watermark);

    watermarkResizeState.isResizing = true;
    watermarkResizeState.id = watermark.id;
    watermarkResizeState.centerX = centerX;
    watermarkResizeState.centerY = centerY;
    watermarkResizeState.startDistance = startDistance;
    watermarkResizeState.startScale = config.scale / 15; // Convert from percentage to multiplier

    document.addEventListener('mousemove', onWatermarkResizeMove);
    document.addEventListener('mouseup', onWatermarkResizeEnd);
  }

  function onWatermarkResizeMove(e: MouseEvent) {
    if (!watermarkResizeState.isResizing || !watermarkResizeState.id) return;

    // Calculate current distance from center to mouse
    const currentDistance = Math.sqrt(
      Math.pow(e.clientX - watermarkResizeState.centerX, 2) + Math.pow(e.clientY - watermarkResizeState.centerY, 2)
    );

    // Scale is proportional to distance ratio
    const distanceRatio =
      watermarkResizeState.startDistance > 0 ? currentDistance / watermarkResizeState.startDistance : 1;

    let newScaleMultiplier = watermarkResizeState.startScale * distanceRatio;

    // Clamp scale multiplier to reasonable bounds (0.2x to 5x)
    newScaleMultiplier = Math.max(0.2, Math.min(5, newScaleMultiplier));

    // Convert back to percentage for storage (multiply by 15 to get back to percentage scale)
    const newScalePercent = Math.round(newScaleMultiplier * 15);

    // Set local scale immediately for instant feedback
    localWatermarkScales.value[watermarkResizeState.id] = newScaleMultiplier;

    // Emit scale update
    emit('updateWatermarkScale', watermarkResizeState.id, newScalePercent);
  }

  function onWatermarkResizeEnd() {
    if (watermarkResizeState.id) {
      // Emit completion event for undo/redo
      emit('watermarkResizeEnd', watermarkResizeState.id);
      // Clear local scale after emit completes
      delete localWatermarkScales.value[watermarkResizeState.id];
    }

    watermarkResizeState.isResizing = false;
    watermarkResizeState.id = null;

    document.removeEventListener('mousemove', onWatermarkResizeMove);
    document.removeEventListener('mouseup', onWatermarkResizeEnd);
  }

  // Start subtitle drag
  function startSubtitleDrag(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const position = subtitlePositionForRatio.value;

    dragState.isDragging = true;
    dragState.type = 'subtitle';
    dragState.id = 'subtitle';
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.startPosition = { ...position };

    document.addEventListener('mousemove', onSubtitleDragMove);
    document.addEventListener('mouseup', onSubtitleDragEnd);
  }

  function onSubtitleDragMove(e: MouseEvent) {
    if (!dragState.isDragging || dragState.type !== 'subtitle' || !overlayContainerRef.value) return;

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    let newX = dragState.startPosition.x + deltaXPercent;
    let newY = dragState.startPosition.y + deltaYPercent;

    // Clamp to bounds
    newX = Math.max(5, Math.min(95, newX));
    newY = Math.max(5, Math.min(95, newY));

    emit('updateSubtitlePosition', { x: newX, y: newY });
  }

  function onSubtitleDragEnd() {
    emit('subtitleDragEnd');
    dragState.isDragging = false;
    dragState.type = null;
    dragState.id = null;

    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
  }

  // Subtitle resize handlers (for maxWidth)
  function startSubtitleResize(e: MouseEvent, side: 'left' | 'right') {
    e.preventDefault();
    e.stopPropagation();

    if (!props.subtitleSettings) return;

    subtitleResizeState.isResizing = true;
    subtitleResizeState.side = side;
    subtitleResizeState.startX = e.clientX;
    subtitleResizeState.startWidth = localSubtitleMaxWidth.value ?? subtitleMaxWidthForRatio.value;

    document.addEventListener('mousemove', onSubtitleResizeMove);
    document.addEventListener('mouseup', onSubtitleResizeEnd);
  }

  function onSubtitleResizeMove(e: MouseEvent) {
    if (!subtitleResizeState.isResizing || !overlayContainerRef.value) return;

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    // Calculate delta in percentage
    const deltaX = e.clientX - subtitleResizeState.startX;
    const deltaXPercent = (deltaX / rect.width) * 100;

    let newWidth: number;

    if (subtitleResizeState.side === 'right') {
      // Dragging right handle: increase width when moving right
      newWidth = subtitleResizeState.startWidth + deltaXPercent * 2; // *2 because we're resizing from center
    } else {
      // Dragging left handle: increase width when moving left
      newWidth = subtitleResizeState.startWidth - deltaXPercent * 2; // *2 because we're resizing from center
    }

    // Clamp width to reasonable bounds (20% to 100%)
    newWidth = Math.max(20, Math.min(100, newWidth));

    // Set local width immediately for instant feedback
    localSubtitleMaxWidth.value = newWidth;

    // Emit width update
    emit('updateSubtitleMaxWidth', Math.round(newWidth));
  }

  function onSubtitleResizeEnd() {
    emit('subtitleResizeEnd');
    // Clear local width after emit completes
    localSubtitleMaxWidth.value = null;

    subtitleResizeState.isResizing = false;
    subtitleResizeState.side = null;

    document.removeEventListener('mousemove', onSubtitleResizeMove);
    document.removeEventListener('mouseup', onSubtitleResizeEnd);
  }

  // Generate a default center-crop region for an aspect ratio
  function generateDefaultCenterCrop(targetRatio: string): {
    source: { x: number; y: number; width: number; height: number };
    output: { x: number; y: number; width: number; height: number };
    id: string;
  } {
    const { width: targetW, height: targetH } = parseAspectRatio(targetRatio);
    const targetAspect = targetW / targetH;

    // Source is 16:9
    const sourceAspect = 16 / 9;

    let sourceWidth: number, sourceHeight: number;

    if (targetAspect > sourceAspect) {
      // Target is wider than source - fit to width, crop top/bottom
      sourceWidth = 1;
      sourceHeight = sourceAspect / targetAspect;
    } else {
      // Target is taller than source - fit to height, crop left/right
      sourceHeight = 1;
      sourceWidth = targetAspect / sourceAspect;
    }

    // Center the crop
    const sourceX = (1 - sourceWidth) / 2;
    const sourceY = (1 - sourceHeight) / 2;

    return {
      id: 'default-center-crop',
      source: {
        x: sourceX,
        y: sourceY,
        width: sourceWidth,
        height: sourceHeight,
      },
      output: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    };
  }

  // Get current framing config for the selected aspect ratio
  const currentFramingConfig = computed(() => {
    // Check if this aspect ratio is selected
    const isSelected = props.selectedAspectRatios.includes(props.previewAspectRatio);
    if (!isSelected) return null;

    // Check if there's a manual config with regions
    const manualConfig = props.framingConfigs[props.previewAspectRatio as keyof ManualFramingConfigs];
    if (manualConfig && manualConfig.regions && manualConfig.regions.length > 0) {
      return manualConfig;
    }

    // For 16:9 without manual config, return null (show full video)
    if (props.previewAspectRatio === '16:9') return null;

    // Generate a default center-crop preview for auto mode or unconfigured manual mode
    return {
      mode: 'auto' as const,
      regions: [generateDefaultCenterCrop(props.previewAspectRatio)],
      targetAspectRatio: props.previewAspectRatio,
      sourceAspectRatio: '16:9',
    };
  });

  // Check if we should show framed preview (actual export result)
  const showFramedPreview = computed(() => {
    return (
      currentFramingConfig.value !== null &&
      currentFramingConfig.value.regions &&
      currentFramingConfig.value.regions.length > 0
    );
  });

  // Check if this is a single region layout (can use optimized single video approach)
  const isSingleRegion = computed(() => {
    return currentFramingConfig.value?.regions?.length === 1;
  });

  // Parse aspect ratio string to get width/height ratio
  function parseAspectRatio(ratio: string): { width: number; height: number } {
    const [w, h] = ratio.split(':').map(Number);
    return { width: w || 16, height: h || 9 };
  }

  // Get the framed container style (maintains target aspect ratio)
  function getFramedContainerStyle(): Record<string, string> {
    // Use cached container size to avoid layout thrashing
    const { width: containerWidth, height: containerHeight } = containerSize.value;
    if (containerWidth === 0 || containerHeight === 0) {
      return { width: '100%', height: '100%' };
    }

    const { width: ratioW, height: ratioH } = parseAspectRatio(props.previewAspectRatio);
    const targetAspect = ratioW / ratioH;
    const containerAspect = containerWidth / containerHeight;

    let width: number, height: number;

    if (containerAspect > targetAspect) {
      // Container is wider than target - fit to height
      height = containerHeight;
      width = height * targetAspect;
    } else {
      // Container is taller than target - fit to width
      width = containerWidth;
      height = width / targetAspect;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  }

  // Get style for a region's output position in the framed container
  function getRegionOutputStyle(region: {
    output: { x: number; y: number; width: number; height: number };
  }): Record<string, string> {
    return {
      left: `${region.output.x * 100}%`,
      top: `${region.output.y * 100}%`,
      width: `${region.output.width * 100}%`,
      height: `${region.output.height * 100}%`,
    };
  }

  // Calculate the cropped video style to show only the source selection
  // EXACT copy of POI editor's getCroppedImageStyle function
  // The media is scaled up so the source crop fills the output container,
  // then positioned so the crop area aligns with the container's top-left
  function getCroppedVideoStyle(region: {
    source: { x: number; y: number; width: number; height: number };
  }): Record<string, string> {
    const filterStyle = getVideoFilterStyle();

    // Guard against invalid dimensions
    if (!region.source.width || !region.source.height) {
      return { display: 'none' };
    }

    // Calculate scale factors - how much to scale the full media
    // so that the source crop area fills the container (100%)
    const scaleX = 100 / region.source.width;
    const scaleY = 100 / region.source.height;

    // Calculate position - offset the media so the crop area starts at 0,0
    // The offset needs to account for the scaled size
    const offsetX = -region.source.x * scaleX;
    const offsetY = -region.source.y * scaleY;

    return {
      width: `${scaleX}%`,
      height: `${scaleY}%`,
      left: `${offsetX}%`,
      top: `${offsetY}%`,
      objectFit: 'fill', // Force video/image to fill exact dimensions, ignoring aspect ratio
      filter: filterStyle.filter || 'none',
    };
  }

  // Get overlay container position style (matches the framed container or video)
  function getOverlayContainerPositionStyle(): Record<string, string> {
    if (showFramedPreview.value) {
      // Match the framed container dimensions and center it
      const frameStyle = getFramedContainerStyle();
      return {
        ...frameStyle,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // Non-framed mode: Calculate actual video bounds within the container
    // The video uses object-contain, so it fits within container while maintaining aspect ratio
    const { width: containerWidth, height: containerHeight } = containerSize.value;
    if (containerWidth === 0 || containerHeight === 0 || !videoRef.value) {
      return { inset: '0' };
    }

    // Get the video's intrinsic aspect ratio
    const videoWidth = videoRef.value.videoWidth || 1920;
    const videoHeight = videoRef.value.videoHeight || 1080;
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth: number, displayHeight: number;

    if (containerAspect > videoAspect) {
      // Container is wider than video - video is constrained by height
      displayHeight = containerHeight;
      displayWidth = displayHeight * videoAspect;
    } else {
      // Container is taller than video - video is constrained by width
      displayWidth = containerWidth;
      displayHeight = displayWidth / videoAspect;
    }

    return {
      width: `${displayWidth}px`,
      height: `${displayHeight}px`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // Drag methods
  function startDrag(
    e: MouseEvent,
    type: 'text' | 'sticker' | 'watermark',
    id: string,
    position: { x: number; y: number }
  ) {
    e.preventDefault();
    e.stopPropagation();

    // For text overlays, capture and lock the current width to prevent auto-resizing during drag
    if (type === 'text' && overlayContainerRef.value) {
      const overlay = props.textOverlays.find((o) => o.id === id);
      if (overlay) {
        const config = getOverlayConfigForRatio(overlay);
        // Only capture width if not already explicitly set
        if (config.style?.width === undefined || config.style.width <= 0) {
          const overlayEl = overlayContainerRef.value.querySelector(`[data-item-id="${id}"]`) as HTMLElement;
          if (overlayEl) {
            const containerRect = overlayContainerRef.value.getBoundingClientRect();
            const capturedWidth = (overlayEl.offsetWidth / containerRect.width) * 100;
            // Set local width immediately to prevent reflow during drag
            localDragWidths.value[id] = capturedWidth;
            // Also emit width update to persist it
            emit('updateOverlayWidth', id, capturedWidth);
          }
        }
      }
    }

    dragState.isDragging = true;
    dragState.type = type;
    dragState.id = id;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.startPosition = { ...position };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    if (!dragState.isDragging || !overlayContainerRef.value) return;

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    // Calculate delta in pixels
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    // Convert to percentage
    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    // Calculate new position
    let newX = dragState.startPosition.x + deltaXPercent;
    let newY = dragState.startPosition.y + deltaYPercent;

    // Clamp to bounds (allow some overflow for edge positioning)
    newX = Math.max(-10, Math.min(110, newX));
    newY = Math.max(-10, Math.min(110, newY));

    // Emit position update (only for text, sticker, watermark - subtitle has its own handler)
    if (dragState.type && dragState.id && dragState.type !== 'subtitle') {
      // Update local position for immediate feedback
      localDragPositions.value[dragState.id] = { x: newX / 100, y: newY / 100 }; // Store as 0-1 normalized

      emit('updateOverlayPosition', dragState.type, dragState.id, { x: newX, y: newY });
    }
  }

  function onDragEnd() {
    // Emit completion event for undo/redo before clearing state
    if (dragState.type && dragState.id && dragState.type !== 'subtitle') {
      emit('overlayDragEnd', dragState.type, dragState.id);

      // Clear local position override
      delete localDragPositions.value[dragState.id];
    }

    dragState.isDragging = false;
    dragState.type = null;
    dragState.id = null;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // Resize handlers for text overlay width
  function startResize(e: MouseEvent, overlayId: string, side: 'left' | 'right') {
    e.preventDefault();
    e.stopPropagation();

    console.log('[ClipEditorPreview] startResize called', { overlayId, side });

    const overlay = props.textOverlays.find((o) => o.id === overlayId);
    if (!overlay || !overlayContainerRef.value) {
      console.log('[ClipEditorPreview] startResize early return', {
        overlay: !!overlay,
        containerRef: !!overlayContainerRef.value,
      });
      return;
    }

    const config = getOverlayConfigForRatio(overlay);
    const currentStyle = config.style;

    // Get current width - use explicit width or calculate from element
    let currentWidth = currentStyle?.width;
    if (currentWidth === undefined || currentWidth <= 0) {
      // Calculate initial width from the element's actual rendered size
      const overlayEl = overlayContainerRef.value.querySelector(`[data-item-id="${overlayId}"]`) as HTMLElement;
      if (overlayEl) {
        const containerRect = overlayContainerRef.value.getBoundingClientRect();
        currentWidth = (overlayEl.offsetWidth / containerRect.width) * 100;
      } else {
        currentWidth = 30; // Default starting width
      }
    }

    resizeState.isResizing = true;
    resizeState.id = overlayId;
    resizeState.side = side;
    resizeState.startX = e.clientX;
    resizeState.startWidth = currentWidth;
    resizeState.startPositionX = config.position.x;

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!resizeState.isResizing || !overlayContainerRef.value || !resizeState.id) {
      return;
    }
    console.log('[ClipEditorPreview] onResizeMove', { id: resizeState.id, clientX: e.clientX });

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    // Calculate delta in percentage
    const deltaX = e.clientX - resizeState.startX;
    const deltaXPercent = (deltaX / rect.width) * 100;

    let newWidth: number;

    if (resizeState.side === 'right') {
      // Dragging right handle: increase width when moving right
      newWidth = resizeState.startWidth + deltaXPercent * 2; // *2 because we're resizing from center
    } else {
      // Dragging left handle: increase width when moving left
      newWidth = resizeState.startWidth - deltaXPercent * 2; // *2 because we're resizing from center
    }

    // Clamp width to reasonable bounds (10% to 100%)
    newWidth = Math.max(10, Math.min(100, newWidth));

    console.log('[ClipEditorPreview] onResizeMove setting width', { id: resizeState.id, newWidth, deltaXPercent });

    // Set local width immediately for instant feedback
    localDragWidths.value[resizeState.id] = newWidth;

    // Emit width update to persist it
    emit('updateOverlayWidth', resizeState.id, newWidth);
  }

  function onResizeEnd() {
    // Emit completion event for undo/redo before clearing state
    if (resizeState.id) {
      emit('overlayResizeEnd', resizeState.id);
    }

    resizeState.isResizing = false;
    resizeState.id = null;
    resizeState.side = null;

    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  // Helper to start sticker drag (position)
  function startStickerDrag(e: MouseEvent, sticker: Sticker) {
    const config = getStickerConfigForRatio(sticker);
    startDrag(e, 'sticker', sticker.id, config.position);
  }

  // Sticker resize handlers (for scale) - uses distance from center for intuitive resizing
  function startStickerResize(e: MouseEvent, sticker: Sticker) {
    e.preventDefault();
    e.stopPropagation();

    // Get the sticker element to find its center
    const stickerEl = (e.target as HTMLElement).closest('[data-item-id]') as HTMLElement;
    if (!stickerEl) return;

    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial distance from center to mouse
    const startDistance = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));

    const config = getStickerConfigForRatio(sticker);

    stickerResizeState.isResizing = true;
    stickerResizeState.id = sticker.id;
    stickerResizeState.centerX = centerX;
    stickerResizeState.centerY = centerY;
    stickerResizeState.startDistance = startDistance;
    stickerResizeState.startScale = config.scale;

    document.addEventListener('mousemove', onStickerResizeMove);
    document.addEventListener('mouseup', onStickerResizeEnd);
  }

  function onStickerResizeMove(e: MouseEvent) {
    if (!stickerResizeState.isResizing || !stickerResizeState.id) return;

    // Calculate current distance from center to mouse
    const currentDistance = Math.sqrt(
      Math.pow(e.clientX - stickerResizeState.centerX, 2) + Math.pow(e.clientY - stickerResizeState.centerY, 2)
    );

    // Scale is proportional to distance ratio
    // When mouse moves further from center, scale increases
    const distanceRatio = stickerResizeState.startDistance > 0 ? currentDistance / stickerResizeState.startDistance : 1;

    let newScale = stickerResizeState.startScale * distanceRatio;

    // Only enforce minimum scale (0.1x), no maximum limit
    newScale = Math.max(0.1, newScale);

    // Set local scale immediately for instant feedback
    localStickerScales.value[stickerResizeState.id] = newScale;

    // Emit scale update
    emit('updateStickerScale', stickerResizeState.id, newScale);
  }

  function onStickerResizeEnd() {
    if (stickerResizeState.id) {
      // Emit completion event for undo/redo
      emit('stickerResizeEnd', stickerResizeState.id);
      // Clear local scale after emit completes
      delete localStickerScales.value[stickerResizeState.id];
    }

    stickerResizeState.isResizing = false;
    stickerResizeState.id = null;

    document.removeEventListener('mousemove', onStickerResizeMove);
    document.removeEventListener('mouseup', onStickerResizeEnd);
  }

  // Text resize handlers (scale-based like stickers)
  function startTextResize(e: MouseEvent, overlay: TextOverlay) {
    e.preventDefault();
    e.stopPropagation();

    // Get the text element to find its center
    const textEl = (e.target as HTMLElement).closest('[data-item-id]') as HTMLElement;
    if (!textEl) return;

    const rect = textEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial distance from center to mouse
    const startDistance = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));

    // Get current scale from perRatioConfigs or default to 1
    const ratioConfig = overlay.perRatioConfigs?.[props.previewAspectRatio];
    const currentScale = ratioConfig?.scale ?? overlay.scale ?? 1;

    textResizeState.isResizing = true;
    textResizeState.id = overlay.id;
    textResizeState.centerX = centerX;
    textResizeState.centerY = centerY;
    textResizeState.startDistance = startDistance;
    textResizeState.startScale = currentScale;

    document.addEventListener('mousemove', onTextResizeMove);
    document.addEventListener('mouseup', onTextResizeEnd);
  }

  function onTextResizeMove(e: MouseEvent) {
    if (!textResizeState.isResizing || !textResizeState.id) return;

    // Calculate current distance from center to mouse
    const currentDistance = Math.sqrt(
      Math.pow(e.clientX - textResizeState.centerX, 2) + Math.pow(e.clientY - textResizeState.centerY, 2)
    );

    // Scale is proportional to distance ratio
    const distanceRatio = textResizeState.startDistance > 0 ? currentDistance / textResizeState.startDistance : 1;

    let newScale = textResizeState.startScale * distanceRatio;

    // Enforce minimum scale (0.1x), no maximum limit
    newScale = Math.max(0.1, newScale);

    // Set local scale immediately for instant feedback
    localTextScales.value[textResizeState.id] = newScale;

    // Emit scale update
    emit('updateOverlayScale', textResizeState.id, newScale);
  }

  function onTextResizeEnd() {
    if (textResizeState.id) {
      // Emit completion event for undo/redo
      emit('overlayScaleEnd', textResizeState.id);
      // Clear local scale after emit completes
      delete localTextScales.value[textResizeState.id];
    }

    textResizeState.isResizing = false;
    textResizeState.id = null;

    document.removeEventListener('mousemove', onTextResizeMove);
    document.removeEventListener('mouseup', onTextResizeEnd);
  }

  // Sticker rotation handlers
  function startStickerRotate(e: MouseEvent, stickerId: string, stickerEl: HTMLElement, currentRotation: number) {
    e.preventDefault();
    e.stopPropagation();

    // Get the center of the sticker element
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial angle from center to mouse
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    stickerRotateState.isRotating = true;
    stickerRotateState.id = stickerId;
    stickerRotateState.startAngle = startAngle;
    stickerRotateState.startRotation = currentRotation;
    stickerRotateState.centerX = centerX;
    stickerRotateState.centerY = centerY;

    document.addEventListener('mousemove', onStickerRotateMove);
    document.addEventListener('mouseup', onStickerRotateEnd);
  }

  function onStickerRotateMove(e: MouseEvent) {
    if (!stickerRotateState.isRotating || !stickerRotateState.id) return;

    // Calculate current angle from center to mouse
    const currentAngle =
      Math.atan2(e.clientY - stickerRotateState.centerY, e.clientX - stickerRotateState.centerX) * (180 / Math.PI);

    // Calculate rotation delta
    const angleDelta = currentAngle - stickerRotateState.startAngle;
    // Apply delta - sticker rotates to follow the mouse movement
    let newRotation = stickerRotateState.startRotation + angleDelta;

    // Normalize rotation to -180 to 180 range
    while (newRotation > 180) newRotation -= 360;
    while (newRotation < -180) newRotation += 360;

    // Set local rotation immediately for instant feedback
    localStickerRotations.value[stickerRotateState.id] = newRotation;

    // Emit rotation update
    emit('updateStickerRotation', stickerRotateState.id, Math.round(newRotation));
  }

  function onStickerRotateEnd() {
    if (stickerRotateState.id) {
      // Emit completion event for undo/redo
      emit('stickerRotateEnd', stickerRotateState.id);
      // Clear local rotation after emit completes
      delete localStickerRotations.value[stickerRotateState.id];
    }

    stickerRotateState.isRotating = false;
    stickerRotateState.id = null;
    stickerRotateState.itemType = null;

    document.removeEventListener('mousemove', onStickerRotateMove);
    document.removeEventListener('mouseup', onStickerRotateEnd);
  }

  // Unified rotation handlers for TrackRenderer items (text, sticker, watermark)
  function onUnifiedRotateMove(e: MouseEvent) {
    if (!stickerRotateState.isRotating || !stickerRotateState.id) return;

    // Calculate current angle from center to mouse
    const currentAngle =
      Math.atan2(e.clientY - stickerRotateState.centerY, e.clientX - stickerRotateState.centerX) * (180 / Math.PI);

    // Calculate rotation delta
    const angleDelta = currentAngle - stickerRotateState.startAngle;
    let newRotation = stickerRotateState.startRotation + angleDelta;

    // Normalize rotation to -180 to 180 range
    while (newRotation > 180) newRotation -= 360;
    while (newRotation < -180) newRotation += 360;

    // Set local rotation immediately for instant feedback
    localStickerRotations.value[stickerRotateState.id] = newRotation;

    // Emit rotation update based on item type
    const roundedRotation = Math.round(newRotation);
    if (stickerRotateState.itemType === 'text') {
      emit('updateOverlayRotation', stickerRotateState.id, roundedRotation);
    } else if (stickerRotateState.itemType === 'sticker') {
      emit('updateStickerRotation', stickerRotateState.id, roundedRotation);
    }
    // Watermark rotation could be added here if needed
  }

  function onUnifiedRotateEnd() {
    if (stickerRotateState.id) {
      // Emit completion event for undo/redo based on item type
      if (stickerRotateState.itemType === 'text') {
        emit('overlayRotateEnd', stickerRotateState.id);
      } else if (stickerRotateState.itemType === 'sticker') {
        emit('stickerRotateEnd', stickerRotateState.id);
      }
      // Clear local rotation after emit completes
      delete localStickerRotations.value[stickerRotateState.id];
    }

    stickerRotateState.isRotating = false;
    stickerRotateState.id = null;
    stickerRotateState.itemType = null;

    document.removeEventListener('mousemove', onUnifiedRotateMove);
    document.removeEventListener('mouseup', onUnifiedRotateEnd);
  }

  // Methods
  function formatDuration(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';

    const totalSeconds = Math.floor(seconds);

    if (totalSeconds < 60) {
      return `0:${totalSeconds.toString().padStart(2, '0')}`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  // Check if current playback position is in a segment with extracted audio and mute accordingly
  // Also respects user's explicit mute setting from the timeline
  // Works in both editor mode (checks video sources) and clip mode (checks audio tracks)
  function updateVideoMuteState(currentTime: number) {
    if (!videoRef.value) return;

    // If user has explicitly muted, always mute
    if (props.isVideoMuted) {
      videoRef.value.muted = true;
      if (preloadVideoRef.value) {
        preloadVideoRef.value.muted = true;
      }
      return;
    }

    let shouldMute = false;

    if (props.editorMode) {
      // Editor mode: check if current video source has audio_extracted flag
      if (props.videoSources && props.videoSources.length > 0) {
        for (const source of props.videoSources) {
          if (currentTime >= source.start_time && currentTime < source.end_time) {
            // Check if this source has audio extracted (use snake_case as returned from DB)
            // Database stores as 1/0, so use truthy check instead of strict equality
            if ((source as any).audio_extracted) {
              shouldMute = true;
              break;
            }
          }
        }
      }
    } else {
      // Clip mode: check if any audio track was extracted from the main video
      // In clip mode, linkedSourceId may be 'main' or undefined (for older tracks)
      // Also check track name for "Extracted" pattern as fallback
      if (props.audioTracks && props.audioTracks.length > 0) {
        const hasExtractedAudio = props.audioTracks.some((track) => {
          // Check linkedSourceId first (for tracks created with the link)
          if (track.linkedSourceId === 'main') return true;
          // Fallback: check if track name indicates extraction
          const trackName = (track as any).name || '';
          return trackName.includes('Extracted') || trackName.includes('(Audio)');
        });
        if (hasExtractedAudio) {
          shouldMute = true;
        }
      }
    }

    // Mute/unmute the video element
    videoRef.value.muted = shouldMute;

    // Also update preload video if it exists
    if (preloadVideoRef.value) {
      preloadVideoRef.value.muted = shouldMute;
    }
  }

  function goToBeginning() {
    if (videoRef.value) {
      const firstSegment = sortedSegments.value[0];
      videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
      emit('timeUpdate', videoRef.value.currentTime);
      syncAllPreviewVideos(true);
    }
  }

  function onLoadedMetadata() {
    if (videoRef.value) {
      duration.value = videoRef.value.duration;

      // Check if we have a pending seek time from aspect ratio switch
      if (pendingSeekTime.value !== null) {
        videoRef.value.currentTime = pendingSeekTime.value;
        pendingSeekTime.value = null;
      } else {
        const firstSegment = sortedSegments.value[0];
        videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
      }

      // Update container size now that we know the video dimensions
      // This ensures the overlay container matches the video bounds
      updateContainerSize();

      emit('videoElementReady', videoRef.value);
    }
  }

  function onTimeUpdate() {
    if (videoRef.value && !isDraggingProgress.value) {
      const currentVideoTime = videoRef.value.currentTime;

      // Check if video should be muted (works in both editor and clip mode)
      updateVideoMuteState(currentVideoTime);

      // In editor mode, handle time updates differently
      if (props.editorMode) {
        // Only emit time updates from main video when it's the active video (index 0)
        // When activeVideoIndex === 1, the preload video is active and handles time updates
        if (activeVideoIndex.value === 0) {
          // Only log occasionally to avoid spam
          if (Math.floor(currentVideoTime * 10) % 5 === 0) {
            console.log(
              '[ClipEditorPreview.onTimeUpdate] Main video time:',
              currentVideoTime.toFixed(3),
              'activeVideoIndex:',
              activeVideoIndex.value,
              'paused:',
              videoRef.value.paused
            );
          }
          emit('timeUpdate', currentVideoTime);
        }
        return;
      }

      // Clip mode: segment-based time management
      const segments = sortedSegments.value;

      let currentSegmentIndex = -1;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (currentVideoTime >= seg.start_time && currentVideoTime <= seg.end_time) {
          currentSegmentIndex = i;
          break;
        }
      }

      if (currentSegmentIndex >= 0) {
        emit('timeUpdate', currentVideoTime);
        // Note: sync is handled by the animation frame loop during playback
        return;
      }

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (currentVideoTime > seg.end_time) {
          const nextSegment = segments[i + 1];

          if (nextSegment) {
            if (currentVideoTime < nextSegment.start_time) {
              videoRef.value.currentTime = nextSegment.start_time;
              emit('timeUpdate', nextSegment.start_time);
              // Sync after segment jump
              syncAllPreviewVideos(true);
              return;
            }
          } else {
            videoRef.value.currentTime = segments[0].start_time;
            videoRef.value.pause();
            emit('timeUpdate', segments[0].start_time);
            // Sync after segment jump
            syncAllPreviewVideos(true);
            return;
          }
        }
      }

      if (currentVideoTime < segments[0].start_time) {
        videoRef.value.currentTime = segments[0].start_time;
        emit('timeUpdate', segments[0].start_time);
        // Sync after segment jump
        syncAllPreviewVideos(true);
        return;
      }

      emit('timeUpdate', currentVideoTime);
    }
  }

  // Event handlers for framed video (single-region mode)
  function onFramedVideoLoadedMetadata() {
    if (framedVideoRef.value) {
      duration.value = framedVideoRef.value.duration;

      // Check if we have a pending seek time from aspect ratio switch
      if (pendingSeekTime.value !== null) {
        framedVideoRef.value.currentTime = pendingSeekTime.value;
        pendingSeekTime.value = null;
      }

      updateContainerSize();
      emit('videoElementReady', framedVideoRef.value);
    }
  }

  function onFramedVideoTimeUpdate() {
    if (framedVideoRef.value && !isDraggingProgress.value && showFramedPreview.value && isSingleRegion.value) {
      const currentVideoTime = framedVideoRef.value.currentTime;
      updateVideoMuteState(currentVideoTime);

      if (props.editorMode) {
        if (activeVideoIndex.value === 0) {
          emit('timeUpdate', currentVideoTime);
        }
        return;
      }

      emit('timeUpdate', currentVideoTime);
    }
  }

  // Event handlers for audio-only video (multi-region mode)
  function onAudioVideoLoadedMetadata() {
    if (audioVideoRef.value) {
      duration.value = audioVideoRef.value.duration;

      if (pendingSeekTime.value !== null) {
        audioVideoRef.value.currentTime = pendingSeekTime.value;
        pendingSeekTime.value = null;
      }

      updateContainerSize();
      emit('videoElementReady', audioVideoRef.value);
    }
  }

  function onAudioVideoTimeUpdate() {
    if (audioVideoRef.value && !isDraggingProgress.value && showFramedPreview.value && !isSingleRegion.value) {
      const currentVideoTime = audioVideoRef.value.currentTime;
      updateVideoMuteState(currentVideoTime);

      if (props.editorMode) {
        if (activeVideoIndex.value === 0) {
          emit('timeUpdate', currentVideoTime);
        }
        return;
      }

      emit('timeUpdate', currentVideoTime);
    }
  }

  function onEnded(event: Event) {
    const endedVideo = event.target as HTMLVideoElement;
    const isMainVideo = endedVideo === videoRef.value;
    const isPreloadVideo = endedVideo === preloadVideoRef.value;

    console.log(
      '[ClipEditorPreview.onEnded] Called.',
      'isMainVideo:',
      isMainVideo,
      'isPreloadVideo:',
      isPreloadVideo,
      'activeVideoIndex:',
      activeVideoIndex.value,
      'hasActiveTransition:',
      !!props.activeTransition,
      'endedVideo.currentTime:',
      endedVideo.currentTime.toFixed(3)
    );

    // In editor mode, handle video ended based on which video ended
    if (props.editorMode) {
      // If we're in a crossfade and the MAIN video ended, this is expected
      // The preload video should continue playing - don't emit videoEnded yet
      if (props.activeTransition && endedVideo === videoRef.value && preloadVideoRef.value) {
        // Main video's media file ended during crossfade
        // This happens when the source file is shorter than the timeline position
        // We need to complete the crossfade immediately and sync the timeline
        const transition = props.activeTransition;
        console.log(
          '[ClipEditorPreview.onEnded] Main video media ended during crossfade.',
          'Transition zone:',
          transition.startTime.toFixed(3),
          '-',
          transition.endTime.toFixed(3),
          'preloadVideo.currentTime:',
          preloadVideoRef.value.currentTime.toFixed(3)
        );

        // Make sure preload video is playing and has proper volume
        preloadVideoRef.value.volume = 1;
        if (preloadVideoRef.value.paused) {
          preloadVideoRef.value.play().catch(() => {});
        }

        // Switch to preload as active since main video can no longer display
        activeVideoIndex.value = 1;
        preloadVideoReady.value = false;

        // Emit that crossfade completed (video swap happened)
        // Parent should update timeline to transition end position
        emit('videoSwapped');
        emit('videoElementReady', preloadVideoRef.value);

        // Also emit a special event to tell parent to jump to end of transition
        // This syncs the timeline with the visual state
        emit('crossfadeCompleted', transition.endTime);
        return;
      }

      // If preload video ended (or no crossfade), emit to parent
      console.log('[ClipEditorPreview.onEnded] Emitting videoEnded to parent');
      emit('videoEnded');
      return;
    }

    if (videoRef.value) {
      const firstSegment = sortedSegments.value[0];
      videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
    }
    // Sync after loop back
    syncAllPreviewVideos(true);
  }

  // Called when preload video is ready to play
  function onPreloadCanPlay() {
    if (!props.editorMode || !preloadVideoRef.value) return;
    console.log('[onPreloadCanPlay] Preload is ready. src:', preloadVideoRef.value.src?.slice(-40));
    preloadVideoReady.value = true;
  }

  // Called when preload video metadata/data is loaded
  function onPreloadLoadedData() {
    if (!props.editorMode || !preloadVideoRef.value) return;

    // If we're the active video after a crossfade, make sure we're playing
    if (activeVideoIndex.value === 1 && !preloadVideoRef.value.paused) {
      // Already playing, good
    } else if (activeVideoIndex.value === 1 && props.isPlaying) {
      // Should be playing but paused - resume
      preloadVideoRef.value.play().catch(() => {});
    }
  }

  // Time update handler for preload video (when it's the active video after crossfade)
  function onPreloadTimeUpdate() {
    if (!props.editorMode || !preloadVideoRef.value) return;

    // Only emit time updates when preload is the active video (index 1)
    // During crossfade, the main video drives time updates
    // After crossfade completes (activeVideoIndex === 1), preload takes over
    if (activeVideoIndex.value === 1) {
      const currentVideoTime = preloadVideoRef.value.currentTime;
      console.log(
        '[ClipEditorPreview.onPreloadTimeUpdate] Emitting time:',
        currentVideoTime.toFixed(3),
        'activeVideoIndex:',
        activeVideoIndex.value
      );
      emit('timeUpdate', currentVideoTime);
    }
  }

  // Start crossfade playback (both videos play simultaneously during transition)
  // Called when entering a transition zone
  function startCrossfade(preloadSeekTime: number): boolean {
    console.log(
      '[ClipEditorPreview.startCrossfade] Called with seekTime:',
      preloadSeekTime,
      'activeVideoIndex:',
      activeVideoIndex.value
    );

    if (!props.editorMode || !preloadVideoRef.value || !videoRef.value) {
      console.log('[ClipEditorPreview.startCrossfade] Missing refs, returning false');
      return false;
    }

    const preloadVideo = preloadVideoRef.value;
    const mainVideo = videoRef.value;

    console.log(
      '[ClipEditorPreview.startCrossfade] Before seek:',
      'mainVideo.currentTime:',
      mainVideo.currentTime.toFixed(3),
      'mainVideo.paused:',
      mainVideo.paused,
      'preloadVideo.currentTime:',
      preloadVideo.currentTime.toFixed(3),
      'preloadVideo.paused:',
      preloadVideo.paused,
      'preloadVideo.readyState:',
      preloadVideo.readyState
    );

    // Seek preload video to the correct position
    preloadVideo.currentTime = preloadSeekTime;

    // Copy audio settings - during crossfade, we'll manage volume via the parent
    preloadVideo.volume = mainVideo.volume;
    preloadVideo.muted = mainVideo.muted;

    // Set initial opacity values for crossfade (preload starts invisible, main visible)
    mainVideo.style.opacity = '1';
    preloadVideo.style.opacity = '0';

    // Both videos should play during crossfade
    // Use a more robust approach: wait for canplay if not ready
    const startPreloadPlayback = () => {
      console.log(
        '[ClipEditorPreview.startCrossfade.startPreloadPlayback]',
        'mainVideo.paused:',
        mainVideo.paused,
        'preloadVideo.paused:',
        preloadVideo.paused
      );
      if (!mainVideo.paused && preloadVideo.paused) {
        preloadVideo.play().catch((err) => {
          console.warn('[ClipEditorPreview] Could not start preload video during crossfade:', err);
        });
      }

      // Start the smooth animation loop once preload is playing
      startCrossfadeAnimation();
    };

    // If preload video has data, start immediately
    if (preloadVideo.readyState >= 3) {
      // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
      console.log('[ClipEditorPreview.startCrossfade] Preload ready, starting immediately');
      startPreloadPlayback();
    } else {
      console.log('[ClipEditorPreview.startCrossfade] Preload not ready, adding canplay listener');
      // Wait for video to be ready
      const handleCanPlay = () => {
        console.log('[ClipEditorPreview.startCrossfade.handleCanPlay] Fired');
        startPreloadPlayback();
        preloadVideo.removeEventListener('canplay', handleCanPlay);
      };
      preloadVideo.addEventListener('canplay', handleCanPlay);

      // Also try to start immediately - browser may buffer and play
      startPreloadPlayback();
    }

    return true;
  }

  // Complete the crossfade (called when transition ends, to finalize the switch)
  function completeCrossfade(): void {
    console.log('[ClipEditorPreview.completeCrossfade] Called. activeVideoIndex:', activeVideoIndex.value);

    // Stop the animation loop first (don't reset opacity - we'll set final state)
    stopCrossfadeAnimation(false);

    if (!props.editorMode || !preloadVideoRef.value || !videoRef.value) {
      console.log('[ClipEditorPreview.completeCrossfade] Missing refs, returning');
      return;
    }

    const preloadVideo = preloadVideoRef.value;
    const mainVideo = videoRef.value;
    const wasPlaying = !mainVideo.paused || !preloadVideo.paused; // Either video was playing

    console.log(
      '[ClipEditorPreview.completeCrossfade]',
      'mainVideo.currentTime:',
      mainVideo.currentTime.toFixed(3),
      'mainVideo.paused:',
      mainVideo.paused,
      'preloadVideo.currentTime:',
      preloadVideo.currentTime.toFixed(3),
      'preloadVideo.paused:',
      preloadVideo.paused,
      'wasPlaying:',
      wasPlaying
    );

    // Switch to preload as the active video
    activeVideoIndex.value = 1;
    console.log('[ClipEditorPreview.completeCrossfade] Set activeVideoIndex to 1');

    // Set final opacity values (main hidden, preload visible)
    // Clear inline styles so Vue's reactive styles can take over
    mainVideo.style.opacity = '';
    preloadVideo.style.opacity = '';

    // Pause the main video (it's now fully faded out)
    mainVideo.pause();

    // Ensure preload video is playing if we were playing before
    if (wasPlaying && preloadVideo.paused) {
      console.log('[ClipEditorPreview.completeCrossfade] Starting preload playback');
      preloadVideo.play().catch(() => {});
    }

    // Restore normal volume on preload video
    preloadVideo.volume = 1;

    // Emit the new video element so parent can track it
    console.log('[ClipEditorPreview.completeCrossfade] Emitting videoElementReady and videoSwapped');
    emit('videoElementReady', preloadVideo);
    emit('videoSwapped');

    preloadVideoReady.value = false;
  }

  // Seamlessly swap to the preloaded video (called by parent during source transition)
  // For instant swap (non-crossfade) scenarios
  function swapToPreloadedVideo(seekTime: number): boolean {
    console.log(
      '[swapToPreloadedVideo] Called with seekTime:',
      seekTime,
      'preloadVideoReady:',
      preloadVideoReady.value,
      'activeVideoIndex:',
      activeVideoIndex.value
    );

    if (!props.editorMode || !preloadVideoReady.value || !preloadVideoRef.value || !videoRef.value) {
      console.log('[swapToPreloadedVideo] Swap failed - not ready. preloadVideoReady:', preloadVideoReady.value);
      return false;
    }

    const preloadVideo = preloadVideoRef.value;
    const mainVideo = videoRef.value;

    // Seek preload video to the correct position
    preloadVideo.currentTime = seekTime;

    // Copy audio settings
    preloadVideo.volume = mainVideo.volume;
    preloadVideo.muted = mainVideo.muted;

    // Swap active video
    activeVideoIndex.value = 1;

    // Start playing the preload video
    preloadVideo.play().catch(() => {});

    // Pause the main video
    mainVideo.pause();

    // Emit the new video element so parent can track it
    emit('videoElementReady', preloadVideo);
    emit('videoSwapped');

    preloadVideoReady.value = false;
    return true;
  }

  // Check if preload video is ready for seamless swap
  function isPreloadReady(): boolean {
    return preloadVideoReady.value && preloadVideoRef.value !== null;
  }

  // Check if main video is currently active (for determining swap direction)
  function isMainVideoActive(): boolean {
    return activeVideoIndex.value === 0;
  }

  // Swap back to main video (reverse of swapToPreloadedVideo)
  // Used when preload was active and we need to switch to a new source loaded in main
  function swapToMainVideo(seekTime: number): boolean {
    if (!props.editorMode || !videoRef.value || activeVideoIndex.value !== 1) {
      return false;
    }

    const mainVideo = videoRef.value;
    const preloadVideo = preloadVideoRef.value;

    // Check if main video is ready (has enough data to play)
    if (mainVideo.readyState < 3) {
      console.log('[ClipEditorPreview.swapToMainVideo] Main video not ready, readyState:', mainVideo.readyState);
      return false;
    }

    // Seek main video to the correct position
    mainVideo.currentTime = seekTime;

    // Copy audio settings from preload
    if (preloadVideo) {
      mainVideo.volume = preloadVideo.volume;
      mainVideo.muted = preloadVideo.muted;
    }

    // Swap active video back to main
    activeVideoIndex.value = 0;

    // Start playing the main video
    mainVideo.play().catch(() => {});

    // Pause the preload video
    if (preloadVideo) {
      preloadVideo.pause();
    }

    // Clear the last preload src so it can be updated with the next source
    lastPreloadSrc.value = null;

    // Emit the new video element so parent can track it
    emit('videoElementReady', mainVideo);
    emit('videoSwapped');

    console.log('[ClipEditorPreview.swapToMainVideo] Swapped back to main video');
    return true;
  }

  // Get preload video element for external control (e.g., volume during crossfade)
  function getPreloadVideoElement(): HTMLVideoElement | null {
    return preloadVideoRef.value;
  }

  function onPlay() {
    // Sync region videos when main video plays (only for multi-region mode)
    // Single region uses main video directly, no sync needed
    if (showFramedPreview.value && !isSingleRegion.value) {
      syncRegionVideos(true);
    }
  }

  function onPause() {
    // Pause region videos when main video pauses (only for multi-region mode)
    if (showFramedPreview.value && !isSingleRegion.value) {
      syncRegionVideos(false);
    }
  }

  function onVideoClick() {
    // Only toggle play if we're not dragging an overlay
    if (!dragState.isDragging) {
      emit('togglePlay');
    }
  }

  function onOverlayContainerClick() {
    // Clicking on empty space in overlay container clears selection
    if (!dragState.isDragging) {
      emit('trackItemSelect', '', '');
    }
  }

  function toggleMute() {
    if (videoRef.value) {
      isMuted.value = !isMuted.value;
      videoRef.value.muted = isMuted.value;
    }
  }

  function onVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    volume.value = parseFloat(target.value);
    if (videoRef.value) {
      videoRef.value.volume = volume.value;
      isMuted.value = volume.value === 0;
    }
  }

  // Fullscreen functionality
  function toggleFullscreen() {
    if (!fullscreenContainerRef.value) return;

    if (!document.fullscreenElement) {
      fullscreenContainerRef.value.requestFullscreen().catch((err) => {
        console.warn('Could not enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Could not exit fullscreen:', err);
      });
    }
  }

  function onFullscreenChange() {
    isFullscreen.value = !!document.fullscreenElement;
    // Update container size when fullscreen changes
    updateContainerSize();
  }

  function onKeyDown(e: KeyboardEvent) {
    // Only handle if not typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    }
  }

  // Get the position and style for a text overlay, respecting per-ratio configs
  function getOverlayConfigForRatio(overlay: TextOverlay): {
    position: { x: number; y: number };
    style: typeof overlay.style;
  } {
    const ratio = props.previewAspectRatio;
    const ratioConfig = overlay.perRatioConfigs?.[ratio];

    if (ratioConfig) {
      return {
        position: ratioConfig.position,
        style: ratioConfig.style,
      };
    }

    // Fallback to default position/style
    return {
      position: overlay.position,
      style: overlay.style,
    };
  }

  // Calculate overlay scale factor based on container height
  // All text overlay sizes are defined relative to a 1080p reference height
  // This ensures the preview matches what the export will look like
  const overlayScaleFactor = computed(() => {
    const { width: containerWidth, height: containerHeight } = containerSize.value;
    if (containerWidth === 0 || containerHeight === 0) return 1;

    let overlayHeight: number;

    if (showFramedPreview.value) {
      // In framed mode, use the framed container height
      const { width: ratioW, height: ratioH } = parseAspectRatio(props.previewAspectRatio);
      const targetAspect = ratioW / ratioH;
      const containerAspect = containerWidth / containerHeight;

      if (containerAspect > targetAspect) {
        overlayHeight = containerHeight;
      } else {
        overlayHeight = containerWidth / targetAspect;
      }
    } else {
      // In non-framed mode, calculate actual video display height
      // The video uses object-contain, so it fits within container while maintaining aspect ratio
      const videoWidth = videoRef.value?.videoWidth || 1920;
      const videoHeight = videoRef.value?.videoHeight || 1080;
      const videoAspect = videoWidth / videoHeight;
      const containerAspect = containerWidth / containerHeight;

      if (containerAspect > videoAspect) {
        overlayHeight = containerHeight;
      } else {
        overlayHeight = containerWidth / videoAspect;
      }
    }

    // Scale relative to 1080p reference (same as subtitle scaling)
    // When overlay container is 1080px tall, scale is 1.0
    // When overlay container is 540px tall, scale is 0.5 (font appears half size)
    return overlayHeight / 1080;
  });

  function getTextOverlayStyle(overlay: TextOverlay): Record<string, string> {
    const config = getOverlayConfigForRatio(overlay);
    const overlayStyle = config.style;

    // Get the scale factor for this container size
    const scale = overlayScaleFactor.value;

    // Scale all size-related properties
    const finalFontSize = Math.round((overlayStyle?.fontSize || 24) * scale);
    const finalLetterSpacing = (overlayStyle?.letterSpacing || 0) * scale;
    const finalPadding = Math.round((overlayStyle?.padding || 8) * scale);
    const finalBorderWidth = (overlayStyle?.border1Width || 0) * scale;
    const finalShadowOffsetX = (overlayStyle?.shadowOffsetX || 2) * scale;
    const finalShadowOffsetY = (overlayStyle?.shadowOffsetY || 2) * scale;
    const finalShadowBlur = (overlayStyle?.shadowBlur || 4) * scale;

    const style: Record<string, string> = {
      fontFamily: overlayStyle?.fontFamily || 'sans-serif',
      fontSize: `${finalFontSize}px`,
      fontWeight: String(overlayStyle?.fontWeight || 600),
      color: overlayStyle?.color || '#ffffff',
      textAlign: overlayStyle?.textAlign || 'center',
      lineHeight: String(overlayStyle?.lineHeight || 1.2),
      letterSpacing: `${finalLetterSpacing}px`,
    };

    // Width handling
    if (overlayStyle?.width !== undefined && overlayStyle.width > 0) {
      style.width = `${overlayStyle.width}%`;
      style.maxWidth = `${overlayStyle.width}%`;
    } else {
      style.maxWidth = `${overlayStyle?.maxWidth || 90}%`;
      style.width = 'fit-content';
    }

    // Chat bubble styling (advanced - rendered to PNG on export)
    const chatBubble = overlayStyle?.chatBubble;
    if (chatBubble?.enabled) {
      // Chat bubble border radius based on shape
      let bubbleRadius = 18;
      switch (chatBubble.shape) {
        case 'rounded':
          bubbleRadius = 18;
          break;
        case 'pointed':
          bubbleRadius = 8;
          break;
        case 'cloud':
          bubbleRadius = 24;
          break;
        case 'square':
          bubbleRadius = 4;
          break;
      }
      const finalBubbleRadius = Math.round(bubbleRadius * scale);

      style.backgroundColor = overlayStyle?.backgroundColor || '#007AFF';
      style.padding = `${finalPadding}px ${Math.round(finalPadding * 1.5)}px`;
      style.borderRadius = `${finalBubbleRadius}px`;

      // Add subtle shadow for chat bubble
      style.boxShadow = `0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.3)`;
    } else if (overlayStyle?.backgroundEnabled && overlayStyle?.backgroundColor) {
      // Regular background (solid color - exports via ASS)
      const finalBorderRadius = Math.round((overlayStyle?.borderRadius || 4) * scale);
      style.backgroundColor = overlayStyle.backgroundColor;
      style.padding = `${finalPadding}px`;
      style.borderRadius = `${finalBorderRadius}px`;
    }

    // Text shadow (exports via ASS for simple, PNG for advanced)
    if (overlayStyle?.shadowEnabled) {
      style.textShadow = `${finalShadowOffsetX}px ${finalShadowOffsetY}px ${finalShadowBlur}px ${overlayStyle.shadowColor || '#000000'}`;
    }

    // Outer glow effect (advanced - rendered to PNG on export)
    if (overlayStyle?.glow?.enabled) {
      const glowBlur = (overlayStyle.glow.blur || 20) * scale;
      const glowColor = overlayStyle.glow.color || '#ffffff';
      const glowOpacity = overlayStyle.glow.opacity || 0.8;
      // Combine with existing text shadow if present
      const existingShadow = style.textShadow || '';
      const glowShadow = `0 0 ${glowBlur}px ${glowColor}`;
      style.textShadow = existingShadow ? `${existingShadow}, ${glowShadow}` : glowShadow;
    }

    // Text gradient (advanced - rendered to PNG on export)
    if (overlayStyle?.gradient?.enabled && overlayStyle.gradient.colors?.length >= 2) {
      const colors = overlayStyle.gradient.colors
        .sort((a, b) => a.position - b.position)
        .map((c) => `${c.color} ${c.position}%`)
        .join(', ');
      const angle = overlayStyle.gradient.angle || 90;
      style.background = `linear-gradient(${angle}deg, ${colors})`;
      style.webkitBackgroundClip = 'text';
      style.webkitTextFillColor = 'transparent';
      style.backgroundClip = 'text';
    }

    // Text outline/stroke (exports via ASS)
    if (overlayStyle?.border1Width && overlayStyle.border1Width > 0) {
      style.webkitTextStroke = `${finalBorderWidth}px ${overlayStyle.border1Color || '#000000'}`;
      style.paintOrder = 'stroke fill';
    }

    return style;
  }

  // Get the position, scale, and rotation for a sticker, respecting per-ratio configs
  function getStickerConfigForRatio(sticker: Sticker): {
    position: { x: number; y: number };
    scale: number;
    rotation: number;
  } {
    const ratio = props.previewAspectRatio;
    const ratioConfig = sticker.perRatioConfigs?.[ratio];

    if (ratioConfig) {
      return {
        position: ratioConfig.position,
        scale: ratioConfig.scale,
        rotation: ratioConfig.rotation,
      };
    }

    // Fallback to default position/scale/rotation
    return {
      position: sticker.position,
      scale: sticker.scale,
      rotation: sticker.rotation,
    };
  }

  // Get the style for image stickers (scales width to base size, height auto - matches export)
  function getStickerImageStyle(sticker: Sticker): Record<string, string> {
    const containerScale = overlayScaleFactor.value;
    // Base width at current container scale (export uses video_height * 0.1 for width)
    const baseWidth = 108 * containerScale;

    // Get cached dimensions for this sticker
    const dims = stickerImageDimensions.value[sticker.id];

    if (dims) {
      // Scale width to baseWidth, calculate height to maintain aspect ratio
      // This matches FFmpeg's scale=width:-1 behavior and the export
      const aspectRatio = dims.width / dims.height;
      const width = baseWidth;
      const height = baseWidth / aspectRatio;

      return {
        width: `${width}px`,
        height: `${height}px`,
      };
    }

    // Fallback before image loads
    return {
      width: `${baseWidth}px`,
      height: 'auto',
    };
  }

  function getVideoFilterStyle(): Record<string, string> {
    if (!props.filterSettings) return {};

    const filters: string[] = [];

    const brightness = props.filterSettings.brightness || 0;
    if (brightness !== 0) {
      const brightnessValue = 1 + brightness / 100;
      filters.push(`brightness(${brightnessValue})`);
    }

    const contrast = props.filterSettings.contrast || 0;
    if (contrast !== 0) {
      const contrastValue = 1 + contrast / 100;
      filters.push(`contrast(${contrastValue})`);
    }

    const saturation = props.filterSettings.saturation || 0;
    if (saturation !== 0) {
      const saturationValue = 1 + saturation / 100;
      filters.push(`saturate(${saturationValue})`);
    }

    const hue = props.filterSettings.hue || 0;
    if (hue !== 0) {
      filters.push(`hue-rotate(${hue}deg)`);
    }

    const sharpen = props.filterSettings.sharpen || 0;
    if (sharpen > 0) {
      const sharpenBoost = 1 + sharpen / 1000;
      filters.push(`contrast(${sharpenBoost})`);
    }

    const fade = props.filterSettings.fade || 0;
    if (fade > 0) {
      const fadeContrast = 1 - fade / 333;
      const fadeSaturation = 1 - fade / 500;
      filters.push(`contrast(${fadeContrast})`);
      filters.push(`saturate(${fadeSaturation})`);
    }

    if (filters.length === 0) return {};

    return {
      filter: filters.join(' '),
    };
  }

  function getVignetteStyle(): Record<string, string> {
    const vignette = props.filterSettings?.vignette || 0;
    if (vignette === 0) {
      return { display: 'none' };
    }

    const intensity = vignette / 100;
    const innerStop = 70 - intensity * 50;
    const opacity = 0.3 + intensity * 0.6;

    return {
      background: `radial-gradient(ellipse at center, transparent ${innerStop}%, rgba(0,0,0,${opacity}) 100%)`,
      pointerEvents: 'none',
    };
  }

  function getMainVideoStyle(): Record<string, string> {
    const filterStyle = getVideoFilterStyle();
    const opacity = activeVideoIndex.value === 0 ? 1 : 0;

    return {
      ...filterStyle,
      opacity: opacity.toString(),
      transition: crossfadeActive.value ? 'opacity 0.3s ease-in-out' : 'none',
    };
  }

  function getPreloadVideoStyle(): Record<string, string> {
    const filterStyle = getVideoFilterStyle();
    const opacity = activeVideoIndex.value === 1 ? 1 : 0;

    return {
      ...filterStyle,
      opacity: opacity.toString(),
      transition: crossfadeActive.value ? 'opacity 0.3s ease-in-out' : 'none',
    };
  }

  function getTemperatureStyle(): Record<string, string> {
    const temp = props.filterSettings?.temperature || 0;
    if (temp === 0) {
      return { display: 'none' };
    }

    const intensity = Math.abs(temp) / 100;
    const opacity = intensity * 0.25;

    if (temp > 0) {
      return {
        backgroundColor: `rgba(255, 140, 50, ${opacity})`,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      };
    } else {
      return {
        backgroundColor: `rgba(80, 140, 255, ${opacity})`,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      };
    }
  }

  // ResizeObserver for container size tracking
  let resizeObserver: ResizeObserver | null = null;

  function updateContainerSize() {
    if (videoContainerRef.value) {
      const rect = videoContainerRef.value.getBoundingClientRect();
      containerSize.value = { width: rect.width, height: rect.height };
    }
  }

  // Watch for framed preview mode changes - sync video time between modes
  watch(showFramedPreview, (isFramed, wasFramed) => {
    if (isFramed) {
      startSyncLoop();
      // Clear old refs when switching modes
      regionVideoRefs.value = [];

      // Sync time from main video to framed video when switching TO framed mode
      if (!wasFramed && videoRef.value && !isNaN(videoRef.value.currentTime)) {
        const currentTime = videoRef.value.currentTime;
        const wasPaused = videoRef.value.paused;

        // Use nextTick to ensure the framed video element is mounted
        nextTick(() => {
          if (isSingleRegion.value && framedVideoRef.value) {
            // Ensure video is loaded before setting time
            framedVideoRef.value.load();
            framedVideoRef.value.currentTime = currentTime;
            if (!wasPaused) {
              framedVideoRef.value.play().catch(() => {});
            }
            // Emit the framed video as the active element
            emit('videoElementReady', framedVideoRef.value);
          } else if (audioVideoRef.value) {
            audioVideoRef.value.load();
            audioVideoRef.value.currentTime = currentTime;
            if (!wasPaused) {
              audioVideoRef.value.play().catch(() => {});
            }
            // Emit the audio video as the active element
            emit('videoElementReady', audioVideoRef.value);
          }
        });
      }
    } else {
      stopSyncLoop();

      // Sync time from framed video back to main video when switching FROM framed mode
      if (wasFramed) {
        let currentTime = 0;
        let wasPaused = true;

        if (framedVideoRef.value && !isNaN(framedVideoRef.value.currentTime)) {
          currentTime = framedVideoRef.value.currentTime;
          wasPaused = framedVideoRef.value.paused;
        } else if (audioVideoRef.value && !isNaN(audioVideoRef.value.currentTime)) {
          currentTime = audioVideoRef.value.currentTime;
          wasPaused = audioVideoRef.value.paused;
        }

        nextTick(() => {
          if (videoRef.value) {
            videoRef.value.currentTime = currentTime;
            if (!wasPaused) {
              videoRef.value.play().catch(() => {});
            }
            // Emit the main video as the active element
            emit('videoElementReady', videoRef.value);
          }
        });
      }
    }
  });

  // Watch for text overlay changes to clear local drag widths when the parent updates
  watch(
    () => props.textOverlays,
    () => {
      // Clear local widths that now have real values from parent
      // This prevents stale local values from overriding parent updates
      if (!dragState.isDragging && !resizeState.isResizing) {
        localDragWidths.value = {};
      }
    },
    { deep: true }
  );

  // Watch for aspect ratio changes to update container size and preserve time
  watch(
    () => props.previewAspectRatio,
    () => {
      // Store current video time from whichever video is currently active
      let currentTime: number | null = null;

      if (showFramedPreview.value) {
        if (isSingleRegion.value && framedVideoRef.value && !isNaN(framedVideoRef.value.currentTime)) {
          currentTime = framedVideoRef.value.currentTime;
        } else if (audioVideoRef.value && !isNaN(audioVideoRef.value.currentTime)) {
          currentTime = audioVideoRef.value.currentTime;
        }
      } else if (videoRef.value && !isNaN(videoRef.value.currentTime)) {
        currentTime = videoRef.value.currentTime;
      }

      if (currentTime !== null) {
        pendingSeekTime.value = currentTime;
      }

      // Force container size update when aspect ratio changes
      updateContainerSize();
      // Clear old refs when aspect ratio changes
      regionVideoRefs.value = [];
    }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.removeEventListener('mousemove', onStickerResizeMove);
    document.removeEventListener('mouseup', onStickerResizeEnd);
    document.removeEventListener('mousemove', onStickerRotateMove);
    document.removeEventListener('mouseup', onStickerRotateEnd);
    document.removeEventListener('mousemove', onWatermarkResizeMove);
    document.removeEventListener('mouseup', onWatermarkResizeEnd);
    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
    document.removeEventListener('mousemove', onSubtitleResizeMove);
    document.removeEventListener('mouseup', onSubtitleResizeEnd);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('keydown', onKeyDown);
    stopSyncLoop();
    stopCrossfadeAnimation(true); // Clean up crossfade animation and reset opacity
    // Cleanup all HLS.js instances to prevent memory leaks
    cleanupAllHlsInstances();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  // Watch for main video src changes
  // NOTE: We no longer reset activeVideoIndex here because:
  // 1. After crossfade completes, the main video src changes to the new source
  // 2. But the preload video (now active) is already playing that source
  // 3. The main video's time updates are now ignored when activeVideoIndex === 1
  // 4. activeVideoIndex will be reset when we actually need to switch back to main
  watch(
    () => props.videoSrc,
    (newSrc, oldSrc) => {
      if (props.editorMode && newSrc !== oldSrc) {
        console.log('[ClipEditorPreview watch videoSrc] Src changed, activeVideoIndex:', activeVideoIndex.value);
        // Don't reset activeVideoIndex - let the crossfade logic handle it
        // The preload video will continue playing and its time updates will be used
      }

      // Setup HLS for main video if source is HLS
      if (newSrc !== oldSrc && videoRef.value) {
        updateVideoSource(videoRef.value, newSrc, 'main');
      }
      // Setup HLS for framed video if source is HLS
      if (newSrc !== oldSrc && framedVideoRef.value) {
        updateVideoSource(framedVideoRef.value, newSrc, 'framed');
      }
      // Setup HLS for audio video if source is HLS
      if (newSrc !== oldSrc && audioVideoRef.value) {
        updateVideoSource(audioVideoRef.value, newSrc, 'audio');
      }
    }
  );

  // Watch for preload video src changes to setup HLS
  watch(
    () => activePreloadSrc.value,
    (newSrc, oldSrc) => {
      if (newSrc !== oldSrc && preloadVideoRef.value) {
        updateVideoSource(preloadVideoRef.value, newSrc, 'preload');
      }
    }
  );

  // Watch for video element refs becoming available to setup HLS if needed
  watch(videoRef, (newElement) => {
    if (newElement && isHlsUrl(props.videoSrc)) {
      updateVideoSource(newElement, props.videoSrc, 'main');
    }
  });

  watch(framedVideoRef, (newElement) => {
    if (newElement && isHlsUrl(props.videoSrc)) {
      updateVideoSource(newElement, props.videoSrc, 'framed');
    }
  });

  watch(audioVideoRef, (newElement) => {
    if (newElement && isHlsUrl(props.videoSrc)) {
      updateVideoSource(newElement, props.videoSrc, 'audio');
    }
  });

  watch(preloadVideoRef, (newElement) => {
    if (newElement && isHlsUrl(activePreloadSrc.value)) {
      updateVideoSource(newElement, activePreloadSrc.value, 'preload');
    }
  });

  // Watch for region video refs to setup HLS
  watch(
    regionVideoRefs,
    (newRefs) => {
      if (isHlsUrl(props.videoSrc)) {
        newRefs.forEach((videoEl, idx) => {
          if (videoEl) {
            updateVideoSource(videoEl, props.videoSrc, `region-${idx}`);
          }
        });
      }
    },
    { deep: true }
  );

  onMounted(() => {
    if (videoRef.value) {
      emit('videoElementReady', videoRef.value);
      // Setup HLS if initial source is HLS
      if (isHlsUrl(props.videoSrc)) {
        updateVideoSource(videoRef.value, props.videoSrc, 'main');
      }
    }

    // Setup HLS for framed video if available
    if (framedVideoRef.value && isHlsUrl(props.videoSrc)) {
      updateVideoSource(framedVideoRef.value, props.videoSrc, 'framed');
    }

    // Setup HLS for audio video if available
    if (audioVideoRef.value && isHlsUrl(props.videoSrc)) {
      updateVideoSource(audioVideoRef.value, props.videoSrc, 'audio');
    }

    // Set up resize observer to track container size changes
    if (videoContainerRef.value) {
      updateContainerSize();
      resizeObserver = new ResizeObserver(() => {
        updateContainerSize();
      });
      resizeObserver.observe(videoContainerRef.value);
    }

    // Start sync loop if in framed preview mode
    if (showFramedPreview.value) {
      startSyncLoop();
    }

    // Add fullscreen and keyboard event listeners
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyDown);
  });

  // Get the current overlay container height for font scaling calculations
  function getOverlayContainerHeight(): number {
    if (!overlayContainerRef.value) return 400; // Fallback
    const rect = overlayContainerRef.value.getBoundingClientRect();
    return rect.height;
  }

  // Expose functions for parent component access
  defineExpose({
    getOverlayContainerHeight,
    swapToPreloadedVideo,
    swapToMainVideo,
    isMainVideoActive,
    startCrossfade,
    completeCrossfade,
    isPreloadReady,
    getPreloadVideoElement,
    // Expose activeVideoIndex so parent can check which video is active (0 = main, 1 = preload)
    get activeVideoIndex() {
      return activeVideoIndex.value;
    },
    resetActiveVideo: () => {
      activeVideoIndex.value = 0;
      preloadVideoReady.value = false;
      lastPreloadSrc.value = null;
      // Emit the currently visible video element as active
      if (showFramedPreview.value && isSingleRegion.value && framedVideoRef.value) {
        emit('videoElementReady', framedVideoRef.value);
      } else if (showFramedPreview.value && !isSingleRegion.value && audioVideoRef.value) {
        emit('videoElementReady', audioVideoRef.value);
      } else if (videoRef.value) {
        emit('videoElementReady', videoRef.value);
      }
    },
    // Expose refs for parent to access current active video
    getActiveVideoElement: () => {
      if (showFramedPreview.value && isSingleRegion.value) {
        return framedVideoRef.value;
      } else if (showFramedPreview.value && !isSingleRegion.value) {
        return audioVideoRef.value;
      }
      return videoRef.value;
    },
  });
</script>

<style scoped>
  /* Text overlay animations */
  .animate-fade {
    animation: fadeIn 0.3s ease-out;
  }

  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }

  .animate-slide-down {
    animation: slideDown 0.3s ease-out;
  }

  .animate-typewriter {
    overflow: hidden;
    white-space: nowrap;
    animation: typewriter 0.5s steps(20);
  }

  .animate-bounce {
    animation: bounce 0.5s ease-out;
  }

  .animate-zoom {
    animation: zoomIn 0.3s ease-out;
  }

  .animate-pop {
    animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Sticker animations */
  .animate-spin {
    animation: spin 2s linear infinite;
  }

  .animate-pulse {
    animation: pulse 1s ease-in-out infinite;
  }

  .animate-shake {
    animation: shake 0.5s ease-in-out infinite;
  }

  .animate-float {
    animation: float 2s ease-in-out infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translate(-50%, calc(-50% + 20px));
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  @keyframes slideDown {
    from {
      transform: translate(-50%, calc(-50% - 20px));
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  @keyframes typewriter {
    from {
      width: 0;
    }
    to {
      width: 100%;
    }
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translate(-50%, -50%);
    }
    50% {
      transform: translate(-50%, calc(-50% - 10px));
    }
  }

  @keyframes zoomIn {
    from {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }

  @keyframes pop {
    0% {
      transform: translate(-50%, -50%) scale(0);
    }
    70% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes spin {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  @keyframes shake {
    0%,
    100% {
      transform: translate(-50%, -50%) translateX(0);
    }
    25% {
      transform: translate(-50%, -50%) translateX(-5px);
    }
    75% {
      transform: translate(-50%, -50%) translateX(5px);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(-50%, -50%) translateY(0);
    }
    50% {
      transform: translate(-50%, -50%) translateY(-10px);
    }
  }

  /* Sticker overlay styling */
  .sticker-overlay {
    z-index: 10;
  }

  .sticker-overlay:hover {
    z-index: 20;
  }

  /* Motion presets (preview-only) */
  .motion-fade {
    animation: motion-fade var(--motion-duration, 0.4s) ease-out both;
  }

  .motion-slide-up {
    animation: motion-slide-up var(--motion-duration, 0.5s) ease-out both;
  }

  .motion-pop {
    animation: motion-pop var(--motion-duration, 0.35s) cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }

  @keyframes motion-fade {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.98);
    }
    to {
      opacity: 1;
      transform: var(--motion-base-transform, translate(-50%, -50%));
    }
  }

  @keyframes motion-slide-up {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) translateY(12px);
    }
    to {
      opacity: 1;
      transform: var(--motion-base-transform, translate(-50%, -50%));
    }
  }

  @keyframes motion-pop {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.4);
    }
    70% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.08);
    }
    100% {
      opacity: 1;
      transform: var(--motion-base-transform, translate(-50%, -50%));
    }
  }

  /* Watermark overlay styling */
  .watermark-overlay {
    z-index: 10;
  }

  .watermark-overlay:hover {
    z-index: 20;
  }

  /* Subtitle overlay styling */
  .subtitle-overlay {
    z-index: 30;
  }

  .subtitle-overlay:hover {
    z-index: 40;
  }

  /* Subtitle text container - matches VideoPlayer implementation */
  .subtitle-text-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Subtitle word stack - layered SVG rendering */
  .subtitle-word-stack {
    position: relative;
    display: inline-block;
    transition-property: transform, opacity, filter;
    transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    transform-origin: center;
    will-change: transform, opacity, filter;
  }

  /* ===== ANIMATION STYLES (matches VideoPlayer) ===== */

  /* Zoom animation - scale up current word */
  .subtitle-word-stack.animation-zoom:has(.current-word) {
    transform: scale(1.15);
  }

  /* Karaoke animation - color change handled via SVG fill, subtle scale */
  .subtitle-word-stack.animation-karaoke:has(.current-word) {
    transform: scale(1.05);
  }

  /* Pop/Bounce animation - bouncy scale effect */
  .subtitle-word-stack.animation-pop:has(.current-word) {
    animation: pop-bounce 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
  }

  @keyframes pop-bounce {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.25);
    }
    100% {
      transform: scale(1.1);
    }
  }

  /* Glow animation - glowing emphasis */
  .subtitle-word-stack.animation-glow:has(.current-word) {
    filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor);
    transform: scale(1.05);
  }

  /* Box highlight - background box (rendered via SVG rect) */
  .subtitle-word-stack.animation-box-highlight:has(.current-word) {
    transform: scale(1.02);
  }

  /* Typewriter animation - words appear as spoken */
  .subtitle-word-stack.animation-typewriter {
    transition-property: transform, opacity;
    transition-duration: 0.15s;
    transition-timing-function: ease-out;
  }

  /* Wave animation - wave effect across words */
  .subtitle-word-stack.animation-wave:has(.current-word) {
    animation: wave-float 0.4s ease-in-out;
  }

  @keyframes wave-float {
    0% {
      transform: translateY(0) scale(1);
    }
    25% {
      transform: translateY(-8px) scale(1.08);
    }
    50% {
      transform: translateY(-4px) scale(1.05);
    }
    75% {
      transform: translateY(-6px) scale(1.06);
    }
    100% {
      transform: translateY(0) scale(1.03);
    }
  }

  /* Custom range input styling */
  input[type='range'].slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }

  input[type='range'].slider::-webkit-slider-track {
    background: transparent;
    height: 4px;
    border-radius: 2px;
  }

  input[type='range'].slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    background: white;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    margin-top: -3px;
  }

  input[type='range'].slider::-webkit-slider-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.15);
    box-shadow: 0 3px 8px rgba(139, 92, 246, 0.4);
  }

  input[type='range'].slider::-moz-range-track {
    background: transparent;
    height: 4px;
    border-radius: 2px;
  }

  input[type='range'].slider::-moz-range-thumb {
    border: none;
    background: white;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  input[type='range'].slider::-moz-range-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.15);
    box-shadow: 0 3px 8px rgba(139, 92, 246, 0.4);
  }

  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(8px);
  }
</style>
