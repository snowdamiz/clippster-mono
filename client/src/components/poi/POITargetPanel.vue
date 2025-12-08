<template>
  <div class="poi-target-panel flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium text-zinc-300">Output Preview</div>
        <span class="text-[10px] text-zinc-500 font-mono">{{ targetAspectRatio }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="autoArrangeVertical"
          class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors"
          title="Stack regions vertically"
          :disabled="regions.length === 0"
        >
          <LayoutGridIcon class="w-3 h-3" />
          Stack
        </button>
      </div>
    </div>

    <!-- Canvas Area -->
    <div class="flex-1 p-3 flex items-center justify-center bg-zinc-950/50">
      <div
        ref="containerRef"
        class="relative bg-black rounded-lg overflow-hidden shadow-lg border border-zinc-800"
        :style="containerStyle"
      >
        <!-- Background fill -->
        <div class="absolute inset-0 bg-zinc-900" />

        <!-- Grid lines for visual guidance -->
        <div class="absolute inset-0 pointer-events-none">
          <!-- Horizontal thirds -->
          <div class="absolute w-full border-t border-white/5" style="top: 33.33%" />
          <div class="absolute w-full border-t border-white/5" style="top: 66.66%" />
          <!-- Vertical thirds -->
          <div class="absolute h-full border-l border-white/5" style="left: 33.33%" />
          <div class="absolute h-full border-l border-white/5" style="left: 66.66%" />
        </div>

        <!-- Region previews (showing source content in output position) -->
        <div
          v-for="region in regions"
          :key="region.id"
          class="absolute overflow-hidden"
          :style="getRegionPreviewStyle(region)"
        >
          <!-- Video crop preview -->
          <video
            v-if="videoUrl"
            :ref="(el) => setVideoRef(region.id, el as HTMLVideoElement)"
            :src="videoUrl"
            class="absolute max-w-none pointer-events-none"
            :style="getCroppedImageStyle(region)"
            preload="metadata"
            muted
            playsinline
            @loadedmetadata="(e) => onVideoLoaded(e.target as HTMLVideoElement)"
          />
          <!-- Thumbnail crop preview (fallback) -->
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="absolute max-w-none pointer-events-none"
            :style="getCroppedImageStyle(region)"
            alt=""
            draggable="false"
          />
          <!-- Placeholder when no thumbnail -->
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center"
            :style="{ backgroundColor: region.color + '20' }"
          >
            <span class="text-[9px] text-zinc-500">{{ region.label || `R${getRegionIndex(region.id) + 1}` }}</span>
          </div>
        </div>

        <!-- Draggable output regions (on top of previews) - hidden while playing -->
        <POIRegion
          v-for="region in regions"
          v-show="!isPlaying"
          :key="`output-${region.id}`"
          :rect="region.output"
          :color="region.color"
          :label="region.label || `Region ${getRegionIndex(region.id) + 1}`"
          :is-selected="selectedRegionId === region.id"
          :container-width="containerWidth"
          :container-height="containerHeight"
          :resizable="true"
          :draggable="true"
          :show-controls="false"
          :show-resize-handles="true"
          @update="(rect) => updateRegionOutput(region.id, rect)"
          @select="selectRegion(region.id)"
          @drag-start="onDragStart"
          @drag-end="onDragEnd"
        />

        <!-- Empty state -->
        <div v-if="regions.length === 0" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <LayoutIcon class="w-6 h-6 text-zinc-600 mx-auto mb-1" />
            <p class="text-[10px] text-zinc-500">Add regions in the source panel</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="px-3 py-2 border-t border-zinc-700/50">
      <p class="text-[10px] text-zinc-500 text-center">Drag and resize regions to arrange the final output layout</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { LayoutGridIcon, LayoutIcon } from 'lucide-vue-next';
  import POIRegion from './POIRegion.vue';
  import type { ManualRegion, ManualRegionRect } from '@/types';

  interface Props {
    regions: ManualRegion[];
    selectedRegionId: string | null;
    thumbnailUrl?: string | null;
    targetAspectRatio?: string;
    sourceAspectRatio?: string;
    videoUrl?: string | null;
    videoTime?: number;
    isPlaying?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    targetAspectRatio: '9:16',
    sourceAspectRatio: '16:9',
    videoTime: 0,
    isPlaying: false,
  });

  const emit = defineEmits<{
    updateRegion: [id: string, region: Partial<ManualRegion>];
    selectRegion: [id: string | null];
  }>();

  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);
  const containerHeight = ref(0);

  // Video refs for each region
  const videoRefs = ref<Map<string, HTMLVideoElement>>(new Map());

  // Set video ref for a region
  function setVideoRef(regionId: string, el: HTMLVideoElement | null) {
    if (el) {
      videoRefs.value.set(regionId, el);
      // Note: currentTime will be set in onVideoLoaded after metadata loads
    } else {
      videoRefs.value.delete(regionId);
    }
  }

  // Handle video loaded - set initial time after metadata is available
  function onVideoLoaded(video: HTMLVideoElement) {
    if (video) {
      video.currentTime = props.videoTime;
      // If we're already playing, start this video too
      if (props.isPlaying) {
        video.play().catch(console.error);
      }
    }
  }

  // Watch for play/pause changes
  watch(
    () => props.isPlaying,
    (playing) => {
      videoRefs.value.forEach((video) => {
        if (playing) {
          video.play().catch(console.error);
        } else {
          video.pause();
        }
      });
    }
  );

  // Watch for time changes (seeking)
  watch(
    () => props.videoTime,
    (time) => {
      videoRefs.value.forEach((video) => {
        // Use a larger threshold for looping detection
        if (Math.abs(video.currentTime - time) > 0.5) {
          video.currentTime = time;
          // If we're playing and just seeked, make sure playback continues
          if (props.isPlaying) {
            video.play().catch(console.error);
          }
        }
      });
    }
  );

  // Parse aspect ratio string to numbers
  function parseAspectRatio(ratio: string): { width: number; height: number } {
    const [w, h] = ratio.split(':').map(Number);
    return { width: w || 16, height: h || 9 };
  }

  // Calculate container style to maintain target aspect ratio
  const containerStyle = computed(() => {
    const aspect = parseAspectRatio(props.targetAspectRatio);
    const aspectRatio = aspect.width / aspect.height;

    // For portrait ratios, use height-based sizing
    const maxWidth = 200;
    const maxHeight = 350;

    let width: number;
    let height: number;

    if (aspectRatio < 1) {
      // Portrait - height constrained
      height = maxHeight;
      width = height * aspectRatio;
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
    } else {
      // Landscape or square
      width = maxWidth;
      height = width / aspectRatio;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  // Get region index for labeling
  function getRegionIndex(id: string): number {
    return props.regions.findIndex((r) => r.id === id);
  }

  // Get style for region preview container
  function getRegionPreviewStyle(region: ManualRegion) {
    return {
      left: `${region.output.x * 100}%`,
      top: `${region.output.y * 100}%`,
      width: `${region.output.width * 100}%`,
      height: `${region.output.height * 100}%`,
    };
  }

  // Calculate the cropped image/video style to show only the source selection
  // The media is scaled up so the source crop fills the output container,
  // then positioned so the crop area aligns with the container's top-left
  function getCroppedImageStyle(region: ManualRegion) {
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
      objectFit: 'fill' as const, // Force video/image to fill exact dimensions, ignoring aspect ratio
    };
  }

  // Update a region's output rect
  function updateRegionOutput(id: string, rect: ManualRegionRect) {
    emit('updateRegion', id, { output: rect });
  }

  // Select a region
  function selectRegion(id: string) {
    emit('selectRegion', id);
  }

  // Auto-arrange regions vertically (stack them)
  function autoArrangeVertical() {
    if (props.regions.length === 0) return;

    const regionCount = props.regions.length;
    const heightPerRegion = 1 / regionCount;

    props.regions.forEach((region, index) => {
      emit('updateRegion', region.id, {
        output: {
          x: 0,
          y: index * heightPerRegion,
          width: 1,
          height: heightPerRegion,
        },
      });
    });
  }

  // Track drag state
  const isDragging = ref(false);

  function onDragStart() {
    isDragging.value = true;
  }

  function onDragEnd() {
    isDragging.value = false;
  }

  // Update container dimensions
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
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  // Watch for aspect ratio changes
  watch(
    () => props.targetAspectRatio,
    () => {
      setTimeout(updateContainerDimensions, 0);
    }
  );
</script>

<style scoped>
  .poi-target-panel {
    background: linear-gradient(to bottom, rgb(24 24 27 / 0.8), rgb(24 24 27 / 0.95));
  }
</style>
