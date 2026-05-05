<template>
  <div class="sp-canvas">
    <div
      ref="canvasRef"
      class="sp-canvas__frame"
      :style="{ aspectRatio: `${aspectRatio.width}/${aspectRatio.height}` }"
    >
      <!-- Background: video > thumbnail > empty -->
      <video
        v-if="videoUrl"
        :src="videoUrl"
        :poster="thumbnailUrl || undefined"
        class="sp-canvas__bg"
        muted
        playsinline
        preload="metadata"
      />
      <img
        v-else-if="thumbnailUrl"
        :src="thumbnailUrl"
        class="sp-canvas__bg"
        alt=""
        draggable="false"
      />
      <div v-else class="sp-canvas__empty">
        <slot name="empty">
          <CaptionsIcon :size="28" class="opacity-30" />
        </slot>
      </div>

      <!-- Center alignment guides -->
      <div
        v-if="showSnapGuides && isDragging && nearVerticalCenter"
        class="sp-canvas__guide sp-canvas__guide--v"
      />
      <div
        v-if="showSnapGuides && isDragging && nearHorizontalCenter"
        class="sp-canvas__guide sp-canvas__guide--h"
      />

      <!-- Subtitle box -->
      <div
        v-if="subtitleSettings && (visibleWords.length > 0 || fallbackText)"
        class="sp-canvas__sub-box"
        :class="{
          'sp-canvas__sub-box--active': isDragging || isResizing,
          'sp-canvas__sub-box--single': subtitleSettings.animationStyle === 'single-word',
        }"
        :style="subtitleBoxStyle"
        @mousedown.prevent="startDrag"
      >
        <!-- Words rendered with full SVG styling -->
        <div
          v-if="visibleWords.length > 0"
          class="sp-canvas__sub-words"
          :class="{ 'sp-canvas__sub-words--single': subtitleSettings.animationStyle === 'single-word' }"
          :style="{ gap: wordGapStyle }"
        >
          <span
            v-for="(wordInfo, index) in visibleWords"
            :key="`sp-word-${wordInfo.start}-${index}`"
            class="sp-canvas__sub-word"
            :style="getWordMotionStyle(wordInfo)"
          >
            <!-- Hidden span sets the box dimensions for the SVG layers -->
            <span
              class="sp-canvas__sub-word-spacer"
              :style="subtitleSettings.animationStyle === 'single-word'
                ? { ...subtitleTextBaseStyle, paddingLeft: '0.2em', paddingRight: '0.2em' }
                : subtitleTextBaseStyle"
            >{{ displayWord(wordInfo) }}</span>
            <svg class="sp-canvas__sub-svg">
              <defs>
                <filter :id="`sp-shadow-${uid}-${index}`" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow
                    :dx="(subtitleSettings.shadowOffsetX ?? 0) * fontScale"
                    :dy="(subtitleSettings.shadowOffsetY ?? 0) * fontScale"
                    :stdDeviation="Math.max((subtitleSettings.shadowBlur ?? 0) * fontScale, 0)"
                    :flood-color="subtitleSettings.shadowColor || '#000000'"
                  />
                </filter>
              </defs>

              <!-- Border 2 (outer) with shadow -->
              <text
                v-if="subtitleSettings.border2Width > 0"
                x="50%"
                y="55%"
                dominant-baseline="middle"
                text-anchor="middle"
                :filter="hasShadow && subtitleSettings.border2Width > 0 ? `url(#sp-shadow-${uid}-${index})` : undefined"
                :style="{
                  fontFamily: subtitleSettings.fontFamily,
                  fontWeight: subtitleSettings.fontWeight,
                  fontSize: subtitleTextBaseStyle.fontSize,
                  letterSpacing: svgLetterSpacing,
                  stroke: subtitleSettings.border2Color || '#000000',
                  strokeWidth: Math.max((subtitleSettings.border1Width + subtitleSettings.border2Width) * 2 * fontScale, 2) + 'px',
                  strokeLinejoin: 'round',
                  strokeLinecap: 'round',
                  fill: 'none',
                }"
              >{{ displayWord(wordInfo) }}</text>

              <!-- Border 1 (inner) -->
              <text
                v-if="subtitleSettings.border1Width > 0"
                x="50%"
                y="55%"
                dominant-baseline="middle"
                text-anchor="middle"
                :filter="hasShadow && subtitleSettings.border2Width <= 0 ? `url(#sp-shadow-${uid}-${index})` : undefined"
                :style="{
                  fontFamily: subtitleSettings.fontFamily,
                  fontWeight: subtitleSettings.fontWeight,
                  fontSize: subtitleTextBaseStyle.fontSize,
                  letterSpacing: svgLetterSpacing,
                  stroke: subtitleSettings.border1Color,
                  strokeWidth: subtitleSettings.border1Width * 2 * fontScale + 'px',
                  strokeLinejoin: 'round',
                  strokeLinecap: 'round',
                  fill: 'none',
                }"
              >{{ displayWord(wordInfo) }}</text>

              <!-- Fill text -->
              <text
                x="50%"
                y="55%"
                dominant-baseline="middle"
                text-anchor="middle"
                :filter="hasShadow && subtitleSettings.border1Width <= 0 && subtitleSettings.border2Width <= 0 ? `url(#sp-shadow-${uid}-${index})` : undefined"
                :style="{
                  fontFamily: subtitleSettings.fontFamily,
                  fontWeight: subtitleSettings.fontWeight,
                  fontSize: subtitleTextBaseStyle.fontSize,
                  letterSpacing: svgLetterSpacing,
                  fill: getWordFillColor(wordInfo, index),
                }"
              >{{ displayWord(wordInfo) }}</text>

              <!-- Box highlight background -->
              <rect
                v-if="subtitleSettings.animationStyle === 'box-highlight' && isCurrentWord(wordInfo)"
                x="0"
                y="15%"
                width="100%"
                height="80%"
                rx="4"
                :fill="subtitleSettings.highlightColor || '#0ea5e9'"
                :style="{ opacity: 0.3 }"
              />
            </svg>
          </span>
        </div>

        <!-- Fallback text (no transcript) -->
        <div v-else class="sp-canvas__sub-fallback" :style="subtitleTextBaseStyle">
          {{ fallbackText }}
        </div>

        <!-- Corner resize handles -->
        <template v-if="subtitleSettings.animationStyle !== 'single-word'">
          <div
            v-for="corner in (['nw','ne','sw','se'] as const)"
            :key="corner"
            class="sp-canvas__handle"
            :class="`sp-canvas__handle--${corner}`"
            @mousedown.stop.prevent="(e) => startResize(e, corner)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue';
