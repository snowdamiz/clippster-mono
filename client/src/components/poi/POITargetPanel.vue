<template>
  <div class="poi-target-panel flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium text-zinc-300">Output Preview</div>
        <span class="text-[10px] text-zinc-500 font-mono">{{ targetAspectRatio }}</span>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border-2"
          :class="showSourceFrame 
            ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/50 text-purple-200 hover:border-purple-400' 
            : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50 hover:border-zinc-600 hover:text-zinc-200'"
        >
          <input
            type="checkbox"
            v-model="showSourceFrame"
            class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
          />
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2"/>
            <path d="M2 10h20M2 15h20" stroke-width="2"/>
          </svg>
          <span>Scale 16:9 Source</span>
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
          :aspect-ratio-locked="region.aspectRatioLocked !== false"
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

        <!-- Subtitle draggable/resizable box -->
        <div
          v-if="subtitleSettings && subtitlePositioningEnabled"
          class="absolute z-20 pointer-events-auto"
          :style="subtitleBoxStyle"
        >
          <!-- Drag body -->
          <div
            class="w-full h-full flex items-center justify-center cursor-move select-none"
            :class="isDraggingSubtitles ? 'ring-2 ring-purple-400' : 'ring-1 ring-purple-500/60 hover:ring-purple-400'"
            style="border-radius: 4px; background: rgba(88,28,135,0.15);"
            @mousedown.prevent="startDragSubtitles"
          >
            <!-- Actual transcript words (when available) -->
            <div
              v-if="visibleWords.length > 0"
              class="flex flex-wrap items-center justify-center gap-2 px-2 pointer-events-none"
            >
              <span
                v-for="(wordInfo, index) in visibleWords"
                :key="`subtitle-word-${wordInfo.start}-${index}`"
                class="relative inline-block"
              >
                <!-- Use SVG for proper border rendering -->
                <span class="invisible select-none" :style="subtitleTextStyle">{{ props.subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}</span>
                <svg class="absolute inset-0 w-full h-full overflow-visible" style="pointer-events: none">
                  <!-- Border 2 (Outer) -->
                  <text
                    v-if="props.subtitleSettings.border2Width > 0"
                    x="50%"
                    y="55%"
                    dominant-baseline="middle"
                    text-anchor="middle"
                    :style="{
                      fontFamily: props.subtitleSettings.fontFamily,
                      fontWeight: props.subtitleSettings.fontWeight,
                      fontSize: subtitleTextStyle.fontSize,
                      stroke: props.subtitleSettings.border2Color,
                      strokeWidth: (props.subtitleSettings.border1Width + props.subtitleSettings.border2Width) * 2 + 'px',
                      strokeLinejoin: 'round',
                      strokeLinecap: 'round',
                      fill: 'none',
                    }"
                  >
                    {{ props.subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                  </text>

                  <!-- Border 1 (Inner) -->
                  <text
                    v-if="props.subtitleSettings.border1Width > 0"
                    x="50%"
                    y="55%"
                    dominant-baseline="middle"
                    text-anchor="middle"
                    :style="{
                      fontFamily: props.subtitleSettings.fontFamily,
                      fontWeight: props.subtitleSettings.fontWeight,
                      fontSize: subtitleTextStyle.fontSize,
                      stroke: props.subtitleSettings.border1Color,
                      strokeWidth: props.subtitleSettings.border1Width * 2 + 'px',
                      strokeLinejoin: 'round',
                      strokeLinecap: 'round',
                      fill: 'none',
                    }"
                  >
                    {{ props.subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                  </text>

                  <!-- Fill Text -->
                  <text
                    x="50%"
                    y="55%"
                    dominant-baseline="middle"
                    text-anchor="middle"
                    :style="{
                      fontFamily: props.subtitleSettings.fontFamily,
                      fontWeight: props.subtitleSettings.fontWeight,
                      fontSize: subtitleTextStyle.fontSize,
                      fill: (props.subtitleSettings.animationStyle === 'karaoke' && isCurrentWord(wordInfo)) 
                        ? (props.subtitleSettings.highlightColor || '#FFFF00')
                        : (props.subtitleSettings.animationStyle === 'single-word' 
                            ? getWordColor(getWordIndexInTranscript(wordInfo))
                            : (props.subtitleSettings.textColor || '#FFFFFF')),
                    }"
                  >
                    {{ props.subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                  </text>
                </svg>
              </span>
            </div>

            <!-- Sample text (when no transcript) -->
            <div
              v-else
              class="text-center font-medium pointer-events-none px-2"
              :style="subtitleTextStyle"
            >
              {{ sampleSubtitleText }}
            </div>
          </div>

          <!-- Corner resize handles -->
          <div
            v-for="corner in ['nw','ne','sw','se']"
            :key="corner"
            class="absolute w-2.5 h-2.5 bg-purple-500 border border-white pointer-events-auto z-30"
            :class="{
              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize': corner === 'nw',
              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize': corner === 'ne',
              'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize': corner === 'sw',
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize': corner === 'se',
            }"
            @mousedown.stop.prevent="(e) => startResizeSubtitles(e, corner)"
          />
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
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { LayoutGridIcon, LayoutIcon } from 'lucide-vue-next';
  import POIRegion from './POIRegion.vue';
  import MediaPreview from '@/components/MediaPreview.vue';
  import type { ManualRegion, ManualRegionRect, SubtitleSettings } from '@/types';

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

  interface WordInfo {
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }

  interface WhisperSegment {
    text: string;
    start: number;
    end: number;
    words?: WordInfo[];
  }

  interface Props {
    regions: ManualRegion[];
    selectedRegionId: string | null;
    thumbnailUrl?: string | null;
    targetAspectRatio: string;
    sourceAspectRatio?: string;
    videoUrl?: string | null;
    videoTime?: number;
    clipStartTime?: number; // For converting absolute time to clip-relative for subtitle matching
    isPlaying?: boolean;
    // Optional watermark preview overlay
    watermarkPreview?: WatermarkPreview | null;
    // Optional layout overlay previews
    overlayPreviews?: OverlayPreview[];
    // Optional subtitle settings for preview
    subtitleSettings?: SubtitleSettings | null;
    // Optional subtitle position for preview
    subtitlePosition?: { x: number; y: number; width?: number } | null;
    subtitlePositioningEnabled?: boolean;
    // Optional transcript data for subtitle rendering
    transcriptWords?: WordInfo[];
    transcriptSegments?: WhisperSegment[];
  }

  const props = withDefaults(defineProps<Props>(), {
    targetAspectRatio: '9:16',
    sourceAspectRatio: '16:9',
    videoTime: 0,
    clipStartTime: 0,
    isPlaying: false,
    watermarkPreview: null,
    subtitleSettings: null,
    subtitlePosition: null,
    subtitlePositioningEnabled: false,
    transcriptWords: () => [],
    transcriptSegments: () => [],
  });

  const emit = defineEmits<{
    updateRegion: [id: string, region: Partial<ManualRegion>];
    selectRegion: [id: string | null];
    updateSourceTransform: [transform: { scale: number; x: number; y: number }];
    subtitlePositionChange: [position: { x: number; y: number; width?: number }];
    subtitleSettingsChange: [settings: SubtitleSettings];
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

  // Subtitle dragging state
  const isDraggingSubtitles = ref(false);
  const isResizingSubtitles = ref(false);
  const subtitleDragOffset = ref({ x: 0, y: 0 });
  const localSubtitlePosition = ref<{ x: number; y: number; width?: number }>(
    props.subtitlePosition ? { ...props.subtitlePosition } : { x: 50, y: 85, width: 80 }
  );
  const subtitleContainerRef = ref<HTMLElement | null>(null);

  // Sync local subtitle position when prop changes (e.g. switching aspect ratios)
  watch(
    () => props.subtitlePosition,
    (pos) => {
      if (pos) localSubtitlePosition.value = { ...pos };
    },
    { deep: true }
  );

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

  // Watch for source frame transform changes and emit to parent
  watch(sourceFrameTransform, (transform) => {
    if (showSourceFrame.value) {
      emit('updateSourceTransform', { ...transform });
    }
  }, { deep: true });

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
      const targetTime = props.videoTime ?? 0;
      console.log('[POITargetPanel] Video metadata loaded, forcing seek to:', targetTime, 'current:', video.currentTime);
      
      // Ensure video is seekable before setting time
      if (video.readyState >= 2) {
        video.currentTime = targetTime;
      } else {
        // Wait for canplay event
        const handleCanPlay = () => {
          console.log('[POITargetPanel] Video can play, seeking to:', targetTime);
          video.currentTime = targetTime;
          video.removeEventListener('canplay', handleCanPlay);
        };
        video.addEventListener('canplay', handleCanPlay, { once: true });
      }
      
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
        // Use 0.1 second threshold to allow accurate seeking while avoiding feedback loops
        if (Math.abs(video.currentTime - time) > 0.1) {
          console.log('[POITargetPanel] Seeking video from', video.currentTime, 'to', time);
          video.currentTime = time;
          // If we're playing and just seeked, make sure playback continues
          if (props.isPlaying) {
            video.play().catch(console.error);
          }
        }
      });
    },
    { immediate: true }
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

  // Subtitle box — positioned as absolute rect using x/y as center, width as %
  const subtitleBoxStyle = computed(() => {
    const pos = localSubtitlePosition.value;
    const w = pos.width ?? 80;
    // Height is fixed at ~12% of container to give enough drag area
    const h = 12;
    // x/y are center percentages → convert to left/top
    const left = pos.x - w / 2;
    const top = pos.y - h / 2;
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${w}%`,
      height: `${h}%`,
    };
  });

  // Subtitle text style — scaled down for the small POI preview canvas
  const subtitleTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};
    const settings = props.subtitleSettings;
    const aspect = parseAspectRatio(props.targetAspectRatio);
    const ar = aspect.width / aspect.height;
    // Scale font down for the small preview canvas (container is ~200px wide)
    const scale = ar < 0.9 ? 0.28 : ar < 1.2 ? 0.32 : 0.22;
    const fs = Math.max(8, Math.round(settings.fontSize * scale));
    const stroke = settings.border1Width > 0
      ? `${settings.border1Color} 0 0 0 ${settings.border1Width * scale}px`
      : undefined;
    
    const styles: any = {
      fontSize: `${fs}px`,
      fontFamily: settings.fontFamily,
      fontWeight: String(settings.fontWeight),
      color: settings.textColor,
      WebkitTextStroke: stroke,
      lineHeight: String(settings.lineHeight || 1.2),
      letterSpacing: `${settings.letterSpacing}px`,
    };
    
    // Add uppercase for single-word style (CapCut-style)
    if (settings.animationStyle === 'single-word') {
      styles.textTransform = 'uppercase';
    }
    
    // Add background if enabled
    if (settings.backgroundEnabled && settings.backgroundColor !== 'transparent') {
      styles.backgroundColor = settings.backgroundColor;
      styles.padding = '2px 6px';
      styles.borderRadius = '2px';
    }
    
    // Add shadow if configured
    if (settings.shadowBlur > 0) {
      styles.textShadow = `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${settings.shadowColor}`;
    }
    
    return styles;
  });
  
  // Sample subtitle text based on animation style
  const sampleSubtitleText = computed(() => {
    console.log('[POITargetPanel] sampleSubtitleText computed:', {
      hasSubtitleSettings: !!props.subtitleSettings,
      hasTranscriptWords: !!props.transcriptWords,
      transcriptWordsLength: props.transcriptWords?.length,
      style: props.subtitleSettings?.animationStyle
    });

    if (!props.subtitleSettings) return 'Sample Text';
    
    // If we have transcript data, we'll render actual words, not sample text
    if (props.transcriptWords && props.transcriptWords.length > 0) {
      return ''; // Actual words will be rendered separately
    }
    
    const style = props.subtitleSettings.animationStyle;
    
    // Single-word style shows 1 word
    if (style === 'single-word') {
      return 'WORD';
    }
    
    // Default sample for other animation styles
    return 'Sample subtitle text';
  });

  // Compute visible words based on current video time
  const visibleWords = computed((): WordInfo[] => {
    console.log('[POITargetPanel] visibleWords computed:', {
      hasTranscriptWords: !!props.transcriptWords,
      transcriptWordsLength: props.transcriptWords?.length,
      hasSubtitleSettings: !!props.subtitleSettings,
      videoTime: props.videoTime,
      clipStartTime: props.clipStartTime
    });

    if (!props.transcriptWords || props.transcriptWords.length === 0 || !props.subtitleSettings) {
      return [];
    }

    // Convert absolute video time to clip-relative time for subtitle matching
    // (transcriptWords have been adjusted to be relative to clip start)
    const absoluteTime = props.videoTime || 0;
    const clipRelativeTime = absoluteTime - (props.clipStartTime || 0);
    const animationStyle = props.subtitleSettings.animationStyle;

    console.log('[POITargetPanel] Computing visible words:', {
      absoluteTime,
      clipStartTime: props.clipStartTime,
      clipRelativeTime,
      animationStyle,
      totalWords: props.transcriptWords.length,
      firstWord: props.transcriptWords[0],
      lastWord: props.transcriptWords[props.transcriptWords.length - 1]
    });

    // Single word mode - only show the current word
    if (animationStyle === 'single-word') {
      const currentWord = props.transcriptWords.find(w => clipRelativeTime >= w.start && clipRelativeTime < w.end);
      console.log('[POITargetPanel] Single word mode:', {
        currentWord,
        clipRelativeTime,
        firstWordTime: props.transcriptWords[0],
        lastWordTime: props.transcriptWords[props.transcriptWords.length - 1]
      });
      return currentWord ? [currentWord] : [];
    }

    // For karaoke and other segment-based styles, show only words from the current segment
    // Find the current segment from transcriptSegments
    console.log('[POITargetPanel] Checking segments:', {
      hasSegments: !!props.transcriptSegments,
      segmentCount: props.transcriptSegments?.length || 0,
      clipRelativeTime,
      animationStyle
    });
    
    if (props.transcriptSegments && props.transcriptSegments.length > 0) {
      const currentSegment = props.transcriptSegments.find(
        seg => clipRelativeTime >= seg.start && clipRelativeTime < seg.end
      );
      
      console.log('[POITargetPanel] Current segment lookup:', {
        found: !!currentSegment,
        clipRelativeTime,
        firstSegment: props.transcriptSegments[0],
        lastSegment: props.transcriptSegments[props.transcriptSegments.length - 1]
      });
      
      if (currentSegment && currentSegment.words && currentSegment.words.length > 0) {
        console.log('[POITargetPanel] Segment mode, visible words from current segment:', {
          count: currentSegment.words.length,
          segmentStart: currentSegment.start,
          segmentEnd: currentSegment.end,
          segmentText: currentSegment.text
        });
        return currentSegment.words;
      }
      
      // No current segment found - show nothing (between segments)
      console.log('[POITargetPanel] No current segment found, showing nothing');
      return [];
    }

    // Fallback: use 3-second window ONLY if no segments are available at all
    const WINDOW_SIZE = 3;
    const words = props.transcriptWords.filter(
      w => w.start <= clipRelativeTime + WINDOW_SIZE && w.end >= clipRelativeTime - WINDOW_SIZE
    );
    console.log('[POITargetPanel] Window mode (fallback), visible words:', {
      count: words.length,
      firstWord: words[0],
      lastWord: words[words.length - 1]
    });
    return words;
  });

  // Check if a word is currently being spoken
  function isCurrentWord(word: WordInfo): boolean {
    // Convert absolute video time to clip-relative time
    const absoluteTime = props.videoTime || 0;
    const clipRelativeTime = absoluteTime - (props.clipStartTime || 0);
    
    // Check if we're in the word's time window
    if (clipRelativeTime >= word.start && clipRelativeTime < word.end) {
      return true;
    }
    
    // Look back tolerance for words that started between frames
    const LOOK_BACK_TOLERANCE = 0.05; // 50ms
    const timeSinceWordStart = clipRelativeTime - word.start;
    
    if (timeSinceWordStart > 0 && timeSinceWordStart <= LOOK_BACK_TOLERANCE) {
      if (clipRelativeTime < word.end) {
        return true;
      }
    }

    return false;
  }

  // Get word color for multi-color mode
  function getWordColor(wordIndex: number): string {
    if (!props.subtitleSettings?.multiColorEnabled) {
      return props.subtitleSettings?.textColor || '#FFFFFF';
    }

    const palette = props.subtitleSettings.colorPalette && props.subtitleSettings.colorPalette.length > 0
      ? props.subtitleSettings.colorPalette
      : ['#04F827', '#0ea5e9', '#FFFD03', '#FFFFFF']; // Default: Green, Cyan, Yellow, White
    
    return palette[wordIndex % palette.length];
  }

  // Get word index in full transcript (for color rotation)
  function getWordIndexInTranscript(word: WordInfo): number {
    return props.transcriptWords?.findIndex(w => w.start === word.start && w.end === word.end) || 0;
  }

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

  // Subtitle dragging functions
  function startDragSubtitles(event: MouseEvent) {
    if (!containerRef.value) return;

    isDraggingSubtitles.value = true;
    const rect = containerRef.value.getBoundingClientRect();
    
    // Calculate the drag offset from the subtitle center
    const centerX = rect.left + (rect.width * localSubtitlePosition.value.x / 100);
    const centerY = rect.top + (rect.height * localSubtitlePosition.value.y / 100);
    
    subtitleDragOffset.value = {
      x: event.clientX - centerX,
      y: event.clientY - centerY,
    };

    // Add global mouse listeners
    document.addEventListener('mousemove', onSubtitleDragMove);
    document.addEventListener('mouseup', onSubtitleDragEnd);
    
    event.preventDefault();
  }

  function onSubtitleDragMove(event: MouseEvent) {
    if (!isDraggingSubtitles.value || !containerRef.value) return;

    const rect = containerRef.value.getBoundingClientRect();
    
    // Calculate new position as percentage
    const newX = ((event.clientX - subtitleDragOffset.value.x - rect.left) / rect.width) * 100;
    const newY = ((event.clientY - subtitleDragOffset.value.y - rect.top) / rect.height) * 100;
    
    // Constrain to container bounds
    const constrainedX = Math.max(10, Math.min(90, newX));
    const constrainedY = Math.max(10, Math.min(90, newY));
    
    localSubtitlePosition.value = {
      ...localSubtitlePosition.value,
      x: constrainedX,
      y: constrainedY,
    };
    
    // Emit position change
    emit('subtitlePositionChange', { ...localSubtitlePosition.value });
  }

  function onSubtitleDragEnd() {
    isDraggingSubtitles.value = false;
    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
  }

  // Resize subtitle box by dragging corners
  function startResizeSubtitles(event: MouseEvent, corner: string) {
    console.log('[POITargetPanel] startResizeSubtitles called:', { corner, containerExists: !!containerRef.value });
    if (!containerRef.value || !props.subtitleSettings) return;
    isResizingSubtitles.value = true;

    const rect = containerRef.value.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = localSubtitlePosition.value.width ?? 80;
    const startCenterX = localSubtitlePosition.value.x;
    const startFontSize = props.subtitleSettings.fontSize || 32;

    console.log('[POITargetPanel] Resize started:', {
      corner,
      startWidth,
      startFontSize,
      startCenterX
    });

    const onMove = (e: MouseEvent) => {
      // Calculate horizontal delta for box width
      const deltaXPct = ((e.clientX - startX) / rect.width) * 100;
      let newWidth: number;
      let newCenterX: number;

      if (corner === 'ne' || corner === 'se') {
        // Right corners: dragging right increases width
        newWidth = Math.max(20, Math.min(100, startWidth + deltaXPct * 2));
        newCenterX = startCenterX;
      } else {
        // Left corners: dragging left increases width
        newWidth = Math.max(20, Math.min(100, startWidth - deltaXPct * 2));
        newCenterX = startCenterX;
      }

      // Calculate font size directly from box width ratio
      // This creates a 1:1 correlation between box size and font size
      const widthRatio = newWidth / startWidth;
      const newFontSize = Math.round(Math.max(12, Math.min(120, startFontSize * widthRatio)));

      localSubtitlePosition.value = {
        ...localSubtitlePosition.value,
        x: Math.max(newWidth / 2, Math.min(100 - newWidth / 2, newCenterX)),
        width: newWidth,
      };
      
      // Emit both position and settings changes
      emit('subtitlePositionChange', { ...localSubtitlePosition.value });
      
      const updatedSettings = {
        ...props.subtitleSettings,
        fontSize: newFontSize
      };
      emit('subtitleSettingsChange', updatedSettings);
    };

    const onUp = () => {
      isResizingSubtitles.value = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    event.preventDefault();
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
    // Clean up subtitle drag listeners
    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
  });

  // Watch for subtitle position prop changes
  watch(
    () => props.subtitlePosition,
    (newPosition) => {
      if (newPosition) {
        localSubtitlePosition.value = { ...newPosition };
      }
    },
    { immediate: true }
  );

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

  /* Subtitle dragging styles */
  .subtitle-selection-box {
    position: relative;
    border: 2px dashed rgba(147, 51, 234, 0.5);
    border-radius: 8px;
    padding: 4px;
    transition: all 0.2s ease;
  }

  .subtitle-selection-box:hover {
    border-color: rgba(147, 51, 234, 0.8);
    background: rgba(147, 51, 234, 0.05);
  }

  .subtitle-selection-box.is-active {
    border-color: rgba(147, 51, 234, 1);
    background: rgba(147, 51, 234, 0.1);
  }

  .subtitle-drag-bar {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 12px;
    background: rgba(147, 51, 234, 0.8);
    border-radius: 4px 4px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
  }

  .subtitle-drag-bar:hover {
    background: rgba(147, 51, 234, 1);
  }

  .subtitle-drag-label {
    font-size: 8px;
    color: white;
    font-weight: 500;
    user-select: none;
  }

  .subtitle-text-container {
    user-select: none;
  }
</style>
