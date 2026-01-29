<template>
  <div class="flex-1 flex flex-col bg-[var(--editor-bg)] relative overflow-hidden">
    <!-- Fixed Timeline Ruler -->
    <div class="flex h-7 border-b border-[var(--editor-border)] bg-[var(--editor-surface)] shrink-0 relative z-[3]">
      <div class="w-[100px] shrink-0 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)]"></div>
      <div class="relative h-full" :style="{ width: timelineWidth + 'px' }">
        <div
          v-for="marker in timeMarkers"
          :key="marker.time"
          class="absolute top-0 h-full border-l border-sky-500/20 pl-1"
          :style="{ left: (marker.time / duration) * timelineWidth + 'px' }"
        >
          <span class="text-xs font-mono text-white/50">{{ formatTime(marker.time) }}</span>
        </div>
      </div>
    </div>

    <!-- Scrollable Tracks Container -->
    <div 
      class="flex-1 overflow-x-auto overflow-y-auto relative editor-timeline__tracks-container"
      ref="tracksContainer"
      @scroll="handleScroll"
    >
      <div class="flex flex-col min-h-full" :style="{ width: timelineWidth + 'px' }">
      <!-- Video Track (with embedded audio waveform) -->
      <div class="flex border-b border-[var(--editor-border)] min-h-[64px] relative">
        <div class="sticky left-0 flex items-center gap-2 w-[100px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.75rem] font-medium shrink-0 z-[2] backdrop-blur overflow-hidden">
          <Film :size="14" class="shrink-0" />
          <div class="track-label-scroll">
            <span class="track-label-text">{{ videoSourceName }}<span class="track-label-spacer">&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</span>{{ videoSourceName }}<span class="track-label-spacer">&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</span></span>
          </div>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <!-- Intro segment (if present) -->
          <div
            v-if="introRef"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-indigo-500/30 to-indigo-500/20 border-indigo-500/40"
            :style="getSegmentStyle(0, introRef.duration || 0)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Intro</span>
            <!-- Waveform canvas for intro -->
            <canvas
              :ref="el => setWaveformCanvasRef(el, 'intro')"
              class="absolute inset-0 w-full h-full pointer-events-none opacity-60"
              style="mix-blend-mode: normal"
            ></canvas>
          </div>

          <!-- Video source segments (from splits/edits) -->
          <div
            v-for="source in videoSources"
            :key="source.id"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-sky-500/30 to-sky-500/20 border-sky-500/40"
            :class="{ 'ring-2 ring-sky-500 ring-offset-1 ring-offset-[var(--editor-bg)] z-[2]': selectedItem?.id === source.id }"
            :style="getSegmentStyle(source.start_time, source.end_time - source.start_time)"
            @click.stop="selectItem(source, 'video')"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">
              {{ formatSourceLabel(source) }}
            </span>
            <!-- Embedded audio waveform canvas -->
            <canvas
              :ref="el => setWaveformCanvasRef(el, `source-${source.id}`)"
              class="absolute inset-0 w-full h-full pointer-events-none opacity-60"
              style="mix-blend-mode: normal"
            ></canvas>
          </div>

          <!-- Outro segment (if present) -->
          <div
            v-if="outroRef"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-indigo-500/30 to-indigo-500/20 border-indigo-500/40"
            :style="getSegmentStyle(duration - outroOffset, outroRef.duration || 0)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Outro</span>
            <!-- Waveform canvas for outro -->
            <canvas
              :ref="el => setWaveformCanvasRef(el, 'outro')"
              class="absolute inset-0 w-full h-full pointer-events-none opacity-60"
              style="mix-blend-mode: normal"
            ></canvas>
          </div>
        </div>
      </div>

      <!-- Grouped Audio Tracks -->
      <div
        v-for="(trackGroup, index) in groupedAudioTracks"
        :key="`audio-track-${trackGroup.order}`"
        class="flex border-b border-[var(--editor-border)] min-h-[48px] relative"
      >
        <div class="sticky left-0 flex items-center gap-2 w-[100px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Music :size="14" />
          <span>A{{ index + 1 }}</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <!-- Render all segments in this track -->
          <div
            v-for="audioTrack in trackGroup.segments"
            :key="audioTrack.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-cyan-500/30 to-cyan-500/20 border-cyan-500/40"
            :class="{ 'ring-2 ring-sky-500 ring-offset-1 ring-offset-[var(--editor-bg)] z-[2]': selectedItem?.id === audioTrack.id }"
            :style="getSegmentStyle(audioTrack.start_time, audioTrack.end_time - audioTrack.start_time)"
            @click.stop="selectItem(audioTrack, 'audio')"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">{{ audioTrack.name }}</span>
            
            <!-- Audio waveform canvas -->
            <canvas
              :ref="el => setWaveformCanvasRef(el, `audio-${audioTrack.id}`)"
              class="absolute inset-0 w-full h-full pointer-events-none opacity-60"
              style="mix-blend-mode: normal"
            ></canvas>
            
            <!-- Mute/Solo indicators -->
            <div class="flex gap-1 ml-auto pl-2">
              <span v-if="audioTrack.is_muted" class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] text-[0.625rem] font-bold tracking-wider bg-zinc-600 text-white border border-zinc-500">M</span>
              <span v-if="audioTrack.is_solo" class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] text-[0.625rem] font-bold tracking-wider bg-sky-500 text-white border border-sky-400">S</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Text Track -->
      <div
        v-if="textOverlays.length > 0"
        class="flex border-b border-[var(--editor-border)] min-h-[48px] relative"
      >
        <div class="sticky left-0 flex items-center gap-2 w-[100px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Type :size="14" />
          <span>T1</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <div
            v-for="textOverlay in textOverlays"
            :key="textOverlay.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-sky-400/30 to-sky-400/20 border-sky-400/40"
            :class="{ 'ring-2 ring-sky-500 ring-offset-1 ring-offset-[var(--editor-bg)] z-[2]': selectedItem?.id === textOverlay.id }"
            :style="getSegmentStyle(textOverlay.start_time, textOverlay.end_time - textOverlay.start_time)"
            @click.stop="selectItem(textOverlay, 'text')"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">{{ truncate(textOverlay.text, 20) }}</span>
          </div>
        </div>
      </div>

      <!-- Sticker Track -->
      <div
        v-if="stickers.length > 0"
        class="flex border-b border-[var(--editor-border)] min-h-[48px] relative"
      >
        <div class="sticky left-0 flex items-center gap-2 w-[100px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Smile :size="14" />
          <span>S1</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <div
            v-for="sticker in stickers"
            :key="sticker.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-cyan-400/30 to-cyan-400/20 border-cyan-400/40"
            :class="{ 'ring-2 ring-sky-500 ring-offset-1 ring-offset-[var(--editor-bg)] z-[2]': selectedItem?.id === sticker.id }"
            :style="getSegmentStyle(sticker.start_time, sticker.end_time - sticker.start_time)"
            @click.stop="selectItem(sticker, 'sticker')"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Sticker</span>
          </div>
        </div>
      </div>

      <!-- Watermark Track -->
      <div
        v-if="watermarks.length > 0"
        class="flex border-b border-[var(--editor-border)] min-h-[48px] relative"
      >
        <div class="sticky left-0 flex items-center gap-2 w-[100px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Image :size="14" />
          <span>W1</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <div
            v-for="watermark in watermarks"
            :key="watermark.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-blue-500/30 to-blue-500/20 border-blue-500/40"
            :class="{ 'ring-2 ring-sky-500 ring-offset-1 ring-offset-[var(--editor-bg)] z-[2]': selectedItem?.id === watermark.id }"
            :style="getSegmentStyle(watermark.start_time, watermark.end_time - watermark.start_time)"
            @click.stop="selectItem(watermark, 'watermark')"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Watermark</span>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Single Playhead Overlay (spans all tracks) -->
    <div
      class="absolute top-7 bottom-0 z-[100] flex justify-center"
      :style="{
        left: (playheadScreenPosition - 6) + 'px',
        width: '13px',
        cursor: isDraggingPlayhead ? 'grabbing' : 'col-resize'
      }"
      @mousedown="handlePlayheadMouseDown"
    >
      <!-- Visible playhead line -->
      <div class="w-0.5 h-full bg-sky-500 pointer-events-none"></div>
      <!-- Playhead handle at top (circle) -->
      <div
        class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-sky-500 rounded-full pointer-events-none"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef, nextTick, onMounted, onUnmounted } from 'vue';
