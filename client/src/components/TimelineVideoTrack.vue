<template>
  <div class="relative flex h-12 items-center border-b border-line-subtle px-2">
    <!-- Track Label -->
    <div
      class="sticky left-0 z-40 -ml-2 flex h-full w-18 shrink-0 items-center gap-1.5 border-r border-line-subtle bg-surface pl-3 pr-2"
    >
      <Video class="size-3.5 shrink-0 text-fg-subtle" />
      <span class="truncate text-2xs font-medium text-fg-muted">Video</span>
    </div>
    <!-- Video Track Content -->
    <div class="relative flex h-full flex-1 items-center">
      <div
        data-video-track="true"
        class="group relative h-8 flex-1 cursor-pointer overflow-hidden rounded-md bg-surface-sunken"
        @click="onVideoTrackClick"
        @mousemove="onTimelineTrackHover"
        @mouseleave="onTimelineMouseLeave"
      >
        <!-- Empty -->
        <div v-if="!videoSrc" class="absolute inset-0 flex items-center justify-center gap-1.5 text-fg-disabled">
          <Video class="size-3.5" />
          <span class="text-2xs">No video</span>
        </div>
        <!-- Video Track with Waveform -->
        <div v-else class="relative h-full w-full">
          <!-- Audio Waveform Canvas -->
          <canvas
            ref="waveformCanvas"
            class="pointer-events-none absolute inset-0 h-full w-full rounded-md"
            style="mix-blend-mode: normal; z-index: 25"
          ></canvas>

          <!-- Played progress overlay -->
          <div
            class="pointer-events-none absolute inset-y-0 left-0 z-15 rounded-l-md bg-surface-active transition-[width] duration-100"
            :style="{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }"
          ></div>

          <!-- Loading indicator for waveform -->
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
            <span class="text-2xs text-fg-subtle">Loading waveform…</span>
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

      // Get peaks on-demand from waveform service
      // Limit peak density to prevent rendering issues at extreme zoom levels
      // Professional video editors use max ~10,000 peaks for waveform display
      const MAX_PEAKS = 10000;
      const requestedPeaks = Math.min(Math.floor(rect.width), MAX_PEAKS);
      
      const gainMultiplier = dbToLinear(props.audioGainDb ?? 0);
      const peaks = await waveformService.getPeaksForRange(props.videoSrc, {
        startTime: 0,
        endTime: props.duration,
        pixelWidth: requestedPeaks,
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
        minBarHeight: 0,
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
