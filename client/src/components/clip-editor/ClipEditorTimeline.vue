<template>
  <div class="flex-1 flex flex-col bg-[var(--editor-bg)] relative overflow-hidden">
    <!-- Fixed Timeline Ruler -->
    <div class="flex h-7 border-b border-[var(--editor-border)] bg-[var(--editor-surface)] shrink-0 relative z-[3]">
      <div class="w-[60px] shrink-0 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)]"></div>
      <div class="relative h-full" :style="{ width: timelineWidth + 'px' }">
        <div
          v-for="marker in timeMarkers"
          :key="marker.time"
          class="absolute top-0 h-full border-l border-sky-500/20 pl-1"
          :style="{ left: (marker.time / duration) * timelineWidth + 'px' }"
        >
          <span class="text-[0.625rem] text-[var(--editor-text-muted)] [font-variant-numeric:tabular-nums]">{{ formatTime(marker.time) }}</span>
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
        <div class="sticky left-0 flex items-center gap-2 w-[60px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Film :size="14" />
          <span>V1</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <!-- Intro segment (if present) -->
          <div
            v-if="introRef"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-indigo-500/30 to-indigo-500/20 border-indigo-500/40"
            :style="getSegmentStyle(0, introRef.duration || 0)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Intro</span>
            <!-- Waveform for intro -->
            <div class="absolute inset-0 flex items-center py-1 pointer-events-none opacity-40">
              <div class="flex items-center justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(introRef.duration || 0)"
                  :key="i"
                  class="flex-1 bg-gradient-to-b from-white/80 to-white/50 rounded-[1px]"
                  :style="{ height: getWaveformHeight(i - 1, 0, introRef.duration || 0) }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Video source segments (from splits/edits) -->
          <div
            v-for="source in videoSources"
            :key="source.id"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-sky-500/30 to-sky-500/20 border-sky-500/40"
            :class="{ '!border-white/80 border-2 z-[2] shadow-[0_0_0_2px_rgba(14,165,233,0.4)]': selectedItem?.id === source.id }"
            :style="getSegmentStyle(source.start_time, source.end_time - source.start_time)"
            @click.stop="selectItem(source, 'video')"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">
              {{ formatSourceLabel(source) }}
            </span>
            <!-- Embedded audio waveform -->
            <div class="absolute inset-0 flex items-center py-1 pointer-events-none opacity-40">
              <div class="flex items-center justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(source.end_time - source.start_time)"
                  :key="i"
                  class="flex-1 bg-gradient-to-b from-white/80 to-white/50 rounded-[1px]"
                  :style="{ height: getWaveformHeight(i - 1, source.start_time, source.end_time - source.start_time) }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Outro segment (if present) -->
          <div
            v-if="outroRef"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-indigo-500/30 to-indigo-500/20 border-indigo-500/40"
            :style="getSegmentStyle(duration - outroOffset, outroRef.duration || 0)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Outro</span>
            <!-- Waveform for outro -->
            <div class="absolute inset-0 flex items-center py-1 pointer-events-none opacity-40">
              <div class="flex items-center justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(outroRef.duration || 0)"
                  :key="i"
                  class="flex-1 bg-gradient-to-b from-white/80 to-white/50 rounded-[1px]"
                  :style="{ height: getWaveformHeight(i - 1, duration - outroOffset, outroRef.duration || 0) }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grouped Audio Tracks -->
      <div
        v-for="(trackGroup, index) in groupedAudioTracks"
        :key="`audio-track-${trackGroup.order}`"
        class="flex border-b border-[var(--editor-border)] min-h-[48px] relative"
      >
        <div class="sticky left-0 flex items-center gap-2 w-[60px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Music :size="14" />
          <span>A{{ index + 1 }}</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <!-- Render all segments in this track -->
          <div
            v-for="audioTrack in trackGroup.segments"
            :key="audioTrack.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-emerald-500/30 to-emerald-500/20 border-emerald-500/40"
            :class="{ '!border-white/80 border-2 z-[2] shadow-[0_0_0_2px_rgba(14,165,233,0.4)]': selectedItem?.id === audioTrack.id }"
            :style="getSegmentStyle(audioTrack.start_time, audioTrack.end_time - audioTrack.start_time)"
            @click.stop="selectItem(audioTrack, 'audio')"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">{{ audioTrack.name }}</span>
            
            <!-- Audio waveform -->
            <div class="absolute inset-0 flex items-center py-1 pointer-events-none opacity-40">
              <div class="flex items-center justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(audioTrack.end_time - audioTrack.start_time)"
                  :key="i"
                  class="flex-1 !bg-gradient-to-b !from-violet-500 !to-violet-400 rounded-[1px] min-h-[4px] !max-w-[3px]"
                  :style="{ height: getAudioWaveformHeight(audioTrack.id, i - 1, audioTrack.start_time, audioTrack.end_time - audioTrack.start_time) }"
                ></div>
              </div>
            </div>
            
            <!-- Mute/Solo indicators -->
            <div class="flex gap-1 ml-auto pl-2">
              <span v-if="audioTrack.is_muted" class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] text-[0.625rem] font-bold tracking-wider bg-red-500/30 text-red-400 border border-red-500/50">M</span>
              <span v-if="audioTrack.is_solo" class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] text-[0.625rem] font-bold tracking-wider bg-amber-500/30 text-amber-400 border border-amber-500/50">S</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Text Track -->
      <div
        v-if="textOverlays.length > 0"
        class="flex border-b border-[var(--editor-border)] min-h-[48px] relative"
      >
        <div class="sticky left-0 flex items-center gap-2 w-[60px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Type :size="14" />
          <span>T1</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <div
            v-for="textOverlay in textOverlays"
            :key="textOverlay.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-amber-500/30 to-amber-500/20 border-amber-500/40"
            :class="{ '!border-white/80 border-2 z-[2] shadow-[0_0_0_2px_rgba(14,165,233,0.4)]': selectedItem?.id === textOverlay.id }"
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
        <div class="sticky left-0 flex items-center gap-2 w-[60px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Smile :size="14" />
          <span>S1</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <div
            v-for="sticker in stickers"
            :key="sticker.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-pink-500/30 to-pink-500/20 border-pink-500/40"
            :class="{ '!border-white/80 border-2 z-[2] shadow-[0_0_0_2px_rgba(14,165,233,0.4)]': selectedItem?.id === sticker.id }"
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
        <div class="sticky left-0 flex items-center gap-2 w-[60px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.8125rem] font-semibold shrink-0 z-[2] backdrop-blur">
          <Image :size="14" />
          <span>W1</span>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <div
            v-for="watermark in watermarks"
            :key="watermark.id"
            class="absolute top-1 h-10 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-blue-500/30 to-blue-500/20 border-blue-500/40"
            :class="{ '!border-white/80 border-2 z-[2] shadow-[0_0_0_2px_rgba(14,165,233,0.4)]': selectedItem?.id === watermark.id }"
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
      class="absolute top-7 bottom-0 w-[2px] z-[100] pointer-events-none"
      :class="{ 'opacity-80': isDraggingPlayhead }"
      :style="{ left: playheadScreenPosition + 'px' }"
      @mousedown="handlePlayheadMouseDown"
    >
      <div class="w-full h-full bg-[var(--editor-accent)] shadow-[0_0_8px_rgba(14,165,233,0.6)]"></div>
      <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--editor-accent)] border-2 border-white rounded-full cursor-ew-resize pointer-events-auto transition-transform duration-150 ease-in-out hover:scale-[1.3]" :class="{ 'scale-[1.2] cursor-grabbing': isDraggingPlayhead }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Film, Music, Type, Smile, Image } from 'lucide-vue-next';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import type { IntroOutroRef } from '@/types';
