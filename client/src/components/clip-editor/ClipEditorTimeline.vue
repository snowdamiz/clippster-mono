<template>
  <div class="editor-timeline">
    <!-- Fixed Timeline Ruler -->
    <div class="editor-timeline__ruler">
      <div class="editor-timeline__ruler-spacer"></div>
      <div class="editor-timeline__ruler-content" :style="{ width: timelineWidth + 'px' }">
        <div
          v-for="marker in timeMarkers"
          :key="marker.time"
          class="editor-timeline__time-marker"
          :style="{ left: (marker.time / duration) * timelineWidth + 'px' }"
        >
          <span class="editor-timeline__time-label">{{ formatTime(marker.time) }}</span>
        </div>
      </div>
    </div>

    <!-- Scrollable Tracks Container -->
    <div 
      class="editor-timeline__tracks-container"
      ref="tracksContainer"
      @scroll="handleScroll"
    >
      <div class="editor-timeline__tracks" :style="{ width: timelineWidth + 'px' }">
      <!-- Video Track (with embedded audio waveform) -->
      <div class="editor-timeline__track editor-timeline__track--video">
        <div class="editor-timeline__track-label">
          <Film :size="14" />
          <span>V1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <!-- Intro segment (if present) -->
          <div
            v-if="introRef"
            class="editor-timeline__segment editor-timeline__segment--intro"
            :style="getSegmentStyle(0, introRef.duration)"
          >
            <span class="editor-timeline__segment-label">Intro</span>
            <!-- Waveform for intro -->
            <div class="editor-timeline__segment-waveform">
              <div class="editor-timeline__waveform-bars">
                <div
                  v-for="i in getWaveformBars(introRef.duration)"
                  :key="i"
                  class="editor-timeline__waveform-bar"
                  :style="{ height: getWaveformHeight(i - 1, 0, introRef.duration) }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Video source segments (from splits/edits) -->
          <div
            v-for="source in videoSources"
            :key="source.id"
            class="editor-timeline__segment editor-timeline__segment--video"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === source.id }"
            :style="getSegmentStyle(source.start_time, source.end_time - source.start_time)"
            @click.stop="selectItem(source, 'video')"
          >
            <span class="editor-timeline__segment-label">
              {{ formatSourceLabel(source) }}
            </span>
            <!-- Embedded audio waveform -->
            <div class="editor-timeline__segment-waveform">
              <div class="editor-timeline__waveform-bars">
                <div
                  v-for="i in getWaveformBars(source.end_time - source.start_time)"
                  :key="i"
                  class="editor-timeline__waveform-bar"
                  :style="{ height: getWaveformHeight(i - 1, source.start_time, source.end_time - source.start_time) }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Outro segment (if present) -->
          <div
            v-if="outroRef"
            class="editor-timeline__segment editor-timeline__segment--outro"
            :style="getSegmentStyle(duration - outroOffset, outroRef.duration)"
          >
            <span class="editor-timeline__segment-label">Outro</span>
            <!-- Waveform for outro -->
            <div class="editor-timeline__segment-waveform">
              <div class="editor-timeline__waveform-bars">
                <div
                  v-for="i in getWaveformBars(outroRef.duration)"
                  :key="i"
                  class="editor-timeline__waveform-bar"
                  :style="{ height: getWaveformHeight(i - 1, duration - outroOffset, outroRef.duration) }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Additional Audio Tracks -->
      <div
        v-for="(audioTrack, index) in audioTracks"
        :key="audioTrack.id"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Music :size="14" />
          <span>A{{ index + 1 }}</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            class="editor-timeline__segment editor-timeline__segment--audio"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === audioTrack.id }"
            :style="getSegmentStyle(audioTrack.start_time, audioTrack.end_time - audioTrack.start_time)"
            @click.stop="selectItem(audioTrack, 'audio')"
          >
            <span class="editor-timeline__segment-label">{{ audioTrack.name }}</span>
            
            <!-- Mute/Solo indicators -->
            <div class="editor-timeline__track-indicators">
              <span v-if="audioTrack.is_muted" class="editor-timeline__indicator editor-timeline__indicator--muted">M</span>
              <span v-if="audioTrack.is_solo" class="editor-timeline__indicator editor-timeline__indicator--solo">S</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Text Track -->
      <div
        v-if="textOverlays.length > 0"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Type :size="14" />
          <span>T1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            v-for="textOverlay in textOverlays"
            :key="textOverlay.id"
            class="editor-timeline__segment editor-timeline__segment--text"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === textOverlay.id }"
            :style="getSegmentStyle(textOverlay.start_time, textOverlay.end_time - textOverlay.start_time)"
            @click.stop="selectItem(textOverlay, 'text')"
          >
            <span class="editor-timeline__segment-label">{{ truncate(textOverlay.text, 20) }}</span>
          </div>
        </div>
      </div>

      <!-- Sticker Track -->
      <div
        v-if="stickers.length > 0"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Smile :size="14" />
          <span>S1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            v-for="sticker in stickers"
            :key="sticker.id"
            class="editor-timeline__segment editor-timeline__segment--sticker"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === sticker.id }"
            :style="getSegmentStyle(sticker.start_time, sticker.end_time - sticker.start_time)"
            @click.stop="selectItem(sticker, 'sticker')"
          >
            <span class="editor-timeline__segment-label">Sticker</span>
          </div>
        </div>
      </div>

      <!-- Watermark Track -->
      <div
        v-if="watermarks.length > 0"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Image :size="14" />
          <span>W1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            v-for="watermark in watermarks"
            :key="watermark.id"
            class="editor-timeline__segment editor-timeline__segment--watermark"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === watermark.id }"
            :style="getSegmentStyle(watermark.start_time, watermark.end_time - watermark.start_time)"
            @click.stop="selectItem(watermark, 'watermark')"
          >
            <span class="editor-timeline__segment-label">Watermark</span>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Single Playhead Overlay (spans all tracks) -->
    <div
      class="editor-timeline__playhead"
      :class="{ 'editor-timeline__playhead--dragging': isDraggingPlayhead }"
      :style="{ left: playheadScreenPosition + 'px' }"
      @mousedown="handlePlayheadMouseDown"
    >
      <div class="editor-timeline__playhead-line"></div>
      <div class="editor-timeline__playhead-handle"></div>
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
}>();

