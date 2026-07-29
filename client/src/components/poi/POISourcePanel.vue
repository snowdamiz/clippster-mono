<template>
  <div class="poi-source-panel flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-2 py-1.5 border-b border-zinc-700/50">
      <div class="flex items-center gap-2">
        <!-- View tabs: Clip vs Uploaded Media -->
        <div class="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          <button
            @click="activeSourceView = 'clip'"
            class="px-2 py-1 text-[10px] font-medium rounded-md transition-colors"
            :class="activeSourceView === 'clip'
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'"
          >
            Clip
          </button>
          <button
            v-if="selectedRegionHasMedia"
            @click="activeSourceView = 'media'"
            class="px-2 py-1 text-[10px] font-medium rounded-md transition-colors flex items-center gap-1"
            :class="activeSourceView === 'media'
              ? 'bg-blue-600/80 text-blue-100'
              : 'text-blue-400 hover:text-blue-300 bg-blue-500/10'"
          >
            <ImageIcon class="w-3 h-3" />
            Media
          </button>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">{{ sourceAspectRatio }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="allowMediaUpload"
          @click="openMediaUpload"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors"
          title="Upload image/video (creates new region)"
        >
          <ImageIcon class="w-3 h-3" />
          Upload Media
        </button>
        <button
          @click="addRegion"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors"
          :disabled="regions.length >= maxRegions"
          :class="{ 'opacity-50 cursor-not-allowed': regions.length >= maxRegions }"
        >
          <PlusIcon class="w-3 h-3" />
          Add Region
        </button>

        <!-- Platform overlay preview (9:16 export) — chrome shows on output panel only -->
        <template v-if="isExport916">
          <button
            ref="platformOverlayButtonRef"
            type="button"
            class="flex items-center gap-1.5 shrink-0 px-2 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-all cursor-pointer border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white"
            @click.stop="showSocialPlatformMenu = !showSocialPlatformMenu"
          >
            <Smartphone class="w-3 h-3 shrink-0 opacity-80" />
            <span>{{ localSocialOverlay?.label || 'Platform' }}</span>
          </button>

          <Teleport to="body">
            <Transition name="poi-social-dropdown">
              <div
                v-if="showSocialPlatformMenu && isExport916"
                ref="socialPlatformMenuPanelRef"
                class="fixed z-[10050] min-w-[180px] rounded-lg border border-white/10 bg-zinc-950/98 py-1.5 px-1.5 shadow-2xl backdrop-blur-md"
                :style="socialPlatformMenuStyle"
                @click.stop
              >
                <button
                  type="button"
                  class="flex items-center gap-3 w-full px-3 py-2.5 text-[13px] rounded-md text-left transition-colors cursor-pointer border-0"
                  :class="
                    !localSocialOverlay
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'bg-transparent text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                  "
                  @click="setSocialOverlay(null)"
                >
                  <span class="text-lg leading-none">✕</span>
                  <span class="font-medium">None</span>
                </button>
                <button
                  v-for="preset in SOCIAL_OVERLAY_PRESETS"
                  :key="preset.platform"
                  type="button"
                  class="flex items-center gap-3 w-full px-3 py-2.5 text-[13px] rounded-md text-left transition-colors cursor-pointer border-0"
                  :class="
                    localSocialOverlay?.platform === preset.platform
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'bg-transparent text-zinc-300 hover:bg-white/[0.08] hover:text-white'
                  "
                  @click="toggleSocialOverlayPreset(preset)"
                >
                  <span class="text-lg leading-none">{{ preset.icon }}</span>
                  <span class="font-medium">{{ preset.label }}</span>
                </button>
              </div>
            </Transition>
          </Teleport>
        </template>
      </div>
    </div>

    <!-- Aspect Ratio Lock Control (shown when region is selected) -->
    <div
      v-if="selectedRegion"
      class="px-2 py-1.5 border-b border-zinc-700/50 bg-zinc-900/30"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 group">
          <Checkbox
            :model-value="selectedRegion.aspectRatioLocked !== false"
            aria-label="Toggle aspect ratio lock"
            class="h-4 w-4 rounded border-white/45 bg-white/10 text-white hover:border-emerald-300/80 data-[state=checked]:border-emerald-300 data-[state=checked]:bg-emerald-500 focus-visible:ring-emerald-400/50"
            @update:model-value="onAspectRatioLockChange"
          >
            <CheckIcon class="h-3.5 w-3.5" />
          </Checkbox>
          <LockIcon
            v-if="selectedRegion.aspectRatioLocked !== false"
            class="w-3.5 h-3.5 text-emerald-400"
          />
          <UnlockIcon
            v-else
            class="w-3.5 h-3.5 text-amber-400"
          />
          <span
            class="text-xs font-medium transition-colors"
            :class="selectedRegion.aspectRatioLocked !== false ? 'text-emerald-300' : 'text-amber-300'"
          >
            {{ selectedRegion.aspectRatioLocked !== false ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked' }}
          </span>
          <span class="text-[10px] text-zinc-500">
            ({{ selectedRegion.aspectRatioLocked !== false ? 'maintains proportions' : 'free resize' }})
          </span>
        </div>
        
        <!-- Delete Media button (only shown when region has uploaded media) -->
        <button
          v-if="selectedRegionHasMedia"
          @click="deleteMedia"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
          title="Remove uploaded media from this region"
        >
          <TrashIcon class="w-3 h-3" />
          Delete Media
        </button>
      </div>

      <!-- Rounded Corners Control -->
      <div class="flex items-center gap-3 mt-2">
        <div class="flex items-center gap-2 group shrink-0">
          <Checkbox
            :model-value="selectedRegion.cornerRadiusEnabled === true"
            aria-label="Toggle rounded corners"
            class="h-4 w-4 rounded border-white/45 bg-white/10 text-white hover:border-violet-300/80 data-[state=checked]:border-violet-300 data-[state=checked]:bg-violet-500 focus-visible:ring-violet-400/50"
            @update:model-value="onCornerRadiusToggle"
          >
            <CheckIcon class="h-3.5 w-3.5" />
          </Checkbox>
          <RoundCornerIcon class="w-3.5 h-3.5 text-violet-400" />
          <span class="text-xs font-medium text-zinc-300">Round Corners</span>
        </div>
        <template v-if="selectedRegion.cornerRadiusEnabled">
          <input
            type="range"
            min="0"
            max="540"
            step="4"
            :value="selectedRegion.cornerRadiusPx ?? 0"
            class="flex-1 h-1 accent-violet-500 cursor-pointer"
            @input="updateCornerRadius"
          />
          <span class="text-[10px] text-zinc-400 font-mono w-7 text-right shrink-0">{{ selectedRegion.cornerRadiusPx ?? 0 }}px</span>
        </template>
      </div>
    </div>

    <!-- Canvas Area -->
    <div class="flex-1 px-2 py-2 flex items-center justify-center bg-zinc-950/50">
      <div ref="containerRef" class="relative bg-black rounded-lg overflow-hidden shadow-lg" :style="containerStyle">
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
          <div v-else class="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div class="text-center">
              <VideoIcon class="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <span class="text-xs text-zinc-500">No preview available</span>
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
            <div class="text-center bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3">
              <PlusCircleIcon class="w-6 h-6 text-zinc-400 mx-auto mb-1" />
              <p class="text-xs text-zinc-400">Click "Add Region" to define crop areas</p>
            </div>
          </div>
        </template>

        <!-- ===== MEDIA VIEW (uploaded region media) ===== -->
        <template v-else-if="activeSourceView === 'media' && selectedRegionMediaSrc">
          <!-- Video preview for video media -->
          <video
            v-if="selectedRegionMediaType === 'video'"
            :src="selectedRegionMediaSrc"
            class="absolute inset-0 w-full h-full object-contain bg-zinc-900"
            controls
            muted
            playsinline
          />
          <!-- Image preview for image media -->
          <img
            v-else
            :src="selectedRegionMediaSrc"
            class="absolute inset-0 w-full h-full object-contain bg-zinc-900"
            alt="Uploaded region media"
            draggable="false"
          />

          <!-- Media info overlay -->
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <div class="flex items-center gap-2">
              <div
                class="w-3 h-3 rounded-sm"
                :style="{ backgroundColor: selectedRegion?.color }"
              />
              <span class="text-xs text-zinc-300 font-medium">
                {{ selectedRegion ? regionLabel(selectedRegion) : '' }}
              </span>
              <span class="text-[10px] text-zinc-500">
                {{ selectedRegionMediaType === 'video' ? 'Video' : 'Image' }} media
              </span>
            </div>
          </div>
        </template>

        <!-- Fallback if media view but no media -->
        <template v-else-if="activeSourceView === 'media'">
          <div class="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div class="text-center">
              <ImageIcon class="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <span class="text-xs text-zinc-500">No media uploaded for this region</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Scaled 16:9 + region + overlay tab row -->
    <div
      v-if="showScaled16x9Tab || regions.length > 0 || showSubtitlesTab || showTextBoxTab"
      class="px-2 py-1.5 border-t border-zinc-700/50 max-h-24 overflow-y-auto"
    >
      <div class="flex flex-wrap gap-1.5">
        <button
          v-if="showScaled16x9Tab"
          type="button"
          @click="selectRegion(POI_OVERLAY_SCALED_16X9_ID)"
          class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors"
          :class="
            selectedRegionId === POI_OVERLAY_SCALED_16X9_ID
              ? 'bg-zinc-700 text-white'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
          "
        >
          <div class="w-2 h-2 rounded-sm bg-purple-500" />
          Scaled 16:9
        </button>

        <button
          v-for="region in regions"
          :key="region.id"
          @click="selectRegion(region.id)"
          class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors"
          :class="
            selectedRegionId === region.id
              ? 'bg-zinc-700 text-white'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
          "
        >
          <div class="w-2 h-2 rounded-sm" :style="{ backgroundColor: region.color }" />
          {{ regionLabel(region) }}
        </button>

        <button
          v-if="showSubtitlesTab"
          type="button"
          @click="selectRegion(POI_OVERLAY_SUBTITLES_ID)"
          class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors"
          :class="
            selectedRegionId === POI_OVERLAY_SUBTITLES_ID
              ? 'bg-zinc-700 text-white'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
          "
        >
          <div class="w-2 h-2 rounded-sm bg-purple-400" />
          Subtitles
        </button>

        <button
          v-if="showTextBoxTab"
          type="button"
          @click="selectRegion(POI_OVERLAY_TEXTBOX_ID)"
          class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors"
          :class="
            selectedRegionId === POI_OVERLAY_TEXTBOX_ID
              ? 'bg-zinc-700 text-white'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
          "
        >
          <div class="w-2 h-2 rounded-sm bg-amber-400" />
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
  } from 'lucide-vue-next';
  import Hls from 'hls.js';
  import POIRegion from './POIRegion.vue';
  import { Checkbox } from '@/components/ui/checkbox';
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

<style scoped>
  .poi-source-panel {
    background: linear-gradient(to bottom, rgb(24 24 27 / 0.8), rgb(24 24 27 / 0.95));
  }

  .poi-social-dropdown-enter-active,
  .poi-social-dropdown-leave-active {
    transition: opacity 0.15s ease;
  }

  .poi-social-dropdown-enter-from,
  .poi-social-dropdown-leave-to {
    opacity: 0;
  }
</style>