import { waveformService } from '@/services/waveformService';

interface VideoSource {
  id: string;
  file_path: string;
  start_time: number;
  end_time: number;
  trim_start: number;
  trim_end: number | null;
  original_duration: number;
}

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

// Constants
const TRACK_LABEL_WIDTH = 60;
const PIXELS_PER_SECOND_BASE = 100;
const MIN_TIMELINE_WIDTH = 800; // Minimum width for timeline content

// Track width (pixels per second)
const pixelsPerSecond = computed(() => {
  if (!tracksContainer.value) return PIXELS_PER_SECOND_BASE;
  
  // At zoom level 0, fit entire duration to container width
  if (props.zoomLevel === 0) {
    const containerWidth = tracksContainer.value.clientWidth;
    // Use at least MIN_TIMELINE_WIDTH to prevent too-compressed timeline
    const targetWidth = Math.max(MIN_TIMELINE_WIDTH, containerWidth);
    return props.duration > 0 ? targetWidth / props.duration : PIXELS_PER_SECOND_BASE;
  }
  
  // For zoom > 0, scale from the fit-to-width baseline
  return PIXELS_PER_SECOND_BASE * props.zoomLevel;
});

// Timeline width based on duration and zoom
const timelineWidth = computed(() => {
  return props.duration * pixelsPerSecond.value;
});

