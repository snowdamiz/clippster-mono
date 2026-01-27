<template>
  <div class="flex items-center h-14 px-2 border-b border-border/20 relative">
    <!-- Track Label -->
    <div
      class="w-18 h-10 -ml-2 flex items-center justify-center text-xs text-center sticky left-0 z-40 bg-gradient-to-r from-[#141416] to-[#141416]/80 backdrop-blur-md border-r border-white/[0.04]"
    >
      <div>
        <div class="font-medium text-white/70 text-[10px] tracking-wide">Main</div>
        <div class="text-[9px] text-white/40">Video</div>
      </div>
    </div>
    <!-- Video Track Content -->
    <div class="flex-1 h-10 relative flex items-center">
      <div
        data-video-track="true"
        class="flex-1 h-8 bg-[#0a0a0b]/50 rounded-md relative cursor-pointer group overflow-hidden"
        @click="onVideoTrackClick"
        @mousemove="onTimelineTrackHover"
        @mouseleave="onTimelineMouseLeave"
      >
        <!-- Video Track Background -->
        <div v-if="!videoSrc" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center text-muted-foreground/40">
            <Video class="h-3.5 w-3.5 mx-auto mb-1" />
            <p class="text-xs">No video</p>
          </div>
        </div>
        <!-- Video Track with Waveform -->
        <div v-else class="relative w-full h-full">
          <!-- Full video duration background (cool gray) -->
          <div class="absolute inset-0 bg-[#161618] rounded-md"></div>

          <!-- Audio Waveform Canvas -->
          <canvas
            ref="waveformCanvas"
            class="absolute inset-0 w-full h-full rounded-md pointer-events-none"
            style="mix-blend-mode: normal; z-index: 25"
          ></canvas>

          <!-- Played progress overlay (cool lighter gray) -->
          <div
            class="absolute inset-y-0 left-0 bg-[#1f1f23] rounded-l-md transition-all duration-100 pointer-events-none z-15"
            :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
          ></div>

          <!-- Loading indicator for waveform -->
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
            <div class="text-xs text-muted-foreground/60">Loading waveform...</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
  import { Video } from 'lucide-vue-next';
  import { waveformService, useWaveform } from '@/services/waveformService';
  import { renderWaveformWithPlayhead, createThrottledRenderer } from '@/utils/waveformRenderer';
  import type { TimelineVideoTrackProps, TimelineVideoTrackEmits } from '../types';

  const props = withDefaults(defineProps<TimelineVideoTrackProps>(), {
    zoomLevel: 1,
    audioGainDb: 0,
  });

  // Convert dB to linear gain multiplier
  function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // Normalize peaks for display - scales quiet audio to be visible
  function normalizePeaks(peaks: { min: number; max: number }[]): { min: number; max: number }[] {
    if (peaks.length === 0) return peaks;

    // Find the maximum amplitude in the waveform
    let maxAmplitude = 0;
    for (const peak of peaks) {
      const peakMax = Math.max(Math.abs(peak.min), Math.abs(peak.max));
      if (peakMax > maxAmplitude) {
        maxAmplitude = peakMax;
      }
    }

    // If waveform is already loud enough (>50% of full scale), don't normalize
    if (maxAmplitude >= 0.5 || maxAmplitude === 0) {
      return peaks;
    }

    // Calculate scale factor to bring max amplitude to ~85% of full scale
    // This leaves headroom while making quiet audio visible
    const targetAmplitude = 0.85;
    const scaleFactor = targetAmplitude / maxAmplitude;

    // Apply normalization (cap at reasonable max to avoid over-amplification of noise)
    const maxScale = 10; // Don't amplify more than 10x
    const finalScale = Math.min(scaleFactor, maxScale);

    return peaks.map((peak) => ({
      min: peak.min * finalScale,
      max: peak.max * finalScale,
    }));
  }

  const emit = defineEmits<TimelineVideoTrackEmits>();

  // Canvas ref for waveform rendering
  const waveformCanvas = ref<HTMLCanvasElement | null>(null);

  // Use new waveform service
  const waveform = useWaveform();
  const isLoading = computed(() => waveform.isLoading.value);
  const isLoaded = computed(() => waveform.isLoaded.value);

  // Resize observer for canvas updates
  let resizeObserver: ResizeObserver | null = null;

  // Render waveform on canvas
  async function renderWaveformOnCanvas(): Promise<void> {
    if (!waveformCanvas.value || !props.videoSrc || !isLoaded.value) {
      return;
    }

    // Need valid duration to render
    if (!props.duration || props.duration <= 0) {
      return;
    }

    try {
      const canvas = waveformCanvas.value;
      const rect = canvas.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) return;

      // Get peaks on-demand from waveform service (1 peak per pixel for maximum accuracy)
      const gainMultiplier = dbToLinear(props.audioGainDb ?? 0);
      const peaks = await waveformService.getPeaksForRange(props.videoSrc, {
        startTime: 0,
        endTime: props.duration,
        pixelWidth: Math.floor(rect.width),
        gainMultiplier,
      });

      if (!peaks || peaks.length === 0) {
        return;
      }

      // Normalize peaks for display (makes quiet audio visible)
      const normalizedPeaks = normalizePeaks(peaks);

      // Use the unified renderer with playhead support
      renderWaveformWithPlayhead(canvas, normalizedPeaks, rect.width, rect.height, props.currentTime, props.duration, {
        style: 'bars',
        useGradientColors: false, // Simple white/teal for this track
      });
    } catch (error) {
      console.error('[TimelineVideoTrack] Error rendering waveform:', error);
    }
  }

  // Throttled renderer for performance
  const throttledRender = createThrottledRenderer(renderWaveformOnCanvas);

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
        await waveform.load(newVideoSrc);
      }
    },
    { immediate: true }
  );

  // Watch for waveform data changes and render
  // Include duration so we re-render when video metadata loads
  watch(
    [isLoaded, () => props.zoomLevel, () => props.currentTime, () => props.audioGainDb, () => props.duration],
    ([loaded, _zoom, _time, _gain, duration]) => {
      if (loaded && duration > 0) {
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
        waveform.load(props.videoSrc);
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
    background: #161618;
    border-radius: 0.375rem;
    position: relative;
    overflow: hidden;
  }

  .video-track-progress {
    background: #1f1f23;
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
