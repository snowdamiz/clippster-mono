<template>
  <div class="flex-1 flex flex-col min-h-0 p-4">
    <!-- Video Container -->
    <div
      ref="videoContainerRef"
      class="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden relative"
    >
      <!-- Single region mode: Main video with CSS transforms applied directly (no extra decoding) -->
      <div
        v-if="showFramedPreview && isSingleRegion"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black overflow-hidden cursor-pointer"
        :style="getFramedContainerStyle()"
        @click="onVideoClick"
      >
        <video
          ref="videoRef"
          :src="videoSrc || ''"
          class="absolute max-w-none"
          :style="getSingleRegionVideoStyle()"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @play="onPlay"
          @pause="onPause"
        />
      </div>

      <!-- Multi-region framed container (for manually configured multiple regions) -->
      <div
        v-else-if="showFramedPreview"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black overflow-hidden"
        :style="getFramedContainerStyle()"
      >
        <!-- Hidden main video for audio/control -->
        <video
          ref="videoRef"
          :src="videoSrc || ''"
          class="sr-only"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @play="onPlay"
          @pause="onPause"
        />

        <!-- Render each region from the framing config -->
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

        <!-- Click handler overlay -->
        <div class="absolute inset-0 cursor-pointer" @click="onVideoClick" />
      </div>

      <!-- Default 16:9 mode: Normal video display -->
      <video
        v-else
        ref="videoRef"
        :src="videoSrc || ''"
        class="max-w-full max-h-full object-contain cursor-pointer"
        :style="getVideoFilterStyle()"
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @play="onPlay"
        @pause="onPause"
        @click="onVideoClick"
      />

      <!-- Overlay Container - matches video dimensions -->
      <div
        ref="overlayContainerRef"
        class="absolute overflow-hidden"
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

        <!-- Text Overlays (Draggable) -->
        <div
          v-for="overlay in visibleTextOverlays"
          :key="overlay.id"
          class="absolute text-overlay select-none"
          :class="[
            getTextOverlayClass(overlay),
            {
              'cursor-move pointer-events-auto': true,
              'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent':
                dragState.type === 'text' && dragState.id === overlay.id,
              'hover:ring-2 hover:ring-violet-400/50': dragState.id !== overlay.id,
            },
          ]"
          :style="getTextOverlayStyle(overlay)"
          @mousedown="(e) => startDrag(e, 'text', overlay.id, getOverlayConfigForRatio(overlay).position)"
        >
          {{ overlay.text }}
        </div>

        <!-- Stickers (Draggable) -->
        <div
          v-for="sticker in visibleStickers"
          :key="sticker.id"
          class="absolute sticker-overlay select-none"
          :class="[
            getStickerClass(sticker),
            {
              'cursor-move pointer-events-auto': true,
              'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent':
                dragState.type === 'sticker' && dragState.id === sticker.id,
              'hover:ring-2 hover:ring-violet-400/50': dragState.id !== sticker.id,
            },
          ]"
          :style="getStickerStyle(sticker)"
          @mousedown="(e) => startDrag(e, 'sticker', sticker.id, sticker.position)"
        >
          <span v-if="sticker.stickerType === 'emoji'" class="text-4xl">
            {{ sticker.stickerPath }}
          </span>
          <img v-else :src="sticker.stickerPath" class="w-full h-full object-contain" alt="Sticker" />
        </div>
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

      <!-- Play Button (centered, doesn't block overlay interactions) -->
      <button
        v-if="!isPlaying"
        @click.stop="emit('togglePlay')"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors pointer-events-auto z-10"
      >
        <Play class="w-8 h-8 text-white ml-1" />
      </button>
    </div>

    <!-- Controls Bar -->
    <div class="mt-3 flex items-center gap-3">
      <button @click="emit('togglePlay')" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
        <Play v-if="!isPlaying" class="w-5 h-5 text-white" />
        <Pause v-else class="w-5 h-5 text-white" />
      </button>

      <!-- Time Display -->
      <div class="text-sm text-white/70 font-mono min-w-[100px]">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>

      <!-- Progress Bar -->
      <div
        class="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative group"
        @click="onProgressClick"
        @mousedown="startProgressDrag"
      >
        <div class="absolute inset-y-0 left-0 bg-violet-500 rounded-full" :style="{ width: `${progressPercent}%` }" />
        <div
          class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          :style="{ left: `calc(${progressPercent}% - 6px)` }"
        />
      </div>

      <!-- Volume Control -->
      <div class="flex items-center gap-2">
        <button @click="toggleMute" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <VolumeX v-if="isMuted" class="w-5 h-5 text-white/50" />
          <Volume2 v-else class="w-5 h-5 text-white" />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          :value="volume"
          @input="onVolumeChange"
          class="w-20 accent-violet-500"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
  import { Play, Pause, Volume2, VolumeX } from 'lucide-vue-next';
  import type { TextOverlay, Sticker, FilterSettings, ManualFramingConfigs } from '@/types';

  interface SegmentInput {
    start_time: number;
    end_time: number;
  }

  interface DragState {
    isDragging: boolean;
    type: 'text' | 'sticker' | null;
    id: string | null;
    startX: number;
    startY: number;
    startPosition: { x: number; y: number };
  }

  const props = defineProps<{
    videoSrc: string | null;
    currentTime: number;
    effectiveTime: number; // Time position accounting for segment cuts
    isPlaying: boolean;
    clipStart: number;
    clipEnd: number;
    textOverlays: TextOverlay[];
    stickers: Sticker[];
    filterSettings: FilterSettings | null;
    segments?: SegmentInput[];
    previewAspectRatio: string; // Currently previewed aspect ratio (e.g., "16:9")
    selectedAspectRatios: string[]; // All selected aspect ratios
    framingConfigs: ManualFramingConfigs; // Framing configurations per aspect ratio
  }>();

  const emit = defineEmits<{
    (e: 'timeUpdate', time: number): void;
    (e: 'togglePlay'): void;
    (e: 'videoElementReady', element: HTMLVideoElement): void;
    (e: 'updateOverlayPosition', type: 'text' | 'sticker', id: string, position: { x: number; y: number }): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // Refs
  const videoRef = ref<HTMLVideoElement | null>(null);
  const videoContainerRef = ref<HTMLElement | null>(null);
  const overlayContainerRef = ref<HTMLElement | null>(null);
  const regionVideoRefs = ref<(HTMLVideoElement | null)[]>([]);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const isDraggingProgress = ref(false);
  const containerSize = ref({ width: 0, height: 0 });

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

  // Computed
  const clipDuration = computed(() => props.clipEnd - props.clipStart);

  // Get sorted segments for playback control
  const sortedSegments = computed(() => {
    if (!props.segments || props.segments.length === 0) {
      return [{ start_time: props.clipStart, end_time: props.clipEnd }];
    }
    return [...props.segments].sort((a, b) => a.start_time - b.start_time);
  });

  const progressPercent = computed(() => {
    if (clipDuration.value <= 0) return 0;
    return ((props.currentTime - props.clipStart) / clipDuration.value) * 100;
  });

  const visibleTextOverlays = computed(() => {
    // Use effective time (accounts for segment cuts) for visibility
    const effectiveTime = props.effectiveTime;
    return props.textOverlays.filter((o) => effectiveTime >= o.startTime && effectiveTime <= o.endTime);
  });

  const visibleStickers = computed(() => {
    // Use effective time (accounts for segment cuts) for visibility
    const effectiveTime = props.effectiveTime;
    return props.stickers.filter((s) => effectiveTime >= s.startTime && effectiveTime <= s.endTime);
  });

  const overlayContainerStyle = computed(() => {
    return {};
  });

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
    if (props.previewAspectRatio === '16:9') return null;

    // Check if this aspect ratio is selected
    const isSelected = props.selectedAspectRatios.includes(props.previewAspectRatio);
    if (!isSelected) return null;

    // Check if there's a manual config with regions
    const manualConfig = props.framingConfigs[props.previewAspectRatio as keyof ManualFramingConfigs];
    if (manualConfig && manualConfig.regions && manualConfig.regions.length > 0) {
      return manualConfig;
    }

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
    // Default: fill the container to match the video
    return {
      inset: '0',
    };
  }

  // Drag methods
  function startDrag(e: MouseEvent, type: 'text' | 'sticker', id: string, position: { x: number; y: number }) {
    e.preventDefault();
    e.stopPropagation();

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

    // Emit position update
    if (dragState.type && dragState.id) {
      emit('updateOverlayPosition', dragState.type, dragState.id, { x: newX, y: newY });
    }
  }

  function onDragEnd() {
    dragState.isDragging = false;
    dragState.type = null;
    dragState.id = null;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // Methods
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

      emit('videoElementReady', videoRef.value);
    }
  }

  function onTimeUpdate() {
    if (videoRef.value && !isDraggingProgress.value) {
      const currentVideoTime = videoRef.value.currentTime;
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

  function onEnded() {
    if (videoRef.value) {
      const firstSegment = sortedSegments.value[0];
      videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
    }
    // Sync after loop back
    syncAllPreviewVideos(true);
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
    // Toggle play when clicking on empty space in overlay container
    if (!dragState.isDragging) {
      emit('togglePlay');
    }
  }

  function onProgressClick(e: MouseEvent) {
    if (!videoRef.value) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = props.clipStart + percent * clipDuration.value;
    videoRef.value.currentTime = newTime;
    emit('timeUpdate', newTime);
    // Sync region videos after seeking
    syncAllPreviewVideos(true);
  }

  function startProgressDrag(e: MouseEvent) {
    isDraggingProgress.value = true;
    const onMove = (moveEvent: MouseEvent) => {
      if (!videoRef.value) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const newTime = props.clipStart + percent * clipDuration.value;
      videoRef.value.currentTime = newTime;
      emit('timeUpdate', newTime);
      // Sync during drag
      syncAllPreviewVideos(true);
    };

    const onUp = () => {
      isDraggingProgress.value = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Final sync after drag ends
      syncAllPreviewVideos(true);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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

  function getTextOverlayStyle(overlay: TextOverlay): Record<string, string> {
    const config = getOverlayConfigForRatio(overlay);
    const overlayStyle = config.style;

    const style: Record<string, string> = {
      left: `${config.position.x}%`,
      top: `${config.position.y}%`,
      transform: 'translate(-50%, -50%)',
      fontFamily: overlayStyle?.fontFamily || 'sans-serif',
      fontSize: `${overlayStyle?.fontSize || 24}px`,
      fontWeight: String(overlayStyle?.fontWeight || 600),
      color: overlayStyle?.color || '#ffffff',
      maxWidth: `${overlayStyle?.maxWidth || 90}%`,
      textAlign: overlayStyle?.textAlign || 'center',
      lineHeight: String(overlayStyle?.lineHeight || 1.2),
      letterSpacing: `${overlayStyle?.letterSpacing || 0}px`,
    };

    if (overlayStyle?.backgroundEnabled && overlayStyle?.backgroundColor) {
      style.backgroundColor = overlayStyle.backgroundColor;
      style.padding = `${overlayStyle.padding || 8}px`;
      style.borderRadius = `${overlayStyle.borderRadius || 4}px`;
    }

    // Apply shadow
    if (overlayStyle?.shadowEnabled) {
      style.textShadow = `${overlayStyle.shadowOffsetX || 2}px ${overlayStyle.shadowOffsetY || 2}px ${overlayStyle.shadowBlur || 4}px ${overlayStyle.shadowColor || '#000000'}`;
    }

    // Apply border using text-stroke (combining border1 and border2)
    if (overlayStyle?.border1Width && overlayStyle.border1Width > 0) {
      style.webkitTextStroke = `${overlayStyle.border1Width}px ${overlayStyle.border1Color || '#000000'}`;
      style.paintOrder = 'stroke fill';
    } else if (overlayStyle?.strokeEnabled) {
      style.webkitTextStroke = `${overlayStyle.strokeWidth || 1}px ${overlayStyle.strokeColor || '#000000'}`;
      style.paintOrder = 'stroke fill';
    }

    return style;
  }

  function getTextOverlayClass(overlay: TextOverlay): string[] {
    const classes: string[] = [];
    if (overlay.animation && overlay.animation !== 'none') {
      classes.push(`animate-${overlay.animation}`);
    }
    return classes;
  }

  function getStickerStyle(sticker: Sticker): Record<string, string> {
    return {
      left: `${sticker.position.x}%`,
      top: `${sticker.position.y}%`,
      transform: `translate(-50%, -50%) scale(${sticker.scale}) rotate(${sticker.rotation}deg)`,
    };
  }

  function getStickerClass(sticker: Sticker): string[] {
    const classes: string[] = [];
    if (sticker.animation && sticker.animation !== 'none') {
      classes.push(`animate-${sticker.animation}`);
    }
    return classes;
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

  // Watch for framed preview mode changes
  watch(showFramedPreview, (isFramed) => {
    if (isFramed) {
      startSyncLoop();
      // Clear old refs when switching modes
      regionVideoRefs.value = [];
    } else {
      stopSyncLoop();
    }
  });

  // Watch for aspect ratio changes to update container size and preserve time
  watch(
    () => props.previewAspectRatio,
    () => {
      // Store current video time before aspect ratio change causes video element swap
      if (videoRef.value && !isNaN(videoRef.value.currentTime)) {
        pendingSeekTime.value = videoRef.value.currentTime;
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
    stopSyncLoop();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  onMounted(() => {
    if (videoRef.value) {
      emit('videoElementReady', videoRef.value);
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
</style>