// Intro/outro offsets
const introOffset = computed(() => props.introRef?.duration || 0);
const outroOffset = computed(() => props.outroRef?.duration || 0);

// Scroll container ref
const tracksContainer = ref<HTMLElement | null>(null);
const scrollLeft = ref(0);

// Waveform state
const isWaveformLoading = ref(false);
const isWaveformLoaded = ref(false);
const waveformPeaks = ref<Map<string, Array<{ min: number; max: number }>>>(new Map());

// Playhead position within the timeline content (based on current time)
const playheadPosition = computed(() => {
  return props.currentTime * pixelsPerSecond.value;
});

// Playhead screen position (accounting for scroll and track label width)
const playheadScreenPosition = computed(() => {
  return TRACK_LABEL_WIDTH + playheadPosition.value - scrollLeft.value;
});

// Auto-scroll timeline to keep playhead in view
watch(() => props.currentTime, (newTime) => {
  if (!tracksContainer.value) return;
  
  const playheadPos = newTime * pixelsPerSecond.value;
  const containerWidth = tracksContainer.value.clientWidth;
  const scrollLeft = tracksContainer.value.scrollLeft;
  
  // Target position: keep playhead at 30% from left edge (not centered, gives context)
  const targetScrollLeft = playheadPos - (containerWidth * 0.3);
  
  // Only auto-scroll if playhead would go off-screen
  const isOffScreenRight = playheadPos > scrollLeft + (containerWidth * 0.8);
  const isOffScreenLeft = playheadPos < scrollLeft + (containerWidth * 0.2);
  
  if (isOffScreenRight || isOffScreenLeft) {
    // Smooth scroll to keep playhead in view
    tracksContainer.value.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth'
    });
  }
});

// Time markers for ruler
const timeMarkers = computed(() => {
  const markers = [];
  const interval = getTimeInterval();
  
  for (let time = 0; time <= props.duration; time += interval) {
    markers.push({ time });
  }
  
  return markers;
});

// Get appropriate time interval based on zoom level
function getTimeInterval(): number {
  const visibleDuration = props.duration / props.zoomLevel;
  
  if (visibleDuration > 120) return 30; // 30s intervals
  if (visibleDuration > 60) return 15;  // 15s intervals
  if (visibleDuration > 30) return 10;  // 10s intervals
  if (visibleDuration > 10) return 5;   // 5s intervals
  return 1;  // 1s intervals
}

// Format time for display
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Handle scroll to update scroll position
function handleScroll() {
  if (tracksContainer.value) {
    scrollLeft.value = tracksContainer.value.scrollLeft;
  }
}