import { Film, Music, Type, Smile, Image } from 'lucide-vue-next';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import type { IntroOutroRef } from '@/types';
import { waveformService } from '@/services/waveformService';
import { renderWaveform } from '@/utils/waveformRenderer';
import {
  formatTime,
  truncateText,
  useTimelineItems,
  usePlayheadDrag,
  useWaveformRenderer,
  useTimelineZoom,
  useTimelineRuler,
  useTimelineSegmentStyles,
  TRACK_LABEL_WIDTH,
  type VideoSource,
} from '@/composables/clip-editor';

const props = defineProps<{
  editorEdit: FullVideoEditorEdit | null;
  currentTime: number;
  duration: number;
  zoomLevel: number;
  selectedItem: any;
  introRef: IntroOutroRef | null;
  outroRef: IntroOutroRef | null;
  videoSourcePath?: string | null; // Path to primary video source for waveform
  videoSources?: VideoSource[]; // Video sources from playback engine
}>();

const emit = defineEmits<{
  (e: 'seek', time: number): void;
  (e: 'selectItem', item: any, type: string): void;
  (e: 'updateItem', item: any): void;
  (e: 'itemDeselected'): void;
}>();

// Scroll container ref
const tracksContainer = ref<HTMLElement | null>(null);

// Canvas refs for waveform rendering
const waveformCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map());
const renderingKeys = new Set<string>(); // Track which keys are currently rendering
let resizeObserver: ResizeObserver | null = null;

