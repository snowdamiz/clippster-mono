<template>
  <div v-if="modelValue" class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div
      class="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl w-[900px] max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h3 class="text-lg font-medium text-white">Manual POI Editor</h3>
          <p class="text-xs text-white/50">Adjust the focus area for {{ targetAspectRatio }} aspect ratio</p>
        </div>
        <button
          @click="$emit('update:modelValue', false)"
          class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Editor Content -->
      <div
        class="flex-1 bg-black relative overflow-hidden flex items-center justify-center select-none"
        ref="containerRef"
      >
        <!-- Hidden video element for loading (always in DOM) -->
        <video
          v-if="videoUrl && !mediaLoaded"
          ref="hiddenVideoRef"
          :src="videoSrc"
          class="absolute opacity-0 pointer-events-none"
          style="width: 1px; height: 1px"
          muted
          crossorigin="anonymous"
          @loadedmetadata="onMediaLoaded"
          @error="onMediaError"
        ></video>

        <!-- Media (Video or Image) - shown after loaded -->
        <div
          class="relative bg-[#0a0a0a]"
          :style="{ width: mediaWidth + 'px', height: mediaHeight + 'px' }"
          v-show="mediaLoaded"
        >
          <video
            v-if="videoUrl"
            ref="videoRef"
            :src="videoSrc"
            class="w-full h-full object-contain pointer-events-none"
            muted
            crossorigin="anonymous"
            @timeupdate="onTimeUpdate"
            @error="onMediaError"
          ></video>
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="w-full h-full object-contain pointer-events-none"
            @load="onMediaLoaded"
            @error="onMediaError"
          />

          <!-- Overlay / Mask -->
          <div class="absolute inset-0 pointer-events-none">
            <!-- Darken outside ROI -->
            <div
              class="absolute inset-0 bg-black/60"
              style="
                clip-path: polygon(
                  0% 0%,
                  0% 100%,
                  100% 100%,
                  100% 0%,
                  0% 0%,
                  var(--roi-left) var(--roi-top),
                  var(--roi-right) var(--roi-top),
                  var(--roi-right) var(--roi-bottom),
                  var(--roi-left) var(--roi-bottom),
                  var(--roi-left) var(--roi-top)
                );
              "
              :style="{
                '--roi-left': roi.x + '%',
                '--roi-top': roi.y + '%',
                '--roi-right': roi.x + roi.width + '%',
                '--roi-bottom': roi.y + roi.height + '%',
              }"
            ></div>
          </div>

          <!-- ROI Box -->
          <div
            class="absolute border-2 border-white shadow-sm cursor-move group"
            :style="{
              left: `${roi.x}%`,
              top: `${roi.y}%`,
              width: `${roi.width}%`,
              height: `${roi.height}%`,
            }"
            @mousedown="startDrag"
          >
            <!-- Grid Lines (Rule of Thirds) -->
            <div class="absolute left-1/3 top-0 bottom-0 w-px bg-white/20 pointer-events-none"></div>
            <div class="absolute right-1/3 top-0 bottom-0 w-px bg-white/20 pointer-events-none"></div>
            <div class="absolute top-1/3 left-0 right-0 h-px bg-white/20 pointer-events-none"></div>
            <div class="absolute bottom-1/3 left-0 right-0 h-px bg-white/20 pointer-events-none"></div>

            <!-- Handles (Corners) -->
            <div
              class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-nw-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              @mousedown.stop="startResize($event, 'nw')"
            ></div>
            <div
              class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-ne-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              @mousedown.stop="startResize($event, 'ne')"
            ></div>
            <div
              class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-sw-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              @mousedown.stop="startResize($event, 'sw')"
            ></div>
            <div
              class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-se-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              @mousedown.stop="startResize($event, 'se')"
            ></div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-show="!mediaLoaded" class="text-white/40 flex items-center gap-2">
          <Loader2 :size="20" class="animate-spin" />
          <span>Loading media...</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="p-4 border-t border-white/10 bg-[#1a1a1a]">
        <!-- Playback controls if video -->
        <div v-if="videoUrl" class="flex items-center gap-4 mb-4">
          <button
            @click="togglePlay"
            class="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <component :is="isPlaying ? Pause : Play" :size="16" fill="currentColor" />
          </button>
          <input
            type="range"
            v-model.number="currentTime"
            :min="clipStartTime || 0"
            :max="clipEndTime || duration"
            step="0.1"
            class="flex-1 accent-violet-500"
            @input="seek"
          />
          <span class="text-xs text-white/60 font-mono">{{ formatTime(currentTime) }}</span>
        </div>

        <div class="flex justify-between items-center">
          <div class="text-xs text-white/40">
            Drag center to move, corners to resize (locked to {{ targetAspectRatio }})
          </div>
          <div class="flex gap-3">
            <button
              @click="$emit('update:modelValue', false)"
              class="px-4 py-2 rounded-lg hover:bg-white/10 text-sm font-medium text-white/70 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirm"
              class="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-sm font-medium text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { X, Play, Pause, Loader2 } from 'lucide-vue-next';

  interface POIConfig {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  const props = defineProps<{
    modelValue: boolean;
    initialConfig?: POIConfig;
    targetAspectRatio: string; // e.g., "9:16"
    sourceAspectRatio?: string; // e.g., "16:9"
    thumbnailUrl?: string;
    videoUrl?: string; // Streaming URL for video (not file path)
    clipStartTime?: number;
    clipEndTime?: number;
  }>();

  const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'confirm', config: POIConfig): void;
  }>();

  const containerRef = ref<HTMLElement | null>(null);
  const videoRef = ref<HTMLVideoElement | null>(null);
  const hiddenVideoRef = ref<HTMLVideoElement | null>(null);
  const mediaLoaded = ref(false);
  const mediaWidth = ref(0);
  const mediaHeight = ref(0);
  const isPlaying = ref(false);
  const duration = ref(0);
  const currentTime = ref(props.clipStartTime || 0);

  // ROI State (in percentages 0-100)
  const roi = ref<POIConfig>({ x: 0, y: 0, width: 100, height: 100 });

  // Video source is now passed as a URL directly (no conversion needed)
  const videoSrc = computed(() => {
    return props.videoUrl || '';
  });

  // Calculate target aspect ratio value
  const targetRatioValue = computed(() => {
    const [w, h] = props.targetAspectRatio.split(':').map(Number);
    return w / h;
  });

  // Calculate source aspect ratio value
  const sourceRatioValue = computed(() => {
    if (mediaWidth.value && mediaHeight.value) {
      return mediaWidth.value / mediaHeight.value;
    }
    if (props.sourceAspectRatio) {
      const [w, h] = props.sourceAspectRatio.split(':').map(Number);
      return w / h;
    }
    return 16 / 9;
  });

  // Initialize ROI based on target ratio
  function initializeROI() {
    if (props.initialConfig && props.initialConfig.width) {
      roi.value = { ...props.initialConfig };
      return;
    }

    // Default: Center crop matching target ratio
    const sRatio = sourceRatioValue.value;
    const tRatio = targetRatioValue.value;

    let width = 100;
    let height = 100;

    if (sRatio > tRatio) {
      // Source is wider than target: Full height, constrained width
      width = (tRatio / sRatio) * 100;
    } else {
      // Source is taller than target: Full width, constrained height
      height = (sRatio / tRatio) * 100;
    }

    roi.value = {
      width,
      height,
      x: (100 - width) / 2,
      y: (100 - height) / 2,
    };
  }

  function onMediaLoaded(e: Event) {
    const el = e.target as HTMLElement;

    console.log('[ManualPOIEditor] onMediaLoaded called', el);

    let originalWidth = 0;
    let originalHeight = 0;

    if (el instanceof HTMLVideoElement) {
      originalWidth = el.videoWidth;
      originalHeight = el.videoHeight;
      duration.value = el.duration;
      console.log(
        '[ManualPOIEditor] Video dimensions:',
        originalWidth,
        'x',
        originalHeight,
        'duration:',
        duration.value
      );
    } else if (el instanceof HTMLImageElement) {
      originalWidth = el.naturalWidth;
      originalHeight = el.naturalHeight;
      console.log('[ManualPOIEditor] Image dimensions:', originalWidth, 'x', originalHeight);
    }

    if (originalWidth === 0 || originalHeight === 0) {
      console.error('[ManualPOIEditor] Invalid media dimensions');
      return;
    }

    // Calculate scaled dimensions to fit container
    if (containerRef.value) {
      const container = containerRef.value;
      const cw = container.clientWidth - 40; // padding
      const ch = container.clientHeight - 40;
      const cRatio = cw / ch;
      const mRatio = originalWidth / originalHeight;

      console.log('[ManualPOIEditor] Container:', cw, 'x', ch, 'ratio:', cRatio, 'media ratio:', mRatio);

      if (mRatio > cRatio) {
        mediaWidth.value = cw;
        mediaHeight.value = cw / mRatio;
      } else {
        mediaHeight.value = ch;
        mediaWidth.value = ch * mRatio;
      }

      console.log('[ManualPOIEditor] Scaled dimensions:', mediaWidth.value, 'x', mediaHeight.value);
    }

    mediaLoaded.value = true;
    initializeROI();

    // After media is loaded, sync the main video element's time
    if (videoRef.value && props.clipStartTime) {
      videoRef.value.currentTime = props.clipStartTime;
    }
  }

  // Drag & Drop Logic
  let isDragging = false;
  let isResizing = false;
  let resizeHandle = '';
  let startX = 0;
  let startY = 0;
  let startRoi = { ...roi.value };

  function startDrag(e: MouseEvent) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startRoi = { ...roi.value };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
  }

  function startResize(e: MouseEvent, handle: string) {
    isResizing = true;
    resizeHandle = handle;
    startX = e.clientX;
    startY = e.clientY;
    startRoi = { ...roi.value };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
  }

  function onMove(e: MouseEvent) {
    if (!mediaWidth.value || !mediaHeight.value) return;

    const dxPx = e.clientX - startX;
    const dyPx = e.clientY - startY;

    const dxPct = (dxPx / mediaWidth.value) * 100;
    const dyPct = (dyPx / mediaHeight.value) * 100;

    if (isDragging) {
      let newX = startRoi.x + dxPct;
      let newY = startRoi.y + dyPct;

      // Constrain to bounds
      newX = Math.max(0, Math.min(newX, 100 - startRoi.width));
      newY = Math.max(0, Math.min(newY, 100 - startRoi.height));

      roi.value.x = newX;
      roi.value.y = newY;
    } else if (isResizing) {
      let newWidth = startRoi.width;
      let newHeight = startRoi.height;
      let newX = startRoi.x;
      let newY = startRoi.y;

      // Aspect ratio locking logic
      const ratio = targetRatioValue.value;
      const sourceRatio = sourceRatioValue.value;
      // Conversion factor between width% and height% considering source aspect ratio
      // width% * mediaWidth / height% * mediaHeight = ratio
      // width% / height% = ratio * (mediaHeight / mediaWidth) = ratio / sourceRatio
      const pctRatio = ratio / sourceRatio;

      if (resizeHandle === 'se') {
        newWidth = startRoi.width + dxPct;
        newHeight = newWidth / pctRatio;
      } else if (resizeHandle === 'sw') {
        newWidth = startRoi.width - dxPct;
        newX = startRoi.x + dxPct;
        newHeight = newWidth / pctRatio;
      } else if (resizeHandle === 'nw') {
        newWidth = startRoi.width - dxPct;
        newX = startRoi.x + dxPct;
        newHeight = newWidth / pctRatio;
        newY = startRoi.y + (startRoi.height - newHeight);
      } else if (resizeHandle === 'ne') {
        newWidth = startRoi.width + dxPct;
        newHeight = newWidth / pctRatio;
        newY = startRoi.y + (startRoi.height - newHeight);
      }

      // Constraints (Min size 10%)
      if (newWidth < 10) newWidth = 10;
      if (newHeight < 10) newHeight = 10;

      // Boundary constraints
      if (newX < 0) {
        newX = 0;
        // Adjust width if hitting left wall
        // Recalc height to maintain ratio
      }
      if (newY < 0) newY = 0;
      if (newX + newWidth > 100) {
        // Hit right wall, clamp width?
        // Complex resizing logic omitted for brevity, simple clamping:
        if (!isDragging) {
          // Only checking during resize
          const maxW = 100 - newX;
          if (newWidth > maxW) {
            newWidth = maxW;
            newHeight = newWidth / pctRatio;
          }
          const maxH = 100 - newY;
          if (newHeight > maxH) {
            newHeight = maxH;
            newWidth = newHeight * pctRatio;
          }
        }
      }

      roi.value = { x: newX, y: newY, width: newWidth, height: newHeight };
    }
  }

  function onEnd() {
    isDragging = false;
    isResizing = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
  }

  // Playback
  function togglePlay() {
    if (!videoRef.value) return;
    if (isPlaying.value) {
      videoRef.value.pause();
    } else {
      videoRef.value.play();
    }
    isPlaying.value = !isPlaying.value;
  }

  function onTimeUpdate() {
    if (videoRef.value) {
      currentTime.value = videoRef.value.currentTime;
      // Loop clip range
      if (props.clipEndTime && currentTime.value >= props.clipEndTime) {
        videoRef.value.currentTime = props.clipStartTime || 0;
      }
    }
  }

  function seek() {
    if (videoRef.value) {
      videoRef.value.currentTime = currentTime.value;
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  }

  function onMediaError(e: Event) {
    console.error('[ManualPOIEditor] Media load error:', e);
    console.error('[ManualPOIEditor] Video URL:', props.videoUrl);
    console.error('[ManualPOIEditor] Video src:', videoSrc.value);
  }

  function confirm() {
    emit('confirm', roi.value);
    emit('update:modelValue', false);
  }

  // Watchers
  watch(
    () => props.modelValue,
    (val) => {
      if (val) {
        console.log('[ManualPOIEditor] Dialog opened');
        console.log('[ManualPOIEditor] videoUrl:', props.videoUrl);
        console.log('[ManualPOIEditor] thumbnailUrl:', props.thumbnailUrl);
        console.log('[ManualPOIEditor] videoSrc:', videoSrc.value);
        mediaLoaded.value = false;
        // Reset state if needed
      }
    }
  );
</script>
