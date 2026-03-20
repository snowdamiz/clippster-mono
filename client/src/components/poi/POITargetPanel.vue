<template>
  <div class="poi-target-panel flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium text-zinc-300">Output Preview</div>
        <span class="text-[10px] text-zinc-500 font-mono">{{ targetAspectRatio }}</span>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors cursor-pointer">
          <input
            type="checkbox"
            v-model="showSourceFrame"
            class="w-3 h-3 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
          />
          <span>Scale 16:9</span>
        </label>
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

        <!-- 16:9 Source Frame Overlay (when Scale 16:9 is enabled) -->
        <div
          v-if="showSourceFrame"
          class="absolute border-2 border-purple-500 cursor-move z-[3]"
          :style="sourceFrameStyle"
          @mousedown="startDragSourceFrame"
        >
          <!-- Source video/thumbnail preview -->
          <video
            v-if="videoUrl"
            ref="sourceFrameVideoRef"
            :key="`${videoUrl}-${videoCacheBuster}`"
            :src="videoUrl"
            class="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50"
            preload="metadata"
            muted
            playsinline
            @loadedmetadata="(e) => onVideoLoaded(e.target as HTMLVideoElement)"
          />
          <img
            v-else-if="thumbnailUrl"
            :key="`${thumbnailUrl}-${videoCacheBuster}`"
            :src="thumbnailUrl"
            class="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50"
            alt="Source frame"
            draggable="false"
          />
          
          <!-- Label -->
          <div class="absolute top-0 left-0 -translate-y-full px-2 py-1 bg-purple-500 text-white text-[10px] font-medium rounded-t whitespace-nowrap">
            16:9 Source Frame (Drag to position)
          </div>

          <!-- Corner resize handles -->
          <div
            v-for="corner in ['nw', 'ne', 'sw', 'se']"
            :key="corner"
            class="absolute w-3 h-3 bg-purple-500 border border-white pointer-events-auto"
            :class="{
              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize': corner === 'nw',
              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize': corner === 'ne',
              'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize': corner === 'sw',
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize': corner === 'se',
            }"
            @mousedown.stop="(e) => startResizeSourceFrame(e, corner)"
          />
        </div>

        <!-- Layout overlay previews (behind region content) -->
        <template v-if="overlayPreviews?.length">
          <div
            v-for="overlay in overlayPreviews"
            :key="overlay.id"
            class="absolute pointer-events-none z-[1]"
            :style="getOverlayStyle(overlay)"
          >
            <MediaPreview
              :src="overlay.dataUrl"
              class-name="w-full h-full object-contain"
              :style="{ opacity: overlay.opacity / 100 }"
            />
          </div>
        </template>

        <!-- Region previews (showing source content in output position) -->
        <div
          v-for="region in regions"
          :key="region.id"
          class="absolute overflow-hidden z-[5]"
          :style="getRegionPreviewStyle(region)"
        >
          <!-- Uploaded image media -->
          <img
            v-if="region.mediaAssetId && region.mediaType === 'image'"
            :src="region.mediaAssetId"
            class="absolute inset-0 w-full h-full object-cover pointer-events-none"
            alt=""
            draggable="false"
          />
          <!-- Uploaded video media -->
          <video
            v-else-if="region.mediaAssetId && region.mediaType === 'video'"
            :ref="(el) => setVideoRef(region.id, el as HTMLVideoElement)"
            :src="region.mediaAssetId"
            class="absolute inset-0 w-full h-full object-cover pointer-events-none"
            preload="metadata"
            muted
            playsinline
            loop
            @loadedmetadata="(e) => onVideoLoaded(e.target as HTMLVideoElement)"
          />
          <!-- Video crop preview (default behavior) -->
          <video
            v-else-if="videoUrl"
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

        <!-- Watermark preview overlay -->
        <div
          v-if="watermarkPreview"
          class="absolute pointer-events-none z-10"
          :style="watermarkPreviewStyle"
        >
          <!-- Watermark indicator (simple preview representation) -->
          <div 
            class="w-full h-full border-2 border-dashed border-amber-500/50 rounded bg-amber-500/10 flex items-center justify-center"
            :style="{ opacity: watermarkPreview.opacity / 100 }"
          >
            <span class="text-[8px] text-amber-500/80 font-medium">WATERMARK</span>
          </div>
        </div>

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
  import MediaPreview from '@/components/MediaPreview.vue';
  import type { ManualRegion, ManualRegionRect } from '@/types';

  interface WatermarkPreview {
    filePath?: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
  }

  interface OverlayPreview {
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
    regions: ManualRegion[];
    selectedRegionId: string | null;
    thumbnailUrl?: string | null;
    targetAspectRatio?: string;
    sourceAspectRatio?: string;
    videoUrl?: string | null;
    videoTime?: number;
    isPlaying?: boolean;
    // Optional watermark preview overlay
    watermarkPreview?: WatermarkPreview | null;
    // Optional layout overlay previews
    overlayPreviews?: OverlayPreview[];
  }

  const props = withDefaults(defineProps<Props>(), {
    targetAspectRatio: '9:16',
    sourceAspectRatio: '16:9',
    videoTime: 0,
    isPlaying: false,
    watermarkPreview: null,
  });

  const emit = defineEmits<{
    updateRegion: [id: string, region: Partial<ManualRegion>];
    selectRegion: [id: string | null];
  }>();

  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);
  const containerHeight = ref(0);

  // Source frame scaling state
  const showSourceFrame = ref(false);
  const sourceFrameTransform = ref({
    scale: 1,
    x: 0,
    y: 0,
  });
  const isDraggingSourceFrame = ref(false);
  const dragStartPos = ref({ x: 0, y: 0 });
  const dragStartTransform = ref({ x: 0, y: 0 });

  // Watch for Scale 16:9 checkbox - auto-fit when enabled
  watch(showSourceFrame, (enabled) => {
    if (enabled) {
      // Start at scale 1.0 - entire 16:9 frame visible, centered in 9:16
      // User can then drag corners to zoom in and drag body to reposition
      sourceFrameTransform.value.scale = 1.0;
      sourceFrameTransform.value.x = 0;
      sourceFrameTransform.value.y = 0;
    }
  });

  // Video refs for each region
  const videoRefs = ref<Map<string, HTMLVideoElement>>(new Map());
  
  // Source frame video ref
  const sourceFrameVideoRef = ref<HTMLVideoElement | null>(null);
  
  // Cache buster for forcing video reload
  const videoCacheBuster = ref(Date.now());
  
  // Watch for videoUrl or thumbnailUrl changes and force reload
  watch([() => props.videoUrl, () => props.thumbnailUrl], ([newVideoUrl, newThumbUrl], [oldVideoUrl, oldThumbUrl]) => {
    if (newVideoUrl !== oldVideoUrl || newThumbUrl !== oldThumbUrl) {
      // Force complete recreation by changing cache buster
      videoCacheBuster.value = Date.now();
      
      // Also force reload if video element exists
      if (sourceFrameVideoRef.value) {
        sourceFrameVideoRef.value.load();
      }
    }
  });

  // Watch for source frame video ref changes and add to videoRefs map
  watch(sourceFrameVideoRef, (newVideo, oldVideo) => {
    if (oldVideo) {
      videoRefs.value.delete('__sourceFrame__');
    }
    if (newVideo) {
      videoRefs.value.set('__sourceFrame__', newVideo);
    }
  });

  // Compute source frame style (16:9 frame positioned in 9:16 container)
  const sourceFrameStyle = computed(() => {
    const transform = sourceFrameTransform.value;
    
    // For 16:9 source in 9:16 container:
    // - 16:9 is wider (aspect ~1.78)
    // - 9:16 is taller (aspect ~0.56)
    // - Base size: fit 16:9 to container WIDTH (so entire frame is visible, letterboxed)
    // - Then apply scale to zoom in/out
    
    const sourceAspect = 16 / 9;
    
    // Fit to WIDTH for 16:9 in portrait container (letterbox effect)
    // Base dimensions at scale 1.0
    const baseWidth = containerWidth.value;
    const baseHeight = baseWidth / sourceAspect;
    
    // Apply scale
    const width = baseWidth * transform.scale;
    const height = baseHeight * transform.scale;
    
    // Center by default, then apply transform offset
    const left = (containerWidth.value - width) / 2 + transform.x;
    const top = (containerHeight.value - height) / 2 + transform.y;
    
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  // Start dragging source frame
  function startDragSourceFrame(e: MouseEvent) {
    e.preventDefault();
    isDraggingSourceFrame.value = true;
    dragStartPos.value = { x: e.clientX, y: e.clientY };
    dragStartTransform.value = { x: sourceFrameTransform.value.x, y: sourceFrameTransform.value.y };
    
    document.addEventListener('mousemove', onDragSourceFrame);
    document.addEventListener('mouseup', stopDragSourceFrame);
  }

  // Handle source frame drag
  function onDragSourceFrame(e: MouseEvent) {
    if (!isDraggingSourceFrame.value) return;
    
    const deltaX = e.clientX - dragStartPos.value.x;
    const deltaY = e.clientY - dragStartPos.value.y;
    
    sourceFrameTransform.value.x = dragStartTransform.value.x + deltaX;
    sourceFrameTransform.value.y = dragStartTransform.value.y + deltaY;
  }

  // Stop dragging source frame
  function stopDragSourceFrame() {
    isDraggingSourceFrame.value = false;
    document.removeEventListener('mousemove', onDragSourceFrame);
    document.removeEventListener('mouseup', stopDragSourceFrame);
  }

  // Start resizing source frame (corner drag)
  function startResizeSourceFrame(e: MouseEvent, corner: string) {
    e.preventDefault();
    e.stopPropagation();
    
    const startScale = sourceFrameTransform.value.scale;
    const startX = e.clientX;
    const startY = e.clientY;
    
    const onResize = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Calculate direction based on corner
      // For all corners, dragging outward (positive delta) should increase scale
      let scaleDelta = 0;
      if (corner === 'se' || corner === 'ne') {
        // Right corners: positive X = scale up
        scaleDelta = deltaX / 200;
      } else {
        // Left corners: negative X = scale up
        scaleDelta = -deltaX / 200;
      }
      
      sourceFrameTransform.value.scale = Math.max(0.5, Math.min(5, startScale + scaleDelta));
    };
    
    const stopResize = () => {
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', stopResize);
    };
    
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
  }

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

  // Calculate watermark preview style (positioned at percentage-based coordinates)
  const watermarkPreviewStyle = computed(() => {
    if (!props.watermarkPreview) return {};
    
    const { x, y, scale } = props.watermarkPreview;
    
    // Watermark size as percentage of container width
    const sizePercent = scale;
    
    // Position is center-point based (like CSS transform: translate(-50%, -50%))
    return {
      width: `${sizePercent}%`,
      height: 'auto',
      aspectRatio: '3/1', // Approximate watermark aspect ratio for preview
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)',
    };
  });

  // Calculate overlay preview style
  function getOverlayStyle(overlay: OverlayPreview) {
    if (overlay.isFullFrame) {
      return {
        left: '0%',
        top: '0%',
        width: '100%',
        height: '100%',
      };
    }
    return {
      left: `${overlay.x}%`,
      top: `${overlay.y}%`,
      transform: 'translate(-50%, -50%)',
      width: `${overlay.scale}%`,
      height: 'auto',
    };
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