// Intro/outro offsets
const introOffset = computed(() => props.introRef?.duration || 0);
const outroOffset = computed(() => props.outroRef?.duration || 0);

// Video source name extracted and formatted from path
const videoSourceName = computed(() => {
  if (!props.videoSourcePath) return 'Video';
  // Extract filename from path and remove extension
  const filename = props.videoSourcePath.split('/').pop() || 'Video';
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  // Format: replace underscores/hyphens with spaces, then title case
  return nameWithoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
});

// Timeline zoom composable
const {
  pixelsPerSecond,
  timelineWidth,
  scrollLeft,
  handleScroll,
  playheadPosition,
  playheadScreenPosition,
} = useTimelineZoom({
  containerRef: tracksContainer,
  zoomLevel: computed(() => props.zoomLevel),
  duration: computed(() => props.duration),
  currentTime: computed(() => props.currentTime),
});

// Timeline ruler composable
const { timeMarkers } = useTimelineRuler({
  duration: computed(() => props.duration),
  zoomLevel: computed(() => props.zoomLevel),
});

// Waveform composable
const {
  isLoading: isWaveformLoading,
  isLoaded: isWaveformLoaded,
  getWaveformBars,
  getWaveformHeight,
  getAudioWaveformHeight: getAudioWaveformHeightFromPath,
} = useWaveformRenderer({
  videoSourcePath: computed(() => props.videoSourcePath),
  zoomLevel: computed(() => props.zoomLevel),
  pixelsPerSecond,
});

// Playhead drag composable
const {
  isDragging: isDraggingPlayhead,
  startDraggingPlayhead: handlePlayheadMouseDown,
  getTimeFromPosition,
} = usePlayheadDrag({
  containerRef: tracksContainer,
  scrollLeft,
  pixelsPerSecond,
  duration: computed(() => props.duration),
  onSeek: (time) => emit('seek', time),
});

