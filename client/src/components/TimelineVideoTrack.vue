<template>
  <div class="flex items-center h-14 px-2 border-b border-border/20 relative">
    <!-- Track Label -->
    <div
      class="w-18 h-10 -ml-2 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-40 bg-[#101010] backdrop-blur-sm"
    >
      <div>
        <div class="font-medium">Main</div>
        <div class="text-xs opacity-70">Video</div>
      </div>
    </div>
    <!-- Video Track Content -->
    <div class="flex-1 h-10 relative flex items-center">
      <div
        data-video-track="true"
        class="flex-1 h-8 bg-[#0a0a0a]/50 rounded-md relative cursor-pointer group overflow-hidden"
        @click="onVideoTrackClick"
        @mousemove="onTimelineTrackHover"
        @mouseleave="onTimelineMouseLeave"
      >
        <!-- Video Track Background -->
        <div v-if="!videoSrc" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center text-muted-foreground/40">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 mx-auto mb-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p class="text-xs">No video</p>
          </div>
        </div>
        <!-- Video Track with Waveform -->
        <div v-else class="relative w-full h-full">
          <!-- Full video duration background -->
          <div class="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 rounded-md"></div>

          <!-- Audio Waveform Canvas -->
          <canvas
            ref="waveformCanvas"
            class="absolute inset-0 w-full h-full rounded-md pointer-events-none"
            style="mix-blend-mode: normal; z-index: 25"
          ></canvas>

          <!-- Played progress overlay -->
          <div
            class="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500/40 to-indigo-500/40 rounded-l-md transition-all duration-100 pointer-events-none z-15"
            :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
          ></div>

          <!-- Loading indicator for waveform -->
          <div
            v-if="isWaveformLoading"
            class="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md"
          >
            <div class="text-xs text-muted-foreground/60">Loading waveform...</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
  import { useAudioWaveform } from '@/composables/useAudioWaveform';
  import { calculateWaveformParameters, createThrottledRenderer } from '@/utils/audioWaveformUtils';
  import type { TimelineVideoTrackProps, TimelineVideoTrackEmits } from '../types';

  const props = withDefaults(defineProps<TimelineVideoTrackProps>(), {
    zoomLevel: 1,
  });

  const emit = defineEmits<TimelineVideoTrackEmits>();

  // Canvas ref for waveform rendering
  const waveformCanvas = ref<HTMLCanvasElement | null>(null);

  // Audio waveform composable
  const {
    waveformData,
    isLoading: isWaveformLoading,
    isLoaded: isWaveformLoaded,
    loadWaveformFromVideo,
    getNormalizedWaveform,
  } = useAudioWaveform();

  // Resize observer for canvas updates
  let resizeObserver: ResizeObserver | null = null;

  // Render waveform on canvas with adaptive resolution
  function renderWaveform(): void {
    if (!waveformCanvas.value || !waveformData.value || !isWaveformLoaded.value) {
      return;
    }

    try {
      const canvas = waveformCanvas.value;
      const rect = canvas.getBoundingClientRect();

      // Set canvas actual size (account for device pixel ratio)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale context for device pixel ratio
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // Get optimal resolution data for current zoom level
      const normalizedData = getNormalizedWaveform(rect.width, rect.height, props.zoomLevel);

      if (!normalizedData.peaks || normalizedData.peaks.length === 0) {
        console.warn('[TimelineVideoTrack] No waveform peaks available for rendering');
        return;
      }

      // Calculate optimal waveform parameters with the selected resolution
      const params = calculateWaveformParameters(
        props.duration,
        rect.width,
        props.zoomLevel,
        normalizedData.resolution,
        normalizedData.peaks.length
      );

      // Render dual-color waveform (white before playhead, purple after)
      renderDualColorWaveform(canvas, {
        width: rect.width,
        height: rect.height,
        peaks: normalizedData.peaks,
        duration: props.duration,
        currentTime: props.currentTime,
        barWidth: params.barWidth,
        barSpacing: params.barSpacing,
        amplitude: 0.8,
      });
    } catch (error) {
      console.error('[TimelineVideoTrack] Error rendering waveform:', error);
    }
  }

  // Render dual-color waveform (white before playhead, purple after)
  function renderDualColorWaveform(
    canvas: HTMLCanvasElement,
    options: {
      width: number;
      height: number;
      peaks: any[];
      duration: number;
      currentTime: number;
      barWidth: number;
      barSpacing: number;
      amplitude: number;
    }
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || options.peaks.length === 0) return;

    const { width, height, peaks, duration, currentTime, barWidth, barSpacing, amplitude } = options;
    const totalBarWidth = barWidth + barSpacing;
    const centerY = height / 2;
    const maxBarHeight = height * amplitude;

    // Calculate playhead position (0-1 ratio)
    const playheadRatio = Math.max(0, Math.min(1, currentTime / duration));
    const playheadPixel = playheadRatio * width;

    // Ensure canvas size is correct
    canvas.width = width;
    canvas.height = height;

    // Clear canvas completely
    ctx.clearRect(0, 0, width, height);

    // Disable any global compositing that might interfere
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    // Render each peak with appropriate color
    peaks.forEach((peak, index) => {
      const x = index * totalBarWidth;

      // Ensure bar stays within canvas bounds (clip instead of skip)
      if (x >= width) return; // Only skip if starting position is beyond canvas

      // Determine color based on position relative to playhead
      const barCenter = x + barWidth / 2;
      const isBeforePlayhead = barCenter < playheadPixel;
      const color = isBeforePlayhead ? '#ffffff' : '#a855f7'; // white before, purple after

      // Set color with full opacity
      ctx.fillStyle = color;
      ctx.globalAlpha = 1.0;

      // Calculate bar heights from peak values
      const positiveHeight = Math.abs(peak.max) * maxBarHeight;
      const negativeHeight = Math.abs(peak.min) * maxBarHeight;

      // Calculate actual bar width to stay within canvas bounds
      const actualBarWidth = Math.min(barWidth, width - x);

      // Draw upper bar (positive values)
      if (positiveHeight > 0 && actualBarWidth > 0) {
        ctx.fillRect(x, centerY - positiveHeight, actualBarWidth, positiveHeight);
      }

      // Draw lower bar (negative values)
      if (negativeHeight > 0 && actualBarWidth > 0) {
        ctx.fillRect(x, centerY, actualBarWidth, negativeHeight);
      }
    });

    // Reset global alpha
    ctx.globalAlpha = 1.0;
  }

  // Throttled renderer for performance
  const throttledRender = createThrottledRenderer(renderWaveform, 16); // ~60fps

  // Setup resize observer
  function setupResizeObserver(): void {
    if (!waveformCanvas.value) return;

    resizeObserver = new ResizeObserver(() => {
      throttledRender();
    });

    resizeObserver.observe(waveformCanvas.value);
  }

  // Cleanup resize observer
  function cleanupResizeObserver(): void {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  }

  // Watch for video source changes
  watch(
    () => props.videoSrc,
    async (newVideoSrc) => {
      if (newVideoSrc) {
        await loadWaveformFromVideo(newVideoSrc);
      }
    },
    { immediate: true }
  );

  // Watch for waveform data changes and render
  watch(
    [waveformData, isWaveformLoaded, () => props.zoomLevel, () => props.currentTime],
    () => {
      if (isWaveformLoaded.value && waveformData.value) {
        nextTick(() => {
          throttledRender();
        });
      }
    },
    { immediate: true }
  );

  // Event handlers
  function onVideoTrackClick(event: MouseEvent) {
    emit('videoTrackClick', event);
  }

  function onTimelineTrackHover(event: MouseEvent) {
    emit('timelineTrackHover', event);
  }

  function onTimelineMouseLeave() {
    emit('timelineMouseLeave');
  }

  // Lifecycle hooks
  onMounted(() => {
    nextTick(() => {
      setupResizeObserver();
      if (props.videoSrc) {
        loadWaveformFromVideo(props.videoSrc);
      }
    });
  });

  onUnmounted(() => {
    cleanupResizeObserver();
  });
</script>

<style scoped>
  /* Video track styling */
  .video-track {
    background: linear-gradient(to right, rgba(147, 51, 234, 0.3), rgba(99, 102, 241, 0.3));
    border-radius: 0.375rem;
    position: relative;
    overflow: hidden;
  }

  .video-track-progress {
    background: linear-gradient(to right, rgba(147, 51, 234, 0.6), rgba(99, 102, 241, 0.6));
    transition: width 0.1s ease;
  }

  /* Hover time preview */
  .hover-preview {
    position: absolute;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    z-index: 20;
    pointer-events: none;
  }

  .hover-preview::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) translateY(50%) rotate(45deg);
    width: 6px;
    height: 6px;
    background: rgba(0, 0, 0, 0.9);
  }
</style>