import { CaptionsIcon } from 'lucide-vue-next';
import type { SubtitleSettings, WordInfo, WhisperSegment } from '@/types';
import {
  getVisibleSubtitleWordsForClipTime,
  maxWordsChunkForAspectRatioString,
  transcriptWordsForWhisperSegment,
} from '@/utils/subtitleVisibleWords';

interface Props {
  /** Background image (e.g. first frame). */
  thumbnailUrl?: string | null;
  /** Optional video for live preview (overrides thumbnail). */
  videoUrl?: string | null;
  /** Output aspect ratio (drives reference width for font scaling). */
  aspectRatio?: { width: number; height: number };
  /** Subtitle styling (rendered via SVG layers). */
  subtitleSettings: SubtitleSettings | null;
  /** Box position; x/y are center percentages, width is canvas-percent. */
  subtitlePosition: { x: number; y: number; width?: number };
  /** Word-level transcript (drives visible chunk + animations). */
  transcriptWords?: WordInfo[];
  /** Segment-level transcript (used for chunk paging + static fallback). */
  transcriptSegments?: WhisperSegment[];
  /** Current playback time in clip-relative seconds. */
  videoTime?: number;
  /**
   * Static preview mode: when true and no words match `videoTime`, fall back to
   * the first segment's words so the user always sees a representative preview.
   */
  staticPreview?: boolean;
  /** Show snap-to-center guides while dragging. */
  showSnapGuides?: boolean;
  /** Fallback text when no transcript is available. */
  emptyText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  thumbnailUrl: null,
  videoUrl: null,
  aspectRatio: () => ({ width: 16, height: 9 }),
  transcriptWords: () => [],
  transcriptSegments: () => [],
  videoTime: 0,
  staticPreview: true,
  showSnapGuides: true,
  emptyText: 'Sample subtitle text',
});

const emit = defineEmits<{
  subtitlePositionChange: [position: { x: number; y: number; width?: number }];
  subtitleSettingsChange: [settings: SubtitleSettings];
}>();

const canvasRef = ref<HTMLElement | null>(null);
const uid = Math.random().toString(36).slice(2, 8);