// Extract items from editor edit
const audioTracks = computed(() => props.editorEdit?.audioTracks || []);
const textOverlays = computed(() => props.editorEdit?.textOverlays || []);
const stickers = computed(() => props.editorEdit?.stickers || []);
const watermarks = computed(() => props.editorEdit?.watermarks || []);

// Group audio tracks by track_order so split segments appear on same row
const groupedAudioTracks = computed(() => {
  const tracks = audioTracks.value;
  const grouped = new Map<number, any[]>();
  
  tracks.forEach(track => {
    const order = track.track_order || 0;
    if (!grouped.has(order)) {
      grouped.set(order, []);
    }
    grouped.get(order)!.push(track);
  });
  
  // Sort segments within each track by start_time
  grouped.forEach(segments => {
    segments.sort((a, b) => a.start_time - b.start_time);
  });
  
  // Convert to array and sort by track_order
  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([order, segments]) => ({ order, segments }));
});

// Get segment style based on time and duration
function getSegmentStyle(startTime: number, segmentDuration: number) {
  return {
    left: startTime * pixelsPerSecond.value + 'px',
    width: segmentDuration * pixelsPerSecond.value + 'px',
  };
}

// Playhead dragging state
const isDraggingPlayhead = ref(false);

// Handle track click to seek and deselect items
function handleTrackClick(event: MouseEvent) {
  if (!tracksContainer.value) return;
  
  // Deselect any selected items when clicking on empty track space
  emit('itemDeselected');
  
  // Calculate position relative to the visible area
  const containerRect = tracksContainer.value.getBoundingClientRect();
  const clickX = event.clientX - containerRect.left;
  
  // Account for scroll position
  const timelineX = clickX + scrollLeft.value;
  const time = timelineX / pixelsPerSecond.value;
  
  emit('seek', Math.max(0, Math.min(time, props.duration)));
}

