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
      <!-- Video Tracks (grouped by order_index) -->
      <div
        v-for="(trackGroup, index) in groupedVideoTracks"
        :key="`video-track-${trackGroup.trackIndex}`"
        class="flex border-b border-[var(--editor-border)] min-h-[64px] relative"
      >
        <div class="sticky left-0 flex items-center gap-2 w-[100px] px-3 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] text-[var(--editor-text-muted)] text-[0.75rem] font-medium shrink-0 z-[2] backdrop-blur overflow-hidden">
          <Film :size="14" class="shrink-0" />
          <div class="track-label-scroll">
            <span class="track-label-text">{{ trackGroup.trackIndex === 0 ? videoSourceName : `Overlay ${trackGroup.trackIndex}` }}<span class="track-label-spacer">&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</span>{{ trackGroup.trackIndex === 0 ? videoSourceName : `Overlay ${trackGroup.trackIndex}` }}<span class="track-label-spacer">&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;</span></span>
          </div>
        </div>
        <div class="relative flex-1 min-h-[48px] cursor-pointer" @click="handleTrackClick">
          <!-- Intro segment (only on base track) -->
          <div
            v-if="introRef && trackGroup.trackIndex === 0"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-indigo-500/30 to-indigo-500/20 border-indigo-500/40"
            :style="getSegmentStyle(0, introRef.duration || 0)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Intro</span>
            <!-- Waveform for intro -->
            <div class="absolute inset-0 flex items-end py-1 pointer-events-none opacity-60">
              <div class="flex items-end justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(introRef.duration || 0)"
                  :key="i"
                  class="bg-[#5eead4] flex-shrink-0"
                  :style="{ height: getWaveformHeight(i - 1, 0, introRef.duration || 0), width: getBarWidth() }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Video source segments for this track -->
          <div
            v-for="source in trackGroup.sources"
            :key="source.id"
            class="absolute top-1 h-14 rounded border ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-sky-500/30 to-sky-500/20 border-sky-500/40"
            :class="{ 
              'ring-2 ring-sky-500 ring-offset-1 ring-offset-[var(--editor-bg)] z-[2]': selectedItem?.id === source.id,
              'cursor-grabbing': isDraggingVideoSource && draggingVideoSource?.id === source.id,
              'cursor-grab': !isDraggingVideoSource,
              'duration-0': isDraggingVideoSource && draggingVideoSource?.id === source.id,
              'transition-all': !isDraggingVideoSource || draggingVideoSource?.id !== source.id
            }"
            :style="getVideoSourceStyle(source)"
            @click.stop="selectItem(source, 'video')"
            @mousedown.stop="startVideoSourceDrag($event, source as any)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">
              {{ formatSourceLabel(source) }}
            </span>
            <!-- Embedded audio waveform -->
            <div class="absolute inset-0 flex items-end py-1 pointer-events-none opacity-60">
              <div class="flex items-end justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(source.end_time - source.start_time)"
                  :key="i"
                  class="bg-[#5eead4] flex-shrink-0"
                  :style="{ height: getWaveformHeight(i - 1, source.start_time, source.end_time - source.start_time), width: getBarWidth() }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Outro segment (only on base track) -->
          <div
            v-if="outroRef && trackGroup.trackIndex === 0"
            class="absolute top-1 h-14 rounded border cursor-pointer transition-all duration-150 ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-indigo-500/30 to-indigo-500/20 border-indigo-500/40"
            :style="getSegmentStyle(duration - outroOffset, outroRef.duration || 0)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">Outro</span>
            <!-- Waveform for outro -->
            <div class="absolute inset-0 flex items-end py-1 pointer-events-none opacity-60">
              <div class="flex items-end justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(outroRef.duration || 0)"
                  :key="i"
                  class="bg-[#5eead4] flex-shrink-0"
                  :style="{ height: getWaveformHeight(i - 1, duration - outroOffset, outroRef.duration || 0), width: getBarWidth() }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grouped Audio Tracks -->
      <div
        v-for="(trackGroup, index) in visualGroupedAudioTracks"
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
            class="absolute top-1 h-10 rounded border transition-all ease-in-out flex items-center px-2 overflow-hidden hover:border-white/40 hover:z-[1] bg-gradient-to-br from-cyan-500/30 to-cyan-500/20 border-cyan-500/40"
            :class="{ 
              'ring-2 ring-sky-500 ring-offset-1 ring-offset-[var(--editor-bg)] z-[2]': selectedItem?.id === audioTrack.id,
              'cursor-grabbing': isDraggingAudioSegment && draggingSegmentId === audioTrack.id,
              'cursor-grab': !isDraggingAudioSegment,
              'duration-0': isDraggingAudioSegment && draggingSegmentId === audioTrack.id
            }"
            :style="getAudioSegmentStyle(audioTrack)"
            @click.stop="selectItem(audioTrack, 'audio')"
            @mousedown="(e) => startAudioSegmentDrag(e, audioTrack)"
          >
            <span class="text-[0.75rem] font-medium text-white/90 whitespace-nowrap overflow-hidden text-ellipsis relative z-[1]">{{ audioTrack.name }}</span>
            
            <!-- Audio waveform -->
            <div class="absolute inset-0 flex items-end py-1 pointer-events-none opacity-60">
              <div class="flex items-end justify-between gap-[1px] w-full h-full px-1">
                <div
                  v-for="i in getWaveformBars(audioTrack.end_time - audioTrack.start_time)"
                  :key="i"
                  class="bg-[#5eead4] flex-shrink-0"
                  :style="{ height: getAudioWaveformHeight(audioTrack.id, i - 1, audioTrack.start_time, audioTrack.end_time - audioTrack.start_time), width: getBarWidth() }"
                ></div>
              </div>
            </div>
            
            <!-- Mute/Solo indicators -->
            <div class="flex gap-1 ml-auto pl-2">
              <span v-if="audioTrack.is_muted" class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] text-[0.625rem] font-bold tracking-wider bg-zinc-600 text-white border border-zinc-500">M</span>
              <span v-if="audioTrack.is_solo" class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-[3px] text-[0.625rem] font-bold tracking-wider bg-sky-500 text-white border border-sky-400">S</span>
            </div>
            
            <!-- Fade In Overlay (always rendered, width changes with fade value) -->
            <div
              class="absolute left-0 top-0 bottom-0 pointer-events-none z-[3]"
              :style="`width: ${renderFadeOverlay(getEffectiveFadeIn(audioTrack.id, audioTrack.fade_in), getEffectiveFadeOut(audioTrack.id, audioTrack.fade_out), audioTrack.end_time - audioTrack.start_time).fadeInWidth}`"
            >
              <div v-if="getEffectiveFadeIn(audioTrack.id, audioTrack.fade_in) > 0" class="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
            </div>
            
            <!-- Fade In Handle (positioned at end of fade overlay, or left corner if no fade) -->
            <div
              class="absolute bottom-0 w-4 h-4 cursor-ew-resize pointer-events-auto z-[4]"
              :class="{ 'bg-cyan-400': activeFadeHandle?.itemId === audioTrack.id && activeFadeHandle?.type === 'fadeIn', 'bg-white/30 hover:bg-white/50': !(activeFadeHandle?.itemId === audioTrack.id && activeFadeHandle?.type === 'fadeIn') }"
              :style="getEffectiveFadeIn(audioTrack.id, audioTrack.fade_in) > 0 
                ? `left: ${renderFadeOverlay(getEffectiveFadeIn(audioTrack.id, audioTrack.fade_in), getEffectiveFadeOut(audioTrack.id, audioTrack.fade_out), audioTrack.end_time - audioTrack.start_time).fadeInWidth}; transform: translateX(-100%); clip-path: polygon(100% 0, 0 0, 0 100%); border-bottom-left-radius: 4px;`
                : 'left: 0; clip-path: polygon(100% 0, 0 0, 0 100%); border-bottom-left-radius: 4px;'"
              @mousedown.stop="(e) => startFadeDrag(e, audioTrack.id, 'fadeIn', 'audio', audioTrack.fade_in, audioTrack.fade_out, audioTrack.end_time - audioTrack.start_time)"
              title="Drag to adjust fade in"
            ></div>
            
            <!-- Fade Out Overlay (always rendered, width changes with fade value) -->
            <div
              class="absolute right-0 top-0 bottom-0 pointer-events-none z-[3]"
              :style="`width: ${renderFadeOverlay(getEffectiveFadeIn(audioTrack.id, audioTrack.fade_in), getEffectiveFadeOut(audioTrack.id, audioTrack.fade_out), audioTrack.end_time - audioTrack.start_time).fadeOutWidth}`"
            >
              <div v-if="getEffectiveFadeOut(audioTrack.id, audioTrack.fade_out) > 0" class="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent"></div>
            </div>
            
            <!-- Fade Out Handle (positioned at start of fade out overlay, or right corner if no fade) -->
            <div
              class="absolute bottom-0 w-4 h-4 cursor-ew-resize pointer-events-auto z-[4]"
              :class="{ 'bg-cyan-400': activeFadeHandle?.itemId === audioTrack.id && activeFadeHandle?.type === 'fadeOut', 'bg-white/30 hover:bg-white/50': !(activeFadeHandle?.itemId === audioTrack.id && activeFadeHandle?.type === 'fadeOut') }"
              :style="getEffectiveFadeOut(audioTrack.id, audioTrack.fade_out) > 0
                ? `right: ${renderFadeOverlay(getEffectiveFadeIn(audioTrack.id, audioTrack.fade_in), getEffectiveFadeOut(audioTrack.id, audioTrack.fade_out), audioTrack.end_time - audioTrack.start_time).fadeOutWidth}; transform: translateX(100%); clip-path: polygon(0 0, 100% 0, 100% 100%); border-bottom-right-radius: 4px;`
                : 'right: 0; clip-path: polygon(0 0, 100% 0, 100% 100%); border-bottom-right-radius: 4px;'"
              @mousedown.stop="(e) => startFadeDrag(e, audioTrack.id, 'fadeOut', 'audio', audioTrack.fade_in, audioTrack.fade_out, audioTrack.end_time - audioTrack.start_time)"
              title="Drag to adjust fade out"
            ></div>
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
  useTimelineSegmentStyles,
  useTimelineFadeHandles,
  useAudioSegmentDrag,
  useVideoSourceDrag,
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
  (e: 'updateFade', payload: { itemId: string; itemType: 'audio' | 'video'; fadeIn: number; fadeOut: number }): void;
  (e: 'tempFadeValuesUpdate', values: Record<string, { fadeIn: number; fadeOut: number }>): void;
  (e: 'reload'): void;
}>();