// --- Position state -----------------------------------------------------
const localPosition = ref<{ x: number; y: number; width?: number }>({ ...props.subtitlePosition });
watch(
  () => props.subtitlePosition,
  (next) => {
    localPosition.value = { ...next };
  },
  { deep: true }
);

const SNAP_TOLERANCE_PCT = 1.5;
const isDragging = ref(false);
const isResizing = ref(false);

const nearVerticalCenter = computed(
  () => Math.abs(localPosition.value.x - 50) < SNAP_TOLERANCE_PCT
);
const nearHorizontalCenter = computed(
  () => Math.abs(localPosition.value.y - 50) < SNAP_TOLERANCE_PCT
);

// --- Aspect ratio + reference output dimensions -------------------------
const aspectRatioString = computed(
  () => `${props.aspectRatio.width}:${props.aspectRatio.height}`
);

/** Reference output width (px) so we can scale the canvas font correctly. */
const referenceOutputWidth = computed(() => {
  const ar = props.aspectRatio.width / props.aspectRatio.height;
  return ar >= 1 ? 1920 : 1080;
});

// --- Box geometry --------------------------------------------------------
/**
 * Wrap boundary as a percentage of the canvas width. The box itself uses
 * `width: max-content`, so this only matters when the rendered text would
 * overflow — at which point words wrap inside the dashed area. We no longer
 * special-case `single-word` because `max-content` already shrink-wraps to the
 * single rendered word; capping it here would just clip oversized fonts.
 */
const computedBoxWidthPct = computed(() => {
  return localPosition.value.width ?? props.subtitleSettings?.maxWidth ?? 80;
});

const subtitleBoxStyle = computed(() => {
  const w = computedBoxWidthPct.value;
  const x = localPosition.value.x;
  const y = localPosition.value.y;
  return {
    left: `${x}%`,
    top: `${y}%`,
    // Hug the actual rendered words (matches VideoPlayer/ProjectWorkspaceDialog).
    // maxWidth still acts as the wrap boundary, so the dashed box never extends
    // past the canvas, but short subtitles get a tight box and the user can
    // crank fontSize without being capped by a fixed-width container.
    width: 'max-content' as const,
    maxWidth: `${w}%`,
    transform: 'translate(-50%, -50%)' as const,
  };
});

// --- Font + text styling -------------------------------------------------
/** Scale from output pixels to canvas pixels. */
const fontScale = computed(() => {
  const w = canvasRef.value?.offsetWidth ?? 0;
  if (w <= 0) return 0.28;
  return w / referenceOutputWidth.value;
});

const subtitleTextBaseStyle = computed((): Record<string, string> => {
  const s = props.subtitleSettings;
  if (!s) return {};
  const fs = Math.max(6, Math.round(s.fontSize * fontScale.value));
  const styles: Record<string, string> = {
    fontSize: `${fs}px`,
    fontFamily: `"${s.fontFamily}", sans-serif`,
    fontWeight: String(s.fontWeight),
    color: s.textColor,
    lineHeight: String(s.lineHeight ?? 1.2),
    letterSpacing: `${(s.letterSpacing ?? 0) * fontScale.value}px`,
  };
  if (s.animationStyle === 'single-word') {
    styles.textTransform = 'uppercase';
  }
  return styles;
});

const svgLetterSpacing = computed(() => {
  const s = props.subtitleSettings;
  if (!s) return '0px';
  return `${(s.letterSpacing ?? 0) * fontScale.value}px`;
});

const wordGapStyle = computed(() => {
  const s = props.subtitleSettings;
  if (!s) return '0.35em';
  if (s.animationStyle === 'single-word') return '0';
  return `${(s.wordSpacing ?? 0.35)}em`;
});

const hasShadow = computed(
  () => (props.subtitleSettings?.shadowBlur ?? 0) > 0 ||
        Math.abs(props.subtitleSettings?.shadowOffsetX ?? 0) > 0 ||
        Math.abs(props.subtitleSettings?.shadowOffsetY ?? 0) > 0
);