// Handle playhead drag
function handlePlayheadMouseDown(event: MouseEvent) {
  event.stopPropagation();
  isDraggingPlayhead.value = true;
  
  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingPlayhead.value || !tracksContainer.value) return;
    
    // Calculate position relative to tracks container
    const rect = tracksContainer.value.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Account for scroll position
    const timelineX = clickX + scrollLeft.value;
    const time = timelineX / pixelsPerSecond.value;
    
    emit('seek', Math.max(0, Math.min(time, props.duration)));
  };
  
  const onMouseUp = () => {
    isDraggingPlayhead.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// Props access for comparison
const selectedItemType = computed(() => props.selectedItem ? 'segment' : null);

// Select item
function selectItem(item: any, type: string) {
  emit('selectItem', item, type);
}

// Truncate text
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

// Format video source label
function formatSourceLabel(source: VideoSource): string {
  const duration = source.end_time - source.start_time;
  return `Clip (${duration.toFixed(1)}s)`;
}

// Load waveform data
async function loadWaveformData() {
  if (!props.videoSourcePath) {
    console.log('[ClipEditorTimeline] No video source path provided');
    return;
  }
  
  // Check if already loaded
  if (waveformService.isLoaded(props.videoSourcePath)) {
    console.log('[ClipEditorTimeline] Waveform already loaded');
    isWaveformLoaded.value = true;
    waveformPeaks.value.clear(); // Clear cache to regenerate with new data
    return;
  }
  
  // Check if already loading
  if (isWaveformLoading.value) {
    console.log('[ClipEditorTimeline] Waveform already loading');
    return;
  }
  
  try {
    isWaveformLoading.value = true;
    console.log('[ClipEditorTimeline] Loading waveform for:', props.videoSourcePath);
    
    await waveformService.loadAudio(props.videoSourcePath);
    
    isWaveformLoaded.value = true;
    waveformPeaks.value.clear(); // Clear cache to force regeneration with real data
    
    console.log('[ClipEditorTimeline] Waveform loaded successfully');
  } catch (error) {
    console.error('[ClipEditorTimeline] Failed to load waveform:', error);
    isWaveformLoaded.value = false;
  } finally {
    isWaveformLoading.value = false;
  }
}

// Watch for video source changes
watch(() => props.videoSourcePath, (newPath) => {
  if (newPath) {
    isWaveformLoaded.value = false;
    waveformPeaks.value.clear();
    loadWaveformData();
  }
}, { immediate: true });

// Watch for zoom level changes to invalidate peak cache
watch(() => props.zoomLevel, () => {
  waveformPeaks.value.clear();
});

// Get number of waveform bars based on segment duration and zoom
function getWaveformBars(segmentDuration: number): number {
  // More bars for longer segments and higher zoom levels
  const baseBarCount = 50;
  const scaledCount = Math.max(baseBarCount, Math.floor(segmentDuration * pixelsPerSecond.value / 4));
  return Math.min(scaledCount, 500); // Cap at 500 bars for performance
}

// Get waveform peaks for a segment
function getSegmentPeaks(startTime: number, segmentDuration: number): Array<{ min: number; max: number }> {
  const cacheKey = `${startTime}-${segmentDuration}`;
  
  // Check cache first
  if (waveformPeaks.value.has(cacheKey)) {
    return waveformPeaks.value.get(cacheKey)!;
  }
  
  // If waveform not loaded yet, return empty array
  if (!isWaveformLoaded.value || !props.videoSourcePath) {
    return [];
  }
  
  // Get peaks from waveform service
  const numBars = getWaveformBars(segmentDuration);
  const peaks = waveformService.getPeaksForRange(props.videoSourcePath, {
    startTime,
    endTime: startTime + segmentDuration,
    pixelWidth: numBars,
  });
  
  // Cache the result
  waveformPeaks.value.set(cacheKey, peaks);
  
  return peaks;
}

// Generate waveform height from real peak data
function getWaveformHeight(index: number, startTime: number, segmentDuration: number): string {
  const peaks = getSegmentPeaks(startTime, segmentDuration);
  
  if (peaks.length === 0 || index >= peaks.length) {
    // Fallback to placeholder pattern if no data
    const time = index / 10;
    const height = 
      Math.abs(Math.sin(time * 0.5) * 0.6) +
      Math.abs(Math.sin(time * 1.2) * 0.3) +
      Math.abs(Math.sin(time * 2.8) * 0.1);
    return `${Math.max(10, height * 100)}%`;
  }
  
  const peak = peaks[index];
  // Calculate amplitude from min/max (use the larger absolute value)
  const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
  
  // Scale to percentage (with minimum height for visibility)
  const heightPercent = Math.max(10, amplitude * 100);
  
  return `${heightPercent}%`;
}

// Generate waveform for audio tracks (uses audio file path)
function getAudioWaveformHeight(audioTrackId: string, index: number, startTime: number, segmentDuration: number): string {
  // Find the audio track to get its file path
  const audioTrack = audioTracks.value.find(t => t.id === audioTrackId);
  if (!audioTrack) {
    return '50%'; // Default height if track not found
  }
  
  // Check if waveform is loaded for this audio file
  if (waveformService.isLoaded(audioTrack.file_path)) {
    const numBars = getWaveformBars(segmentDuration);
    const peaks = waveformService.getPeaksForRange(audioTrack.file_path, {
      startTime,
      endTime: startTime + segmentDuration,
      pixelWidth: numBars,
    });
    
    if (peaks.length > 0 && index < peaks.length) {
      const peak = peaks[index];
      const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
      const heightPercent = Math.max(10, amplitude * 100);
      return `${heightPercent}%`;
    }
  }
  
  // Fallback to procedural waveform pattern
  const time = index / 10;
  const height = 
    Math.abs(Math.sin(time * 0.7) * 0.5) +
    Math.abs(Math.sin(time * 1.5) * 0.3) +
    Math.abs(Math.sin(time * 3.2) * 0.2);
  return `${Math.max(15, height * 100)}%`;
}
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
</style>

