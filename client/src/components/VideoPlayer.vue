<template>
  <div class="w-full h-full min-h-0 relative overflow-hidden flex items-center justify-center group/player">
    <!-- Video Crop Container -->
    <div
      ref="videoContainerRef"
      class="video-crop-container"
      :style="{
        aspectRatio: `${aspectRatio.width}/${aspectRatio.height}`,
        maxWidth: '100%',
        maxHeight: '100%',
        position: 'relative',
        overflow: 'hidden',
      }"
    >
      <!-- Loading State -->
      <div v-if="videoLoading" class="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
        <div class="flex flex-col items-center gap-4">
          <!-- Animated Loading Ring -->
          <div class="relative">
            <div class="loading-ring"></div>
            <div class="loading-ring-inner"></div>
            <Film class="h-6 w-6 text-white/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div class="flex flex-col items-center gap-1">
            <span class="text-white/90 text-sm font-medium tracking-wide">Loading video</span>
            <span class="text-white/40 text-xs">Please wait...</span>
          </div>
        </div>
      </div>

      <!-- No Video State -->
      <div v-else-if="!videoSrc && !videoError" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center group/empty">
          <div class="relative inline-block">
            <!-- Decorative rings -->
            <div class="absolute inset-0 -m-4 rounded-full border border-white/5 animate-pulse-slow" />
            <div class="absolute inset-0 -m-8 rounded-full border border-white/[0.03]" />
            <div
              class="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 group-hover/empty:bg-white/[0.05] group-hover/empty:border-white/[0.1]"
            >
              <Video
                class="h-10 w-10 text-white/30 transition-colors group-hover/empty:text-white/50"
                strokeWidth="{1.5}"
              />
            </div>
          </div>
          <p class="text-white/40 text-sm mt-5 font-medium">No video assigned</p>
          <p class="text-white/20 text-xs mt-1">Select a clip to preview</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="videoError" class="absolute inset-0 flex items-center justify-center bg-zinc-950/90">
        <div class="text-center p-6 max-w-xs">
          <div class="relative inline-block mb-4">
            <div class="absolute inset-0 -m-2 rounded-full bg-red-500/20 animate-pulse-slow" />
            <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle class="h-8 w-8 text-red-400" strokeWidth="{1.5}" />
            </div>
          </div>
          <p class="text-white/90 text-sm font-semibold">Failed to load video</p>
          <p class="text-white/40 text-xs mt-2 leading-relaxed">{{ videoError }}</p>
          <button
            @click="$emit('retryLoad')"
            class="mt-5 px-5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-lg text-sm text-red-300 transition-all duration-200 flex items-center gap-2 mx-auto group/retry"
          >
            <RotateCcw class="h-3.5 w-3.5 transition-transform group-hover/retry:-rotate-45" />
            <span>Try again</span>
          </button>
        </div>
      </div>
      <!-- Video Element -->
      <!-- Note: For HLS URLs (.m3u8), src is not set directly - HLS.js handles it -->
      <video
        v-else
        ref="videoElementRef"
        :src="videoSrc && !videoSrc.includes('.m3u8') ? videoSrc : undefined"
        crossorigin="anonymous"
        class="w-full h-full video-with-focal-point"
        :class="hideVideoForComposition ? 'opacity-0' : 'object-cover'"
        :style="hideVideoForComposition ? {} : {
          objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`,
        }"
        @timeupdate="$emit('timeUpdate')"
        @loadedmetadata="$emit('loadedMetadata')"
        @ended="$emit('videoEnded')"
        @error="$emit('videoError', $event)"
        @loadstart="$emit('loadStart')"
        @canplay="$emit('canPlay')"
        data-testid="project-video"
      />

      <!-- Use 16:9: CSS blur + sharp layer (GPU-friendly). Canvas blur was unusably slow on long VODs. -->
      <div
        v-if="showUse169GpuStack"
        class="absolute inset-0 z-10 overflow-hidden pointer-events-none"
      >
        <video
          ref="use169BgVideoRef"
          :src="videoSrc && !videoSrc.includes('.m3u8') ? videoSrc : undefined"
          class="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover scale-[1.08]"
          :style="use169BgVideoStyle"
          muted
          playsinline
          preload="metadata"
        />
        <div class="pointer-events-none absolute z-[1]" :style="use169SharpFrameStyle">
          <video
            ref="use169FgVideoRef"
            :src="videoSrc && !videoSrc.includes('.m3u8') ? videoSrc : undefined"
            class="absolute inset-0 h-full w-full object-contain pointer-events-none"
            muted
            playsinline
            preload="metadata"
          />
        </div>
      </div>

      <!-- Canvas-based multi-region framing preview -->
      <canvas
        v-if="showFramingCanvas && videoSrc && !videoLoading && !videoError"
        ref="framingCanvasRef"
        class="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      <!-- Subtitle Overlay -->
      <div
        v-if="subtitleSettings?.enabled && visibleWords.length > 0 && videoSrc && !videoLoading"
        class="absolute inset-0 subtitle-overlay pointer-events-none z-20"
      >
        <!-- Selection box wrapper: dashed border + resize handles + drag -->
        <div
          class="subtitle-selection-box pointer-events-auto"
          :class="{
            'is-active': isDraggingSubtitles || isResizingSubtitles,
            'is-hidden': !subtitleBoxVisible,
          }"
          :style="getSubtitleContainerStyle"
          @mousedown.self="onSubtitleBoxMouseDown"
          @click.stop="onSubtitleBoxClick"
        >
          <!-- Drag handle bar at top — click to open properties, drag to move -->
          <div
            v-if="subtitleBoxVisible"
            class="subtitle-drag-bar"
            @mousedown.stop="startDragSubtitles"
            @click.stop="emit('subtitleSelected')"
          >
            <span class="subtitle-drag-label">⠿ SUBTITLES</span>
          </div>

          <!-- Corner resize handles for font size adjustment -->
          <template v-if="subtitleBoxVisible">
            <div class="resize-handle resize-handle-tl" @mousedown.stop="(e) => startFontResize(e, 'tl')" @click.stop></div>
            <div class="resize-handle resize-handle-tr" @mousedown.stop="(e) => startFontResize(e, 'tr')" @click.stop></div>
            <div class="resize-handle resize-handle-bl" @mousedown.stop="(e) => startFontResize(e, 'bl')" @click.stop></div>
            <div class="resize-handle resize-handle-br" @mousedown.stop="(e) => startFontResize(e, 'br')" @click.stop></div>
          </template>

        <div 
          ref="subtitleContainerRef"
          class="subtitle-text-container pointer-events-auto"
          :class="subtitleBoxVisible ? 'cursor-move' : 'cursor-pointer'"
          :style="{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', width: 'fit-content', gap: wordGapStyle }"
          @mousedown="onSubtitleTextMouseDown"
          @click.stop="onSubtitleTextClick"
        >
          <span
            v-for="(wordInfo, index) in visibleWords"
            :key="`subtitle-word-${wordInfo.start}-${index}`"
            class="subtitle-word-stack"
            :class="getAnimationClass"
            :style="{
              transitionDuration: `${getWordAnimationDuration(wordInfo)}s`,
              ...subtitleWordSafetyPaddingStyle,
              ...getTypewriterStyle(wordInfo, index),
            }"
          >
            <!-- Render word using SVG to allow rounded line joins -->
            <span
              class="invisible pointer-events-none select-none"
              :class="{ 'current-word': isCurrentWord(wordInfo) }"
              :style="getTextStyle"
            >
              {{ subtitleSettings?.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
            </span>

            <svg class="absolute inset-0 w-full h-full overflow-visible" style="pointer-events: none">
              <defs>
                <!-- Drop shadow for subtitle stack (applied to bottom visible layer) -->
                <filter :id="`shadow-${index}`" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow
                    :dx="(subtitleSettings?.shadowOffsetX ?? 0) * finalFontSizeScale"
                    :dy="(subtitleSettings?.shadowOffsetY ?? 0) * finalFontSizeScale"
                    :stdDeviation="Math.max((subtitleSettings?.shadowBlur ?? 0) * finalFontSizeScale, 0)"
                    :flood-color="subtitleSettings?.shadowColor || '#000000'"
                  />
                </filter>
              </defs>

              <g :style="{ transformOrigin: 'center', transformBox: 'fill-box' }">
                <!-- Layer 1 (bottom): Border 2 (Outer) with Shadow -->
                <text
                  v-if="subtitleSettings && subtitleSettings.border2Width > 0"
                  x="50%"
                  y="55%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                  :filter="subtitleShadowFilterUrl(index)"
                  :style="{
                    fontFamily: subtitleSettings.fontFamily,
                    fontWeight: subtitleSettings.fontWeight,
                    fontSize: getTextStyle.fontSize,
                    letterSpacing: svgLetterSpacing,
                    stroke: subtitleSettings.border2Color || '#FF0000',
                    strokeWidth: Math.max((subtitleSettings.border1Width + subtitleSettings.border2Width) * 2 * finalFontSizeScale, 10) + 'px',
                    strokeLinejoin: 'round',
                    strokeLinecap: 'round',
                    fill: 'none',
                    opacity: '1',
                  }"
                  :data-debug-outer="`RENDERING: border2=${subtitleSettings.border2Width}, color=${subtitleSettings.border2Color}, width=${Math.max((subtitleSettings.border1Width + subtitleSettings.border2Width) * 2 * finalFontSizeScale, 10)}`"
                >
                  {{ subtitleSettings?.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                </text>

                <!-- Layer 2 (middle): Border 1 (Inner) -->
                <text
                  v-if="subtitleSettings && subtitleSettings.border1Width > 0"
                  x="50%"
                  y="55%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                  :filter="subtitleSettings.border2Width <= 0 ? subtitleShadowFilterUrl(index) : undefined"
                  :style="{
                    fontFamily: subtitleSettings.fontFamily,
                    fontWeight: subtitleSettings.fontWeight,
                    fontSize: getTextStyle.fontSize,
                    letterSpacing: svgLetterSpacing,
                    stroke: subtitleSettings.border1Color,
                    strokeWidth: subtitleSettings.border1Width * 2 * finalFontSizeScale + 'px',
                    strokeLinejoin: 'round',
                    strokeLinecap: 'round',
                    fill: 'none',
                  }"
                  :data-debug-inner="`border1: ${subtitleSettings.border1Width}, color: ${subtitleSettings.border1Color}, width: ${subtitleSettings.border1Width * 2 * finalFontSizeScale}`"
                  :data-word="wordInfo.word"
                  :data-is-current="isCurrentWord(wordInfo)"
                  :data-animation-style="subtitleSettings?.animationStyle"
                >
                  {{ subtitleSettings?.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                </text>

                <!-- Layer 3 (top): Fill Text -->
                <text
                  x="50%"
                  y="55%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                  :filter="subtitleSettings && subtitleSettings.border1Width <= 0 && subtitleSettings.border2Width <= 0 ? subtitleShadowFilterUrl(index) : undefined"
                  :class="{ 'current-word-text': isCurrentWord(wordInfo) }"
                  :style="{
                    fontFamily: subtitleSettings.fontFamily,
                    fontWeight: subtitleSettings.fontWeight,
                    fontSize: getTextStyle.fontSize,
                    letterSpacing: svgLetterSpacing,
                    fill: (subtitleSettings?.animationStyle === 'karaoke' && isCurrentWord(wordInfo)) 
                      ? (subtitleSettings?.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT)
                      : (subtitleSettings?.animationStyle === 'single-word' 
                          ? getWordColor(getWordIndexInTranscript(wordInfo))
                          : (subtitleSettings?.textColor || '#FFFFFF')),
                  }"
                  :data-word="wordInfo.word"
                  :data-is-current="isCurrentWord(wordInfo)"
                  :data-animation-style="subtitleSettings?.animationStyle"
                >
                  {{ subtitleSettings?.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                </text>

                <!-- Box highlight background (rendered behind text) -->
                <rect
                  v-if="subtitleSettings?.animationStyle === 'box-highlight' && isCurrentWord(wordInfo)"
                  x="0"
                  y="15%"
                  width="100%"
                  height="80%"
                  rx="4"
                  :fill="subtitleSettings?.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT"
                  :style="{ opacity: 0.3 }"
                />
              </g>
            </svg>
          </span>
        </div>
        </div><!-- end subtitle-selection-box -->
      </div>

      <!-- Clip pill text box (project workspace) -->
      <div
        v-if="showClipTextBoxOverlay"
        class="absolute inset-0 pointer-events-none z-[25]"
      >
        <div
          class="clip-text-selection-box pointer-events-auto"
          :class="{
            'is-active': isDraggingClipText || isResizingClipText,
            'clip-text--passive': !clipTextBoxInteractive,
          }"
          :style="clipTextBoxContainerStyle"
          @mousedown.self="onClipTextBoxOuterMouseDown"
        >
          <div
            v-if="clipTextBoxInteractive"
            class="clip-text-drag-bar"
            @mousedown.stop="startDragClipText($event)"
            @click.stop="emit('clipTextBoxSelected')"
          >
            <span class="clip-text-drag-label">⠿ TEXT</span>
          </div>
          <template v-if="clipTextBoxInteractive">
            <div class="resize-handle resize-handle-tl" @mousedown.stop="(e) => startClipTextWidthResize(e, 'tl')" />
            <div class="resize-handle resize-handle-tr" @mousedown.stop="(e) => startClipTextWidthResize(e, 'tr')" />
            <div class="resize-handle resize-handle-bl" @mousedown.stop="(e) => startClipTextWidthResize(e, 'bl')" />
            <div class="resize-handle resize-handle-br" @mousedown.stop="(e) => startClipTextWidthResize(e, 'br')" />
          </template>
          <div
            class="clip-text-pill cursor-move"
            :class="{ 'cursor-default': !clipTextBoxInteractive }"
            :style="clipTextPillStyle"
            @mousedown="clipTextBoxInteractive ? startDragClipText($event) : undefined"
            @click.stop="emit('clipTextBoxSelected')"
          >
            <span class="clip-text-pill-inner whitespace-pre-wrap break-words text-center inline-block max-w-full" :style="clipTextPillTextStyle">
              {{ displayClipTextBoxText }}
            </span>
          </div>
        </div>
      </div>

      <!-- Watermark Overlay -->
      <div
        v-if="shouldShowWatermark && videoSrc && !videoLoading"
        class="absolute pointer-events-none z-10 transition-opacity duration-300"
        :style="getWatermarkOverlayStyle"
      >
        <img
          :src="getWatermarkSrc"
          alt="Watermark"
          class="watermark-image"
          :class="isFullFrameWatermark ? '' : 'max-w-full max-h-full object-contain'"
          :style="getWatermarkImageStyle"
        />
      </div>

      <!-- Canvas click capture — clicking the previewer hides the subtitle selection box (no play/pause) -->
      <div
        v-if="videoSrc && !videoLoading"
        class="absolute inset-0 z-[15] cursor-default"
        @click="onCanvasClick"
      />

      <!-- Center alignment guides — visible while dragging subtitles, highlighted when snapped to center -->
      <div
        v-if="showSubtitleCenterGuides"
        class="subtitle-guide-line subtitle-guide-line--vertical"
        :class="{ 'is-snapped': isSubtitleSnappedX }"
      />
      <div
        v-if="showSubtitleCenterGuides"
        class="subtitle-guide-line subtitle-guide-line--horizontal"
        :class="{ 'is-snapped': isSubtitleSnappedY }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { Video, AlertTriangle, Film, RotateCcw } from 'lucide-vue-next';
  import Hls from 'hls.js';

  import type {
    WhisperSegment,
    WatermarkSettings,
    PerRatioWatermarkSettings,
    ManualRegion,
    ManualFramingConfig,
  } from '@/types';
  import type { ClipTextBoxState } from '@/utils/clipTextBox';
  import { use169BlurSliderToCssPx } from '@/utils/use169Blur';
  import {
    maxWordsChunkForAspectRatioString,
    pickActiveSingleWordAtTime,
  } from '@/utils/subtitleVisibleWords';
  import {
    getSubtitleLineHeightMultiplier,
    getSubtitleWordSafetyPaddingPx,
    getSubtitleWordSpacingPx,
  } from '@/services/subtitle-renderer';

  interface WatermarkData {
    dataUrl: string; // Data URL for display
    width?: number;
    height?: number;
  }

  interface Props {
    videoSrc: string | null;
    videoLoading: boolean;
    videoError: string | null;
    isPlaying: boolean;
    aspectRatio: { width: number; height: number };
    focalPoint?: { x: number; y: number };
    subtitleSettings?: SubtitleSettings;
    transcriptWords?: WordInfo[];
    transcriptSegments?: WhisperSegment[];
    currentTime?: number;
    watermarkSettings?: WatermarkSettings;
    watermarkData?: WatermarkData | null;
    audioGainDb?: number; // dB gain (-20 to +20) for audio playback preview
    framingRegions?: ManualRegion[]; // Multi-region framing for VOD preset preview
    /** Full manual framing from VOD preset — drives "Use 16:9" blur + sharp letterbox (creator profile layout). */
    manualFramingConfig?: ManualFramingConfig | null;
    subtitleInitialPosition?: { x: number; y: number; width?: number | null } | null;
    clipTextBoxState?: ClipTextBoxState | null;
    /** When true, show handles and allow drag/resize */
    clipTextBoxInteractive?: boolean;
    /** When true (e.g. workspace Text tab), show enabled box whenever visible flags pass — ignore start/end window so editing works at any playhead. */
    clipTextBoxIgnoreTiming?: boolean;
    /** Absolute video time (seconds) where the active clip starts — for clip-local timing */
    clipAbsoluteStart?: number | null;
  }

  interface WordInfo {
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }

  interface SubtitleSettings {
    enabled: boolean;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    textColor: string;
    backgroundColor: string;
    backgroundEnabled: boolean;
    border1Width: number;
    border1Color: string;
    border2Width: number;
    border2Color: string;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    shadowColor: string;
    position: 'top' | 'middle' | 'bottom';
    positionPercentage: number;
    maxWidth: number;
    animationStyle: 'none' | 'karaoke' | 'zoom' | 'pop' | 'glow' | 'box-highlight' | 'typewriter' | 'wave' | 'single-word';
    highlightColor: string;
    multiColorEnabled: boolean;
    multiColorMode: 'default' | 'custom';
    colorPalette: string[];
    lineHeight: number;
    letterSpacing: number;
    textAlign: 'left' | 'center' | 'right';
    textOffsetX: number;
    textOffsetY: number;
    padding: number;
    borderRadius: number;
    wordSpacing: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    focalPoint: () => ({ x: 0.5, y: 0.5 }),
    subtitleSettings: () => ({
      enabled: false,
      fontFamily: 'Montserrat',
      fontSize: 32,
      fontWeight: 700,
      textColor: '#FFFFFF',
      backgroundColor: '#000000',
      backgroundEnabled: false,
      border1Width: 2,
      border1Color: '#00FF00',
      border2Width: 4,
      border2Color: '#000000',
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowBlur: 4,
      shadowColor: '#000000',
      position: 'bottom',
      positionPercentage: 97,
      maxWidth: 90,
      animationStyle: 'none',
      highlightColor: '#0ea5e9',
      multiColorEnabled: false,
      multiColorMode: 'default' as const,
      colorPalette: [] as string[],
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'center',
      padding: 16,
      borderRadius: 8,
      textOffsetX: 0,
      textOffsetY: 0,
      wordSpacing: 0.35,
    }),
    transcriptWords: () => [],
    transcriptSegments: () => [],
    currentTime: 0,
    watermarkSettings: () => ({
      enabled: false,
      watermarkId: null,
      positionX: 12,
      positionY: 92,
      opacity: 80,
      scale: 20,
    }),
    watermarkData: null,
    audioGainDb: 0,
    framingRegions: () => [],
    manualFramingConfig: null,
    subtitleInitialPosition: null,
    clipTextBoxState: null,
    clipTextBoxInteractive: false,
    clipTextBoxIgnoreTiming: false,
    clipAbsoluteStart: null,
  });

  interface Emits {
    (e: 'togglePlayPause'): void;
    (e: 'timeUpdate'): void;
    (e: 'loadedMetadata'): void;
    (e: 'videoEnded'): void;
    (e: 'videoError', event: Event): void;
    (e: 'loadStart'): void;
    (e: 'canPlay'): void;
    (e: 'retryLoad'): void;
    (e: 'videoElementReady', element: HTMLVideoElement): void;
    (e: 'watermarkIdChange', watermarkId: string | null): void;
    (e: 'subtitlePositionChange', position: { x: number; y: number }, width: number): void;
    (e: 'subtitleFontSizeChange', fontSize: number): void;
    (e: 'subtitleSelected'): void;
    (e: 'clipTextBoxPositionChange', payload: { x: number; y: number; widthPct: number; fontSize?: number }): void;
    (e: 'clipTextBoxSelected'): void;
  }

  const emit = defineEmits<Emits>();

  const videoElementRef = ref<HTMLVideoElement | null>(null);
  const use169BgVideoRef = ref<HTMLVideoElement | null>(null);
  const use169FgVideoRef = ref<HTMLVideoElement | null>(null);
  const videoContainerRef = ref<HTMLElement | null>(null);
  const framingCanvasRef = ref<HTMLCanvasElement | null>(null);
  const subtitleContainerRef = ref<HTMLElement | null>(null);
  const containerHeight = ref<number>(1080); // Default to 1080p height
  const containerWidth = ref<number>(1920);

  // Subtitle box state
  const isDraggingSubtitles = ref(false);
  const isResizingSubtitles = ref(false);
  const subtitleDragOffset = ref({ x: 0, y: 0 });
  const customSubtitlePosition = ref<{ x: number; y: number }>(
    props.subtitleInitialPosition
      ? { x: props.subtitleInitialPosition.x, y: props.subtitleInitialPosition.y }
      : { x: 50, y: 85 }
  );
  const customSubtitleWidth = ref<number>(
    props.subtitleInitialPosition?.width ?? props.subtitleSettings?.maxWidth ?? 80
  );
  // Font resize state
  const fontResizeStartX = ref(0);
  const fontResizeStartY = ref(0);
  const fontResizeStartSize = ref(0);
  // Which corner: tl | tr | bl | br
  const fontResizeCorner = ref<'tl' | 'tr' | 'bl' | 'br'>('br');

  // Visibility of the subtitle selection chrome (border, drag bar, resize handles).
  // Click on canvas hides it (subtitles only). Click on subtitle text brings it back.
  const subtitleBoxVisible = ref(true);

  /** Snap tolerance (percent) — within this distance from center, snap & highlight guide. */
  const SUBTITLE_SNAP_TOLERANCE_PCT = 1.5;

  const showSubtitleCenterGuides = computed(
    () => isDraggingSubtitles.value && subtitleBoxVisible.value
  );
  const isSubtitleSnappedX = computed(
    () => Math.abs(customSubtitlePosition.value.x - 50) < SUBTITLE_SNAP_TOLERANCE_PCT
  );
  const isSubtitleSnappedY = computed(
    () => Math.abs(customSubtitlePosition.value.y - 50) < SUBTITLE_SNAP_TOLERANCE_PCT
  );

  watch(() => props.subtitleInitialPosition, (pos) => {
    customSubtitlePosition.value = pos ? { x: pos.x, y: pos.y } : { x: 50, y: 85 };
    if (pos?.width != null) customSubtitleWidth.value = pos.width;
    // New clip / new position context — restore the selection chrome by default.
    subtitleBoxVisible.value = true;
  });

  watch(() => props.subtitleSettings?.maxWidth, (w) => {
    if (w !== undefined) customSubtitleWidth.value = w;
  });

  // Re-show the chrome whenever subtitles are re-enabled (so the user always sees handles first).
  watch(
    () => props.subtitleSettings?.enabled,
    (enabled) => {
      if (enabled) subtitleBoxVisible.value = true;
    }
  );

  // --- Clip text box (pill) ---
  const customClipTextPosition = ref({ x: 50, y: 50 });
  const customClipTextWidthPct = ref(72);
  const customClipTextFontSize = ref(28);
  const isDraggingClipText = ref(false);
  const isResizingClipText = ref(false);
  const clipTextDragOffset = ref({ x: 0, y: 0 });
  const clipTextResizeStartX = ref(0);
  const clipTextResizeStartY = ref(0);
  const clipTextResizeStartFontSize = ref(28);
  const clipTextResizeCorner = ref<'tl' | 'tr' | 'bl' | 'br'>('br');

  watch(
    () => props.clipTextBoxState,
    (s) => {
      if (!s) return;
      customClipTextPosition.value = { x: s.positionX, y: s.positionY };
      customClipTextWidthPct.value = s.widthPct;
      customClipTextFontSize.value = s.style?.fontSize ?? 28;
    },
    { immediate: true, deep: true }
  );

  const clipTextRelativeTime = computed(() => {
    const ct = props.currentTime ?? 0;
    if (props.clipAbsoluteStart != null && props.clipAbsoluteStart !== undefined) {
      return ct - props.clipAbsoluteStart;
    }
    return ct;
  });

  const showClipTextBoxOverlay = computed(() => {
    const s = props.clipTextBoxState;
    if (!s?.enabled || !props.videoSrc || props.videoLoading || props.videoError) return false;
    if (props.clipTextBoxIgnoreTiming) return true;
    const t = clipTextRelativeTime.value;
    const eps = 1e-3;
    return t + eps >= s.startTime && t <= s.endTime + eps;
  });

  const clipBoxScale = computed(() => {
    const videoScaleFactor = containerHeight.value / 1080;
    const aspectRatioValue = props.aspectRatio.width / props.aspectRatio.height;
    let fontSizeScale = 1;
    if (aspectRatioValue <= 0.9) fontSizeScale = 0.65;
    else if (aspectRatioValue > 0.9 && aspectRatioValue <= 1.1) fontSizeScale = 0.78;
    return fontSizeScale * videoScaleFactor;
  });

  const displayClipTextBoxText = computed(() => props.clipTextBoxState?.text ?? '');

  const clipTextBoxContainerStyle = computed(() => {
    const x = customClipTextPosition.value.x;
    const y = customClipTextPosition.value.y;
    const w = Math.min(100, Math.max(12, customClipTextWidthPct.value));
    return {
      position: 'absolute' as const,
      top: `${y}%`,
      left: `${x}%`,
      transform: 'translate(-50%, -50%)',
      width: 'max-content',
      maxWidth: `${w}%`,
      boxSizing: 'border-box' as const,
    };
  });

  const clipTextPillStyle = computed(() => {
    const s = props.clipTextBoxState?.style;
    if (!s) return {};
    const pad = Math.round((s.padding || 16) * clipBoxScale.value);
    const rad = Math.round((s.borderRadius || 24) * clipBoxScale.value);
    const st: Record<string, string> = {
      borderRadius: `${rad}px`,
      padding: `${pad}px`,
      boxSizing: 'border-box',
      width: 'auto',
      maxWidth: '100%',
    };
    if (s.backgroundEnabled) {
      st.backgroundColor = s.backgroundColor || '#FFFFFF';
    }
    return st;
  });

  const clipTextPillTextStyle = computed(() => {
    const s = props.clipTextBoxState?.style;
    if (!s) return {};
    const baseFs = customClipTextFontSize.value ?? s.fontSize ?? 28;
    const fs = Math.round(baseFs * clipBoxScale.value);
    const tt = s.textTransform || 'none';
    return {
      fontFamily: `"${s.fontFamily}", Arial, sans-serif`,
      fontWeight: String(s.fontWeight ?? 700),
      fontSize: `${fs}px`,
      color: s.color || '#000000',
      textTransform: tt as string,
      lineHeight: String(s.lineHeight ?? 1.2),
      letterSpacing: `${(s.letterSpacing || 0) * clipBoxScale.value}px`,
    };
  });

  function onClipTextBoxOuterMouseDown(e: MouseEvent) {
    if (props.clipTextBoxInteractive) startDragClipText(e);
  }

  function startDragClipText(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!videoContainerRef.value || !props.clipTextBoxInteractive) return;
    isDraggingClipText.value = true;
    const containerRect = videoContainerRef.value.getBoundingClientRect();
    const curX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const curY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    const pos = customClipTextPosition.value;
    clipTextDragOffset.value = { x: curX - pos.x, y: curY - pos.y };
    document.addEventListener('mousemove', onDragClipText);
    document.addEventListener('mouseup', stopClipTextInteraction);
  }

  function onDragClipText(e: MouseEvent) {
    if (!isDraggingClipText.value || !videoContainerRef.value) return;
    const containerRect = videoContainerRef.value.getBoundingClientRect();
    const curX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const curY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    customClipTextPosition.value = {
      x: Math.max(0, Math.min(100, curX - clipTextDragOffset.value.x)),
      y: Math.max(0, Math.min(100, curY - clipTextDragOffset.value.y)),
    };
  }

  /** Corner drag scales font size (same model as subtitle resize), not horizontal stretch. */
  function startClipTextWidthResize(e: MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br') {
    e.preventDefault();
    e.stopPropagation();
    if (!props.clipTextBoxInteractive) return;
    isResizingClipText.value = true;
    clipTextResizeStartX.value = e.clientX;
    clipTextResizeStartY.value = e.clientY;
    clipTextResizeStartFontSize.value = customClipTextFontSize.value;
    clipTextResizeCorner.value = corner;
    document.addEventListener('mousemove', onClipTextFontResize);
    document.addEventListener('mouseup', stopClipTextInteraction);
  }

  function onClipTextFontResize(e: MouseEvent) {
    if (!isResizingClipText.value || !videoContainerRef.value) return;
    const containerRect = videoContainerRef.value.getBoundingClientRect();
    const dx = e.clientX - clipTextResizeStartX.value;
    const dy = e.clientY - clipTextResizeStartY.value;
    const signX = clipTextResizeCorner.value === 'tr' || clipTextResizeCorner.value === 'br' ? 1 : -1;
    const signY = clipTextResizeCorner.value === 'bl' || clipTextResizeCorner.value === 'br' ? 1 : -1;
    const delta = (dx * signX + dy * signY) / 2;
    const scaledDelta = (delta / containerRect.height) * 200;
    const newSize = Math.max(10, Math.min(120, clipTextResizeStartFontSize.value + scaledDelta));
    customClipTextFontSize.value = Math.round(newSize);
  }

  function stopClipTextInteraction() {
    const was = isDraggingClipText.value || isResizingClipText.value;
    isDraggingClipText.value = false;
    isResizingClipText.value = false;
    document.removeEventListener('mousemove', onDragClipText);
    document.removeEventListener('mousemove', onClipTextFontResize);
    document.removeEventListener('mouseup', stopClipTextInteraction);
    if (was) {
      emit('clipTextBoxPositionChange', {
        x: customClipTextPosition.value.x,
        y: customClipTextPosition.value.y,
        widthPct: customClipTextWidthPct.value,
        fontSize: customClipTextFontSize.value,
      });
    }
  }

  // Multi-region framing + creator "Use 16:9" (blur bg + sharp 16:9) from manualFramingConfig
  const usesUse169WorkspaceFraming = computed(() => {
    if ((props.framingRegions?.length ?? 0) > 0) return false;
    const fc = props.manualFramingConfig;
    if (!fc || fc.sourceFrameMode !== 'use16x9') return false;
    const rw = props.aspectRatio.width;
    const rh = props.aspectRatio.height;
    if (!rw || !rh) return false;
    return rw / rh < 0.95; // portrait / tall preview canvas
  });

  /** Progressive file / blob playback: GPU layers instead of canvas blur (fixes severe jank on long VODs). */
  const showUse169GpuStack = computed(() => {
    if (!usesUse169WorkspaceFraming.value || !props.videoSrc || props.videoLoading || props.videoError)
      return false;
    if (props.videoSrc.includes('.m3u8')) return false;
    return true;
  });

  /** HLS or POI regions only: canvas compositing (use 16:9 on HLS stays canvas + throttled). */
  const showFramingCanvas = computed(() => {
    const regions = props.framingRegions?.length ?? 0;
    const use169 = usesUse169WorkspaceFraming.value;
    const src = props.videoSrc;
    const isHls = !!src?.includes('.m3u8');
    if (use169 && src && !isHls) return false;
    return regions > 0 || (use169 && isHls && !!src);
  });

  const hideVideoForComposition = computed(() => showFramingCanvas.value || showUse169GpuStack.value);

  const use169BgVideoStyle = computed(() => {
    const fc = props.manualFramingConfig;
    const amt = fc?.blurAmount ?? 0;
    const blurPx =
      fc?.blurEnabled !== false && amt > 0 ? use169BlurSliderToCssPx(amt) : 0;
    return blurPx > 0 ? { filter: `blur(${blurPx}px)` } : {};
  });

  const use169SharpFrameStyle = computed((): Record<string, string> => {
    const fc = props.manualFramingConfig;
    const cw = containerWidth.value;
    const ch = containerHeight.value;
    if (!fc || cw <= 0 || ch <= 0) {
      return { display: 'none' };
    }
    const st = fc.sourceTransform ?? { scale: 1, x: 0, y: 0 };
    const sourceAspect = 16 / 9;
    const baseWidth = cw;
    const baseHeight = baseWidth / sourceAspect;
    const width = baseWidth * st.scale;
    const height = baseHeight * st.scale;
    const left = (cw - width) / 2 + st.x * cw;
    const top = (ch - height) / 2 + st.y * ch;
    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  let framingAnimationId: number | null = null;
  let use169SyncRaf: number | null = null;
  /** HLS use-16:9 canvas path: throttle + limit backing store size */
  let lastUse169CanvasDraw = 0;
  const regionImageCache = new Map<string, HTMLImageElement>();
  const regionVideoCache = new Map<string, HTMLVideoElement>();

  function startFramingLoop() {
    if (framingAnimationId !== null) return;
    renderFramingFrame();
  }

  function stopFramingLoop() {
    if (framingAnimationId !== null) {
      cancelAnimationFrame(framingAnimationId);
      framingAnimationId = null;
    }
  }

  /** Cover the canvas with video (letterbox/crop center) — same visual as CSS object-cover */
  function drawVideoCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, cw: number, ch: number) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh);
  }

  function regionMediaSrc(assetId?: string | null): string {
    if (!assetId) return '';
    if (
      assetId.startsWith('blob:') ||
      assetId.startsWith('http://') ||
      assetId.startsWith('https://') ||
      assetId.startsWith('asset:')
    ) {
      return assetId;
    }
    try {
      return convertFileSrc(assetId);
    } catch {
      return assetId;
    }
  }

  function getRegionImage(assetId: string): HTMLImageElement | null {
    const src = regionMediaSrc(assetId);
    if (!src) return null;
    const cached = regionImageCache.get(src);
    if (cached) return cached;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    regionImageCache.set(src, img);
    return img;
  }

  function getRegionVideo(assetId: string): HTMLVideoElement | null {
    const src = regionMediaSrc(assetId);
    if (!src) return null;
    const cached = regionVideoCache.get(src);
    if (cached) return cached;

    const media = document.createElement('video');
    media.crossOrigin = 'anonymous';
    media.src = src;
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = 'metadata';
    regionVideoCache.set(src, media);
    return media;
  }

  function drawObjectCover(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ) {
    if (!sourceWidth || !sourceHeight || !dw || !dh) return;
    const scale = Math.max(dw / sourceWidth, dh / sourceHeight);
    const sw = dw / scale;
    const sh = dh / scale;
    const sx = (sourceWidth - sw) / 2;
    const sy = (sourceHeight - sh) / 2;
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  function getRegionCornerRadius(region: ManualRegion, regionWidthPx: number, regionHeightPx: number): number {
    if (!region.cornerRadiusEnabled || !region.cornerRadiusPx) return 0;
    const radius = region.cornerRadiusPx * (regionWidthPx / 1080);
    return Math.max(0, Math.min(radius, regionWidthPx / 2, regionHeightPx / 2));
  }

  function applyRoundedRegionClip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    if (radius <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
  }

  function drawTransformedSourceFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    cw: number,
    ch: number,
    vw: number,
    vh: number,
    config: ManualFramingConfig
  ) {
    const st = config.sourceTransform ?? { scale: 1, x: 0, y: 0 };
    const sourceAspect = vw / vh || 16 / 9;
    const baseWidth = cw;
    const baseHeight = baseWidth / sourceAspect;
    const width = baseWidth * st.scale;
    const height = baseHeight * st.scale;
    const left = (cw - width) / 2 + st.x * cw;
    const top = (ch - height) / 2 + st.y * ch;
    const amt = config.blurAmount ?? 0;
    const blurPx =
      config.blurEnabled !== false && amt > 0 ? use169BlurSliderToCssPx(amt) : 0;

    ctx.save();
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(video, 0, 0, vw, vh, left, top, width, height);
    ctx.restore();
  }

  function renderFramingFrame() {
    const canvas = framingCanvasRef.value;
    const video = videoElementRef.value;
    const regions = props.framingRegions;
    if (!canvas || !video) {
      framingAnimationId = null;
      return;
    }

    // Size canvas to match container
    const rect = canvas.getBoundingClientRect();
    const fcEarly = props.manualFramingConfig;
    const use169Early =
      fcEarly?.sourceFrameMode === 'use16x9' &&
      props.aspectRatio.width / props.aspectRatio.height < 0.95;
    const amtEarly = fcEarly?.blurAmount ?? 0;
    const blurPxEarly =
      use169Early &&
      fcEarly &&
      fcEarly.blurEnabled !== false &&
      amtEarly > 0
        ? use169BlurSliderToCssPx(amtEarly)
        : 0;
    // Heavy canvas blur + DPR → massive lag; keep compositor light for HLS fallback.
    const dpr =
      use169Early && blurPxEarly > 0
        ? 1
        : Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(rect.width * dpr);
    const ch = Math.round(rect.height * dpr);

    if (cw === 0 || ch === 0) {
      framingAnimationId = requestAnimationFrame(renderFramingFrame);
      return;
    }

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) { framingAnimationId = null; return; }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) {
      framingAnimationId = requestAnimationFrame(renderFramingFrame);
      return;
    }

    const fc = props.manualFramingConfig;
    const hasRegions = !!regions && regions.length > 0;
    const use169 =
      !hasRegions &&
      fc?.sourceFrameMode === 'use16x9' &&
      props.aspectRatio.width / props.aspectRatio.height < 0.95;

    if (use169) {
      const now = performance.now();
      if (!video.paused && now - lastUse169CanvasDraw < 42) {
        framingAnimationId = requestAnimationFrame(renderFramingFrame);
        return;
      }
      lastUse169CanvasDraw = now;

      const amtU9 = fc!.blurAmount ?? 0;
      const blurPx =
        fc!.blurEnabled !== false && amtU9 > 0 ? use169BlurSliderToCssPx(amtU9) : 0;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);

      if (blurPx > 0) {
        ctx.save();
        ctx.filter = `blur(${blurPx}px)`;
        drawVideoCover(ctx, video, cw, ch);
        ctx.restore();
      }

      const st = fc!.sourceTransform ?? { scale: 1, x: 0, y: 0 };
      const baseWidth = cw;
      const baseHeight = baseWidth / (16 / 9);
      const boxW = baseWidth * st.scale;
      const boxH = baseHeight * st.scale;
      const left = (cw - boxW) / 2 + st.x * cw;
      const top = (ch - boxH) / 2 + st.y * ch;

      ctx.drawImage(video, 0, 0, vw, vh, left, top, boxW, boxH);

      framingAnimationId = video.paused ? null : requestAnimationFrame(renderFramingFrame);
      return;
    }

    if (!regions || regions.length === 0) {
      framingAnimationId = null;
      return;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);

    if (fc?.sourceFrameMode === 'scale') {
      drawTransformedSourceFrame(ctx, video, cw, ch, vw, vh, fc);
    }

    // Draw each region: source rect from video → output rect on canvas
    for (const region of regions) {
      const dx = region.output.x * cw;
      const dy = region.output.y * ch;
      const dw = region.output.width * cw;
      const dh = region.output.height * ch;
      const cornerRadius = getRegionCornerRadius(region, dw, dh);

      if (region.mediaAssetId && region.mediaType === 'image') {
        const img = getRegionImage(region.mediaAssetId);
        if (img?.complete && img.naturalWidth && img.naturalHeight) {
          ctx.save();
          applyRoundedRegionClip(ctx, dx, dy, dw, dh, cornerRadius);
          drawObjectCover(ctx, img, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh);
          ctx.restore();
        }
        continue;
      }

      if (region.mediaAssetId && region.mediaType === 'video') {
        const media = getRegionVideo(region.mediaAssetId);
        if (media) {
          if (Number.isFinite(video.currentTime) && media.duration) {
            const targetTime = video.currentTime % media.duration;
            if (Math.abs(media.currentTime - targetTime) > 0.12) {
              media.currentTime = targetTime;
            }
          }
          if (!video.paused && media.paused) void media.play().catch(() => {});
          if (video.paused && !media.paused) media.pause();
          if (media.readyState >= 2 && media.videoWidth && media.videoHeight) {
            ctx.save();
            applyRoundedRegionClip(ctx, dx, dy, dw, dh, cornerRadius);
            drawObjectCover(ctx, media, media.videoWidth, media.videoHeight, dx, dy, dw, dh);
            ctx.restore();
          }
        }
        continue;
      }

      const sx = region.source.x * vw;
      const sy = region.source.y * vh;
      const sw = region.source.width * vw;
      const sh = region.source.height * vh;

      ctx.save();
      applyRoundedRegionClip(ctx, dx, dy, dw, dh, cornerRadius);
      ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    }

    framingAnimationId = requestAnimationFrame(renderFramingFrame);
  }

  // Start/stop framing loop based on regions, video, and canvas readiness
  watch([showFramingCanvas, videoElementRef, framingCanvasRef], ([show, videoEl, canvasEl]) => {
    if (show && videoEl && canvasEl) {
      startFramingLoop();
    } else {
      stopFramingLoop();
    }
  }, { immediate: true });

  watch(
    () => props.isPlaying,
    (playing) => {
      if (playing && showFramingCanvas.value && videoElementRef.value && framingCanvasRef.value) {
        startFramingLoop();
      }
    }
  );

  function syncUse169CloneVideos() {
    const master = videoElementRef.value;
    const bg = use169BgVideoRef.value;
    const fg = use169FgVideoRef.value;
    if (!master || !bg || !fg) return;
    const t = master.currentTime;
    if (!Number.isFinite(t)) return;
    if (Math.abs(bg.currentTime - t) > 0.12 || Math.abs(fg.currentTime - t) > 0.12) {
      bg.currentTime = t;
      fg.currentTime = t;
    }
    bg.playbackRate = master.playbackRate;
    fg.playbackRate = master.playbackRate;
    const shouldPlay = props.isPlaying && !master.paused && !master.ended;
    if (shouldPlay) {
      if (bg.paused) void bg.play().catch(() => {});
      if (fg.paused) void fg.play().catch(() => {});
    } else {
      bg.pause();
      fg.pause();
    }
  }

  function use169SyncTick() {
    syncUse169CloneVideos();
    use169SyncRaf = requestAnimationFrame(use169SyncTick);
  }

  watch(
    showUse169GpuStack,
    (on) => {
      if (use169SyncRaf !== null) {
        cancelAnimationFrame(use169SyncRaf);
        use169SyncRaf = null;
      }
      if (on) {
        nextTick(() => {
          syncUse169CloneVideos();
          use169SyncRaf = requestAnimationFrame(use169SyncTick);
        });
      }
    },
    { immediate: true }
  );

  // HLS.js instance for HLS playback
  let hlsInstance: Hls | null = null;

  // Web Audio API refs for gain control
  const audioContext = ref<AudioContext | null>(null);
  const gainNode = ref<GainNode | null>(null);
  const mediaSource = ref<MediaElementAudioSourceNode | null>(null);
  const isAudioSetup = ref(false);

  // Convert dB to linear gain multiplier
  function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // Setup Web Audio API for gain control
  async function setupAudioGain(videoElement: HTMLVideoElement) {
    // Only setup once per video element
    if (isAudioSetup.value) return;

    // Don't setup if gain is 0 dB (no change needed)
    // This allows normal playback when no gain adjustment is required
    const currentGainDb = props.audioGainDb ?? 0;
    if (currentGainDb === 0 && !audioContext.value) {
      console.log('[VideoPlayer] Skipping audio gain setup (0 dB, no adjustment needed)');
      return;
    }

    try {
      // Create audio context if not exists
      if (!audioContext.value) {
        audioContext.value = new AudioContext();
        console.log('[VideoPlayer] Created new AudioContext, state:', audioContext.value.state);
      }

      // Resume context if suspended (required for user gesture)
      if (audioContext.value.state === 'suspended') {
        console.log('[VideoPlayer] Resuming suspended AudioContext...');
        await audioContext.value.resume();
        console.log('[VideoPlayer] AudioContext resumed, state:', audioContext.value.state);
      }

      // Create media source from video element
      mediaSource.value = audioContext.value.createMediaElementSource(videoElement);
      console.log('[VideoPlayer] Created MediaElementSourceNode');

      // Create gain node
      gainNode.value = audioContext.value.createGain();

      // Set initial gain
      const linearGain = dbToLinear(currentGainDb);
      gainNode.value.gain.value = linearGain;
      console.log('[VideoPlayer] Created GainNode with initial gain:', linearGain);

      // Connect: video -> gain -> destination (speakers)
      mediaSource.value.connect(gainNode.value);
      gainNode.value.connect(audioContext.value.destination);
      console.log('[VideoPlayer] Audio routing connected: video -> gain -> destination');

      isAudioSetup.value = true;
      console.log('[VideoPlayer] Audio gain setup complete, gain:', linearGain, '(', currentGainDb, 'dB)');
    } catch (error) {
      console.error('[VideoPlayer] Failed to setup audio gain:', error);
      // Reset state so we can try again if needed
      isAudioSetup.value = false;
    }
  }

  // Update gain value when prop changes
  function updateAudioGain() {
    if (gainNode.value && audioContext.value) {
      const linearGain = dbToLinear(props.audioGainDb ?? 0);
      // Use setValueAtTime for smooth transition
      gainNode.value.gain.setTargetAtTime(linearGain, audioContext.value.currentTime, 0.05);
    }
  }

  // Cleanup audio resources
  function cleanupAudio() {
    if (mediaSource.value) {
      try {
        mediaSource.value.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      mediaSource.value = null;
    }
    if (gainNode.value) {
      try {
        gainNode.value.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      gainNode.value = null;
    }
    if (audioContext.value) {
      try {
        audioContext.value.close();
      } catch (e) {
        // Ignore close errors
      }
      audioContext.value = null;
    }
    isAudioSetup.value = false;
  }

  // Calculate max words based on aspect ratio + effect density.
  const maxWordsForAspectRatio = computed(() => {
    return maxWordsChunkForAspectRatioString(
      `${props.aspectRatio.width}:${props.aspectRatio.height}`,
      props.subtitleSettings?.animationStyle
    );
  });

  // Find the current whisper segment
  const currentSegment = computed((): WhisperSegment | null => {
    console.log('[VideoPlayer] currentSegment check:', {
      subtitleEnabled: props.subtitleSettings?.enabled,
      hasTranscriptSegments: !!props.transcriptSegments,
      segmentsLength: props.transcriptSegments?.length || 0,
      currentTime: props.currentTime,
    });
    
    if (!props.subtitleSettings?.enabled || !props.transcriptSegments || props.transcriptSegments.length === 0) {
      console.log('[VideoPlayer] No current segment - missing data');
      return null;
    }

    const time = props.currentTime || 0;

    // Find segment that contains the current time
    for (const segment of props.transcriptSegments) {
      if (time >= segment.start && time <= segment.end) {
        console.log('[VideoPlayer] Found current segment:', segment);
        return segment;
      }
    }

    // Return null if in dead space between segments
    console.log('[VideoPlayer] No segment at current time:', time);
    return null;
  });

  // Get all words from the current segment
  const segmentWords = computed((): WordInfo[] => {
    if (!currentSegment.value) return [];

    const segment = currentSegment.value;

    // First try: filter from global transcript words by segment time range
    if (props.transcriptWords && props.transcriptWords.length > 0) {
      const filtered = props.transcriptWords.filter((word) => {
        return (
          (word.start >= segment.start && word.start < segment.end) ||
          (word.end > segment.start && word.end <= segment.end) ||
          (word.start <= segment.start && word.end >= segment.end)
        );
      });

      if (filtered.length > 0) {
        return filtered;
      }
    }

    // Fallback: use segment.words directly, remapping their timestamps to the segment's absolute time range.
    // This handles transcripts where word timestamps are chunk-relative rather than VOD-absolute.
    const segWords = (segment as any).words;
    if (segWords && Array.isArray(segWords) && segWords.length > 0) {
      const wordStart = segWords[0].start;
      const wordEnd = segWords[segWords.length - 1].end;
      const wordSpan = wordEnd - wordStart;
      const segSpan = segment.end - segment.start;
      const offset = segment.start - wordStart;
      const scale = wordSpan > 0 ? segSpan / wordSpan : 1;

      return segWords.map((w: any): WordInfo => ({
        word: w.word,
        start: wordSpan > 0
          ? segment.start + (w.start - wordStart) * scale
          : segment.start + (w.start - wordStart) + offset,
        end: wordSpan > 0
          ? segment.start + (w.end - wordStart) * scale
          : segment.start + (w.end - wordStart) + offset,
        confidence: w.confidence,
      }));
    }

    return [];
  });

  // Get visible words (chunked display - shows X words at a time, then jumps to next X)
  const visibleWords = computed((): WordInfo[] => {
    const allSegmentWords = segmentWords.value;
    
    if (allSegmentWords.length === 0) {
      return [];
    }

    const time = props.currentTime || 0;
    const animationStyle = props.subtitleSettings?.animationStyle;

    console.log('[VideoPlayer] Animation style check:', {
      animationStyle,
      subtitleSettings: props.subtitleSettings,
      isSingleWord: animationStyle === 'single-word'
    });

    // Single word mode - only show the current word (shared hit-test: min window + no short-word drop)
    if (animationStyle === 'single-word') {
      const currentWord = pickActiveSingleWordAtTime(allSegmentWords, time);
      return currentWord ? [currentWord] : [];
    }

    // Normal chunked display for other animation styles
    const maxWords = maxWordsForAspectRatio.value;

    // If segment has fewer words than the limit, show all
    if (allSegmentWords.length <= maxWords) {
      return allSegmentWords;
    }

    // Find the current word being spoken
    let currentWordIndex = -1;
    for (let i = 0; i < allSegmentWords.length; i++) {
      const word = allSegmentWords[i];
      if (time >= word.start && time < word.end) {
        currentWordIndex = i;
        break;
      }
    }

    // If no word is currently being spoken, find the next upcoming word
    if (currentWordIndex === -1) {
      for (let i = 0; i < allSegmentWords.length; i++) {
        if (allSegmentWords[i].start > time) {
          currentWordIndex = i;
          break;
        }
      }
    }

    // If still no match, default to first chunk
    if (currentWordIndex === -1) {
      currentWordIndex = 0;
    }

    // Calculate which "chunk" (page) this word belongs to
    const chunkIndex = Math.floor(currentWordIndex / maxWords);
    const startIndex = chunkIndex * maxWords;
    const endIndex = Math.min(startIndex + maxWords, allSegmentWords.length);

    return allSegmentWords.slice(startIndex, endIndex);
  });

  // Check if a word is currently being spoken (must match single-word hit-test / extended windows)
  function isCurrentWord(word: WordInfo): boolean {
    const style = props.subtitleSettings?.animationStyle;
    if (style === 'single-word') {
      return visibleWords.value.some(
        (w) => w.start === word.start && w.end === word.end && w.word === word.word
      );
    }

    const time = props.currentTime || 0;

    if (time >= word.start && time < word.end) {
      return true;
    }

    const LOOK_BACK_TOLERANCE = 0.05;
    const timeSinceWordStart = time - word.start;

    if (timeSinceWordStart > 0 && timeSinceWordStart <= LOOK_BACK_TOLERANCE) {
      if (time < word.end) {
        return true;
      }
    }

    return false;
  }

  // Default color palette for multi-color single-word mode
  const DEFAULT_COLOR_PALETTE = ['#04F827', '#0ea5e9', '#FFFD03', '#FFFFFF']; // Green, Cyan, Yellow, White

  // Get the color for a word based on multi-color settings (for single-word mode)
  function getWordColor(wordIndex: number): string {
    const settings = props.subtitleSettings;
    
    // Only apply multi-color in single-word mode
    if (!settings || settings.animationStyle !== 'single-word' || !settings.multiColorEnabled) {
      // Multi-color is OFF or not in single-word mode, use the regular text color
      return settings?.textColor || '#FFFFFF';
    }
    
    // Multi-color is ON in single-word mode
    if (settings.multiColorMode === 'custom' && settings.colorPalette && settings.colorPalette.length > 0) {
      // Use custom palette
      const paletteIndex = wordIndex % settings.colorPalette.length;
      return settings.colorPalette[paletteIndex];
    } else {
      // Use default palette (Neon Green, Cyan, Yellow, White)
      const paletteIndex = wordIndex % DEFAULT_COLOR_PALETTE.length;
      return DEFAULT_COLOR_PALETTE[paletteIndex];
    }
  }

  // Get the index of the current word in the full transcript
  function getWordIndexInTranscript(word: WordInfo): number {
    if (!props.transcriptWords || props.transcriptWords.length === 0) {
      return 0;
    }
    
    // Find the index of this word in the transcript
    const index = props.transcriptWords.findIndex(w => w.start === word.start && w.word === word.word);
    return index >= 0 ? index : 0;
  }

  // Get the animation class based on animation style
  const getAnimationClass = computed(() => {
    const style = props.subtitleSettings?.animationStyle;
    if (!style || style === 'none') return {};

    return {
      'animation-zoom': style === 'zoom',
      'animation-karaoke': style === 'karaoke',
      'animation-pop': style === 'pop',
      'animation-glow': style === 'glow',
      'animation-box-highlight': style === 'box-highlight',
      'animation-typewriter': style === 'typewriter',
      'animation-wave': style === 'wave',
      'animation-single-word': style === 'single-word',
    };
  });

  // Get typewriter style (controls visibility for typewriter effect)
  function getTypewriterStyle(word: WordInfo, _index: number): Record<string, string> {
    const style = props.subtitleSettings?.animationStyle;
    if (style !== 'typewriter') return {};

    const time = props.currentTime || 0;
    const isVisible = time >= word.start;

    return {
      opacity: isVisible ? '1' : '0',
      transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
    };
  }

  // Calculate animation duration for a specific word based on its timing
  function getWordAnimationDuration(word: WordInfo): number {
    // Calculate word duration in seconds
    const wordDuration = word.end - word.start;

    // For very short words (under 50ms), use instant transition
    if (wordDuration < 0.05) {
      return 0;
    }

    // For short words (50-100ms), use 30% of duration for responsive animation
    if (wordDuration < 0.1) {
      return wordDuration * 0.3;
    }

    // For medium words (100-200ms), use 35% of duration
    if (wordDuration < 0.2) {
      return wordDuration * 0.35;
    }

    // For normal words (200-400ms), use 40% of duration
    if (wordDuration < 0.4) {
      return wordDuration * 0.4;
    }

    // For longer words (400ms+), use 45% but cap at 200ms to prevent overly slow animations
    const calculatedDuration = wordDuration * 0.45;
    return Math.min(0.2, calculatedDuration);
  }

  const getSubtitleContainerStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    console.log('[VideoPlayer] Subtitle textAlign:', settings.textAlign);
    
    // Apply text offsets (X and Y adjustments in percentage)
    const leftOffset = settings.textOffsetX || 0;
    const topOffset = settings.textOffsetY || 0;
    
    // Determine position: always use customSubtitlePosition (defaults to bottom-center 50,85)
    const topPct = customSubtitlePosition.value.y;
    
    // Calculate horizontal position based on alignment
    let leftPct: number;
    let transformX: string;
    
    switch (settings.textAlign) {
      case 'left':
        // Position at 10% from left edge, apply offset from left edge
        leftPct = 10;
        transformX = `${leftOffset}%`;
        break;
      case 'right':
        // Position at 90% from left edge, apply offset from right edge
        leftPct = 90;
        transformX = `calc(-100% + ${leftOffset}%)`;
        break;
      default:
        // Center alignment: use custom position and center the container
        leftPct = customSubtitlePosition.value.x;
        transformX = `calc(-50% + ${leftOffset}%)`;
        break;
    }

    // Calculate scaled values for advanced settings
    const scaledPadding = Math.round((settings.padding || 0) * finalFontSizeScale.value);
    const scaledBorderRadius = Math.round((settings.borderRadius || 0) * finalFontSizeScale.value);
    const scaledLineHeight = getSubtitleLineHeightMultiplier(
      settings,
      `${props.aspectRatio.width}:${props.aspectRatio.height}`
    );

    // Base styles — always use absolute positioning anchored to the overlay container.
    // Width is fit-content so the box shrinks/grows with the text.
    const baseStyles: Record<string, string> = {
      position: 'absolute',
      top: topPct + '%',
      left: leftPct + '%',
      transform: `translate(${transformX}, calc(-50% + ${topOffset}%))`,
      width: 'max-content',
      maxWidth: customSubtitleWidth.value + '%',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: settings.textAlign || 'center',
      alignItems: 'center',
      lineHeight: String(scaledLineHeight),
    };

    // Add background styles if enabled
    if (settings.backgroundEnabled) {
      baseStyles.backgroundColor = settings.backgroundColor || '#000000';
      baseStyles.padding = `${scaledPadding}px`;
      baseStyles.borderRadius = `${scaledBorderRadius}px`;
    }

    console.log('[VideoPlayer] Computed subtitle styles:', baseStyles);
    return baseStyles;
  });

  // Calculate the final font size scale factor
  const finalFontSizeScale = computed(() => {
    if (!props.subtitleSettings) return 1;

    const videoScaleFactor = containerHeight.value / 1080;
    const aspectRatioValue = props.aspectRatio.width / props.aspectRatio.height;
    let fontSizeScale = 1;

    if (aspectRatioValue <= 0.9) {
      fontSizeScale = 0.65; // Vertical formats (9:16, 4:5)
    } else if (aspectRatioValue > 0.9 && aspectRatioValue <= 1.1) {
      fontSizeScale = 0.78; // Square format (1:1)
    }

    return fontSizeScale * videoScaleFactor;
  });

  /** App cyan — default karaoke / highlight fallback (matches SubtitlePropertiesPanel presets) */
  const DEFAULT_SUBTITLE_HIGHLIGHT = '#0ea5e9';

  /** SVG filter url for subtitle drop shadow; undefined when shadow is fully off */
  function subtitleShadowFilterUrl(wordIndex: number): string | undefined {
    const s = props.subtitleSettings;
    if (!s) return undefined;
    const blur = s.shadowBlur ?? 0;
    const dx = s.shadowOffsetX ?? 0;
    const dy = s.shadowOffsetY ?? 0;
    if (blur <= 0 && dx === 0 && dy === 0) return undefined;
    return `url(#shadow-${wordIndex})`;
  }

  /** Effective subtitle font size in CSS px (panel fontSize × video layout scale). */
  const subtitleRenderedFontSizePx = computed(() => {
    if (!props.subtitleSettings) return 0;
    return Math.max(1, Math.round(props.subtitleSettings.fontSize * finalFontSizeScale.value));
  });

  /**
   * Letter spacing from the panel is in px, calibrated around a typical on-screen size.
   * Scale with rendered font so gaps don’t look “stuck” when the user enlarges subtitles.
   */
  const REFERENCE_SUBTITLE_FONT_PX = 48;

  const scaledSubtitleLetterSpacingPx = computed(() => {
    if (!props.subtitleSettings) return 0;
    const raw = props.subtitleSettings.letterSpacing || 0;
    const fs = subtitleRenderedFontSizePx.value;
    return raw * (fs / REFERENCE_SUBTITLE_FONT_PX);
  });

  // Style for text layer (top layer)
  const getTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    const adjustedFontSize = subtitleRenderedFontSizePx.value;
    const adjustedLetterSpacing = scaledSubtitleLetterSpacingPx.value;

    const styles: any = {
      color: settings.textColor,
      fontFamily: `"${settings.fontFamily}", Arial, sans-serif`,
      fontWeight: settings.fontWeight,
      fontSize: `${adjustedFontSize}px`,
      letterSpacing: `${adjustedLetterSpacing}px`,
      lineHeight: String(
        getSubtitleLineHeightMultiplier(
          settings,
          `${props.aspectRatio.width}:${props.aspectRatio.height}`
        )
      ),
    };
    
    // Add uppercase for single-word style (CapCut-style)
    if (settings.animationStyle === 'single-word') {
      styles.textTransform = 'uppercase';
    }
    
    return styles;
  });

  // Space between word spans: scale with rendered font (see getSubtitleWordSpacingPx — not full 0.35em or gaps look huge).
  const wordGapStyle = computed(() => {
    if (!props.subtitleSettings) return '0px';
    const gapPx = getSubtitleWordSpacingPx(
      props.subtitleSettings.wordSpacing,
      subtitleRenderedFontSizePx.value
    );
    return `${gapPx}px`;
  });

  const subtitleWordSafetyPaddingStyle = computed(() => {
    if (!props.subtitleSettings) return {};
    const aspectRatio = `${props.aspectRatio.width}:${props.aspectRatio.height}`;
    const padPx = getSubtitleWordSafetyPaddingPx(
      props.subtitleSettings,
      subtitleRenderedFontSizePx.value,
      aspectRatio
    );
    const verticalPadPx = Math.max(0, padPx * 0.35);
    return {
      padding: `${verticalPadPx}px ${padPx}px`,
    };
  });

  // Get letter spacing for SVG elements
  const svgLetterSpacing = computed(() => {
    if (!props.subtitleSettings) return '0px';
    return `${scaledSubtitleLetterSpacingPx.value}px`;
  });

  // Watermark overlay computed properties
  const getWatermarkSrc = computed(() => {
    return props.watermarkData?.dataUrl || '';
  });

  // Local state for watermark dimensions (in case DB didn't provide them)
  const localWatermarkDimensions = ref<{ width: number; height: number } | null>(null);

  // Update local dimensions when props change
  watch(
    () => props.watermarkData,
    (newData) => {
      if (newData?.width && newData?.height) {
        localWatermarkDimensions.value = { width: newData.width, height: newData.height };
      } else {
        localWatermarkDimensions.value = null;
      }
    },
    { immediate: true }
  );

  // Handle image load to get natural dimensions
  function onWatermarkLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      localWatermarkDimensions.value = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }
  }

  // Get the aspect ratio string for looking up per-ratio settings
  const aspectRatioString = computed(() => {
    const { width, height } = props.aspectRatio;
    // Normalize common aspect ratios
    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(ratio - 9 / 16) < 0.01) return '9:16';
    if (Math.abs(ratio - 1) < 0.01) return '1:1';
    if (Math.abs(ratio - 4 / 5) < 0.01) return '4:5';
    return `${width}:${height}`;
  });

  // Check if watermark should be shown for current aspect ratio
  const shouldShowWatermark = computed(() => {
    if (!props.watermarkSettings?.enabled) return false;
    if (!props.watermarkData) return false;

    const perRatio = props.watermarkSettings.perRatioSettings;
    if (perRatio) {
      const ratioKey = aspectRatioString.value as keyof PerRatioWatermarkSettings;
      // If perRatioSettings exists and the specific ratio is null, watermark is disabled for this ratio
      if (ratioKey in perRatio && perRatio[ratioKey] === null) {
        return false;
      }
    }
    return true;
  });

  // Get the effective watermark ID for the current aspect ratio
  // This may differ from the main watermarkId if per-ratio settings specify a different watermark
  const effectiveWatermarkId = computed(() => {
    if (!props.watermarkSettings) return null;

    const perRatio = props.watermarkSettings.perRatioSettings;
    if (perRatio) {
      const ratioKey = aspectRatioString.value as keyof PerRatioWatermarkSettings;
      const ratioConfig = perRatio[ratioKey];
      // If this ratio has a specific watermark ID, use it
      if (ratioConfig?.watermarkId) {
        return ratioConfig.watermarkId;
      }
    }
    // Fall back to the main watermark ID
    return props.watermarkSettings.watermarkId;
  });

  const getWatermarkOverlayStyle = computed(() => {
    if (!props.watermarkSettings) return {};

    const settings = props.watermarkSettings;
    // Use local dimensions if available, otherwise fallback to props
    const wmWidth = localWatermarkDimensions.value?.width ?? props.watermarkData?.width ?? null;
    const wmHeight = localWatermarkDimensions.value?.height ?? props.watermarkData?.height ?? null;

    const ratio = wmWidth && wmHeight ? wmWidth / wmHeight : null;
    const is16x9 = ratio ? Math.abs(ratio - 16 / 9) < 0.02 : false;

    // Get per-ratio settings if available
    const perRatio = settings.perRatioSettings;
    const ratioKey = aspectRatioString.value as keyof PerRatioWatermarkSettings;
    const ratioConfig = perRatio?.[ratioKey];

    // Check for explicit full-frame overlay mode from per-ratio settings
    if (ratioConfig?.position?.isFullFrameOverlay) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Check for explicit full-frame overlay mode flag (top-level)
    if (settings.isFullFrameOverlay) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Treat HD+ 16:9 watermarks as full-frame so baked positions land correctly, even if not exactly 1920x1080.
    const isFullFrame =
      is16x9 &&
      wmWidth !== null &&
      wmHeight !== null &&
      wmWidth >= 1600 &&
      wmHeight >= 900 &&
      props.aspectRatio.width === 16 &&
      props.aspectRatio.height === 9;

    // Full-frame 1920x1080 overlays fill the frame and sit at 0,0
    if (isFullFrame) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Use per-ratio position settings if available, otherwise fall back to top-level settings
    const positionX = ratioConfig?.position?.x ?? settings.positionX;
    const positionY = ratioConfig?.position?.y ?? settings.positionY;
    const scale = ratioConfig?.position?.scale ?? settings.scale ?? 15;

    return {
      width: `${scale}%`,
      left: `${positionX}%`,
      top: `${positionY}%`,
      transform: 'translate(-50%, -50%)',
    };
  });

  // Get watermark opacity - use per-ratio value if available, otherwise manual value for preview
  const getWatermarkOpacity = computed(() => {
    if (!props.watermarkSettings) return 1;

    // Check for per-ratio opacity setting
    const perRatio = props.watermarkSettings.perRatioSettings;
    const ratioKey = aspectRatioString.value as keyof PerRatioWatermarkSettings;
    const ratioConfig = perRatio?.[ratioKey];

    // Use per-ratio opacity if available, otherwise fall back to top-level setting
    const opacity = ratioConfig?.position?.opacity ?? props.watermarkSettings.opacity ?? 100;
    return opacity / 100;
  });

  // Check if watermark is in full-frame overlay mode
  const isFullFrameWatermark = computed(() => {
    if (!props.watermarkSettings) return false;

    const settings = props.watermarkSettings;
    const wmWidth = props.watermarkData?.width ?? null;
    const wmHeight = props.watermarkData?.height ?? null;
    const ratio = wmWidth && wmHeight ? wmWidth / wmHeight : null;
    const is16x9 = ratio ? Math.abs(ratio - 16 / 9) < 0.02 : false;

    // Get per-ratio settings if available
    const perRatio = settings.perRatioSettings;
    const ratioKey = aspectRatioString.value as keyof PerRatioWatermarkSettings;
    const ratioConfig = perRatio?.[ratioKey];

    // Check for explicit full-frame overlay mode from per-ratio settings
    if (ratioConfig?.position?.isFullFrameOverlay) {
      return true;
    }

    // Check for explicit full-frame overlay mode flag (top-level)
    if (settings.isFullFrameOverlay) {
      return true;
    }

    // Auto-detect HD+ 16:9 watermarks as full-frame
    const isAutoFullFrame =
      is16x9 &&
      wmWidth !== null &&
      wmHeight !== null &&
      wmWidth >= 1600 &&
      wmHeight >= 900 &&
      props.aspectRatio.width === 16 &&
      props.aspectRatio.height === 9;

    return isAutoFullFrame;
  });

  // Get watermark image style - for full-frame mode, fill the container
  const getWatermarkImageStyle = computed(() => {
    const baseStyle: Record<string, string | number> = {
      opacity: getWatermarkOpacity.value,
    };

    if (isFullFrameWatermark.value) {
      return {
        ...baseStyle,
        width: '100%',
        height: '100%',
        objectFit: 'fill', // Fill the entire container exactly
      };
    }

    return baseStyle;
  });

  // Expose the video element ref to parent
  defineExpose({
    videoElement: videoElementRef,
  });

  // Watch for video element changes and notify parent
  watch(videoElementRef, (newElement) => {
    if (newElement) {
      emit('videoElementReady', newElement);
      // Don't setup audio immediately - wait for gain change or canPlay
    }
  });

  // Cleanup HLS instance
  function cleanupHls() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
  }

  // Setup HLS playback for .m3u8 URLs
  function setupHlsPlayback(videoElement: HTMLVideoElement, hlsUrl: string) {
    cleanupHls();

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
      });

      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(videoElement);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] HLS manifest parsed, ready to play');
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[VideoPlayer] HLS fatal error:', data.type, data.details);
          cleanupHls();
        }
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoElement.src = hlsUrl;
    } else {
      console.error('[VideoPlayer] HLS not supported in this browser');
    }
  }

  // Watch for video source changes to handle HLS URLs
  watch(
    () => props.videoSrc,
    (newSrc, oldSrc) => {
      if (newSrc === oldSrc) return;

      // Cleanup previous HLS instance
      cleanupHls();

      // If new source is HLS, set it up
      if (newSrc && newSrc.includes('.m3u8') && videoElementRef.value) {
        setupHlsPlayback(videoElementRef.value, newSrc);
      }
    }
  );

  // Also handle when video element becomes available after source is set
  watch(videoElementRef, (newElement) => {
    if (newElement && props.videoSrc?.includes('.m3u8')) {
      setupHlsPlayback(newElement, props.videoSrc);
    }
  });

  // Watch for audioGainDb changes
  watch(
    () => props.audioGainDb,
    async (newGainDb) => {
      // If audio is already setup, just update the gain
      if (isAudioSetup.value) {
        updateAudioGain();
        // Also ensure AudioContext is running
        if (audioContext.value?.state === 'suspended') {
          await audioContext.value.resume();
        }
      } else if (newGainDb !== 0 && videoElementRef.value) {
        // Setup audio when user changes gain from 0 to something else
        await setupAudioGain(videoElementRef.value);
      }
    }
  );

  // Watch for play state to ensure AudioContext is running
  watch(
    () => props.isPlaying,
    async (playing) => {
      if (playing && audioContext.value?.state === 'suspended') {
        console.log('[VideoPlayer] Video playing, resuming AudioContext');
        await audioContext.value.resume();
      }
    }
  );

  // Watch for effective watermark ID changes (when aspect ratio changes and per-ratio settings specify a different watermark)
  watch(effectiveWatermarkId, (newId, oldId) => {
    // Only emit if the ID actually changed and we have watermark settings
    if (newId !== oldId && props.watermarkSettings?.enabled) {
      emit('watermarkIdChange', newId);
    }
  });

  // Note: We do NOT cleanup audio when video source changes because
  // MediaElementAudioSourceNode can only be created once per video element.
  // The audio routing remains valid even when the video src changes.

  // Setup ResizeObserver to track container size changes
  let resizeObserver: ResizeObserver | null = null;

  // Subtitle drag handlers — drags by center point
  function startDragSubtitles(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!videoContainerRef.value) return;
    // Drag is only meaningful when the box is visible (handles + chrome shown)
    if (!subtitleBoxVisible.value) return;

    isDraggingSubtitles.value = true;

    const containerRect = videoContainerRef.value.getBoundingClientRect();
    const curX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const curY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    const pos = customSubtitlePosition.value ?? { x: 50, y: 85 };

    subtitleDragOffset.value = {
      x: curX - pos.x,
      y: curY - pos.y,
    };

    document.addEventListener('mousemove', onDragSubtitles);
    document.addEventListener('mouseup', stopSubtitleInteraction);
  }

  function onDragSubtitles(e: MouseEvent) {
    if (!isDraggingSubtitles.value || !videoContainerRef.value) return;
    const containerRect = videoContainerRef.value.getBoundingClientRect();
    const curX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const curY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    let nextX = Math.max(0, Math.min(100, curX - subtitleDragOffset.value.x));
    let nextY = Math.max(0, Math.min(100, curY - subtitleDragOffset.value.y));
    // Snap to center when within tolerance so users can land on truly-centered.
    if (Math.abs(nextX - 50) < SUBTITLE_SNAP_TOLERANCE_PCT) nextX = 50;
    if (Math.abs(nextY - 50) < SUBTITLE_SNAP_TOLERANCE_PCT) nextY = 50;
    customSubtitlePosition.value = { x: nextX, y: nextY };
  }

  /**
   * Mousedown on the dashed selection-box wrapper.
   * Only initiates a drag if the box chrome is visible (so clicks while hidden don't fight the
   * canvas-click handler that brings the box back).
   */
  function onSubtitleBoxMouseDown(e: MouseEvent) {
    if (!subtitleBoxVisible.value) return;
    startDragSubtitles(e);
  }

  /**
   * Click on the box wrapper (not bubbled to canvas).
   * If the box is currently hidden, surface it again so the user can drag/resize.
   */
  function onSubtitleBoxClick() {
    if (!subtitleBoxVisible.value) {
      subtitleBoxVisible.value = true;
    }
  }

  /**
   * Mousedown on the inner subtitle text container.
   * When hidden, do not start a drag — let the click handler bring the box back.
   */
  function onSubtitleTextMouseDown(e: MouseEvent) {
    if (!subtitleBoxVisible.value) return;
    startDragSubtitles(e);
  }

  /**
   * Click on the subtitle text — bring the selection chrome back when hidden.
   * When already visible, do nothing here; the drag bar handles "select" semantics.
   */
  function onSubtitleTextClick() {
    if (!subtitleBoxVisible.value) {
      subtitleBoxVisible.value = true;
    }
  }

  /**
   * Click on the previewer canvas (anywhere outside the subtitle box / text).
   * Hides the subtitle selection chrome so the user sees a clean preview of the subtitles only.
   * Clicks on the subtitle box/text are stopped before reaching here.
   */
  function onCanvasClick() {
    if (!props.subtitleSettings?.enabled) return;
    if (visibleWords.value.length === 0) return;
    if (subtitleBoxVisible.value) {
      subtitleBoxVisible.value = false;
    }
  }

  // Font resize via corner handles — dragging away from center = bigger
  function startFontResize(e: MouseEvent, corner: 'tl' | 'tr' | 'bl' | 'br') {
    e.preventDefault();
    e.stopPropagation();

    isResizingSubtitles.value = true;
    fontResizeStartX.value = e.clientX;
    fontResizeStartY.value = e.clientY;
    fontResizeStartSize.value = props.subtitleSettings?.fontSize ?? 48;
    fontResizeCorner.value = corner;

    document.addEventListener('mousemove', onFontResize);
    document.addEventListener('mouseup', stopSubtitleInteraction);
  }

  function onFontResize(e: MouseEvent) {
    if (!isResizingSubtitles.value || !videoContainerRef.value) return;
    const containerRect = videoContainerRef.value.getBoundingClientRect();
    const dx = e.clientX - fontResizeStartX.value;
    const dy = e.clientY - fontResizeStartY.value;
    // Away from corner = bigger. Each corner's outward direction:
    // tl: left(-x) and up(-y)   = bigger → signX=-1, signY=-1
    // tr: right(+x) and up(-y)  = bigger → signX=+1, signY=-1
    // bl: left(-x) and down(+y) = bigger → signX=-1, signY=+1
    // br: right(+x) and down(+y)= bigger → signX=+1, signY=+1
    const signX = (fontResizeCorner.value === 'tr' || fontResizeCorner.value === 'br') ? 1 : -1;
    const signY = (fontResizeCorner.value === 'bl' || fontResizeCorner.value === 'br') ? 1 : -1;
    const delta = (dx * signX + dy * signY) / 2;
    const scaledDelta = (delta / containerRect.height) * 200;
    const newSize = Math.max(8, Math.min(200, fontResizeStartSize.value + scaledDelta));
    emit('subtitleFontSizeChange', Math.round(newSize));
  }

  function stopSubtitleInteraction() {
    const wasInteracting = isDraggingSubtitles.value || isResizingSubtitles.value;
    isDraggingSubtitles.value = false;
    isResizingSubtitles.value = false;
    document.removeEventListener('mousemove', onDragSubtitles);
    document.removeEventListener('mousemove', onFontResize);
    document.removeEventListener('mouseup', stopSubtitleInteraction);

    if (wasInteracting && customSubtitlePosition.value) {
      emit('subtitlePositionChange', customSubtitlePosition.value, customSubtitleWidth.value);
    }
  }

  // Debug subtitle overlay rendering
  watch([() => props.subtitleSettings, visibleWords, () => props.videoSrc, () => props.videoLoading], ([settings, words, src, loading]) => {
    console.log('[VideoPlayer] Subtitle overlay conditions:', {
      subtitleEnabled: settings?.enabled,
      visibleWordsCount: words.length,
      hasVideoSrc: !!src,
      videoLoading: loading,
      shouldShow: settings?.enabled && words.length > 0 && !!src && !loading,
    });
    
    // Debug karaoke settings
    if (settings?.animationStyle === 'karaoke') {
      console.log('[VideoPlayer] Karaoke subtitle settings:', {
        animationStyle: settings.animationStyle,
        textColor: settings.textColor,
        highlightColor: settings.highlightColor,
        currentTime: props.currentTime,
      });
    }
  });

  onMounted(() => {
    if (videoContainerRef.value) {
      containerHeight.value = videoContainerRef.value.clientHeight;
      containerWidth.value = videoContainerRef.value.clientWidth;

      // Create ResizeObserver to watch for size changes
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          containerHeight.value = entry.contentRect.height;
          containerWidth.value = entry.contentRect.width;
        }
      });

      resizeObserver.observe(videoContainerRef.value);
    }

    // Debug: Check if fonts are loaded
    if (props.subtitleSettings?.fontFamily) {
      console.log(
        '[VideoPlayer] Subtitle font:',
        props.subtitleSettings.fontFamily,
        'weight:',
        props.subtitleSettings.fontWeight
      );

      // Check if font is actually loaded
      document.fonts.ready.then(() => {
        const testFont = `${props.subtitleSettings?.fontWeight || 400} 12px "${props.subtitleSettings?.fontFamily}"`;
        const loaded = document.fonts.check(testFont);
        console.log('[VideoPlayer] Font loaded in browser?', loaded, 'test:', testFont);
      });
    }
  });

  onUnmounted(() => {
    if (use169SyncRaf !== null) {
      cancelAnimationFrame(use169SyncRaf);
      use169SyncRaf = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    // Cleanup framing loop
    stopFramingLoop();
    // Cleanup HLS instance
    cleanupHls();
    // Cleanup audio resources
    cleanupAudio();
  });
</script>

<style scoped>
  /* Video player specific styles */
  .video-container {
    position: relative;
    background: #000;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .video-crop-container {
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
  }

  .video-element {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Smooth focal point transition */
  .video-with-focal-point {
    transition: object-position 1.5s ease-in-out;
  }

  /* Loading Animation */
  .loading-ring {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: rgba(139, 92, 246, 0.8);
    border-right-color: rgba(6, 182, 212, 0.4);
    animation: loading-spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  }

  .loading-ring-inner {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    margin: -20px 0 0 -20px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: rgba(6, 182, 212, 0.6);
    border-left-color: rgba(139, 92, 246, 0.3);
    animation: loading-spin 0.8s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse;
  }

  @keyframes loading-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Slow pulse animation */
  @keyframes pulse-slow {
    0%,
    100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 0.3;
      transform: scale(1.05);
    }
  }

  .animate-pulse-slow {
    animation: pulse-slow 3s ease-in-out infinite;
  }

  /* Focal Point Indicator */
  .focal-point-indicator {
    animation: focal-pulse 2s ease-in-out infinite;
  }

  @keyframes focal-pulse {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }

  /* Smooth transitions */
  .transition-opacity {
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Subtitle selection box — dashed border + drag bar; chrome can be toggled off via .is-hidden */
  .subtitle-selection-box {
    position: absolute;
    border: 1px dashed rgba(255, 255, 255, 0.45);
    border-radius: 4px;
    box-sizing: border-box;
    padding: 22px 0 0 0; /* top only — for drag bar; no side/bottom padding so box fits text */
    cursor: move;
    user-select: none;
    transition: border-color 0.15s;
  }

  .subtitle-selection-box:hover,
  .subtitle-selection-box.is-active {
    border-color: rgba(59, 130, 246, 0.85);
    border-width: 2px;
  }

  /*
   * Hidden state: clicking the previewer canvas hides the chrome so the user sees a clean
   * preview of just the subtitles. Clicking the subtitle text brings the chrome back.
   * Padding is preserved so the subtitle text doesn't visually shift between states.
   * Pointer-events are disabled on the wrapper so clicks in the invisible padding area pass
   * through to the canvas — only the inner text container remains interactive.
   */
  .subtitle-selection-box.is-hidden,
  .subtitle-selection-box.is-hidden:hover {
    border-color: transparent;
    border-width: 1px;
    cursor: default;
    pointer-events: none;
  }

  .subtitle-selection-box.is-hidden .subtitle-text-container {
    pointer-events: auto;
  }

  /* Drag bar at the top of the selection box */
  .subtitle-drag-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: move;
    border-radius: 4px 4px 0 0;
    background: rgba(59, 130, 246, 0.85);
    backdrop-filter: blur(4px);
    transition: background 0.15s;
  }

  .subtitle-drag-bar:hover {
    background: rgba(59, 130, 246, 0.95);
  }

  .subtitle-drag-label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: 0.1em;
    pointer-events: none;
    user-select: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* Corner resize handles for font size adjustment */
  .resize-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background: rgba(59, 130, 246, 0.9);
    border: 2px solid rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.15s, transform 0.15s;
  }

  .subtitle-selection-box:hover .resize-handle,
  .subtitle-selection-box.is-active .resize-handle {
    opacity: 1;
  }

  .resize-handle:hover {
    transform: scale(1.3);
    background: rgba(59, 130, 246, 1);
  }

  .resize-handle-tl {
    top: -5px;
    left: -5px;
    cursor: nwse-resize;
  }

  .resize-handle-tr {
    top: -5px;
    right: -5px;
    cursor: nesw-resize;
  }

  .resize-handle-bl {
    bottom: -5px;
    left: -5px;
    cursor: nesw-resize;
  }

  .resize-handle-br {
    bottom: -5px;
    right: -5px;
    cursor: nwse-resize;
  }

  /*
   * Center alignment guide lines — visible while the user is dragging the subtitle box.
   * Highlight (cyan + glow) when the subtitle box is snapped to the canvas center.
   */
  .subtitle-guide-line {
    position: absolute;
    background: rgba(255, 255, 255, 0.45);
    pointer-events: none;
    z-index: 30;
    transition: background-color 0.12s ease, box-shadow 0.12s ease;
  }

  .subtitle-guide-line--vertical {
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    transform: translateX(-50%);
  }

  .subtitle-guide-line--horizontal {
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    transform: translateY(-50%);
  }

  .subtitle-guide-line.is-snapped {
    background: rgba(34, 211, 238, 0.95);
    box-shadow: 0 0 6px rgba(34, 211, 238, 0.7);
  }

  /* Clip text box selection — same chrome as subtitles (blue), shrink-wrap inner pill */
  .clip-text-selection-box {
    position: absolute;
    border: 1px dashed rgba(59, 130, 246, 0.55);
    border-radius: 6px;
    box-sizing: border-box;
    padding: 22px 0 0 0;
    cursor: move;
    user-select: none;
    transition: border-color 0.15s;
  }

  .clip-text-selection-box:hover,
  .clip-text-selection-box.is-active {
    border-color: rgba(59, 130, 246, 0.85);
    border-width: 2px;
  }

  /* Passive mode: no chrome, still visible; clicks pass to pill only */
  .clip-text-selection-box.clip-text--passive {
    border: none;
    padding: 0;
    cursor: default;
  }

  .clip-text-drag-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: move;
    border-radius: 4px 4px 0 0;
    background: rgba(59, 130, 246, 0.85);
    backdrop-filter: blur(4px);
    transition: background 0.15s;
  }

  .clip-text-drag-bar:hover {
    background: rgba(59, 130, 246, 0.95);
  }

  .clip-text-drag-label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: 0.1em;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .clip-text-selection-box:hover .resize-handle,
  .clip-text-selection-box.is-active .resize-handle {
    opacity: 1;
  }

  .clip-text-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    max-width: 100%;
  }

  .clip-text-pill-inner {
    max-width: 100%;
  }

  /* Subtitle word animation styles */
  .subtitle-text-container {
    display: flex;
    flex-wrap: wrap;
    /* justify-content is set dynamically via inline style based on textAlign */
    align-items: center;
  }

  /* Subtitle layering for crisp borders */
  .subtitle-word-stack {
    position: relative;
    display: inline-block;
    transition-property: transform, opacity, filter;
    transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    transform-origin: center;
    will-change: transform, opacity, filter;
  }

  /* ===== ANIMATION STYLES ===== */

  /* Zoom animation - scale up current word */
  .subtitle-word-stack.animation-zoom:has(.current-word) {
    transform: scale(1.15);
  }

  /* Karaoke animation - color change handled via JS, subtle scale */
  .subtitle-word-stack.animation-karaoke:has(.current-word) {
    transform: scale(1.05);
  }

  /* Pop/Bounce animation - bouncy scale effect */
  .subtitle-word-stack.animation-pop:has(.current-word) {
    animation: pop-bounce 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
  }

  @keyframes pop-bounce {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.25);
    }
    100% {
      transform: scale(1.1);
    }
  }

  /* Glow animation - glowing emphasis */
  .subtitle-word-stack.animation-glow:has(.current-word) {
    filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor);
    transform: scale(1.05);
  }

  /* Box highlight - background box (rendered via SVG rect) */
  .subtitle-word-stack.animation-box-highlight:has(.current-word) {
    transform: scale(1.02);
  }

  /* Typewriter animation - words appear as spoken */
  .subtitle-word-stack.animation-typewriter {
    transition-property: transform, opacity;
    transition-duration: 0.15s;
    transition-timing-function: ease-out;
  }

  /* Wave animation - wave effect across words */
  .subtitle-word-stack.animation-wave:has(.current-word) {
    animation: wave-float 0.4s ease-in-out;
  }

  @keyframes wave-float {
    0% {
      transform: translateY(0) scale(1);
    }
    25% {
      transform: translateY(-8px) scale(1.08);
    }
    50% {
      transform: translateY(-4px) scale(1.05);
    }
    75% {
      transform: translateY(-6px) scale(1.06);
    }
    100% {
      transform: translateY(0) scale(1.03);
    }
  }

  /* Single word animation - punchy entrance and exit */
  .subtitle-word-stack.animation-single-word {
    animation: single-word-punch 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  @keyframes single-word-punch {
    0% {
      opacity: 0;
      transform: scale(0.8) translateY(10px);
    }
    50% {
      opacity: 1;
      transform: scale(1.1) translateY(-2px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Watermark styling */
  .watermark-image {
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
    transition: opacity 0.3s ease;
  }

  /* Video element styling */
  video {
    background: #09090b;
  }

  /* Keyboard hint styling */
  kbd {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  }
</style>