// --- Visible words -------------------------------------------------------
const visibleWords = computed((): WordInfo[] => {
  if (!props.subtitleSettings) return [];
  const words = props.transcriptWords ?? [];
  const segments = props.transcriptSegments ?? [];
  if (!words.length || !segments.length) return [];

  const t = props.videoTime ?? 0;
  const fromTime = getVisibleSubtitleWordsForClipTime(
    t,
    words,
    segments,
    props.subtitleSettings.animationStyle,
    aspectRatioString.value
  );
  if (fromTime.length > 0) return fromTime;

  // Static fallback: first segment's words (chunked).
  if (props.staticPreview) {
    const firstSeg = segments[0];
    if (!firstSeg) return [];
    const segWords = transcriptWordsForWhisperSegment(firstSeg, words);
    if (!segWords.length) return [];
    if (props.subtitleSettings.animationStyle === 'single-word') {
      return [segWords[0]];
    }
    const max = maxWordsChunkForAspectRatioString(
      aspectRatioString.value,
      props.subtitleSettings.animationStyle
    );
    return segWords.slice(0, max);
  }
  return [];
});

const fallbackText = computed(() => {
  if (!props.subtitleSettings) return '';
  if (visibleWords.value.length > 0) return '';
  if (props.subtitleSettings.animationStyle === 'single-word') return 'WORD';
  return props.emptyText;
});

function displayWord(wordInfo: WordInfo): string {
  if (props.subtitleSettings?.animationStyle === 'single-word') {
    return wordInfo.word.toUpperCase();
  }
  return wordInfo.word;
}

// --- Highlights / animations --------------------------------------------
function isCurrentWord(word: WordInfo): boolean {
  const style = props.subtitleSettings?.animationStyle;
  if (!style) return false;
  if (style === 'single-word') {
    return visibleWords.value.some(
      (w) => w.start === word.start && w.end === word.end && w.word === word.word
    );
  }
  const t = props.videoTime ?? 0;
  if (t >= word.start && t < word.end) return true;
  const dt = t - word.start;
  if (dt > 0 && dt <= 0.05 && t < word.end) return true;
  return false;
}

function getWordIndexInTranscript(word: WordInfo): number {
  return (
    props.transcriptWords?.findIndex((w) => w.start === word.start && w.end === word.end) ?? 0
  );
}

function getMultiColor(idx: number): string {
  const s = props.subtitleSettings;
  if (!s) return '#FFFFFF';
  const palette = s.colorPalette && s.colorPalette.length > 0
    ? s.colorPalette
    : ['#04F827', '#0ea5e9', '#FFFD03', '#FFFFFF'];
  return palette[idx % palette.length];
}

function getWordFillColor(word: WordInfo, _i: number): string {
  const s = props.subtitleSettings;
  if (!s) return '#FFFFFF';
  const active = isCurrentWord(word);
  if (s.animationStyle === 'single-word') {
    if (s.multiColorEnabled) return getMultiColor(getWordIndexInTranscript(word));
    return s.textColor || '#FFFFFF';
  }
  if (active && (s.animationStyle === 'karaoke' || s.animationStyle === 'glow')) {
    return s.highlightColor || '#0ea5e9';
  }
  return s.textColor || '#FFFFFF';
}

function getWordMotionStyle(word: WordInfo): Record<string, string> {
  if (!props.subtitleSettings || !isCurrentWord(word)) return {};
  const style = props.subtitleSettings.animationStyle;
  if (style === 'zoom') return { transform: 'scale(1.14)', transformOrigin: 'bottom center' };
  if (style === 'pop') return { transform: 'scale(1.1)', transformOrigin: 'bottom center' };
  if (style === 'wave') return { transform: 'translateY(-3px)' };
  if (style === 'glow') {
    const hl = props.subtitleSettings.highlightColor || '#0ea5e9';
    return { filter: `drop-shadow(0 0 6px ${hl})` };
  }
  return {};
}

// --- Drag ---------------------------------------------------------------
let dragOffset = { x: 0, y: 0 };

