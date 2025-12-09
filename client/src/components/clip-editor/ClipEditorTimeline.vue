<template>
  <div class="bg-gradient-to-t from-[#0a0a0a]/50 to-[#0a0a0a]/20 transition-all duration-300 ease-in-out">
    <div class="pt-3 px-4 pb-3 flex flex-col">
      <!-- Timeline Header -->
      <div class="flex items-center justify-between mb-3 pr-1 flex-shrink-0">
        <div class="flex items-center gap-2">
          <!-- Timeline Toolbar -->
          <!-- Zoom Slider -->
          <div
            class="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-2 border border-white/[0.04]"
          >
            <ZoomIn :size="14" class="text-white/40" />
            <input
              type="range"
              :min="1"
              :max="5"
              :step="0.1"
              v-model.number="zoomLevel"
              class="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer slider-zoom"
            />
            <span class="text-[10px] text-white/50 text-right font-mono tabular-nums w-8">
              {{ Math.round(zoomLevel * 100) }}%
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Show segment count if multiple segments -->
          <span
            v-if="sortedTrimSegments.length > 1"
            class="text-[10px] text-violet-400/70 bg-violet-500/10 px-2 py-1 rounded-md"
          >
            {{ sortedTrimSegments.length }} segments
          </span>
          <span class="text-[10px] text-white/40 bg-white/[0.04] px-2 py-1 rounded-md">
            {{ formatTime(totalDuration) }}
          </span>
        </div>
      </div>

      <!-- Timeline Tracks Container -->
      <div
        ref="timelineScrollContainer"
        class="pr-1 bg-[#101010] border border-white/[0.04] rounded-lg relative overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 backdrop-blur-sm"
        @mousemove="onTimelineMouseMove"
        @mouseleave="onTimelineMouseLeave"
      >
        <!-- Timeline Content Wrapper - handles zoom width -->
        <div
          ref="contentWrapperRef"
          class="timeline-content-wrapper relative"
          :class="{ dragging: isDragging || isResizing }"
          :style="{ width: `${100 * zoomLevel}%`, minHeight: '100%' }"
        >
          <!-- Segmented Timestamp Ruler -->
          <div
            class="h-8 border-b border-border/30 flex items-center bg-[#0a0a0a]/40 px-2 sticky top-0 z-50 backdrop-blur-sm timeline-ruler"
          >
            <!-- Track label spacer -->
            <div class="w-16 pr-2 flex items-center justify-center flex-shrink-0">
              <span class="text-xs text-muted-foreground/50 font-medium">Time</span>
            </div>
            <!-- Segmented timestamp ruler -->
            <div
              ref="rulerContentRef"
              class="flex-1 relative h-full flex items-center cursor-pointer"
              @click="onRulerClick"
            >
              <!-- Render each segment region in the ruler -->
              <template v-for="(segmentLayout, index) in segmentLayouts" :key="segmentLayout.segment.id">
                <!-- Segment region with ticks -->
                <div
                  class="absolute h-full"
                  :style="{
                    left: `${segmentLayout.startPercent}%`,
                    width: `${segmentLayout.widthPercent}%`,
                  }"
                >
                  <!-- Segment start time (always shown) -->
                  <div
                    class="absolute flex flex-col items-center"
                    :style="{ left: '0%', transform: 'translateX(-50%)', bottom: '0' }"
                  >
                    <div class="w-px bg-violet-400/60 h-4"></div>
                    <span class="text-[10px] text-violet-400/80 whitespace-nowrap font-medium mt-0.5">
                      {{ formatTime(clipStart + segmentLayout.segment.startTime) }}
                    </span>
                  </div>

                  <!-- Intermediate tick marks within segment -->
                  <div
                    v-for="tick in segmentLayout.ticks"
                    :key="tick.time"
                    class="absolute flex flex-col items-center"
                    :style="{ left: `${tick.positionInSegment}%`, transform: 'translateX(-50%)', bottom: '0' }"
                  >
                    <div class="w-px bg-foreground/20 timeline-tick" :class="tick.isMajor ? 'h-4' : 'h-2'"></div>
                    <span
                      v-if="tick.isMajor"
                      class="text-[10px] text-foreground/40 whitespace-nowrap font-normal mt-0.5"
                    >
                      {{ formatTime(clipStart + tick.time) }}
                    </span>
                  </div>

                  <!-- Segment end time (always shown) -->
                  <div
                    class="absolute flex flex-col items-center"
                    :style="{ left: '100%', transform: 'translateX(-50%)', bottom: '0' }"
                  >
                    <div class="w-px bg-violet-400/60 h-4"></div>
                    <span class="text-[10px] text-violet-400/80 whitespace-nowrap font-medium mt-0.5">
                      {{ formatTime(clipStart + segmentLayout.segment.endTime) }}
                    </span>
                  </div>
                </div>

                <!-- Gap indicator between segments -->
                <div
                  v-if="index < segmentLayouts.length - 1"
                  class="absolute h-full flex items-center justify-center bg-orange-500/5"
                  :style="{
                    left: `${segmentLayout.startPercent + segmentLayout.widthPercent}%`,
                    width: `${GAP_PERCENT}%`,
                  }"
                >
                  <div class="flex flex-col items-center">
                    <Scissors :size="12" class="text-orange-400/70" />
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Video Track -->
          <div class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-40 bg-[#101010] backdrop-blur-sm flex-shrink-0"
            >
              <div>
                <div class="font-medium flex items-center gap-1">
                  <Film :size="12" />
                  Video
                </div>
              </div>
            </div>
            <div ref="videoTrackContentRef" class="flex-1 h-8 relative" @click="onTrackContentClick">
              <!-- Background -->
              <div class="absolute inset-0 bg-[#0a0a0a]/50 rounded-md cursor-pointer"></div>

              <!-- Render each segment with waveform -->
              <template v-for="(segmentLayout, index) in segmentLayouts" :key="segmentLayout.segment.id">
                <!-- Segment with waveform -->
                <div
                  :ref="(el) => setSegmentRef(el, 'trim', segmentLayout.segment.id)"
                  class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group cursor-pointer"
                  :class="getSegmentClasses('trim', segmentLayout.segment.id, segmentLayout.segment.isDeleted)"
                  :style="getSegmentLayoutStyle(segmentLayout, 'violet', 'trim', segmentLayout.segment.id)"
                  @mousedown="(e) => onSegmentMouseDown(e, 'trim', segmentLayout.segment.id, segmentLayout.segment)"
                  @click.stop="(e) => onSegmentClick(e, segmentLayout.segment)"
                >
                  <!-- Segment background gradient -->
                  <div class="absolute inset-0 bg-gradient-to-r from-violet-900/30 to-indigo-900/20"></div>

                  <!-- Waveform canvas for this segment -->
                  <canvas
                    :ref="(el) => setWaveformCanvasRef(el, segmentLayout.segment.id)"
                    class="absolute inset-0 w-full h-full pointer-events-none"
                    style="mix-blend-mode: normal; z-index: 5"
                  ></canvas>

                  <!-- Segment label -->
                  <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <span class="text-xs text-white/80 font-medium drop-shadow-sm bg-black/20 px-1.5 py-0.5 rounded">
                      {{ formatTime(clipStart + segmentLayout.segment.startTime) }} -
                      {{ formatTime(clipStart + segmentLayout.segment.endTime) }}
                    </span>
                  </div>

                  <!-- Left resize handle -->
                  <div
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="
                      (e) => onResizeMouseDown(e, 'trim', segmentLayout.segment.id, 'left', segmentLayout.segment)
                    "
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle -->
                  <div
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="
                      (e) => onResizeMouseDown(e, 'trim', segmentLayout.segment.id, 'right', segmentLayout.segment)
                    "
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>

                <!-- Gap indicator between segments on video track -->
                <div
                  v-if="index < segmentLayouts.length - 1"
                  class="absolute top-1 bottom-1 flex items-center justify-center"
                  :style="{
                    left: `${segmentLayout.startPercent + segmentLayout.widthPercent}%`,
                    width: `${GAP_PERCENT}%`,
                  }"
                >
                  <div
                    class="w-full h-full bg-orange-500/5 border-x border-dashed border-orange-400/30 flex items-center justify-center"
                  >
                    <Scissors :size="12" class="text-orange-400/40" />
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Audio Tracks -->
          <div
            v-for="track in audioTracks"
            :key="track.id"
            class="flex items-center h-12 px-2 border-b border-border/20 relative"
          >
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-40 bg-[#101010] backdrop-blur-sm flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1 truncate">
                <Music :size="12" />
                <span class="truncate max-w-[40px]">{{ track.name }}</span>
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                :ref="(el) => setSegmentRef(el, 'audio', track.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                :class="getSegmentClasses('audio', track.id)"
                :style="getSegmentStyle(track.startTime, track.endTime, 'emerald', 'audio', track.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'audio', track.id, track)"
                @click.stop="selectItem('audio', track.id)"
              >
                <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                  {{ track.name }}
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'audio', track.id, 'left', track)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'audio', track.id, 'right', track)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Text Overlays Track -->
          <div v-if="textOverlays.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-40 bg-[#101010] backdrop-blur-sm flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Type :size="12" />
                Text
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="overlay in textOverlays"
                :key="overlay.id"
                :ref="(el) => setSegmentRef(el, 'text', overlay.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                :class="getSegmentClasses('text', overlay.id)"
                :style="getSegmentStyle(overlay.startTime, overlay.endTime, 'amber', 'text', overlay.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'text', overlay.id, overlay)"
                @click.stop="selectItem('text', overlay.id)"
              >
                <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                  {{ overlay.text }}
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'text', overlay.id, 'left', overlay)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'text', overlay.id, 'right', overlay)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Stickers Track -->
          <div v-if="stickers.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-40 bg-[#101010] backdrop-blur-sm flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Smile :size="12" />
                Stickers
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="sticker in stickers"
                :key="sticker.id"
                :ref="(el) => setSegmentRef(el, 'sticker', sticker.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center justify-center group"
                :class="getSegmentClasses('sticker', sticker.id)"
                :style="getSegmentStyle(sticker.startTime, sticker.endTime, 'pink', 'sticker', sticker.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'sticker', sticker.id, sticker)"
                @click.stop="selectItem('sticker', sticker.id)"
              >
                <span v-if="sticker.stickerType === 'emoji'" class="text-sm pointer-events-none">
                  {{ sticker.stickerPath }}
                </span>
                <span v-else class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm pointer-events-none">
                  Sticker
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'sticker', sticker.id, 'left', sticker)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'sticker', sticker.id, 'right', sticker)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Effects Track -->
          <div v-if="effects.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-40 bg-[#101010] backdrop-blur-sm flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Sparkles :size="12" />
                Effects
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="effect in effects"
                :key="effect.id"
                :ref="(el) => setSegmentRef(el, 'effect', effect.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                :class="getSegmentClasses('effect', effect.id)"
                :style="getSegmentStyle(effect.startTime, effect.endTime, 'cyan', 'effect', effect.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'effect', effect.id, effect)"
                @click.stop="selectItem('effect', effect.id)"
              >
                <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm capitalize pointer-events-none">
                  {{ effect.type }}
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'effect', effect.id, 'left', effect)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'effect', effect.id, 'right', effect)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Playhead Line (inside content wrapper so it scrolls with content) -->
          <div
            v-if="totalDuration > 0"
            class="absolute top-0 bottom-0 z-[60] cursor-ew-resize group"
            :class="{ 'cursor-grabbing': isDraggingPlayhead }"
            :style="{
              left: `calc(72px + (100% - 80px) * ${playheadPosition})`,
              width: '12px',
              marginLeft: '-6px',
            }"
            @mousedown="onPlayheadMouseDown"
          >
            <div class="absolute inset-x-[5px] inset-y-0 bg-white/80 shadow-lg group-hover:bg-white transition-colors">
              <!-- Top circle -->
              <div
                class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md group-hover:scale-110 transition-transform"
              ></div>
              <!-- Bottom circle -->
              <div
                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/80 rounded-full shadow-md group-hover:scale-110 transition-transform"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { ZoomIn, Film, Music, Type, Smile, Sparkles, Scissors } from 'lucide-vue-next';
  import { useAudioWaveform } from '@/composables/useAudioWaveform';
  import type { TrimSegment, AudioTrack, TextOverlay, Sticker, Effect } from '@/types';

  type ItemType = 'trim' | 'audio' | 'text' | 'sticker' | 'effect';

  interface DragInfo {
    type: ItemType;
    id: string;
    item: any;
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
    trackContentWidth: number;
  }

  interface ResizeInfo {
    type: ItemType;
    id: string;
    handle: 'left' | 'right';
    item: any;
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
    trackContentWidth: number;
  }

  interface SegmentTick {
    time: number;
    positionInSegment: number;
    isMajor: boolean;
  }

  interface SegmentLayout {
    segment: TrimSegment;
    startPercent: number;
    widthPercent: number;
    ticks: SegmentTick[];
  }

  // Gap percentage between segments
  const GAP_PERCENT = 2;

  const props = defineProps<{
    duration: number;
    currentTime: number;
    clipStart: number;
    clipEnd: number;
    trimSegments: TrimSegment[];
    audioTracks: AudioTrack[];
    textOverlays: TextOverlay[];
    stickers: Sticker[];
    effects: Effect[];
    videoSrc?: string;
  }>();

  const emit = defineEmits<{
    (e: 'seek', time: number): void;
    (e: 'updateTrimSegment', segmentId: string, startTime: number, endTime: number): void;
    (e: 'updateAudioTrack', trackId: string, updates: Partial<AudioTrack>): void;
    (e: 'updateTextOverlay', overlayId: string, updates: Partial<TextOverlay>): void;
    (e: 'updateSticker', stickerId: string, updates: Partial<Sticker>): void;
    (e: 'updateEffect', effectId: string, updates: Partial<Effect>): void;
  }>();

  // Refs
  const timelineScrollContainer = ref<HTMLElement | null>(null);
  const contentWrapperRef = ref<HTMLElement | null>(null);
  const rulerContentRef = ref<HTMLElement | null>(null);
  const videoTrackContentRef = ref<HTMLElement | null>(null);
  const segmentRefs = ref<Map<string, HTMLElement>>(new Map());
  const waveformCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map());
  const zoomLevel = ref(1);

  // Selection state
  const selectedItemKey = ref<string | null>(null);

  // Drag state
  const isDragging = ref(false);
  const dragInfo = ref<DragInfo | null>(null);

  // Resize state
  const isResizing = ref(false);
  const resizeInfo = ref<ResizeInfo | null>(null);

  // Playhead drag state
  const isDraggingPlayhead = ref(false);

  // Audio waveform
  const { waveformData, isLoaded: isWaveformLoaded, loadWaveformFromVideo } = useAudioWaveform();

  // Resize observer for waveform canvases
  let resizeObserver: ResizeObserver | null = null;

  // Color mappings
  const colorMap: Record<string, { bg: string; border: string }> = {
    violet: { bg: 'rgba(139, 92, 246, 0.4), rgba(139, 92, 246, 0.5)', border: 'rgba(139, 92, 246, 0.6)' },
    emerald: { bg: 'rgba(16, 185, 129, 0.4), rgba(16, 185, 129, 0.5)', border: 'rgba(16, 185, 129, 0.6)' },
    amber: { bg: 'rgba(245, 158, 11, 0.4), rgba(245, 158, 11, 0.5)', border: 'rgba(245, 158, 11, 0.6)' },
    pink: { bg: 'rgba(236, 72, 153, 0.4), rgba(236, 72, 153, 0.5)', border: 'rgba(236, 72, 153, 0.6)' },
    cyan: { bg: 'rgba(6, 182, 212, 0.4), rgba(6, 182, 212, 0.5)', border: 'rgba(6, 182, 212, 0.6)' },
  };

  // Sorted trim segments by start time - creates a default segment if none exist
  const sortedTrimSegments = computed(() => {
    const existingSegments = [...props.trimSegments]
      .filter((s) => !s.isDeleted)
      .sort((a, b) => a.startTime - b.startTime);

    // If no segments exist, create a default segment spanning the full clip duration
    // Note: Timeline works with relative times (0 to duration), not absolute source times
    if (existingSegments.length === 0 && props.duration > 0) {
      return [
        {
          id: 'default-segment',
          startTime: 0,
          endTime: props.duration,
          isDeleted: false,
        },
      ];
    }

    return existingSegments;
  });

  // Calculate total duration of all segments
  const totalDuration = computed(() => {
    const segmentDuration = sortedTrimSegments.value.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
    // Fallback to prop duration if no segments
    return segmentDuration > 0 ? segmentDuration : props.duration;
  });

  // Calculate segment layouts with gaps
  const segmentLayouts = computed((): SegmentLayout[] => {
    const segments = sortedTrimSegments.value;
    if (segments.length === 0) return [];

    const totalSegmentDuration = totalDuration.value;
    if (totalSegmentDuration <= 0) return [];

    // Calculate total gap percentage
    const totalGapPercent = (segments.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    const layouts: SegmentLayout[] = [];
    let currentPercent = 0;

    segments.forEach((segment, index) => {
      const segmentDuration = segment.endTime - segment.startTime;
      const widthPercent = (segmentDuration / totalSegmentDuration) * availablePercent;

      // Generate ticks for this segment - similar to main timeline
      const ticks: SegmentTick[] = [];

      // Determine optimal intervals based on segment duration and zoom
      let majorInterval: number;
      let minorInterval: number;
      const effectiveDuration = segmentDuration / zoomLevel.value;

      if (effectiveDuration < 10) {
        majorInterval = 2;
        minorInterval = 1;
      } else if (effectiveDuration < 30) {
        majorInterval = 5;
        minorInterval = 1;
      } else if (effectiveDuration < 120) {
        majorInterval = 10;
        minorInterval = 5;
      } else if (effectiveDuration < 600) {
        majorInterval = 30;
        minorInterval = 10;
      } else {
        majorInterval = 60;
        minorInterval = 20;
      }

      // Generate intermediate ticks (excluding exact start and end times which are shown separately)
      // Round to nearest interval for cleaner numbers
      const startTick = Math.ceil(segment.startTime / minorInterval) * minorInterval;

      for (let t = startTick; t < segment.endTime; t += minorInterval) {
        // Skip if too close to start or end (within 0.5 seconds)
        if (Math.abs(t - segment.startTime) < 0.5 || Math.abs(t - segment.endTime) < 0.5) {
          continue;
        }

        const posInSegment = ((t - segment.startTime) / segmentDuration) * 100;
        // Only include ticks in the middle of the segment (not at edges)
        if (posInSegment > 2 && posInSegment < 98) {
          ticks.push({
            time: t,
            positionInSegment: posInSegment,
            isMajor: t % majorInterval === 0,
          });
        }
      }

      layouts.push({
        segment,
        startPercent: currentPercent,
        widthPercent,
        ticks,
      });

      currentPercent += widthPercent;
      if (index < segments.length - 1) {
        currentPercent += GAP_PERCENT;
      }
    });

    return layouts;
  });

  // Convert current time to playhead position (0-1)
  const playheadPosition = computed(() => {
    if (totalDuration.value <= 0) return 0;

    // Find which segment the current time falls into
    let accumulatedTime = 0;
    let accumulatedPercent = 0;
    const totalGapPercent = (sortedTrimSegments.value.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    for (let i = 0; i < sortedTrimSegments.value.length; i++) {
      const segment = sortedTrimSegments.value[i];
      const segmentDuration = segment.endTime - segment.startTime;
      const segmentWidthPercent = (segmentDuration / totalDuration.value) * availablePercent;

      if (props.currentTime >= segment.startTime && props.currentTime <= segment.endTime) {
        // Current time is within this segment
        const timeIntoSegment = props.currentTime - segment.startTime;
        const percentIntoSegment = (timeIntoSegment / segmentDuration) * segmentWidthPercent;
        return (accumulatedPercent + percentIntoSegment) / 100;
      }

      accumulatedPercent += segmentWidthPercent;
      if (i < sortedTrimSegments.value.length - 1) {
        accumulatedPercent += GAP_PERCENT;
      }
      accumulatedTime += segmentDuration;
    }

    // If not in any segment, clamp to end
    return 1;
  });

  // Calculate height based on number of tracks
  const calculatedHeight = computed(() => {
    const headerHeight = 44; // Timeline header with toolbar
    const rulerHeight = 32; // Timestamp ruler
    const videoTrackHeight = 48; // Video track
    const otherTrackHeight = 48; // Other tracks (audio, text, etc.)
    const padding = 16; // Bottom padding

    const otherTracksCount =
      props.audioTracks.length +
      (props.textOverlays.length > 0 ? 1 : 0) +
      (props.stickers.length > 0 ? 1 : 0) +
      (props.effects.length > 0 ? 1 : 0);

    return headerHeight + rulerHeight + videoTrackHeight + otherTracksCount * otherTrackHeight + padding;
  });

  // Methods
  function formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function setSegmentRef(el: any, type: ItemType, id: string) {
    if (el) {
      segmentRefs.value.set(`${type}_${id}`, el);
    }
  }

  function setWaveformCanvasRef(el: any, segmentId: string) {
    if (el) {
      waveformCanvasRefs.value.set(segmentId, el as HTMLCanvasElement);
    }
  }

  function selectItem(type: ItemType, id: string) {
    selectedItemKey.value = `${type}_${id}`;
  }

  function getSegmentClasses(type: ItemType, id: string, isDeleted?: boolean): string[] {
    const classes: string[] = [];
    const key = `${type}_${id}`;

    if (isDragging.value && dragInfo.value?.type === type && dragInfo.value?.id === id) {
      classes.push('cursor-grabbing', 'z-30', 'shadow-2xl', 'border-2', 'border-blue-400', 'dragging');
    } else if (isResizing.value && resizeInfo.value?.type === type && resizeInfo.value?.id === id) {
      classes.push('cursor-ew-resize', 'z-30', 'shadow-2xl', 'border-2', 'border-green-400', 'resizing');
    } else {
      classes.push('cursor-grab', 'hover:cursor-grab', 'transition-all', 'duration-200', 'ease-out');
    }

    if (isDeleted) {
      classes.push('opacity-30');
    }

    if (selectedItemKey.value === key) {
      classes.push('ring-2', 'ring-blue-400', 'ring-offset-1', 'ring-offset-transparent', 'selected-segment');
    }

    return classes;
  }

  function getSegmentLayoutStyle(
    layout: SegmentLayout,
    color: string,
    type: ItemType,
    id: string
  ): Record<string, string> {
    const colors = colorMap[color] || colorMap.violet;
    const isSelected = selectedItemKey.value === `${type}_${id}`;

    return {
      left: `${layout.startPercent}%`,
      width: `${layout.widthPercent}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  function getSegmentStyle(
    startTime: number,
    endTime: number,
    color: string,
    type: ItemType,
    id: string
  ): Record<string, string> {
    const colors = colorMap[color] || colorMap.violet;
    const isSelected = selectedItemKey.value === `${type}_${id}`;

    // For non-trim segments, use the total duration for positioning
    const effectiveDuration = totalDuration.value || props.duration;

    return {
      left: `${(startTime / effectiveDuration) * 100}%`,
      width: `${Math.max(((endTime - startTime) / effectiveDuration) * 100, 1)}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  function getTrackContentWidth(): number {
    if (rulerContentRef.value) {
      return rulerContentRef.value.getBoundingClientRect().width;
    }
    if (videoTrackContentRef.value) {
      return videoTrackContentRef.value.getBoundingClientRect().width;
    }
    if (contentWrapperRef.value) {
      return contentWrapperRef.value.getBoundingClientRect().width - 64 - 16;
    }
    return 500;
  }

  // Convert click position to source time
  function clickPositionToTime(percent: number): number {
    const totalGapPercent = (sortedTrimSegments.value.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    let accumulatedPercent = 0;

    for (let i = 0; i < sortedTrimSegments.value.length; i++) {
      const segment = sortedTrimSegments.value[i];
      const segmentDuration = segment.endTime - segment.startTime;
      const segmentWidthPercent = (segmentDuration / totalDuration.value) * availablePercent;

      const segmentEndPercent = accumulatedPercent + segmentWidthPercent;

      if (percent * 100 >= accumulatedPercent && percent * 100 <= segmentEndPercent) {
        // Click is within this segment
        const percentIntoSegment = (percent * 100 - accumulatedPercent) / segmentWidthPercent;
        return segment.startTime + percentIntoSegment * segmentDuration;
      }

      // Check if click is in gap
      if (i < sortedTrimSegments.value.length - 1) {
        const gapEndPercent = segmentEndPercent + GAP_PERCENT;
        if (percent * 100 > segmentEndPercent && percent * 100 < gapEndPercent) {
          // Click is in gap, return end of current segment
          return segment.endTime;
        }
      }

      accumulatedPercent = segmentEndPercent + (i < sortedTrimSegments.value.length - 1 ? GAP_PERCENT : 0);
    }

    // Default to last segment end
    const lastSegment = sortedTrimSegments.value[sortedTrimSegments.value.length - 1];
    return lastSegment?.endTime || 0;
  }

  function onTrackContentClick(e: MouseEvent) {
    selectedItemKey.value = null;

    const trackContent = e.currentTarget as HTMLElement;
    const rect = trackContent.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onRulerClick(e: MouseEvent) {
    const ruler = e.currentTarget as HTMLElement;
    const rect = ruler.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onSegmentClick(e: MouseEvent, segment: TrimSegment) {
    // Select the segment
    selectItem('trim', segment.id);

    // Also seek to the clicked position within the segment
    const segmentEl = e.currentTarget as HTMLElement;
    const rect = segmentEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentInSegment = x / rect.width;

    // Calculate time within this segment
    const segmentDuration = segment.endTime - segment.startTime;
    const time = segment.startTime + percentInSegment * segmentDuration;

    emit('seek', Math.max(segment.startTime, Math.min(segment.endTime, time)));
  }

  // Playhead dragging
  function onPlayheadMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDraggingPlayhead.value = true;

    document.addEventListener('mousemove', onPlayheadDragMove);
    document.addEventListener('mouseup', onPlayheadDragEnd);
  }

  function onPlayheadDragMove(e: MouseEvent) {
    if (!isDraggingPlayhead.value || totalDuration.value <= 0) return;

    if (!videoTrackContentRef.value) return;
    const trackRect = videoTrackContentRef.value.getBoundingClientRect();

    const x = e.clientX - trackRect.left;
    const percent = Math.max(0, Math.min(1, x / trackRect.width));
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onPlayheadDragEnd() {
    isDraggingPlayhead.value = false;

    document.removeEventListener('mousemove', onPlayheadDragMove);
    document.removeEventListener('mouseup', onPlayheadDragEnd);
  }

  function onTimelineMouseMove(_e: MouseEvent) {
    // Could be used for hover effects
  }

  function onTimelineMouseLeave() {
    // Could be used for hover effects
  }

  // Segment dragging
  function onSegmentMouseDown(e: MouseEvent, type: ItemType, id: string, item: any) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const trackContentWidth = getTrackContentWidth();

    isDragging.value = true;
    dragInfo.value = {
      type,
      id,
      item,
      startX: e.clientX,
      originalStartTime: item.startTime,
      originalEndTime: item.endTime,
      trackContentWidth,
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    if (!isDragging.value || !dragInfo.value) return;

    const deltaX = e.clientX - dragInfo.value.startX;
    const deltaTime = (deltaX / dragInfo.value.trackContentWidth) * props.duration;

    const itemDuration = dragInfo.value.originalEndTime - dragInfo.value.originalStartTime;
    let newStartTime = dragInfo.value.originalStartTime + deltaTime;
    let newEndTime = newStartTime + itemDuration;

    if (newStartTime < 0) {
      newStartTime = 0;
      newEndTime = itemDuration;
    }
    if (newEndTime > props.duration) {
      newEndTime = props.duration;
      newStartTime = props.duration - itemDuration;
    }

    emitUpdate(dragInfo.value.type, dragInfo.value.id, newStartTime, newEndTime);
  }

  function onDragEnd() {
    isDragging.value = false;
    dragInfo.value = null;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // Segment resizing
  function onResizeMouseDown(e: MouseEvent, type: ItemType, id: string, handle: 'left' | 'right', item: any) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const trackContentWidth = getTrackContentWidth();

    isResizing.value = true;
    resizeInfo.value = {
      type,
      id,
      handle,
      item,
      startX: e.clientX,
      originalStartTime: item.startTime,
      originalEndTime: item.endTime,
      trackContentWidth,
    };

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!isResizing.value || !resizeInfo.value) return;

    const deltaX = e.clientX - resizeInfo.value.startX;
    const deltaTime = (deltaX / resizeInfo.value.trackContentWidth) * props.duration;

    let newStartTime = resizeInfo.value.originalStartTime;
    let newEndTime = resizeInfo.value.originalEndTime;

    const minDuration = 0.1;

    if (resizeInfo.value.handle === 'left') {
      newStartTime = Math.max(0, resizeInfo.value.originalStartTime + deltaTime);
      if (newEndTime - newStartTime < minDuration) {
        newStartTime = newEndTime - minDuration;
      }
    } else {
      newEndTime = Math.min(props.duration, resizeInfo.value.originalEndTime + deltaTime);
      if (newEndTime - newStartTime < minDuration) {
        newEndTime = newStartTime + minDuration;
      }
    }

    emitUpdate(resizeInfo.value.type, resizeInfo.value.id, newStartTime, newEndTime);
  }

  function onResizeEnd() {
    isResizing.value = false;
    resizeInfo.value = null;

    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  function emitUpdate(type: ItemType, id: string, startTime: number, endTime: number) {
    switch (type) {
      case 'trim':
        emit('updateTrimSegment', id, startTime, endTime);
        break;
      case 'audio':
        emit('updateAudioTrack', id, { startTime, endTime });
        break;
      case 'text':
        emit('updateTextOverlay', id, { startTime, endTime });
        break;
      case 'sticker':
        emit('updateSticker', id, { startTime, endTime });
        break;
      case 'effect':
        emit('updateEffect', id, { startTime, endTime });
        break;
    }
  }

  // Waveform rendering
  function renderWaveformForSegment(segmentId: string, segment: TrimSegment) {
    const canvas = waveformCanvasRefs.value.get(segmentId);
    if (!canvas || !waveformData.value || !isWaveformLoaded.value) return;

    try {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Set canvas actual size (account for device pixel ratio)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale context for device pixel ratio
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      // Segment times are relative to the clip (0 to duration)
      // Convert to absolute source video times for waveform extraction
      const absoluteStartTime = props.clipStart + segment.startTime;
      const absoluteEndTime = props.clipStart + segment.endTime;
      const segmentDuration = segment.endTime - segment.startTime;

      // Get the highest resolution waveform data available for maximum detail
      // For segments, we need more peaks because we're showing a smaller portion of the video
      const { duration, resolutions } = waveformData.value;

      // Try resolutions in order of detail (highest first)
      const resolutionOrder = ['extreme', 'ultra', 'high', 'medium', 'low'];
      let peaks: any[] = [];
      let usedResolution = 'high';

      for (const res of resolutionOrder) {
        if (resolutions[res]?.peaks?.length > 0) {
          peaks = resolutions[res].peaks;
          usedResolution = res;
          break;
        }
      }

      if (peaks.length === 0) return;

      // Extract peaks for this segment's time range
      const startRatio = absoluteStartTime / duration;
      const endRatio = absoluteEndTime / duration;
      const startIndex = Math.floor(startRatio * peaks.length);
      const endIndex = Math.ceil(endRatio * peaks.length);
      const segmentPeaks = peaks.slice(startIndex, endIndex);

      if (segmentPeaks.length === 0) return;

      // Calculate how to best display the peaks across the canvas width
      const canvasWidth = rect.width;
      const numPeaks = segmentPeaks.length;

      // Target: thin bars (1-2px) with no/minimal spacing for detailed waveform
      // If we have more peaks than pixels, downsample
      // If we have fewer peaks than pixels, make bars wider
      let displayPeaks = segmentPeaks;
      let barWidth: number;
      let barSpacing: number;

      if (numPeaks > canvasWidth) {
        // More peaks than pixels - downsample to 1 bar per pixel
        const step = numPeaks / canvasWidth;
        displayPeaks = [];
        for (let i = 0; i < canvasWidth; i++) {
          const idx = Math.floor(i * step);
          if (idx < numPeaks) {
            displayPeaks.push(segmentPeaks[idx]);
          }
        }
        barWidth = 1;
        barSpacing = 0;
      } else {
        // Fewer peaks than pixels - spread bars across canvas
        // Use bar width of 2px with spacing calculated to fill canvas
        barWidth = 2;
        const totalBarSpace = numPeaks * barWidth;
        const remainingSpace = canvasWidth - totalBarSpace;
        barSpacing = numPeaks > 1 ? remainingSpace / (numPeaks - 1) : 0;

        // If spacing is too large, increase bar width instead
        if (barSpacing > barWidth * 2) {
          const totalWidth = canvasWidth / numPeaks;
          barWidth = Math.floor(totalWidth * 0.7); // 70% bar, 30% spacing
          barSpacing = totalWidth - barWidth;
        }
      }

      // Normalize peaks to use full available height (find max peak value)
      let maxPeakValue = 0;
      displayPeaks.forEach((peak: any) => {
        const absMax = Math.abs(peak.max);
        const absMin = Math.abs(peak.min);
        if (absMax > maxPeakValue) maxPeakValue = absMax;
        if (absMin > maxPeakValue) maxPeakValue = absMin;
      });

      // Normalize peaks if they're not already at full scale
      const normalizer = maxPeakValue > 0 ? maxPeakValue : 1;
      const normalizedPeaks = displayPeaks.map((peak: any) => ({
        min: peak.min / normalizer,
        max: peak.max / normalizer,
      }));

      renderSegmentWaveform(canvas, {
        width: rect.width,
        height: rect.height,
        peaks: normalizedPeaks,
        segmentDuration,
        currentTime: props.currentTime,
        segmentStartTime: segment.startTime,
        segmentEndTime: segment.endTime,
        barWidth,
        barSpacing,
        amplitude: 0.8,
      });
    } catch (error) {
      console.error('[ClipEditorTimeline] Error rendering waveform:', error);
    }
  }

  function renderSegmentWaveform(
    canvas: HTMLCanvasElement,
    options: {
      width: number;
      height: number;
      peaks: any[];
      segmentDuration: number;
      currentTime: number;
      segmentStartTime: number;
      segmentEndTime: number;
      barWidth: number;
      barSpacing: number;
      amplitude: number;
    }
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || options.peaks.length === 0) return;

    const { width, height, peaks, currentTime, segmentStartTime, segmentEndTime, barWidth, barSpacing, amplitude } =
      options;
    const totalBarWidth = barWidth + barSpacing;
    const centerY = height / 2;
    const maxBarHeight = height * amplitude;

    // Calculate playhead position within segment
    const isWithinSegment = currentTime >= segmentStartTime && currentTime <= segmentEndTime;
    const playheadRatio = isWithinSegment
      ? (currentTime - segmentStartTime) / (segmentEndTime - segmentStartTime)
      : currentTime < segmentStartTime
        ? 0
        : 1;
    const playheadPixel = playheadRatio * width;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    peaks.forEach((peak, index) => {
      const x = index * totalBarWidth;
      if (x >= width) return;

      const barCenter = x + barWidth / 2;
      const isBeforePlayhead = barCenter < playheadPixel;
      const color = isBeforePlayhead ? '#e4e4e7' : '#a78bfa';

      ctx.fillStyle = color;
      ctx.globalAlpha = 1.0;

      const positiveHeight = Math.abs(peak.max) * maxBarHeight;
      const negativeHeight = Math.abs(peak.min) * maxBarHeight;
      const actualBarWidth = Math.min(barWidth, width - x);

      if (positiveHeight > 0 && actualBarWidth > 0) {
        ctx.fillRect(x, centerY - positiveHeight, actualBarWidth, positiveHeight);
      }
      if (negativeHeight > 0 && actualBarWidth > 0) {
        ctx.fillRect(x, centerY, actualBarWidth, negativeHeight);
      }
    });

    ctx.globalAlpha = 1.0;
  }

  function renderAllWaveforms() {
    if (!isWaveformLoaded.value || !waveformData.value) return;

    sortedTrimSegments.value.forEach((segment) => {
      renderWaveformForSegment(segment.id, segment);
    });
  }

  // Setup resize observer for waveform canvases
  function setupResizeObserver() {
    resizeObserver = new ResizeObserver(() => {
      renderAllWaveforms();
    });

    waveformCanvasRefs.value.forEach((canvas) => {
      if (canvas && resizeObserver) {
        resizeObserver.observe(canvas);
      }
    });
  }

  function cleanupResizeObserver() {
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

  // Watch for waveform and segment changes
  watch(
    [waveformData, isWaveformLoaded, () => props.currentTime, zoomLevel, sortedTrimSegments],
    () => {
      if (isWaveformLoaded.value && waveformData.value) {
        nextTick(() => {
          renderAllWaveforms();
        });
      }
    },
    { immediate: true }
  );

  // Lifecycle
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
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.removeEventListener('mousemove', onPlayheadDragMove);
    document.removeEventListener('mouseup', onPlayheadDragEnd);
  });
</script>

<style scoped>
  /* Timeline ruler styling */
  .timeline-ruler {
    background: rgba(10, 10, 10, 0.6);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    user-select: none;
  }

  .timeline-tick {
    transition: all 0.2s ease;
  }

  /* Clip segment animations */
  .clip-segment {
    transition:
      transform 0.2s ease-out,
      box-shadow 0.2s ease-out,
      border-color 0.15s ease;
    will-change: transform, box-shadow;
  }

  /* No transitions during drag for smoother performance */
  .clip-segment.dragging,
  .clip-segment.resizing {
    transition: none !important;
  }

  /* Enhanced hover state for clip segments */
  .clip-segment:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  /* Ensure resize handles are visible on segment hover */
  .clip-segment:hover .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  /* Enhanced cursor states */
  .clip-segment:not(.dragging):hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  /* Selected segment styling */
  .clip-segment.selected-segment {
    z-index: 15;
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
    border-color: #3b82f6 !important;
  }

  .clip-segment.selected-segment:not(.dragging):not(.resizing) {
    animation: selection-pulse 2s ease-in-out infinite;
  }

  @keyframes selection-pulse {
    0%,
    100% {
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
    }
    50% {
      box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5);
    }
  }

  /* Active resize handle styling */
  .clip-segment.resizing .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
    background: rgba(255, 255, 255, 0.8) !important;
  }

  .clip-segment.dragging {
    cursor: grabbing !important;
    transform: scale(1.02);
  }

  /* Smooth transitions for non-dragging states */
  .clip-segment:not(.dragging) {
    transition:
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.15s ease;
  }

  /* Timeline content wrapper */
  .timeline-content-wrapper.dragging {
    cursor: grabbing;
  }

  /* Zoom slider styling */
  .slider-zoom {
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    transition: opacity 0.2s;
  }

  .slider-zoom::-webkit-slider-track {
    width: 100%;
    height: 3px;
    border-radius: 4px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.15);
  }

  .slider-zoom::-moz-range-track {
    width: 100%;
    height: 3px;
    border-radius: 4px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.15);
  }

  .slider-zoom::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: all 0.15s ease;
  }

  .slider-zoom::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: all 0.15s ease;
  }

  .slider-zoom:hover::-webkit-slider-thumb {
    transform: scale(1.2);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
  }

  .slider-zoom:hover::-moz-range-thumb {
    transform: scale(1.2);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
  }
</style>
