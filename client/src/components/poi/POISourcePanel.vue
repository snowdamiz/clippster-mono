<template>
  <div class="poi-source-panel @container flex h-full flex-col bg-surface">
    <!-- Header -->
    <div class="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-2">
      <div class="flex min-w-0 items-center gap-2">
        <!-- View tabs: Clip vs Uploaded Media -->
        <SegmentedControl v-model="activeSourceView" :options="sourceViewOptions" size="sm" />
        <span class="shrink-0 font-mono text-2xs text-fg-subtle">{{ sourceAspectRatio }}</span>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Button
          v-if="allowMediaUpload"
          variant="ghost"
          size="xs"
          title="Upload image/video (creates new region)"
          @click="openMediaUpload"
        >
          <ImageIcon />
          <span class="hidden @md:inline">Upload media</span>
        </Button>
        <Button variant="secondary" size="xs" :disabled="regions.length >= maxRegions" @click="addRegion">
          <PlusIcon />
          Add region
        </Button>

        <!-- Platform overlay preview (9:16 export) — chrome shows on output panel only -->
        <DropdownMenu
          v-if="isExport916"
          :open="showSocialPlatformMenu"
          @update:open="(v: boolean) => (showSocialPlatformMenu = v)"
        >
          <DropdownMenuTrigger as-child>
            <button
              ref="platformOverlayButtonRef"
              type="button"
              :class="buttonVariants({ variant: 'ghost', size: 'xs' })"
              title="Preview platform overlay"
            >
              <Smartphone />
              <span class="hidden @md:inline">{{ localSocialOverlay?.label || 'Platform' }}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-44">
            <div ref="socialPlatformMenuPanelRef">
              <DropdownMenuItem @select="setSocialOverlay(null)">
                <XIcon />
                <span class="flex-1">None</span>
                <CheckIcon v-if="!localSocialOverlay" class="size-3.5 text-brand" />
              </DropdownMenuItem>
              <DropdownMenuItem
                v-for="preset in SOCIAL_OVERLAY_PRESETS"
                :key="preset.platform"
                @select="toggleSocialOverlayPreset(preset)"
              >
                <span class="grid w-4 place-items-center text-sm leading-none">{{ preset.icon }}</span>
                <span class="flex-1">{{ preset.label }}</span>
                <CheckIcon v-if="localSocialOverlay?.platform === preset.platform" class="size-3.5 text-brand" />
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Region options (shown when a region is selected) -->
    <div v-if="selectedRegion" class="flex shrink-0 flex-col gap-2 border-b border-line-subtle px-3 py-2">
      <div class="flex items-center justify-between gap-3">
        <label class="flex min-w-0 cursor-pointer items-center gap-2">
          <Checkbox
            :model-value="selectedRegion.aspectRatioLocked !== false"
            aria-label="Toggle aspect ratio lock"
            @update:model-value="onAspectRatioLockChange"
          />
          <LockIcon v-if="selectedRegion.aspectRatioLocked !== false" class="size-3.5 shrink-0 text-fg-muted" />
          <UnlockIcon v-else class="size-3.5 shrink-0 text-fg-muted" />
          <span class="truncate text-xs font-medium text-fg">
            {{ selectedRegion.aspectRatioLocked !== false ? 'Aspect ratio locked' : 'Aspect ratio unlocked' }}
          </span>
          <span class="hidden truncate text-2xs text-fg-subtle sm:inline">
            ({{ selectedRegion.aspectRatioLocked !== false ? 'maintains proportions' : 'free resize' }})
          </span>
        </label>

        <!-- Delete Media button (only shown when region has uploaded media) -->
        <Button
          v-if="selectedRegionHasMedia"
          variant="destructive-soft"
          size="xs"
          title="Remove uploaded media from this region"
          @click="deleteMedia"
        >
          <TrashIcon />
          Delete media
        </Button>
      </div>

      <!-- Rounded Corners Control -->
      <div class="flex h-6 items-center gap-3">
        <label class="flex shrink-0 cursor-pointer items-center gap-2">
          <Checkbox
            :model-value="selectedRegion.cornerRadiusEnabled === true"
            aria-label="Toggle rounded corners"
            @update:model-value="onCornerRadiusToggle"
          />
          <RoundCornerIcon class="size-3.5 text-fg-muted" />
          <span class="text-xs font-medium text-fg">Round corners</span>
        </label>
        <template v-if="selectedRegion.cornerRadiusEnabled">
          <input
            type="range"
            min="0"
            max="540"
            step="4"
            :value="selectedRegion.cornerRadiusPx ?? 0"
            class="min-w-0 flex-1"
            aria-label="Corner radius"
            @input="updateCornerRadius"
          />
          <span class="tabular w-10 shrink-0 text-right font-mono text-2xs text-fg-muted">{{ selectedRegion.cornerRadiusPx ?? 0 }}px</span>
        </template>
      </div>
    </div>

    <!-- Canvas Area -->
    <div class="flex flex-1 items-center justify-center bg-surface-sunken p-2">
      <div ref="containerRef" class="relative overflow-hidden rounded-lg bg-black" :style="containerStyle">
        <!-- ===== CLIP VIEW ===== -->
        <template v-if="activeSourceView === 'clip'">
          <!-- Live composited editor timeline (preferred in OpenCut export). -->
          <canvas
            v-if="timelinePreviewCanvas"
            ref="timelineCanvasRef"
            class="absolute inset-0 w-full h-full object-cover"
          />
          <!-- Video element (when available) -->
          <video
            v-else-if="videoUrl"
            ref="videoRef"
            :src="videoUrl"
            :poster="thumbnailUrl || undefined"
            class="absolute inset-0 w-full h-full object-cover"
            preload="auto"
            :volume="volume"
            :muted="isMuted"
            playsinline
            @timeupdate="onVideoTimeUpdate"
            @loadedmetadata="onVideoLoaded"
          />

          <!-- Thumbnail Image (fallback when no video) -->
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="absolute inset-0 w-full h-full object-cover"
            alt="Video thumbnail"
            draggable="false"
          />

          <!-- Placeholder when no thumbnail or video -->
          <div v-else class="absolute inset-0 flex items-center justify-center bg-surface">
            <div class="flex flex-col items-center gap-2 text-center">
              <VideoIcon class="size-6 text-fg-disabled" />
              <span class="text-xs text-fg-subtle">No preview available</span>
            </div>
          </div>

          <!-- Grid overlay for visual guidance -->
          <div class="absolute inset-0 pointer-events-none">
            <div class="w-full h-full grid grid-cols-3 grid-rows-3">
              <div v-for="i in 9" :key="i" class="border border-white/5" />
            </div>
          </div>

          <!-- POI Regions -->
          <POIRegion
            v-for="region in regions"
            :key="region.id"
            :rect="region.source"
            :color="region.color"
            :label="regionLabel(region)"
            :is-selected="selectedRegionId === region.id"
            :container-width="containerWidth"
            :container-height="containerHeight"
            :resizable="true"
            :draggable="true"
            :aspect-ratio-locked="region.aspectRatioLocked !== false"
            :corner-radius-px="region.cornerRadiusEnabled && region.cornerRadiusPx
              ? Math.max(1, Math.round(region.cornerRadiusPx * (containerWidth * region.source.width) / 1080))
              : 0"
            @update="(rect) => updateRegionSource(region.id, rect)"
            @delete="deleteRegion(region.id)"
            @select="selectRegion(region.id)"
            @drag-start="onDragStart"
            @drag-end="onDragEnd"
          />

          <!-- Click to add region hint (when empty) -->
          <div v-if="regions.length === 0" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="flex flex-col items-center gap-1.5 rounded-lg bg-black/65 px-4 py-3 text-center">
              <PlusCircleIcon class="size-5 text-fg-muted" />
              <p class="text-xs text-fg-muted">Click "Add region" to define crop areas</p>
            </div>
          </div>
        </template>

        <!-- ===== MEDIA VIEW (uploaded region media) ===== -->
        <template v-else-if="activeSourceView === 'media' && selectedRegionMediaSrc">
          <!-- Video preview for video media -->
          <video
            v-if="selectedRegionMediaType === 'video'"
            :src="selectedRegionMediaSrc"
            class="absolute inset-0 h-full w-full animate-fade-in bg-surface object-contain"
            controls
            muted
            playsinline
          />
          <!-- Image preview for image media -->
          <img
            v-else
            :src="selectedRegionMediaSrc"
            class="absolute inset-0 h-full w-full animate-fade-in bg-surface object-contain"
            alt="Uploaded region media"
            draggable="false"
          />

          <!-- Media info overlay -->
          <div class="absolute inset-x-0 bottom-0 bg-black/65 px-3 py-2">
            <div class="flex items-center gap-2">
              <div
                class="w-3 h-3 rounded-sm"
                :style="{ backgroundColor: selectedRegion?.color }"
              />
              <span class="text-xs font-medium text-fg">
                {{ selectedRegion ? regionLabel(selectedRegion) : '' }}
              </span>
              <span class="text-2xs text-fg-muted">
                {{ selectedRegionMediaType === 'video' ? 'Video' : 'Image' }} media
              </span>
            </div>
          </div>
        </template>

        <!-- Fallback if media view but no media -->
        <template v-else-if="activeSourceView === 'media'">
          <div class="absolute inset-0 flex animate-fade-in items-center justify-center bg-surface">
            <div class="flex flex-col items-center gap-2 text-center">
              <ImageIcon class="size-6 text-fg-disabled" />
              <span class="text-xs text-fg-subtle">No media uploaded for this region</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Scaled 16:9 + region + overlay tab row -->
    <div
      v-if="showScaled16x9Tab || regions.length > 0 || showSubtitlesTab || showTextBoxTab"
      class="max-h-24 shrink-0 overflow-y-auto border-t border-line-subtle px-2 py-1.5"
    >
      <div class="flex flex-wrap gap-1">
        <button
          v-if="showScaled16x9Tab"
          type="button"
          :class="chipClass(selectedRegionId === POI_OVERLAY_SCALED_16X9_ID)"
          @click="selectRegion(POI_OVERLAY_SCALED_16X9_ID)"
        >
          <Maximize2Icon class="size-3 text-fg-subtle" />
          Scaled 16:9
        </button>

        <button
          v-for="region in regions"
          :key="region.id"
          type="button"
          :class="chipClass(selectedRegionId === region.id)"
          @click="selectRegion(region.id)"
        >
          <span class="size-2 rounded-sm" :style="{ backgroundColor: region.color }" />
          {{ regionLabel(region) }}
        </button>

        <button
          v-if="showSubtitlesTab"
          type="button"
          :class="chipClass(selectedRegionId === POI_OVERLAY_SUBTITLES_ID)"
          @click="selectRegion(POI_OVERLAY_SUBTITLES_ID)"
        >
          <CaptionsIcon class="size-3 text-fg-subtle" />
          Subtitles
        </button>

        <button
          v-if="showTextBoxTab"
          type="button"
          :class="chipClass(selectedRegionId === POI_OVERLAY_TEXTBOX_ID)"
          @click="selectRegion(POI_OVERLAY_TEXTBOX_ID)"
        >
          <TypeIcon class="size-3 text-fg-subtle" />
          Text box
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import {
    PlusIcon,
    VideoIcon,
    PlusCircleIcon,
    ImageIcon,
    LockIcon,
    UnlockIcon,
    TrashIcon,
    Smartphone,
    CircleDotIcon as RoundCornerIcon,
    CheckIcon,
    XIcon,
    Maximize2Icon,
    CaptionsIcon,
    TypeIcon,
  } from 'lucide-vue-next';
  import Hls from 'hls.js';
  import POIRegion from './POIRegion.vue';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
  import type { ManualRegion, ManualRegionRect } from '@/types';
  import { POI_REGION_COLORS } from '@/types';
  import { SOCIAL_OVERLAY_PRESETS } from '@/editor/constants/social-overlay-constants';
  import type { SocialOverlayPreset } from '@/editor/types/social-overlays';
  import { getRegionDisplayLabel } from '@/utils/poiRegionNumbering';
  import {
    POI_OVERLAY_SCALED_16X9_ID,
    POI_OVERLAY_SUBTITLES_ID,
    POI_OVERLAY_TEXTBOX_ID,
    isPoiOverlaySelection,
  } from '@/utils/poiOverlaySelection';

  interface Props {
    regions: ManualRegion[];
    selectedRegionId: string | null;
    thumbnailUrl?: string | null;
    sourceAspectRatio?: string;
    maxRegions?: number;
    videoUrl?: string | null;
    timelinePreviewCanvas?: HTMLCanvasElement | null;
    videoTime?: number;
    isPlaying?: boolean;
    volume?: number;
    isMuted?: boolean;
    /** When false, hides upload UI (e.g. creator profile defaults use stream/thumbnail reference only). */
    allowMediaUpload?: boolean;
    /** Manual POI export aspect ratio — used to show platform overlay toggle for 9:16. */
    targetAspectRatio?: string;
    /** Preview-only social chrome on output (TikTok / Reels / Shorts). */
    socialOverlayPreset?: SocialOverlayPreset | null;
    /** Next clip-wide region number for new regions in the current edit context. */
    nextRegionNumber?: number;
    /** Show Scaled 16:9 tab before region tabs (when Scale 16:9 mode is active). */
    showScaled16x9Tab?: boolean;
    /** Show Subtitles tab after region tabs (when subtitle positioning is enabled). */
    showSubtitlesTab?: boolean;
    /** Show Text box tab after region tabs (when clip text box is enabled). */
    showTextBoxTab?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    sourceAspectRatio: '16:9',
    maxRegions: 8,
    videoTime: 0,
    isPlaying: false,
    volume: 1,
    isMuted: false,
    allowMediaUpload: true,
    targetAspectRatio: '16:9',
    socialOverlayPreset: null,
    nextRegionNumber: 1,
    showScaled16x9Tab: false,
    showSubtitlesTab: false,
    showTextBoxTab: false,
  });

  const emit = defineEmits<{
    'update:regions': [regions: ManualRegion[]];
    'update:selectedRegionId': [id: string | null];
    addRegion: [region: ManualRegion];
    updateRegion: [id: string, region: Partial<ManualRegion>];
    deleteRegion: [id: string];
    selectRegion: [id: string | null];
    timeUpdate: [time: number];
    uploadMedia: [regionId: string];
    'update:socialOverlayPreset': [preset: SocialOverlayPreset | null];
  }>();

  const showSocialPlatformMenu = ref(false);
  const platformOverlayButtonRef = ref<HTMLButtonElement | null>(null);
  const socialPlatformMenuPanelRef = ref<HTMLElement | null>(null);

  const localSocialOverlay = computed(() => props.socialOverlayPreset ?? null);

  const isExport916 = computed(() => props.targetAspectRatio === '9:16');

  const socialPlatformMenuStyle = computed(() => {
    const el = platformOverlayButtonRef.value;
    if (!el) return {};
    const rect = el.getBoundingClientRect();
    return {
      top: `${rect.bottom + 6}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
    };
  });

  function setSocialOverlay(preset: SocialOverlayPreset | null) {
    emit('update:socialOverlayPreset', preset);
    showSocialPlatformMenu.value = false;
  }

  function toggleSocialOverlayPreset(preset: SocialOverlayPreset) {
    if (localSocialOverlay.value?.platform === preset.platform) {
      emit('update:socialOverlayPreset', null);
    } else {
      emit('update:socialOverlayPreset', preset);
    }
    showSocialPlatformMenu.value = false;
  }

  function handleDocumentClickForSocialMenu(e: MouseEvent) {
    if (!showSocialPlatformMenu.value) return;
    const target = e.target as Node;
    if (platformOverlayButtonRef.value?.contains(target)) return;
    if (socialPlatformMenuPanelRef.value?.contains(target)) return;
    showSocialPlatformMenu.value = false;
  }

  const containerRef = ref<HTMLElement | null>(null);
  const videoRef = ref<HTMLVideoElement | null>(null);
  const timelineCanvasRef = ref<HTMLCanvasElement | null>(null);
  let timelineCanvasRafId: number | null = null;

  function drawTimelineCanvas() {
    const source = props.timelinePreviewCanvas;
    const target = timelineCanvasRef.value;
    if (!source || !target || source.width <= 0 || source.height <= 0) return;
    if (target.width !== source.width || target.height !== source.height) {
      target.width = source.width;
      target.height = source.height;
    }
    target.getContext('2d')?.drawImage(source, 0, 0, target.width, target.height);
  }

  function startTimelineCanvasLoop() {
    if (timelineCanvasRafId !== null) return;
    const tick = () => {
      drawTimelineCanvas();
      timelineCanvasRafId = requestAnimationFrame(tick);
    };
    timelineCanvasRafId = requestAnimationFrame(tick);
  }

  function stopTimelineCanvasLoop() {
    if (timelineCanvasRafId === null) return;
    cancelAnimationFrame(timelineCanvasRafId);
    timelineCanvasRafId = null;
  }
  const containerWidth = ref(0);
  const containerHeight = ref(0);

  // View toggle: 'clip' shows source video, 'media' shows uploaded region media
  const activeSourceView = ref<'clip' | 'media'>('clip');

  const sourceViewOptions = computed(() => [
    { value: 'clip' as const, label: 'Clip' },
    ...(selectedRegionHasMedia.value ? [{ value: 'media' as const, label: 'Media', icon: ImageIcon }] : []),
  ]);

  /** Pill style for the region / overlay selector row. */
  function chipClass(selected: boolean): string {
    return [
      'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-2xs font-medium transition-colors',
      selected
        ? 'bg-brand-soft text-fg shadow-[inset_0_0_0_1px_var(--brand-line)]'
        : 'bg-surface-hover text-fg-muted hover:bg-surface-active hover:text-fg',
    ].join(' ');
  }

  // Check if selected region has uploaded media
  const selectedRegionHasMedia = computed(() => {
    if (!props.selectedRegionId) return false;
    const region = props.regions.find(r => r.id === props.selectedRegionId);
    return !!region?.mediaAssetId;
  });

  // Get the selected region
  const selectedRegion = computed(() => {
    if (!props.selectedRegionId || isPoiOverlaySelection(props.selectedRegionId)) return null;
    return props.regions.find(r => r.id === props.selectedRegionId) || null;
  });

  // Reactive media src (computed can't be async, so we use a ref + watcher)
  const selectedRegionMediaSrc = ref<string | null>(null);

  // Watch for changes to selected region's media and update the src
  watch(
    () => selectedRegion.value?.mediaAssetId,
    async (assetId) => {
      if (!assetId) {
        selectedRegionMediaSrc.value = null;
        return;
      }
      // If it's a blob URL, use directly
      if (assetId.startsWith('blob:')) {
        selectedRegionMediaSrc.value = assetId;
        return;
      }
      // If it's a file path (from save_temp_media_file), use convertFileSrc
      if (assetId.includes('/') || assetId.includes('\\')) {
        try {
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          selectedRegionMediaSrc.value = convertFileSrc(assetId);
        } catch {
          // Fallback for non-Tauri environment
          selectedRegionMediaSrc.value = assetId;
        }
        return;
      }
      selectedRegionMediaSrc.value = assetId;
    },
    { immediate: true }
  );

  // Get the media type for the selected region
  const selectedRegionMediaType = computed(() => {
    return selectedRegion.value?.mediaType || 'image';
  });

  // Watch for region selection changes to auto-switch view
  watch(() => props.selectedRegionId, (newId) => {
    if (newId) {
      const region = props.regions.find(r => r.id === newId);
      // If selecting a region with media, auto-switch to media view
      if (region?.mediaAssetId && activeSourceView.value === 'clip') {
        // Don't auto-switch, let user control it
      }
    }
    // If deselecting or selecting region without media, switch back to clip view
    if (!newId || !selectedRegionHasMedia.value) {
      activeSourceView.value = 'clip';
    }
  });

  // HLS.js instance for proper MPEG-TS (.ts) file playback with A/V sync
  let hlsInstance: Hls | null = null;

  function isHlsUrl(url: string | null | undefined): boolean {
    return !!url && url.includes('.m3u8');
  }

  function cleanupHls(): void {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
  }

  function setupHlsPlayback(videoEl: HTMLVideoElement, hlsUrl: string): void {
    cleanupHls();
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
      });
      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(videoEl);
      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[POISourcePanel] HLS fatal error:', data.type, data.details);
          cleanupHls();
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = hlsUrl;
    }
  }

  // Watch for video URL changes to setup HLS if needed
  watch(
    () => props.videoUrl,
    (newUrl) => {
      if (newUrl && videoRef.value && isHlsUrl(newUrl)) {
        setupHlsPlayback(videoRef.value, newUrl);
      } else if (!isHlsUrl(newUrl)) {
        cleanupHls();
      }
    }
  );

  // Watch for video element becoming available
  watch(videoRef, (newElement) => {
    if (newElement && props.videoUrl && isHlsUrl(props.videoUrl)) {
      setupHlsPlayback(newElement, props.videoUrl);
    }
  });

  // Watch for play/pause changes
  watch(
    () => props.isPlaying,
    (playing) => {
      if (!videoRef.value) return;
      if (playing) {
        videoRef.value.play().catch(console.error);
        startHighFrequencyTimeSync();
      } else {
        videoRef.value.pause();
        stopHighFrequencyTimeSync();
      }
    }
  );

  /**
   * Native HTML5 `timeupdate` only fires every ~250ms, which is far too sparse for
   * single-word subtitle rendering: short tokens (e.g. fast articles, contractions)
   * can have hit windows under 200ms and would be visually skipped between samples.
   *
   * While the video is playing, drive an additional rAF loop that re-emits the latest
   * `currentTime` every animation frame so downstream consumers (e.g. POITargetPanel
   * subtitle selection via `pickActiveSingleWordAtTime`) sample at ~60Hz.
   */
  let timeSyncRafId: number | null = null;

  function startHighFrequencyTimeSync() {
    if (timeSyncRafId !== null) return;
    const tick = () => {
      const el = videoRef.value;
      if (!el || el.paused || el.ended) {
        timeSyncRafId = null;
        return;
      }
      emit('timeUpdate', el.currentTime);
      timeSyncRafId = requestAnimationFrame(tick);
    };
    timeSyncRafId = requestAnimationFrame(tick);
  }

  function stopHighFrequencyTimeSync() {
    if (timeSyncRafId !== null) {
      cancelAnimationFrame(timeSyncRafId);
      timeSyncRafId = null;
    }
  }

  // Watch for time changes (seeking)
  watch(
    () => props.videoTime,
    (time) => {
      if (!videoRef.value) return;
      // Only seek if there's a significant difference (to avoid feedback loops)
      // Use 0.1 second threshold to allow accurate seeking while avoiding feedback loops
      if (Math.abs(videoRef.value.currentTime - time) > 0.1) {
        console.log('[POISourcePanel] Seeking video from', videoRef.value.currentTime, 'to', time);
        videoRef.value.currentTime = time;
        // If we're playing and just seeked, make sure playback continues
        if (props.isPlaying) {
          videoRef.value.play().catch(console.error);
        }
      }
    },
    { immediate: true }
  );

  // Handle video time update
  function onVideoTimeUpdate() {
    if (videoRef.value) {
      emit('timeUpdate', videoRef.value.currentTime);
    }
  }

  // Handle video loaded
  function onVideoLoaded() {
    if (videoRef.value) {
      // Force seek to the correct time when video loads
      // This ensures we start at the clip position, not the VOD beginning
      const targetTime = props.videoTime ?? 0;
      console.log('[POISourcePanel] Video metadata loaded, forcing seek to:', targetTime, 'current:', videoRef.value.currentTime);
      
      // Ensure video is seekable before setting time
      if (videoRef.value.readyState >= 2) {
        videoRef.value.currentTime = targetTime;
      } else {
        // Wait for canplay event
        const handleCanPlay = () => {
          if (videoRef.value) {
            console.log('[POISourcePanel] Video can play, seeking to:', targetTime);
            videoRef.value.currentTime = targetTime;
            videoRef.value.removeEventListener('canplay', handleCanPlay);
          }
        };
        videoRef.value.addEventListener('canplay', handleCanPlay, { once: true });
      }
    }
  }

  // Parse aspect ratio string to numbers
  function parseAspectRatio(ratio: string): { width: number; height: number } {
    const [w, h] = ratio.split(':').map(Number);
    return { width: w || 16, height: h || 9 };
  }

  // Calculate container style to maintain aspect ratio
  const containerStyle = computed(() => {
    const aspect = parseAspectRatio(props.sourceAspectRatio);
    const aspectRatio = aspect.width / aspect.height;

    // Use a fixed width and calculate height
    const maxWidth = 400;
    const maxHeight = 300;

    let width = maxWidth;
    let height = width / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  // Get region index for labeling (array position — prefer displayNumber via regionLabel)
  function getRegionIndex(id: string): number {
    return props.regions.findIndex((r) => r.id === id);
  }

  function regionLabel(region: ManualRegion): string {
    return getRegionDisplayLabel(region, getRegionIndex(region.id));
  }

  function onCornerRadiusToggle(checked: boolean | 'indeterminate') {
    if (!selectedRegion.value) return;
    const enabled = checked === true;
    emit('updateRegion', selectedRegion.value.id, {
      cornerRadiusEnabled: enabled,
      cornerRadiusPx: enabled ? (selectedRegion.value.cornerRadiusPx ?? 16) : 0,
    });
  }

  function updateCornerRadius(e: Event) {
    if (!selectedRegion.value) return;
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    emit('updateRegion', selectedRegion.value.id, { cornerRadiusPx: val });
  }

  function onAspectRatioLockChange(checked: boolean | 'indeterminate') {
    if (!selectedRegion.value) return;
    emit('updateRegion', selectedRegion.value.id, { aspectRatioLocked: checked === true });
  }

  // Delete uploaded media from selected region
  function deleteMedia() {
    if (!selectedRegion.value) return;
    
    // Clear mediaAssetId and mediaType from the region
    emit('updateRegion', selectedRegion.value.id, { 
      mediaAssetId: undefined, 
      mediaType: undefined 
    });
    
    // Switch back to clip view since media is gone
    activeSourceView.value = 'clip';
  }

  // Get next available color
  function getNextColor(): string {
    const usedColors = new Set(props.regions.map((r) => r.color));
    const available = POI_REGION_COLORS.filter((c) => !usedColors.has(c));
    return available[0] || POI_REGION_COLORS[props.regions.length % POI_REGION_COLORS.length];
  }

  // Generate unique ID
  function generateId(): string {
    return `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add a new region
  function addRegion() {
    if (props.regions.length >= props.maxRegions) return;

    // Source crop dimensions (normalized 0-1)
    const sourceCropWidth = 0.5;
    const sourceCropHeight = 0.5;
    
    // Parse source video aspect ratio (default 16:9)
    const [sourceW, sourceH] = (props.sourceAspectRatio || '16:9').split(':').map(Number);
    const sourceVideoAspect = sourceW / sourceH; // 16/9 = 1.778
    
    // Calculate the actual aspect ratio of the cropped region
    // The crop is normalized (0-1), but we need to account for the source video's aspect ratio
    // Example: 0.5 width on 16:9 source = 0.5 * 1.778 = 0.889 actual width
    //          0.5 height on 16:9 source = 0.5 actual height
    //          Aspect ratio = 0.889 / 0.5 = 1.778 (same as source)
    const actualCropAspect = (sourceCropWidth * sourceVideoAspect) / sourceCropHeight;
    
    // Calculate output dimensions that maintain the crop's aspect ratio
    // Fit to full width, calculate height based on actual crop aspect ratio
    const outputWidth = 1.0;
    const outputHeight = outputWidth / actualCropAspect;
    
    const displayNumber = props.nextRegionNumber;
    const newRegion: ManualRegion = {
      id: generateId(),
      color: getNextColor(),
      displayNumber,
      label: `Region ${displayNumber}`,
      source: {
        x: 0.25,
        y: 0.25,
        width: sourceCropWidth,
        height: sourceCropHeight,
      },
      output: {
        x: 0,
        y: props.regions.length > 0 ? Math.min(props.regions.length * 0.33, 0.6) : 0,
        width: outputWidth,
        height: Math.min(outputHeight, 1.0), // Clamp to canvas bounds
      },
      aspectRatioLocked: true, // Lock aspect ratio by default
    };

    emit('addRegion', newRegion);
    emit('selectRegion', newRegion.id);
  }

  // Update a region's source rect
  function updateRegionSource(id: string, rect: ManualRegionRect) {
    const region = props.regions.find(r => r.id === id);
    
    // If aspect ratio is locked, recalculate output dimensions
    if (region?.aspectRatioLocked !== false) {
      // Parse source video aspect ratio (default 16:9)
      const [sourceW, sourceH] = (props.sourceAspectRatio || '16:9').split(':').map(Number);
      const sourceVideoAspect = sourceW / sourceH;
      
      // Calculate the actual aspect ratio of the cropped region
      // Account for source video's aspect ratio
      const actualCropAspect = (rect.width * sourceVideoAspect) / rect.height;
      
      const currentOutput = region?.output || { x: 0, y: 0, width: 1, height: 0.33 };
      
      // Maintain output width, adjust height to match actual crop aspect ratio
      const newOutputHeight = currentOutput.width / actualCropAspect;
      
      emit('updateRegion', id, { 
        source: rect,
        output: {
          ...currentOutput,
          height: newOutputHeight,
        }
      });
    } else {
      emit('updateRegion', id, { source: rect });
    }
  }

  // Delete a region
  function deleteRegion(id: string) {
    emit('deleteRegion', id);
    if (props.selectedRegionId === id) {
      emit('selectRegion', null);
    }
  }

  // Select a region
  function selectRegion(id: string) {
    emit('selectRegion', id);
  }

  // Open media upload — always add a new region (when under cap), then attach media to it
  function openMediaUpload() {
    if (!props.allowMediaUpload) return;
    if (props.regions.length < props.maxRegions) {
      addRegion();
      nextTick(() => {
        if (props.selectedRegionId) {
          emit('uploadMedia', props.selectedRegionId);
        }
      });
    } else {
      // At region limit: attach to the current selection (cannot add another region)
      const id = props.selectedRegionId ?? props.regions[0]?.id;
      if (id) emit('uploadMedia', id);
    }
  }

  // Track drag state for cursor styling
  const isDragging = ref(false);

  function onDragStart() {
    isDragging.value = true;
  }

  function onDragEnd() {
    isDragging.value = false;
  }

  // Update container dimensions on resize
  function updateContainerDimensions() {
    if (containerRef.value) {
      containerWidth.value = containerRef.value.offsetWidth;
      containerHeight.value = containerRef.value.offsetHeight;
    }
  }

  // ResizeObserver for responsive sizing
  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    updateContainerDimensions();

    if (containerRef.value) {
      resizeObserver = new ResizeObserver(updateContainerDimensions);
      resizeObserver.observe(containerRef.value);
    }

    document.addEventListener('click', handleDocumentClickForSocialMenu);

    // If we mount already in play state, kick off the high-frequency time sync.
    if (props.isPlaying) {
      startHighFrequencyTimeSync();
    }
    if (props.timelinePreviewCanvas) {
      startTimelineCanvasLoop();
    }
  });

  onUnmounted(() => {
    cleanupHls();
    stopHighFrequencyTimeSync();
    stopTimelineCanvasLoop();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    document.removeEventListener('click', handleDocumentClickForSocialMenu);
  });

  watch(isExport916, (val) => {
    if (!val) showSocialPlatformMenu.value = false;
  });

  watch(
    () => props.timelinePreviewCanvas,
    (canvas) => {
      if (canvas) {
        startTimelineCanvasLoop();
        nextTick(drawTimelineCanvas);
      } else {
        stopTimelineCanvasLoop();
      }
    },
  );

  // Watch for aspect ratio changes
  watch(
    () => props.sourceAspectRatio,
    () => {
      // Update dimensions after style change
      setTimeout(updateContainerDimensions, 0);
    }
  );
</script>
