<template>
  <div class="poi-source-panel flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium text-zinc-300">Source Video</div>
        <span class="text-[10px] text-zinc-500 font-mono">{{ sourceAspectRatio }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
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
      </div>
    </div>

    <!-- Aspect Ratio Lock Control (shown when region is selected) -->
    <div
      v-if="selectedRegion"
      class="px-3 py-2 border-b border-zinc-700/50 bg-zinc-900/30"
    >
      <label class="flex items-center gap-2 cursor-pointer group">
        <input
          type="checkbox"
          :checked="selectedRegion.aspectRatioLocked !== false"
          @change="toggleAspectRatioLock"
          class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
        />
        <LockIcon
          v-if="selectedRegion.aspectRatioLocked !== false"
          class="w-3.5 h-3.5 text-emerald-400"
        />
        <UnlockIcon
          v-else
          class="w-3.5 h-3.5 text-amber-400"
        />
        <span class="text-xs font-medium group-hover:text-zinc-200 transition-colors"
          :class="selectedRegion.aspectRatioLocked !== false ? 'text-emerald-300' : 'text-amber-300'"
        >
          {{ selectedRegion.aspectRatioLocked !== false ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked' }}
        </span>
        <span class="text-[10px] text-zinc-500">
          ({{ selectedRegion.aspectRatioLocked !== false ? 'maintains proportions' : 'free resize' }})
        </span>
      </label>
    </div>

    <!-- Canvas Area -->
    <div class="flex-1 p-3 flex items-center justify-center bg-zinc-950/50">
      <div ref="containerRef" class="relative bg-black rounded-lg overflow-hidden shadow-lg" :style="containerStyle">
        <!-- Video element (when available) -->
        <video
          v-if="videoUrl"
          ref="videoRef"
          :src="videoUrl"
          class="absolute inset-0 w-full h-full object-cover"
          preload="metadata"
          muted
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
          :label="region.label || `Region ${getRegionIndex(region.id) + 1}`"
          :is-selected="selectedRegionId === region.id"
          :container-width="containerWidth"
          :container-height="containerHeight"
          :resizable="true"
          :draggable="true"
          :aspect-ratio-locked="region.aspectRatioLocked !== false"
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
      </div>
    </div>

    <!-- Region List -->
    <div v-if="regions.length > 0" class="px-3 py-2 border-t border-zinc-700/50 max-h-24 overflow-y-auto">
      <div class="flex flex-wrap gap-1.5">
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
          {{ region.label || `Region ${getRegionIndex(region.id) + 1}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { PlusIcon, VideoIcon, PlusCircleIcon, ImageIcon, LockIcon, UnlockIcon } from 'lucide-vue-next';
  import Hls from 'hls.js';
  import POIRegion from './POIRegion.vue';
  import type { ManualRegion, ManualRegionRect } from '@/types';
  import { POI_REGION_COLORS } from '@/types';

  interface Props {
    regions: ManualRegion[];
    selectedRegionId: string | null;
    thumbnailUrl?: string | null;
    sourceAspectRatio?: string;
    maxRegions?: number;
    videoUrl?: string | null;
    videoTime?: number;
    isPlaying?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    sourceAspectRatio: '16:9',
    maxRegions: 8,
    videoTime: 0,
    isPlaying: false,
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
  }>();

  const containerRef = ref<HTMLElement | null>(null);
  const videoRef = ref<HTMLVideoElement | null>(null);
  const containerWidth = ref(0);
  const containerHeight = ref(0);

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
      } else {
        videoRef.value.pause();
      }
    }
  );

  // Watch for time changes (seeking)
  watch(
    () => props.videoTime,
    (time) => {
      if (!videoRef.value) return;
      // Only seek if there's a significant difference (to avoid feedback loops)
      // Use a larger threshold for looping detection
      if (Math.abs(videoRef.value.currentTime - time) > 0.5) {
        videoRef.value.currentTime = time;
        // If we're playing and just seeked, make sure playback continues
        if (props.isPlaying) {
          videoRef.value.play().catch(console.error);
        }
      }
    }
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
      // Always set currentTime, even if it's 0 (0 is falsy but valid)
      videoRef.value.currentTime = props.videoTime;
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

  // Get selected region
  const selectedRegion = computed(() => {
    return props.regions.find(r => r.id === props.selectedRegionId) || null;
  });

  // Get region index for labeling
  function getRegionIndex(id: string): number {
    return props.regions.findIndex((r) => r.id === id);
  }

  // Toggle aspect ratio lock for selected region
  function toggleAspectRatioLock() {
    if (!selectedRegion.value) return;
    
    const newLockState = !(selectedRegion.value.aspectRatioLocked !== false);
    emit('updateRegion', selectedRegion.value.id, { aspectRatioLocked: newLockState });
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
    
    const newRegion: ManualRegion = {
      id: generateId(),
      color: getNextColor(),
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

  // Open media upload - creates new region if none selected
  function openMediaUpload() {
    if (props.selectedRegionId) {
      emit('uploadMedia', props.selectedRegionId);
    } else {
      // Auto-create a region first, then upload media to it
      addRegion();
      // The new region will be auto-selected, emit upload for it
      // Wait for next tick to ensure region is created
      nextTick(() => {
        if (props.selectedRegionId) {
          emit('uploadMedia', props.selectedRegionId);
        }
      });
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
  });

  onUnmounted(() => {
    cleanupHls();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

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
</style>