// Constants
const TRACK_LABEL_WIDTH = 60;
const PIXELS_PER_SECOND_BASE = 100;

// Track width (pixels per second)
const pixelsPerSecond = computed(() => PIXELS_PER_SECOND_BASE * props.zoomLevel);

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

// Get segment style based on time and duration
function getSegmentStyle(startTime: number, segmentDuration: number) {
  return {
    left: startTime * pixelsPerSecond.value + 'px',
    width: segmentDuration * pixelsPerSecond.value + 'px',
  };
}

// Playhead dragging state
const isDraggingPlayhead = ref(false);

// Handle track click to seek
function handleTrackClick(event: MouseEvent) {
  if (!tracksContainer.value) return;
  
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
</script>

<style scoped>
.editor-timeline {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #0a0a0a;
  position: relative;
  overflow: hidden;
}

/* Fixed Timeline Ruler */
.editor-timeline__ruler {
  display: flex;
  height: 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: #0d0d0d;
  flex-shrink: 0;
  position: relative;
  z-index: 3;
}

.editor-timeline__ruler-spacer {
  width: 60px;
  flex-shrink: 0;
  background-color: rgba(0, 0, 0, 0.4);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.editor-timeline__ruler-content {
  position: relative;
  height: 100%;
}

.editor-timeline__time-marker {
  position: absolute;
  top: 0;
  height: 100%;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  padding-left: 0.25rem;
}

.editor-timeline__time-label {
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

/* Single Playhead (overlays entire timeline) */
.editor-timeline__playhead {
  position: absolute;
  top: 28px; /* Start below ruler */
  bottom: 0;
  width: 2px;
  z-index: 100;
  pointer-events: none;
}

.editor-timeline__playhead-line {
  width: 100%;
  height: 100%;
  background-color: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
}

.editor-timeline__playhead-handle {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background-color: #ef4444;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: ew-resize;
  pointer-events: auto;
  transition: transform 150ms ease;
}

.editor-timeline__playhead-handle:hover {
  transform: translateX(-50%) scale(1.3);
}

.editor-timeline__playhead--dragging .editor-timeline__playhead-handle {
  transform: translateX(-50%) scale(1.2);
  cursor: grabbing;
}

/* Scrollable Tracks Container */
.editor-timeline__tracks-container {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
}

.editor-timeline__tracks {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.editor-timeline__track {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 48px;
  position: relative;
}

.editor-timeline__track--video {
  min-height: 64px; /* Taller track for video + waveform */
}

.editor-timeline__track-label {
  position: sticky;
  left: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 60px;
  padding: 0 0.75rem;
  background-color: rgba(0, 0, 0, 0.95);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8125rem;
  font-weight: 600;
  flex-shrink: 0;
  z-index: 2;
  backdrop-filter: blur(4px);
}

.editor-timeline__track-content {
  position: relative;
  flex: 1;
  min-height: 48px;
  cursor: pointer;
}

.editor-timeline__segment {
  position: absolute;
  top: 4px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  overflow: hidden;
}

.editor-timeline__track--video .editor-timeline__segment {
  height: 56px; /* Taller segments for video track */
}

.editor-timeline__segment:hover {
  border-color: rgba(255, 255, 255, 0.4);
  z-index: 1;
}

.editor-timeline__segment--selected {
  border-color: rgba(255, 255, 255, 0.8);
  border-width: 2px;
  z-index: 2;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.4);
}

.editor-timeline__segment--intro,
.editor-timeline__segment--outro {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%);
  border-color: rgba(99, 102, 241, 0.4);
}

.editor-timeline__segment--video {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%);
  border-color: rgba(139, 92, 246, 0.4);
}

.editor-timeline__segment--audio {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.2) 100%);
  border-color: rgba(34, 197, 94, 0.4);
}

.editor-timeline__segment--text {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.2) 100%);
  border-color: rgba(251, 191, 36, 0.4);
}

.editor-timeline__segment--sticker {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.3) 0%, rgba(236, 72, 153, 0.2) 100%);
  border-color: rgba(236, 72, 153, 0.4);
}

.editor-timeline__segment--watermark {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.2) 100%);
  border-color: rgba(59, 130, 246, 0.4);
}

.editor-timeline__segment-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  z-index: 1;
}

/* Waveform within segment */
.editor-timeline__segment-waveform {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 4px 0;
  pointer-events: none;
  opacity: 0.4;
}

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

.editor-timeline__waveform-bars {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1px;
  width: 100%;
  height: 100%;
  padding: 0 4px;
}

.editor-timeline__waveform-bar {
  flex: 1;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.5) 100%);
  border-radius: 1px;
  min-height: 4px;
  max-width: 3px;
}

.editor-timeline__track-indicators {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
  padding-left: 0.5rem;
}

.editor-timeline__indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.editor-timeline__indicator--muted {
  background-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.5);
}

.editor-timeline__indicator--solo {
  background-color: rgba(251, 191, 36, 0.3);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.5);
}
</style>