// Extract items from editor edit using composable
const editorEditRef = toRef(props, 'editorEdit');
const {
  audioTracks,
  textOverlays,
  stickers,
  watermarks,
  groupedAudioTracks,
} = useTimelineItems(editorEditRef);

// Timeline segment styling composable
const { getSegmentStyle, formatSourceLabel } = useTimelineSegmentStyles({
  pixelsPerSecond,
});

// Handle track click to seek and deselect items
function handleTrackClick(event: MouseEvent) {
  // Deselect any selected items when clicking on empty track space
  emit('itemDeselected');

  // Use composable to get time from click position
  const time = getTimeFromPosition(event);
  emit('seek', time);
}

// Props access for comparison
const selectedItemType = computed(() => props.selectedItem ? 'segment' : null);

// Select item
function selectItem(item: any, type: string) {
  emit('selectItem', item, type);
}

// truncate is an alias for truncateText from composable
const truncate = truncateText;

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

// Canvas ref management
function setWaveformCanvasRef(el: any, key: string) {
  if (el && el instanceof HTMLCanvasElement) {
    waveformCanvasRefs.value.set(key, el);
    
    // Observe this canvas for resize events
    if (resizeObserver) {
      resizeObserver.observe(el);
    }
    
    // Render after canvas is in DOM and sized
    nextTick(() => {
      // Use setTimeout to ensure canvas has dimensions
      setTimeout(() => renderWaveformForKey(key), 0);
    });
  } else {
    waveformCanvasRefs.value.delete(key);
  }
}

// Render waveform for a specific canvas by key
async function renderWaveformForKey(key: string) {
  // Prevent duplicate renders for the same key
  if (renderingKeys.has(key)) {
    console.log(`[ClipEditorTimeline] Already rendering ${key}, skipping...`);
    return;
  }

  const canvas = waveformCanvasRefs.value.get(key);
  if (!canvas) {
    console.log(`[ClipEditorTimeline] No canvas found for key: ${key}`);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log(`[ClipEditorTimeline] Canvas ${key} has zero dimensions:`, rect.width, 'x', rect.height);
    return;
  }

  renderingKeys.add(key);
  
  try {
    let startTime = 0;
    let duration = 0;
    let filePath: string | null = null;

    // Determine segment time range and file path based on key
    if (key === 'intro' && props.introRef) {
      startTime = 0;
      duration = props.introRef.duration || 0;
      filePath = props.videoSourcePath || null;
    } else if (key === 'outro' && props.outroRef) {
      startTime = props.duration - (props.outroRef.duration || 0);
      duration = props.outroRef.duration || 0;
      filePath = props.videoSourcePath || null;
    } else if (key.startsWith('source-')) {
      const sourceId = key.replace('source-', '');
      const source = props.videoSources?.find(s => s.id === sourceId);
      if (source) {
        startTime = source.start_time;
        duration = source.end_time - source.start_time;
        filePath = props.videoSourcePath || null;
      }
    } else if (key.startsWith('audio-')) {
      const audioId = key.replace('audio-', '');
      const audioTrack = audioTracks.value.find(t => t.id === audioId);
      if (audioTrack) {
        startTime = audioTrack.start_time;
        duration = audioTrack.end_time - audioTrack.start_time;
        filePath = audioTrack.file_path;
      }
    }

    if (duration <= 0 || !filePath) {
      console.log(`[ClipEditorTimeline] Invalid duration or filePath for ${key}:`, { duration, filePath });
      return;
    }

    console.log(`[ClipEditorTimeline] Rendering waveform for ${key}:`, {
      filePath,
      startTime,
      duration,
      canvasSize: `${rect.width}x${rect.height}`
    });

    // Get peaks from waveform service
    const peaks = await waveformService.getPeaksForRange(filePath, {
      startTime,
      endTime: startTime + duration,
      pixelWidth: Math.floor(rect.width),
    });

    if (peaks.length === 0) {
      console.warn(`[ClipEditorTimeline] No peaks returned for ${key}`);
      return;
    }

    console.log(`[ClipEditorTimeline] Got ${peaks.length} peaks for ${key}, rendering...`);

    // Normalize peaks for display (makes quiet audio visible)
    const normalizedPeaks = normalizePeaks(peaks);

    // Render waveform on canvas
    renderWaveform(canvas, {
      width: rect.width,
      height: rect.height,
      peaks: normalizedPeaks,
      style: 'bars',
      baseline: 1, // Bars grow upward from bottom
      useGradientColors: false, // Simple teal color for timeline segments
      baseColor: '#5eead4',
      amplitude: 0.85,
    });

    console.log(`[ClipEditorTimeline] Successfully rendered waveform for ${key}`);
  } catch (error) {
    console.error(`[ClipEditorTimeline] Error rendering waveform for ${key}:`, error);
  } finally {
    renderingKeys.delete(key);
  }
}