// Scroll container ref
const tracksContainer = ref<HTMLElement | null>(null);

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

// Calculate the number of video track layers based on order_index
const videoTrackLayers = computed(() => {
  if (!props.videoSources || props.videoSources.length === 0) return 1;
  
  // Find the maximum order_index to determine how many layers we need
  const maxOrderIndex = Math.max(...props.videoSources.map((s: any) => s.order_index || 0));
  
  // Add 1 because order_index is 0-based, and ensure at least 1 layer
  return Math.max(1, maxOrderIndex + 1);
});

// Group video sources by track layer (order_index) for rendering separate lanes
const groupedVideoTracks = computed(() => {
  if (!props.videoSources || props.videoSources.length === 0) {
    return [{ trackIndex: 0, visualIndex: 0, sources: [] }];
  }

  // Group sources by order_index
  const groups: Record<number, any[]> = {};
  props.videoSources.forEach((source: any) => {
    const trackIndex = source.order_index ?? 0;
    if (!groups[trackIndex]) {
      groups[trackIndex] = [];
    }
    groups[trackIndex].push(source);
  });

  // Find max order_index
  const maxOrderIndex = Math.max(...Object.keys(groups).map(Number), 0);
  
  // Create array with all tracks from 0 to maxOrderIndex (fill gaps)
  const result = [];
  for (let i = 0; i <= maxOrderIndex; i++) {
    result.push({
      trackIndex: i,
      visualIndex: maxOrderIndex - i, // Invert for visual ordering (higher index = visually above)
      sources: groups[i] || [], // Empty array if no sources on this track
    });
  }
  
  // Sort by visual index (top to bottom)
  return result.sort((a, b) => a.visualIndex - b.visualIndex);
});

