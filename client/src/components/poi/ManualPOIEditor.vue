<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[10001]">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl w-full max-w-4xl mx-4 border border-white/10 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <!-- Top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 flex-shrink-0" />

            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center border border-blue-500/30"
                >
                  <LayoutDashboardIcon class="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-white">Manual Framing Editor</h2>
                  <p class="text-xs text-zinc-400">
                    Define crop regions on the source and arrange them in the {{ targetAspectRatio }} output
                  </p>
                </div>
              </div>
              <button
                @click="close"
                class="p-2 hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-800"
                title="Close"
              >
                <XIcon class="h-5 w-5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <!-- Main Content - Side by Side Panels -->
            <div class="flex-1 overflow-hidden flex flex-col">
              <div class="flex-1 flex overflow-hidden">
                <!-- Source Panel (Left) -->
                <div class="flex-1 border-r border-zinc-800">
                  <POISourcePanel
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="thumbnailUrl"
                    :source-aspect-ratio="sourceAspectRatio"
                    :video-url="videoUrl"
                    :video-time="absoluteVideoTime"
                    :is-playing="isPlaying"
                    @add-region="addRegion"
                    @update-region="updateRegion"
                    @delete-region="deleteRegion"
                    @select-region="selectRegion"
                    @time-update="onTimeUpdate"
                    @upload-media="handleMediaUpload"
                  />
                </div>

                <!-- Arrow indicator -->
                <div class="flex items-center justify-center w-12 bg-zinc-900/50">
                  <div class="flex flex-col items-center gap-2">
                    <ArrowRightIcon class="w-5 h-5 text-zinc-500" />
                    <span class="text-[9px] text-zinc-600 font-medium tracking-wider rotate-90 whitespace-nowrap">
                      EXPORT
                    </span>
                  </div>
                </div>

                <!-- Target Panel (Right) -->
                <div class="flex-1">
                  <POITargetPanel
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="thumbnailUrl"
                    :target-aspect-ratio="targetAspectRatio"
                    :source-aspect-ratio="sourceAspectRatio"
                    :video-url="videoUrl"
                    :video-time="absoluteVideoTime"
                    :is-playing="isPlaying"
                    :watermark-preview="resolvedWatermark"
                    :overlay-previews="resolvedOverlays"
                    :subtitle-settings="subtitleSettings"
                    :subtitle-position="localSubtitlePosition"
                    :subtitle-positioning-enabled="subtitlePositioningEnabled"
                    @update-region="updateRegion"
                    @select-region="selectRegion"
                    @update-source-transform="handleSourceTransformUpdate"
                    @subtitlePositionChange="onSubtitlePositionChange"
                  />
                </div>
              </div>

              <!-- Video Playback Controls -->
              <div v-if="clipDuration > 0" class="px-5 py-3 border-t border-zinc-800 bg-zinc-900/70">
                <div class="flex items-center gap-4">
                  <!-- Play/Pause button -->
                  <button
                    @click="togglePlayback"
                    class="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors shadow-lg"
                    :disabled="!videoUrl"
                    :class="{ 'opacity-50 cursor-not-allowed': !videoUrl }"
                  >
                    <PlayIcon v-if="!isPlaying" class="w-4 h-4 ml-0.5" />
                    <PauseIcon v-else class="w-4 h-4" />
                  </button>

                  <!-- Time display -->
                  <span class="text-xs text-zinc-400 font-mono w-20">
                    {{ formatTime(currentTime) }} / {{ formatTime(clipDuration) }}
                  </span>

                  <!-- Progress bar -->
                  <div class="flex-1 relative group cursor-pointer" ref="progressBarRef" @mousedown="onSeekStart">
                    <div class="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-gradient-to-r from-blue-500 to-violet-500"
                        :class="{ 'transition-all duration-100': !isSeeking }"
                        :style="{ width: `${(currentTime / clipDuration) * 100}%` }"
                      />
                    </div>
                    <!-- Seek handle -->
                    <div
                      class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md transition-opacity pointer-events-none"
                      :class="{ 
                        'opacity-100': isSeeking || currentTime === 0, 
                        'opacity-0 group-hover:opacity-100': !isSeeking && currentTime !== 0 
                      }"
                      :style="{ left: `calc(${(currentTime / clipDuration) * 100}% - 6px)` }"
                    />
                  </div>

                  <!-- Reset button -->
                  <button
                    @click="
                      currentTime = 0;
                      isPlaying = false;
                    "
                    class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Reset to start"
                  >
                    <RotateCcwIcon class="w-4 h-4" />
                  </button>
                </div>

                <!-- Loading/Error state -->
                <div v-if="videoLoading" class="text-[10px] text-zinc-500 mt-2">Loading video preview...</div>
                <div v-else-if="videoError" class="text-[10px] text-amber-400 mt-2">
                  {{ videoError }}
                </div>
              </div>

              <!-- Segment Timeline -->
              <POISegmentTimeline
                v-if="clipDuration > 0"
                :segments="segmentConfigs"
                :active-segment-id="activeSegmentId"
                :duration="clipDuration"
                :current-time="currentTime"
                :video-url="videoUrl"
                :thumbnail-url="thumbnailUrl"
                :clip-start-time="clipStartTime"
                :clip-end-time="clipEndTime"
                @add-segment="addSegment"
                @delete-segment="deleteSegment"
                @select-segment="selectSegment"
                @update-segment="updateSegment"
                @seek-time="handleSeekTime"
              />

              <!-- Subtitle Positioning Controls -->
              <div v-if="subtitleSettings" class="px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="subtitle-positioning"
                    v-model="subtitlePositioningEnabled"
                    class="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label for="subtitle-positioning" class="text-sm font-medium text-white flex items-center gap-2">
                    <Type class="h-4 w-4 text-purple-400" />
                    Enable subtitle positioning
                  </label>
                  <span class="text-[10px] text-zinc-500">{{ targetAspectRatio }}</span>
                </div>
                <p class="text-[10px] text-zinc-400 mt-1 ml-7">
                  Drag subtitles in the preview to adjust their position for this aspect ratio
                </p>
              </div>

              <!-- Debug info -->
              <div v-if="!subtitleSettings" class="px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
                <p class="text-[10px] text-amber-400">Debug: subtitleSettings is null/undefined</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <div class="text-sm text-zinc-400">
                <span v-if="regions.length === 0 && !sourceTransform" class="text-amber-400">
                  <AlertCircleIcon class="w-4 h-4 inline mr-1" />
                  Add at least one region or enable source frame scaling
                </span>
                <span v-else-if="sourceTransform && regions.length === 0" class="text-zinc-500">
                  Source frame scaling configured
                </span>
                <span v-else class="text-zinc-500">
                  {{ regions.length }} region{{ regions.length !== 1 ? 's' : '' }} configured
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button
                  @click="resetRegions"
                  class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                  :disabled="regions.length === 0 && !sourceTransform"
                  :class="{ 'opacity-50 cursor-not-allowed': regions.length === 0 && !sourceTransform }"
                >
                  Reset
                </button>
                <button
                  @click="close"
                  class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="confirmConfig"
                  :disabled="regions.length === 0 && !sourceTransform"
                  class="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all relative overflow-hidden group"
                  :class="
                    regions.length === 0 && !sourceTransform
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500'
                  "
                >
                  <div
                    v-if="regions.length > 0 || sourceTransform"
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <CheckIcon class="h-4 w-4 relative" />
                  <span class="relative">Apply Configuration</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import {
    LayoutDashboardIcon,
    XIcon,
    ArrowRightIcon,
    CheckIcon,
    AlertCircleIcon,
    PlayIcon,
    PauseIcon,
    RotateCcwIcon,
  } from 'lucide-vue-next';
  import Hls from 'hls.js';
  import POISourcePanel from './POISourcePanel.vue';
  import POITargetPanel from './POITargetPanel.vue';
  import POISegmentTimeline from './POISegmentTimeline.vue';
  import type { ManualRegion, ManualFramingConfig, WatermarkSettings, LayoutOverlay, SegmentRegionConfig, SubtitleSettings } from '@/types';
  import { utf8ToBase64 } from '@/utils/encoding';

  interface WatermarkPreview {
    filePath: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
  }

  interface OverlayPreviewData {
    id: string;
    dataUrl: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    isFullFrame: boolean;
    label?: string;
  }

  interface Props {
    modelValue: boolean;
    initialConfig?: ManualFramingConfig | null;
    targetAspectRatio: string;
    sourceAspectRatio?: string;
    thumbnailUrl?: string | null;
    videoPath?: string | null;
    clipStartTime?: number;
    clipEndTime?: number;
    // Optional full video duration (for VOD pre-edit use case)
    fullVideoDuration?: number;
    // Optional watermark preview for the target aspect ratio
    watermarkSettings?: WatermarkSettings | null;
    // Optional layout overlays to display in target preview
    layoutOverlays?: LayoutOverlay[];
    // Pre-resolved overlay preview data URLs (keyed by overlay id)
    overlayPreviewUrls?: Record<string, string>;
    // Optional subtitle settings for preview
    subtitleSettings?: SubtitleSettings | null;
    // Optional subtitle position override for this aspect ratio
    subtitlePositionOverride?: { x: number; y: number; width?: number } | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    sourceAspectRatio: '16:9',
    clipStartTime: 0,
    clipEndTime: 0,
    fullVideoDuration: 0,
    watermarkSettings: null,
    subtitleSettings: null,
    subtitlePositionOverride: null,
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [config: ManualFramingConfig];
    subtitlePositionChange: [position: { x: number; y: number; width?: number }];
  }>();

  // Local state
  const regions = ref<ManualRegion[]>([]);
  const selectedRegionId = ref<string | null>(null);

  // Base regions - apply to entire clip when no segment is active
  const baseRegions = ref<ManualRegion[]>([]);

  // Segment management state
  const segmentConfigs = ref<SegmentRegionConfig[]>([]);
  const activeSegmentId = ref<string | null>(null);

  // Source frame transform (16:9 scaling in 9:16)
  const sourceTransform = ref<{ scale: number; x: number; y: number } | null>(null);

  // Video playback state
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const videoUrl = ref<string | null>(null);
  const videoLoading = ref(false);
  const videoError = ref<string | null>(null);

  // Subtitle positioning state
  const localSubtitlePosition = ref<{ x: number; y: number; width?: number }>(
    props.subtitlePositionOverride ? { ...props.subtitlePositionOverride } : { x: 50, y: 85, width: 80 }
  );
  const subtitlePositioningEnabled = ref(false);
  const isSeeking = ref(false);
  const progressBarRef = ref<HTMLElement | null>(null);

  // Store seek listeners for cleanup
  let seekMoveListener: ((e: MouseEvent) => void) | null = null;
  let seekUpListener: (() => void) | null = null;

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

  function constructVideoUrl(filePath: string, port: number): string {
    const encodedPath = utf8ToBase64(filePath);
    const isTsFile = filePath.toLowerCase().endsWith('.ts');
    if (isTsFile) {
      return `http://localhost:${port}/ts-hls/${encodedPath}/playlist.m3u8`;
    }
    return `http://localhost:${port}/video/${encodedPath}`;
  }

  // Keyboard controls for precision scrubbing
  function handleKeyDown(e: KeyboardEvent) {
    // Only handle if dialog is open and not typing in an input
    if (!props.modelValue) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    const microStep = 0.01; // 10ms - ultra precise
    const fineStep = 0.1; // 100ms - fine control
    const jumpTime = 1.0; // 1 second for shift+arrow
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey) {
          // Jump back 1 second
          currentTime.value = Math.max(0, currentTime.value - jumpTime);
        } else if (e.ctrlKey || e.metaKey) {
          // Ultra precise: 10ms steps
          currentTime.value = Math.max(0, currentTime.value - microStep);
        } else {
          // Fine: 100ms steps (0.1 second)
          currentTime.value = Math.max(0, currentTime.value - fineStep);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey) {
          // Jump forward 1 second
          currentTime.value = Math.min(clipDuration.value, currentTime.value + jumpTime);
        } else if (e.ctrlKey || e.metaKey) {
          // Ultra precise: 10ms steps
          currentTime.value = Math.min(clipDuration.value, currentTime.value + microStep);
        } else {
          // Fine: 100ms steps (0.1 second)
          currentTime.value = Math.min(clipDuration.value, currentTime.value + fineStep);
        }
        break;
      case ' ':
        e.preventDefault();
        togglePlayback();
        break;
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    cleanupHls();
    cleanupSeekListeners();
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Computed clip duration
  const clipDuration = computed(() => {
    if (props.clipEndTime !== undefined && props.clipStartTime !== undefined) {
      return props.clipEndTime - props.clipStartTime;
    }
    // Fallback to full video duration for VOD pre-edit use case
    return props.fullVideoDuration || 0;
  });

  // Format time as MM:SS
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Load video URL using the app's video server
  async function loadVideoUrl() {
    cleanupHls();
    if (!props.videoPath) return;

    videoLoading.value = true;
    videoError.value = null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const port = await invoke<number>('get_video_server_port');
      const timestamp = Date.now();
      const baseUrl = constructVideoUrl(props.videoPath, port);
      videoUrl.value = baseUrl.includes('?') ? `${baseUrl}&t=${timestamp}` : `${baseUrl}?t=${timestamp}`;
      console.log('[POIEditor] Video URL loaded:', videoUrl.value);
    } catch (error) {
      console.error('[POIEditor] Failed to load video:', error);
      videoError.value = 'Failed to load video preview';
    } finally {
      videoLoading.value = false;
    }
  }

  // Play/Pause toggle
  function togglePlayback() {
    isPlaying.value = !isPlaying.value;
  }

  // Handle time update from video
  function onTimeUpdate(time: number) {
    // Convert absolute time to clip-relative time
    currentTime.value = time - props.clipStartTime;

    // Loop back to start if we've reached the end (while still playing)
    if (currentTime.value >= clipDuration.value && isPlaying.value) {
      currentTime.value = 0;
      // The video will be seeked back to start via the watch on absoluteVideoTime
    }
  }

  // Get absolute video time from clip-relative time
  const absoluteVideoTime = computed(() => {
    return props.clipStartTime + currentTime.value;
  });

  // Resolve watermark settings for the target aspect ratio
  const resolvedWatermark = computed((): WatermarkPreview | null => {
    if (!props.watermarkSettings?.enabled) return null;

    const ratioKey = props.targetAspectRatio as '16:9' | '9:16' | '1:1' | '4:5';
    const perRatioConfig = props.watermarkSettings.perRatioSettings?.[ratioKey];

    // If config is explicitly null, watermark is disabled for this ratio
    if (perRatioConfig === null) return null;

    // Use per-ratio position if available, otherwise default
    const position = perRatioConfig?.position;

    return {
      filePath: '', // Will be loaded by POITargetPanel
      x: position?.x ?? props.watermarkSettings.positionX,
      y: position?.y ?? props.watermarkSettings.positionY,
      scale: position?.scale ?? props.watermarkSettings.scale,
      opacity: position?.opacity ?? props.watermarkSettings.opacity,
    };
  });

  // Resolve overlay data for the target aspect ratio
  const resolvedOverlays = computed((): OverlayPreviewData[] => {
    if (!props.layoutOverlays?.length) {
      console.log('[ManualPOIEditor] resolvedOverlays: no layoutOverlays');
      return [];
    }

    const ratioKey = props.targetAspectRatio as '16:9' | '9:16' | '1:1' | '4:5';
    const urlKeys = props.overlayPreviewUrls ? Object.keys(props.overlayPreviewUrls) : [];
    console.log('[ManualPOIEditor] resolvedOverlays evaluating:', {
      overlayCount: props.layoutOverlays.length,
      overlayIds: props.layoutOverlays.map(o => o.id),
      previewUrlKeys: urlKeys,
      previewUrlLengths: urlKeys.map(k => props.overlayPreviewUrls?.[k]?.length || 0),
      ratioKey,
    });

    return props.layoutOverlays
      .map((overlay) => {
        const dataUrl = props.overlayPreviewUrls?.[overlay.id];
        if (!dataUrl) {
          console.log('[ManualPOIEditor] No dataUrl for overlay:', overlay.id);
          return null;
        }
        console.log('[ManualPOIEditor] Found dataUrl for overlay:', overlay.id, 'length:', dataUrl.length);

        // Check per-ratio settings first
        const perRatio = overlay.perRatioSettings?.[ratioKey];
        const settings = perRatio || overlay;

        return {
          id: overlay.id,
          dataUrl,
          x: settings.x ?? 50,
          y: settings.y ?? 50,
          scale: (perRatio as any)?.scale ?? 100,
          opacity: settings.opacity ?? 100,
          isFullFrame: (settings as any).isFullFrameOverlay ?? false,
          label: overlay.label,
        } as OverlayPreviewData;
      })
      .filter((o): o is OverlayPreviewData => o !== null);
  });

  // Clean up any existing seek listeners
  function cleanupSeekListeners() {
    if (seekMoveListener) {
      window.removeEventListener('mousemove', seekMoveListener);
      seekMoveListener = null;
    }
    if (seekUpListener) {
      window.removeEventListener('mouseup', seekUpListener);
      seekUpListener = null;
    }
  }

  // Handle seek drag start
  function onSeekStart(event: MouseEvent) {
    if (!progressBarRef.value) return;
    event.preventDefault();
    
    // Clean up any existing listeners first
    cleanupSeekListeners();
    
    const wasPlaying = isPlaying.value;
    isPlaying.value = false; // Pause during seek
    isSeeking.value = true;
    
    // Store initial mouse position and time for precision mode
    const startX = event.clientX;
    const startTime = currentTime.value;

    seekMoveListener = (e: MouseEvent) => {
      if (!progressBarRef.value) return;
      const rect = progressBarRef.value.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      
      if (e.shiftKey) {
        // Precision mode: quantize to 0.01 second increments
        const rawTime = percent * clipDuration.value;
        const quantized = Math.round(rawTime / 0.01) * 0.01;
        currentTime.value = Math.max(0, Math.min(clipDuration.value, quantized));
      } else {
        // Normal mode: direct position mapping
        currentTime.value = percent * clipDuration.value;
      }
    };

    seekUpListener = () => {
      isSeeking.value = false;
      if (wasPlaying) {
        isPlaying.value = true; // Resume if it was playing
      }
      cleanupSeekListeners();
    };

    // Initial seek position
    seekMoveListener(event);

    // Add listeners to window for better drag tracking
    window.addEventListener('mousemove', seekMoveListener);
    window.addEventListener('mouseup', seekUpListener);
  }

  // Initialize from initial config when dialog opens
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        // Load initial configuration
        if (props.initialConfig && props.initialConfig.regions.length > 0) {
          // Deep clone the regions
          regions.value = JSON.parse(JSON.stringify(props.initialConfig.regions));
          
          // Load segment configurations if present
          if (props.initialConfig.segmentConfigs && props.initialConfig.segmentConfigs.length > 0) {
            segmentConfigs.value = JSON.parse(JSON.stringify(props.initialConfig.segmentConfigs));
            // Don't auto-activate first segment - let the watch on currentTime determine active segment
            activeSegmentId.value = null;
            // Save base regions if we have regions but no active segment
            if (regions.value.length > 0) {
              baseRegions.value = JSON.parse(JSON.stringify(regions.value));
            }
          } else {
            segmentConfigs.value = [];
            activeSegmentId.value = null;
          }
        } else {
          regions.value = [];
          segmentConfigs.value = [];
          activeSegmentId.value = null;
        }
        selectedRegionId.value = regions.value.length > 0 ? regions.value[0].id : null;

        // Reset playback state
        isPlaying.value = false;
        currentTime.value = 0;

        // Load video URL
        await loadVideoUrl();
      } else {
        // Cleanup when closing
        isPlaying.value = false;
        videoUrl.value = null;
      }
    },
    { immediate: true }
  );

  // Add a new region
  function addRegion(region: ManualRegion) {
    regions.value.push(region);
  }

  // Update a region
  function updateRegion(id: string, update: Partial<ManualRegion>) {
    const index = regions.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      regions.value[index] = { ...regions.value[index], ...update };
    }
  }

  // Delete a region
  function deleteRegion(id: string) {
    const index = regions.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      regions.value.splice(index, 1);
    }
    if (selectedRegionId.value === id) {
      selectedRegionId.value = regions.value.length > 0 ? regions.value[0].id : null;
    }
  }

  // Select a region
  function selectRegion(id: string | null) {
    selectedRegionId.value = id;
  }

  // Handle source transform updates from POITargetPanel
  function handleSourceTransformUpdate(transform: { scale: number; x: number; y: number }) {
    sourceTransform.value = { ...transform };
  }

  // Handle media upload for a region
  async function handleMediaUpload(regionId: string) {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        // For now, store the file URL directly
        // TODO: Integrate with editor asset system when available in POI context
        const fileUrl = URL.createObjectURL(file);
        const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
        
        updateRegion(regionId, {
          mediaAssetId: fileUrl, // Temporary: using object URL
          mediaType: mediaType as 'image' | 'video',
        });
        
        console.log('[ManualPOIEditor] Media uploaded for region:', regionId, mediaType);
      } catch (error) {
        console.error('[ManualPOIEditor] Failed to upload media:', error);
      }
    };
    
    input.click();
  }

  // Handle subtitle position changes
  function onSubtitlePositionChange(position: { x: number; y: number; width?: number }) {
    localSubtitlePosition.value = { ...position };
    emit('subtitlePositionChange', { ...position });
  }

  // Add a new segment
  function addSegment() {
    // Create segment at current playhead position (or at end if no playhead)
    const startTime = currentTime.value !== null ? currentTime.value : 
                      (segmentConfigs.value.length > 0 ? segmentConfigs.value[segmentConfigs.value.length - 1].endTime : 0);
    
    // Default duration: 5 seconds or 1/4 of clip duration, whichever is smaller
    const defaultDuration = Math.min(5, clipDuration.value / 4);
    const endTime = Math.min(startTime + defaultDuration, clipDuration.value);
    
    if (startTime >= clipDuration.value) return;
    
    // If this is the first segment and we're not currently in a segment, save current regions as base
    if (segmentConfigs.value.length === 0 && activeSegmentId.value === null) {
      baseRegions.value = JSON.parse(JSON.stringify(regions.value));
    }
    
    const newSegment: SegmentRegionConfig = {
      segmentId: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime,
      endTime,
      regions: JSON.parse(JSON.stringify(regions.value)), // Copy current regions
    };
    
    segmentConfigs.value.push(newSegment);
    
    // Sort segments by start time
    segmentConfigs.value.sort((a, b) => a.startTime - b.startTime);
    
    activeSegmentId.value = newSegment.segmentId;
  }

  // Delete a segment
  function deleteSegment(segmentId: string) {
    const index = segmentConfigs.value.findIndex(s => s.segmentId === segmentId);
    if (index !== -1) {
      segmentConfigs.value.splice(index, 1);
      if (activeSegmentId.value === segmentId) {
        activeSegmentId.value = segmentConfigs.value[0]?.segmentId || null;
      }
    }
  }

  // Select a segment
  function selectSegment(segmentId: string) {
    const segment = segmentConfigs.value.find(s => s.segmentId === segmentId);
    if (!segment) return;
    
    // Check if current time is actually within this segment's range
    const isWithinSegment = currentTime.value >= segment.startTime && currentTime.value <= segment.endTime;
    
    if (isWithinSegment) {
      // Save current regions before switching
      if (activeSegmentId.value && activeSegmentId.value !== segmentId) {
        // Save current segment's regions
        const currentSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
        if (currentSegment) {
          currentSegment.regions = JSON.parse(JSON.stringify(regions.value));
        }
      } else if (activeSegmentId.value === null) {
        // Save base regions
        baseRegions.value = JSON.parse(JSON.stringify(regions.value));
      }
      
      // Switch to segment and load its regions
      activeSegmentId.value = segmentId;
      regions.value = JSON.parse(JSON.stringify(segment.regions));
    } else {
      // We're outside the segment - don't activate it, just seek to its start time
      // This will trigger the watch on currentTime which will handle the segment switch
      currentTime.value = segment.startTime;
    }
  }

  // Update segment times (from timeline drag/resize)
  function updateSegment(segmentId: string, updates: { startTime?: number; endTime?: number }) {
    const segment = segmentConfigs.value.find(s => s.segmentId === segmentId);
    if (segment) {
      if (updates.startTime !== undefined) {
        segment.startTime = updates.startTime;
      }
      if (updates.endTime !== undefined) {
        segment.endTime = updates.endTime;
      }
    }
  }

  // Handle seek time from timeline playhead drag
  function handleSeekTime(time: number) {
    currentTime.value = time;
    // Video elements in POISourcePanel and POITargetPanel will sync via their watch on videoTime prop
  }

  // Watch for time changes and auto-switch segments (works during playback AND manual scrubbing)
  watch(currentTime, (time) => {
    if (segmentConfigs.value.length === 0) {
      // No segments - ensure we're using base regions
      if (activeSegmentId.value !== null) {
        activeSegmentId.value = null;
        if (baseRegions.value.length > 0) {
          regions.value = JSON.parse(JSON.stringify(baseRegions.value));
        }
      }
      return;
    }
    
    // Find which segment the current time falls into
    const activeSegment = segmentConfigs.value.find(
      seg => time >= seg.startTime && time <= seg.endTime
    );
    
    if (activeSegment) {
      // We're inside a segment
      if (activeSegment.segmentId !== activeSegmentId.value) {
        // Save current regions before switching
        if (activeSegmentId.value) {
          const currentSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
          if (currentSegment) {
            currentSegment.regions = JSON.parse(JSON.stringify(regions.value));
          }
        } else {
          // We were in base regions, save them
          baseRegions.value = JSON.parse(JSON.stringify(regions.value));
        }
        
        // Switch to the segment
        activeSegmentId.value = activeSegment.segmentId;
        regions.value = JSON.parse(JSON.stringify(activeSegment.regions));
      }
    } else {
      // We're outside all segments - use base regions
      if (activeSegmentId.value !== null) {
        // Save current segment's regions
        const currentSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
        if (currentSegment) {
          currentSegment.regions = JSON.parse(JSON.stringify(regions.value));
        }
        
        // Switch to base regions
        activeSegmentId.value = null;
        if (baseRegions.value.length > 0) {
          regions.value = JSON.parse(JSON.stringify(baseRegions.value));
        }
      }
    }
  }, { immediate: true });

  // Reset all regions
  function resetRegions() {
    regions.value = [];
    selectedRegionId.value = null;
  }

  // Close the dialog
  function close() {
    emit('update:modelValue', false);
  }

  // Confirm and emit the configuration
  function confirmConfig() {
    // Allow applying if we have regions OR source transform
    if (regions.value.length === 0 && baseRegions.value.length === 0 && !sourceTransform.value) return;

    // Save current regions
    if (activeSegmentId.value) {
      // Save current segment's regions
      const activeSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
      if (activeSegment) {
        activeSegment.regions = JSON.parse(JSON.stringify(regions.value));
      }
    } else {
      // Save base regions
      baseRegions.value = JSON.parse(JSON.stringify(regions.value));
    }

    // Use base regions as the default regions in config
    // Segments will override these for their specific time ranges
    const finalRegions = baseRegions.value.length > 0 ? baseRegions.value : regions.value;

    const config: ManualFramingConfig = {
      mode: 'manual',
      regions: JSON.parse(JSON.stringify(finalRegions)),
      targetAspectRatio: props.targetAspectRatio,
      sourceAspectRatio: props.sourceAspectRatio,
      segmentConfigs: segmentConfigs.value.length > 0 ? JSON.parse(JSON.stringify(segmentConfigs.value)) : undefined,
      sourceTransform: sourceTransform.value ? JSON.parse(JSON.stringify(sourceTransform.value)) : undefined,
    };

    emit('confirm', config);
    close();
  }
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
</style>