// Render all visible waveforms (debounced)
let renderDebounceTimer: number | null = null;
function renderAllWaveforms() {
  if (renderDebounceTimer !== null) {
    clearTimeout(renderDebounceTimer);
  }
  
  renderDebounceTimer = window.setTimeout(async () => {
    console.log(`[ClipEditorTimeline] Rendering all waveforms (${waveformCanvasRefs.value.size} canvases)`);
    for (const key of waveformCanvasRefs.value.keys()) {
      await renderWaveformForKey(key);
    }
    renderDebounceTimer = null;
  }, 300);
}

// Setup resize observer for canvas elements
let resizeDebounceTimer: number | null = null;
function setupResizeObserver() {
  if (resizeObserver) return;
  
  resizeObserver = new ResizeObserver(() => {
    // Debounce resize events to prevent rapid re-renders
    if (resizeDebounceTimer !== null) {
      clearTimeout(resizeDebounceTimer);
    }
    
    resizeDebounceTimer = window.setTimeout(() => {
      console.log('[ClipEditorTimeline] ResizeObserver triggered, rendering waveforms...');
      renderAllWaveforms();
      resizeDebounceTimer = null;
    }, 500);
  });

  // Observe all existing canvases
  for (const canvas of waveformCanvasRefs.value.values()) {
    resizeObserver.observe(canvas);
  }
}

// Cleanup resize observer
function cleanupResizeObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

// Lifecycle hooks
onMounted(() => {
  console.log('[ClipEditorTimeline] Component mounted, setting up waveforms...');
  setupResizeObserver();
  
  nextTick(async () => {
    // Pre-load audio for video source
    if (props.videoSourcePath) {
      console.log('[ClipEditorTimeline] Pre-loading video audio:', props.videoSourcePath);
      await waveformService.loadAudio(props.videoSourcePath);
    }
    
    // Pre-load audio for all audio tracks
    for (const track of audioTracks.value) {
      if (track.file_path) {
        console.log('[ClipEditorTimeline] Pre-loading audio track:', track.file_path);
        await waveformService.loadAudio(track.file_path);
      }
    }
    
    console.log('[ClipEditorTimeline] Audio pre-loading complete, canvases will render individually');
  });
});

onUnmounted(() => {
  cleanupResizeObserver();
});
</script>

<style scoped>
/* Scrollbar styling */
.editor-timeline__tracks-container::-webkit-scrollbar {
  height: 12px;
}

.editor-timeline__tracks-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.editor-timeline__tracks-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  border: 2px solid rgba(0, 0, 0, 0.3);
}

.editor-timeline__tracks-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Track label scroll on hover - marquee style */
.track-label-scroll {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  mask-image: linear-gradient(to right, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
}

.track-label-text {
  display: inline-block;
  white-space: nowrap;
}

.track-label-spacer {
  opacity: 0.4;
}

.track-label-scroll:hover .track-label-text {
  animation: scroll-text 6s linear infinite;
}

@keyframes scroll-text {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}
</style>

