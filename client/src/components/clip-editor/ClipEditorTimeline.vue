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
import { ref, computed, watch, toRef } from 'vue';
import { Film, Music, Type, Smile, Image } from 'lucide-vue-next';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import type { IntroOutroRef } from '@/types';
import {
  formatTime,
  truncateText,
  useTimelineItems,
  usePlayheadDrag,
  useWaveformRenderer,
  useTimelineZoom,
  useTimelineRuler,
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

// Intro/outro offsets
const introOffset = computed(() => props.introRef?.duration || 0);
const outroOffset = computed(() => props.outroRef?.duration || 0);

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

// Get segment style based on time and duration
function getSegmentStyle(startTime: number, segmentDuration: number) {
  return {
    left: startTime * pixelsPerSecond.value + 'px',
    width: segmentDuration * pixelsPerSecond.value + 'px',
  };
}

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

// Format video source label
function formatSourceLabel(source: VideoSource): string {
  const duration = source.end_time - source.start_time;
  return `Clip (${duration.toFixed(1)}s)`;
}

// Wrapper for audio track waveform height that looks up file path by ID
function getAudioWaveformHeight(audioTrackId: string, index: number, startTime: number, segmentDuration: number): string {
  const audioTrack = audioTracks.value.find(t => t.id === audioTrackId);
  if (!audioTrack) return '50%';
  return getAudioWaveformHeightFromPath(audioTrack.file_path, index, startTime, segmentDuration);
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