function startDrag(event: MouseEvent) {
  if (!canvasRef.value) return;
  isDragging.value = true;
  const rect = canvasRef.value.getBoundingClientRect();
  const centerX = rect.left + (rect.width * localPosition.value.x) / 100;
  const centerY = rect.top + (rect.height * localPosition.value.y) / 100;
  dragOffset = { x: event.clientX - centerX, y: event.clientY - centerY };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(event: MouseEvent) {
  if (!isDragging.value || !canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  // Drag by center point; clamp to canvas. Matches VideoPlayer.onDragSubtitles
  // — no half-width bumper because the box hugs the words and very-large
  // fonts would otherwise refuse to track the cursor near the edges.
  let x = Math.max(0, Math.min(100, ((event.clientX - dragOffset.x - rect.left) / rect.width) * 100));
  let y = Math.max(0, Math.min(100, ((event.clientY - dragOffset.y - rect.top) / rect.height) * 100));

  if (Math.abs(x - 50) < SNAP_TOLERANCE_PCT) x = 50;
  if (Math.abs(y - 50) < SNAP_TOLERANCE_PCT) y = 50;

  localPosition.value = { ...localPosition.value, x, y };
  emit('subtitlePositionChange', { ...localPosition.value });
}

function onDragEnd() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

// --- Resize -------------------------------------------------------------
/**
 * Corner drag scales `fontSize` directly (matches VideoPlayer.startFontResize).
 * The selection box uses `width: max-content`, so it auto-grows with the text;
 * letting fontSize go up to 200 means the user is no longer capped by the box
 * dimensions. maxWidth (i.e. `localPosition.width`) is left untouched here —
 * the SubtitlePropertiesPanel's "Max Width" slider remains the place to control
 * wrap width, just like in ProjectWorkspaceDialog.
 */
function startResize(event: MouseEvent, corner: 'nw' | 'ne' | 'sw' | 'se') {
  if (!canvasRef.value || !props.subtitleSettings) return;
  isResizing.value = true;

  const rect = canvasRef.value.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startFontSize = props.subtitleSettings.fontSize || 32;
  const settingsSnapshot = props.subtitleSettings;

  function onMove(e: MouseEvent) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    // For each corner, "outward" drag (away from center) increases font size.
    const signX = corner === 'ne' || corner === 'se' ? 1 : -1;
    const signY = corner === 'sw' || corner === 'se' ? 1 : -1;
    const delta = (dx * signX + dy * signY) / 2;
    // Scale relative to canvas height so the gesture feels consistent across
    // ratios (mirrors VideoPlayer onFontResize: `(delta / height) * 200`).
    const scaledDelta = (delta / rect.height) * 200;
    const newFontSize = Math.round(
      Math.max(8, Math.min(200, startFontSize + scaledDelta))
    );

    const base = props.subtitleSettings ?? settingsSnapshot;
    emit('subtitleSettingsChange', { ...base, fontSize: newFontSize });
  }

  function onUp() {
    isResizing.value = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  event.preventDefault();
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
});
</script>

<style scoped>
.sp-canvas {
  position: relative;
  width: 100%;
}

.sp-canvas__frame {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: visible;
  border: 1px solid var(--sidebar-border, #2d2d33);
  user-select: none;
}

.sp-canvas__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  pointer-events: none;
  display: block;
}

.sp-canvas__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #52525b;
}

/* Snap guides */
.sp-canvas__guide {
  position: absolute;
  background: rgba(250, 204, 21, 0.85);
  pointer-events: none;
  z-index: 50;
}
.sp-canvas__guide--v {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
}
.sp-canvas__guide--h {
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  transform: translateY(-50%);
}

/* Subtitle box */
.sp-canvas__sub-box {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  z-index: 10;
  border-radius: 4px;
  background: rgba(88, 28, 135, 0.12);
  outline: 1px solid rgba(168, 85, 247, 0.55);
  transition: outline-color 120ms ease;
  padding: 4px 6px;
  box-sizing: border-box;
}
.sp-canvas__sub-box:hover {
  outline-color: rgba(192, 132, 252, 0.9);
}
.sp-canvas__sub-box--active {
  outline: 2px solid rgba(192, 132, 252, 1);
}
.sp-canvas__sub-box--single {
  background: rgba(88, 28, 135, 0.05);
}

.sp-canvas__sub-words {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.sp-canvas__sub-words--single {
  flex-wrap: nowrap;
}

.sp-canvas__sub-word {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  transition: transform 150ms ease;
}

.sp-canvas__sub-word-spacer {
  visibility: hidden;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  display: inline-block;
}

.sp-canvas__sub-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.sp-canvas__sub-fallback {
  text-align: center;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Resize handles */
.sp-canvas__handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #a855f7;
  border: 1px solid #fff;
  border-radius: 1px;
  z-index: 20;
}
.sp-canvas__handle--nw { top: 0;    left: 0;    transform: translate(-50%, -50%); cursor: nwse-resize; }
.sp-canvas__handle--ne { top: 0;    right: 0;   transform: translate(50%, -50%);  cursor: nesw-resize; }
.sp-canvas__handle--sw { bottom: 0; left: 0;    transform: translate(-50%, 50%);  cursor: nesw-resize; }
.sp-canvas__handle--se { bottom: 0; right: 0;   transform: translate(50%, 50%);   cursor: nwse-resize; }
</style>