// Calculate video track height based on number of layers
const videoTrackHeight = computed(() => {
  const TRACK_HEIGHT = 48;
  const PADDING = 16; // Top and bottom padding
  return videoTrackLayers.value * TRACK_HEIGHT + PADDING;
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
  getBarWidth,
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

// Fade handles composable
const {
  isDraggingFade,
  activeFadeHandle,
  tempFadeValues,
  startFadeDrag,
  renderFadeOverlay,
} = useTimelineFadeHandles({
  pixelsPerSecond,
  onFadeUpdate: (itemId, itemType, fadeIn, fadeOut) => {
    emit('updateFade', { itemId, itemType, fadeIn, fadeOut });
  },
});

// Audio segment drag composable
const {
  isDragging: isDraggingAudioSegment,
  draggingSegmentId,
  dragOffset,
  dragOffsetY,
  targetTrackOrder,
  startDragging: startAudioSegmentDrag,
  getSegmentVisualPosition,
} = useAudioSegmentDrag({
  containerRef: tracksContainer,
  scrollLeft,
  pixelsPerSecond,
  audioTracks,
  onDragComplete: async () => {
    emit('reload');
  },
});

// Video source drag composable
const {
  isDragging: isDraggingVideoSource,
  dragOffset: videoSourceDragOffset,
  dragOffsetY: videoSourceDragOffsetY,
  targetTrackIndex: videoSourceTargetTrack,
  draggingSource: draggingVideoSource,
  startDragging: startVideoSourceDrag,
  getSourceVisualPosition,
} = useVideoSourceDrag({
  videoSources: computed(() => (props.videoSources || []) as any[]),
  pixelsPerSecond,
  onDragComplete: () => {
    emit('reload');
  },
});

// Computed map of effective fade values for all tracks
const effectiveFadeValues = computed(() => {
  const result: Record<string, { fadeIn: number; fadeOut: number }> = {};
  
  // Start with actual values from all audio tracks
  audioTracks.value.forEach(track => {
    result[track.id] = {
      fadeIn: track.fade_in,
      fadeOut: track.fade_out,
    };
  });
  
  // Override with temp values during drag
  Object.keys(tempFadeValues.value).forEach(trackId => {
    if (tempFadeValues.value[trackId]) {
      result[trackId] = tempFadeValues.value[trackId];
    }
  });
  
  return result;
});

// Watch tempFadeValues and emit to parent so inspector can update in real-time
watch(tempFadeValues, (newValues) => {
  emit('tempFadeValuesUpdate', newValues);
}, { deep: true });

// Helper to get effective fade values (temp during drag, actual otherwise)
function getEffectiveFadeIn(trackId: string, actualFadeIn: number): number {
  return effectiveFadeValues.value[trackId]?.fadeIn ?? actualFadeIn;
}

function getEffectiveFadeOut(trackId: string, actualFadeOut: number): number {
  return effectiveFadeValues.value[trackId]?.fadeOut ?? actualFadeOut;
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

// Wrapper for audio track waveform height that looks up file path by ID
function getAudioWaveformHeight(audioTrackId: string, index: number, startTime: number, segmentDuration: number): string {
  const audioTrack = audioTracks.value.find(t => t.id === audioTrackId);
  if (!audioTrack) return '50%';
  return getAudioWaveformHeightFromPath(audioTrack.file_path, index, startTime, segmentDuration);
}

// Get segment style with drag offset for real-time visual feedback
function getAudioSegmentStyle(audioTrack: any): Record<string, string> {
  const visualStartTime = getSegmentVisualPosition(audioTrack.id, audioTrack.start_time);
  const duration = audioTrack.end_time - audioTrack.start_time;
  const baseStyle = getSegmentStyle(visualStartTime, duration);
  
  // Add vertical transform if this segment is being dragged
  if (isDraggingAudioSegment.value && draggingSegmentId.value === audioTrack.id) {
    return {
      ...baseStyle,
      transform: `translateY(${dragOffsetY.value}px)`,
      zIndex: '10', // Ensure dragged segment is on top
    };
  }
  
  return baseStyle;
}

// Get video source style with drag offset for real-time visual feedback
function getVideoSourceStyle(source: any): Record<string, string> {
  const isBeingDragged = isDraggingVideoSource.value && draggingVideoSource.value?.id === source.id;
  
  // Calculate horizontal position with drag offset
  const visualStartTime = isBeingDragged 
    ? source.start_time + (videoSourceDragOffset.value / pixelsPerSecond.value)
    : source.start_time;
  
  const duration = source.end_time - source.start_time;
  const baseStyle = getSegmentStyle(visualStartTime, duration);
  
  // Add vertical transform if this source is being dragged
  if (isBeingDragged) {
    return {
      ...baseStyle,
      transform: `translateY(${videoSourceDragOffsetY.value}px)`,
      zIndex: '10', // Ensure dragged source is on top
    };
  }
  
  return baseStyle;
}

// Check if a segment should be rendered on a specific track during drag
function shouldRenderSegmentOnTrack(audioTrack: any, trackOrder: number): boolean {
  // If segment is being dragged, render it on the target track
  if (isDraggingAudioSegment.value && draggingSegmentId.value === audioTrack.id) {
    return targetTrackOrder.value === trackOrder;
  }
  // Otherwise, render on its actual track
  return audioTrack.track_order === trackOrder;
}

// Get the visual grouped tracks (accounts for dragging to new tracks)
const visualGroupedAudioTracks = computed(() => {
  // Start with existing grouped tracks
  const groups = [...groupedAudioTracks.value];
  
  // If dragging and target track doesn't exist, add a placeholder
  if (isDraggingAudioSegment.value && targetTrackOrder.value >= groups.length) {
    // Add empty tracks up to the target track
    for (let i = groups.length; i <= targetTrackOrder.value; i++) {
      groups.push({
        order: i,
        segments: []
      });
    }
  }
  
  // Redistribute segments based on drag state
  return groups.map(group => ({
    ...group,
    segments: audioTracks.value.filter(track => shouldRenderSegmentOnTrack(track, group.order))
  }));
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

