<template>
  <div class="pp" :class="{ 'pp--embedded': variant === 'embedded' }">
    <!-- Header (hidden when embedded — parent provides its own Cancel/Done bar) -->
    <div v-if="variant !== 'embedded'" class="pp__header">
      <button class="pp__back" type="button" title="Back to clips" aria-label="Back to clips" @click="$emit('close')">
        <ChevronLeft :size="16" />
      </button>
      <span class="pp__title">Subtitles</span>
    </div>

    <!-- Single scrolling body -->
    <div class="pp__body">
      <!-- ── TRANSCRIPT ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Transcript <span class="pp__section-hint">· edit to fix typos</span></div>
        <div class="sp__segments">
          <div
            v-for="(seg, si) in editableSegments"
            :key="segmentRowKey(seg, si)"
            :ref="(el) => setSegmentRef(el, si)"
            class="sp__seg"
            :class="{ 'sp__seg--active': isActiveSegment(seg) }"
          >
            <span class="sp__seg-ts">{{ formatTime(seg.start) }}</span>
            <textarea
              class="pp__textarea sp__seg-ta"
              :value="seg.text"
              rows="1"
              @input="onSegmentTextInput(si, ($event.target as HTMLTextAreaElement).value)"
              @blur="onSegmentTextBlur(si, ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
          <div v-if="editableSegments.length === 0" class="sp__empty">No transcript for this clip.</div>
        </div>
      </div>

      <!-- ── ANIMATION STYLE ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Animation style</div>
        <div class="sp__style-grid">
          <button
            v-for="style in animationStyles"
            :key="style.id"
            type="button"
            class="pp__tile sp__style-btn"
            :class="{ 'pp__tile--active': settings.animationStyle === style.id }"
            @click="update('animationStyle', style.id)"
          >
            <span class="sp__style-name">{{ style.name }}</span>
            <span class="sp__style-desc">{{ style.desc }}</span>
          </button>
        </div>
      </div>

      <!-- ── MULTI-COLOR (Single-Word Mode Only) ── -->
      <div v-if="settings.animationStyle === 'single-word'" class="pp__section">
        <div class="pp__section-hd-row">
          <div>
            <div class="pp__section-hd">Multi-color words</div>
            <p class="pp__hint">Cycle through colors for each word</p>
          </div>
          <label class="pp__toggle">
            <input
              type="checkbox"
              :checked="settings.multiColorEnabled"
              @change="update('multiColorEnabled', ($event.target as HTMLInputElement).checked)"
            />
            <span class="pp__toggle-track"><span class="pp__toggle-thumb"></span></span>
          </label>
        </div>

        <div v-if="settings.multiColorEnabled" class="pp__stack pp__mt">
          <div>
            <label class="sp__radio-option">
              <input
                type="radio"
                name="multiColorMode"
                :checked="settings.multiColorMode === 'default'"
                @change="update('multiColorMode', 'default')"
              />
              <span class="sp__radio-label">Default palette</span>
            </label>
            <div class="sp__color-palette-preview">
              <span class="sp__palette-dot" style="background: #04f827" title="Green"></span>
              <span class="sp__palette-dot" style="background: #0ea5e9" title="Cyan"></span>
              <span class="sp__palette-dot" style="background: #fffd03" title="Yellow"></span>
              <span class="sp__palette-dot" style="background: #ffffff" title="White"></span>
            </div>
          </div>

          <label class="sp__radio-option">
            <input
              type="radio"
              name="multiColorMode"
              :checked="settings.multiColorMode === 'custom'"
              @change="update('multiColorMode', 'custom')"
            />
            <span class="sp__radio-label">Custom palette</span>
          </label>

          <div v-if="settings.multiColorMode === 'custom'" class="sp__color-palette">
            <div v-for="(color, index) in settings.colorPalette" :key="index" class="pp__swatch-row">
              <label class="pp__swatch-wrap">
                <input type="color" :value="color" @input="updatePaletteColor(index, ($event.target as HTMLInputElement).value)" />
                <span class="pp__swatch" :style="{ background: color }"></span>
              </label>
              <input
                class="pp__hex"
                type="text"
                :value="color"
                maxlength="7"
                @change="updatePaletteColor(index, ($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="settings.colorPalette.length > 1"
                type="button"
                class="sp__icon-btn"
                title="Remove color"
                aria-label="Remove color"
                @click="removePaletteColor(index)"
              >
                <X :size="14" />
              </button>
            </div>
            <button type="button" class="sp__btn-add" @click="addPaletteColor">
              <Plus :size="14" />
              Add color
            </button>
          </div>
        </div>
      </div>

      <!-- ── HIGHLIGHT COLOR (Karaoke/Pop/Zoom Modes) ── -->
      <div v-if="['karaoke', 'pop', 'zoom'].includes(settings.animationStyle)" class="pp__section">
        <div class="pp__section-hd">Highlight color</div>
        <p class="pp__hint pp__mb">Color when word is active</p>

        <div class="sp__preset-colors">
          <button
            v-for="preset in highlightColorPresets"
            :key="preset.value"
            type="button"
            class="sp__color-preset"
            :class="{ 'sp__color-preset--active': settings.highlightColor === preset.value }"
            :style="{ background: preset.value }"
            :title="preset.name"
            :aria-label="preset.name"
            @click="update('highlightColor', preset.value)"
          ></button>

          <button
            type="button"
            class="sp__color-preset sp__color-preset--custom"
            :class="{ 'sp__color-preset--active': isCustomHighlightColor }"
            title="Custom color"
            aria-label="Custom color"
            @click="showCustomHighlightPicker = true"
          >
            <span v-if="isCustomHighlightColor" class="sp__color-preset-swatch" :style="{ background: settings.highlightColor }"></span>
            <Pipette v-else :size="14" />
          </button>
        </div>

        <div v-if="showCustomHighlightPicker || isCustomHighlightColor" class="pp__swatch-row pp__mt">
          <label class="pp__swatch-wrap">
            <input
              type="color"
              :value="settings.highlightColor"
              @input="update('highlightColor', ($event.target as HTMLInputElement).value)"
            />
            <span class="pp__swatch" :style="{ background: settings.highlightColor }"></span>
          </label>
          <input
            class="pp__hex"
            type="text"
            :value="settings.highlightColor"
            maxlength="7"
            @change="update('highlightColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <!-- ── FONT ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Font</div>
        <div class="pp__font-grid">
          <button
            v-for="f in fonts"
            :key="f"
            type="button"
            class="pp__font-btn"
            :class="{ 'pp__font-btn--active': settings.fontFamily === f }"
            :style="{ fontFamily: f }"
            @click="update('fontFamily', f)"
          >
            {{ f }}
          </button>
        </div>

        <div class="pp__field pp__mt">
          <span class="pp__label">Size <em class="pp__val">{{ settings.fontSize }}px</em></span>
          <input
            type="range"
            class="pp__slider"
            :value="settings.fontSize"
            min="8"
            max="120"
            step="1"
            @input="update('fontSize', Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <div class="pp__field pp__mt">
          <span class="pp__label">Weight</span>
          <div class="pp__seg-ctrl pp__seg-ctrl--block">
            <button
              v-for="w in weights"
              :key="w.v"
              type="button"
              class="pp__seg-btn"
              :class="{ 'pp__seg-btn--active': settings.fontWeight === w.v }"
              @click="update('fontWeight', w.v)"
            >
              {{ w.l }}
            </button>
          </div>
        </div>

        <div class="pp__field pp__mt">
          <span class="pp__label">Alignment</span>
          <div class="pp__seg-ctrl">
            <button
              type="button"
              class="pp__seg-btn"
              :class="{ 'pp__seg-btn--active': settings.textAlign === 'left' }"
              title="Align left"
              aria-label="Align left"
              @click="update('textAlign', 'left')"
            >
              <AlignLeft :size="14" />
            </button>
            <button
              type="button"
              class="pp__seg-btn"
              :class="{ 'pp__seg-btn--active': settings.textAlign === 'center' }"
              title="Align center"
              aria-label="Align center"
              @click="update('textAlign', 'center')"
            >
              <AlignCenter :size="14" />
            </button>
            <button
              type="button"
              class="pp__seg-btn"
              :class="{ 'pp__seg-btn--active': settings.textAlign === 'right' }"
              title="Align right"
              aria-label="Align right"
              @click="update('textAlign', 'right')"
            >
              <AlignRight :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- ── COLORS ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Colors</div>
        <p class="pp__hint pp__mb">Subtitle fill and karaoke highlight</p>
        <div class="pp__colors-grid">
          <div v-for="ci in colorItems" :key="ci.key" class="pp__colors-row">
            <span class="pp__label">{{ ci.label }}</span>
            <div class="pp__swatch-row pp__colors-swatch-row">
              <label class="pp__swatch-wrap">
                <input
                  type="color"
                  :value="(settings as any)[ci.key]"
                  @input="update(ci.key as any, ($event.target as HTMLInputElement).value)"
                />
                <span class="pp__swatch" :style="{ background: (settings as any)[ci.key] }"></span>
              </label>
              <input
                class="pp__hex"
                type="text"
                :value="(settings as any)[ci.key]"
                maxlength="7"
                @change="update(ci.key as any, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ── OUTLINE ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Outline</div>
        <p class="pp__hint pp__mb">Layered strokes (Border 1 on top, Border 2 behind it)</p>
        <div class="pp__stack">
          <div class="pp__row2">
            <div class="pp__field">
              <span class="pp__label">Border 1 <em class="pp__val">{{ settings.border1Width }}px</em></span>
              <input
                type="range"
                class="pp__slider"
                :value="settings.border1Width"
                min="0"
                max="20"
                step="1"
                @input="update('border1Width', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
            <div class="pp__field">
              <span class="pp__label">Border 1 color</span>
              <div class="pp__swatch-row">
                <label class="pp__swatch-wrap">
                  <input
                    type="color"
                    :value="settings.border1Color"
                    @input="update('border1Color', ($event.target as HTMLInputElement).value)"
                  />
                  <span class="pp__swatch" :style="{ background: settings.border1Color }"></span>
                </label>
                <input
                  class="pp__hex"
                  type="text"
                  :value="settings.border1Color"
                  maxlength="7"
                  @change="update('border1Color', ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
          <div class="pp__row2">
            <div class="pp__field">
              <span class="pp__label">Border 2 <em class="pp__val">{{ settings.border2Width }}px</em></span>
              <input
                type="range"
                class="pp__slider"
                :value="settings.border2Width"
                min="0"
                max="20"
                step="1"
                @input="update('border2Width', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
            <div class="pp__field">
              <span class="pp__label">Border 2 color</span>
              <div class="pp__swatch-row">
                <label class="pp__swatch-wrap">
                  <input
                    type="color"
                    :value="settings.border2Color"
                    @input="update('border2Color', ($event.target as HTMLInputElement).value)"
                  />
                  <span class="pp__swatch" :style="{ background: settings.border2Color }"></span>
                </label>
                <input
                  class="pp__hex"
                  type="text"
                  :value="settings.border2Color"
                  maxlength="7"
                  @change="update('border2Color', ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── BACKGROUND ── -->
      <div class="pp__section">
        <div class="pp__section-hd-row">
          <span class="pp__section-hd">Background</span>
          <label class="pp__toggle">
            <input
              type="checkbox"
              :checked="settings.backgroundEnabled"
              @change="update('backgroundEnabled', ($event.target as HTMLInputElement).checked)"
            />
            <span class="pp__toggle-track"><span class="pp__toggle-thumb"></span></span>
          </label>
        </div>
        <div v-if="settings.backgroundEnabled" class="pp__stack pp__mt">
          <div class="pp__row2">
            <div class="pp__field">
              <span class="pp__label">Color</span>
              <div class="pp__swatch-row">
                <label class="pp__swatch-wrap">
                  <input
                    type="color"
                    :value="settings.backgroundColor"
                    @input="update('backgroundColor', ($event.target as HTMLInputElement).value)"
                  />
                  <span class="pp__swatch" :style="{ background: settings.backgroundColor }"></span>
                </label>
                <input
                  class="pp__hex"
                  type="text"
                  :value="settings.backgroundColor"
                  maxlength="7"
                  @change="update('backgroundColor', ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
            <div class="pp__field">
              <span class="pp__label">Padding <em class="pp__val">{{ settings.padding }}px</em></span>
              <input
                type="range"
                class="pp__slider"
                :value="settings.padding"
                min="0"
                max="40"
                step="1"
                @input="update('padding', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>
          <div class="pp__field">
            <span class="pp__label">Corner radius <em class="pp__val">{{ settings.borderRadius }}px</em></span>
            <input
              type="range"
              class="pp__slider"
              :value="settings.borderRadius"
              min="0"
              max="40"
              step="1"
              @input="update('borderRadius', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </div>

      <!-- ── SHADOW ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Shadow</div>
        <p class="pp__hint pp__mb">Soft glow behind the subtitle</p>
        <div class="pp__row2">
          <div class="pp__field">
            <span class="pp__label">Blur <em class="pp__val">{{ settings.shadowBlur }}px</em></span>
            <input
              type="range"
              class="pp__slider"
              :value="settings.shadowBlur"
              min="0"
              max="30"
              step="1"
              @input="update('shadowBlur', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div class="pp__field">
            <span class="pp__label">Color</span>
            <div class="pp__swatch-row">
              <label class="pp__swatch-wrap">
                <input
                  type="color"
                  :value="settings.shadowColor"
                  @input="update('shadowColor', ($event.target as HTMLInputElement).value)"
                />
                <span class="pp__swatch" :style="{ background: settings.shadowColor }"></span>
              </label>
              <input
                class="pp__hex"
                type="text"
                :value="settings.shadowColor"
                maxlength="7"
                @change="update('shadowColor', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ── SPACING ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Spacing</div>
        <div class="pp__row2">
          <div class="pp__field">
            <span class="pp__label">Line height <em class="pp__val">{{ settings.lineHeight }}</em></span>
            <input
              type="range"
              class="pp__slider"
              :value="settings.lineHeight"
              min="0.8"
              max="3"
              step="0.05"
              @input="update('lineHeight', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div class="pp__field">
            <span class="pp__label">Letter spacing <em class="pp__val">{{ settings.letterSpacing }}px</em></span>
            <input
              type="range"
              class="pp__slider"
              :value="settings.letterSpacing"
              min="-5"
              max="20"
              step="0.5"
              @input="update('letterSpacing', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </div>

      <!-- ── REMOVE FROM THIS CLIP ── -->
      <div class="pp__section pp__section--danger">
        <button class="pp__delete-btn" type="button" @click="$emit('delete')">
          <Trash2 :size="14" />
          Remove subtitles from this clip
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronLeft, AlignLeft, AlignCenter, AlignRight, Trash2, Pipette, Plus, X } from 'lucide-vue-next';

import type { SubtitleSettings } from '@/types';

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  /** When set, stable row identity for the workspace transcript editor */
  whisperSegmentIndex?: number;
  wordIndex?: number | null;
  wordEndIndex?: number | null;
  sourceStart?: number;
  sourceEnd?: number;
}

interface Props {
  settings: SubtitleSettings;
  segments: TranscriptSegment[];
  currentTime?: number;
  variant?: 'standalone' | 'embedded';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updateSettings', settings: Partial<SubtitleSettings>): void;
  /** Live in-memory sync (preview) while typing */
  (e: 'draftSegmentText', segmentIndex: number, text: string, segment?: TranscriptSegment): void;
  /** Persist to storage (call on blur) */
  (e: 'commitSegmentText', segmentIndex: number, text: string, segment?: TranscriptSegment): void;
  (e: 'delete'): void;
}>();

const fonts = [
  'Montserrat', 'Impact', 'Inter', 'Oswald', 'Poppins',
  'Roboto', 'Open Sans', 'Lato', 'Arial', 'Verdana',
  'Georgia', 'Courier New',
];

const weights = [
  { v: 400, l: 'Regular' },
  { v: 600, l: 'Semi' },
  { v: 700, l: 'Bold' },
  { v: 800, l: 'Extra' },
  { v: 900, l: 'Black' },
];

const colorItems = [
  { key: 'textColor',      label: 'Text' },
  { key: 'highlightColor', label: 'Highlight' },
];

const animationStyles: { id: SubtitleSettings['animationStyle']; name: string; desc: string }[] = [
  { id: 'karaoke', name: 'Karaoke', desc: 'Word-by-word color highlight' },
  { id: 'zoom', name: 'Zoom', desc: 'Current word scales up' },
  { id: 'pop', name: 'Pop', desc: 'Bouncy emphasis effect' },
  { id: 'glow', name: 'Glow', desc: 'Glowing word highlight' },
  { id: 'wave', name: 'Wave', desc: 'Floating wave motion' },
  { id: 'single-word', name: 'Single Word', desc: 'One word at a time with punchy effect' },
  { id: 'none', name: 'None', desc: 'Static text, no animation' },
];

const editableSegments = ref<TranscriptSegment[]>([]);
const segmentRefs = ref<HTMLElement[]>([]);
const lastScrolledActiveIndex = ref(-1);
/** Rows edited since last successful blur-commit (flushed on unmount so tab switches still save). */
const dirtySegmentIndices = ref(new Set<number>());
const dirtySegmentSources = ref(new Map<number, TranscriptSegment>());

watch(() => props.segments, (segs) => {
  segmentRefs.value = [];
  lastScrolledActiveIndex.value = -1;
  editableSegments.value = segs.map((s, index) => {
    if (dirtySegmentIndices.value.has(index)) {
      return { ...s, text: editableSegments.value[index]?.text ?? s.text };
    }
    return { ...s };
  });
}, { immediate: true });

onBeforeUnmount(() => {
  for (const index of dirtySegmentIndices.value) {
    const text = editableSegments.value[index]?.text ?? '';
    emit('commitSegmentText', index, text, dirtySegmentSources.value.get(index));
  }
  dirtySegmentIndices.value = new Set();
  dirtySegmentSources.value = new Map();
});

const activeSegmentIndex = computed(() => {
  const t = props.currentTime ?? 0;
  return editableSegments.value.findIndex((seg) => t >= seg.start && t < seg.end);
});

watch(activeSegmentIndex, async (index) => {
  if (index < 0 || index === lastScrolledActiveIndex.value) return;
  lastScrolledActiveIndex.value = index;
  await nextTick();
  segmentRefs.value[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

function setSegmentRef(el: unknown, index: number) {
  if (el instanceof HTMLElement) {
    segmentRefs.value[index] = el;
  }
}

function segmentRowKey(seg: TranscriptSegment, i: number) {
  if (seg.whisperSegmentIndex != null && typeof seg.wordIndex === 'number') {
    return `ws${seg.whisperSegmentIndex}-w${seg.wordIndex}`;
  }
  if (seg.whisperSegmentIndex != null) {
    return `ws${seg.whisperSegmentIndex}-seg`;
  }
  return `row-${i}`;
}

const previewBg = computed(() => ({
  background: props.settings.backgroundEnabled ? props.settings.backgroundColor : '#1a1a1a',
}));

const previewTextStyle = computed(() => {
  const s = props.settings;
  const shadows: string[] = [];
  if (s.border2Width > 0) {
    const b = s.border2Width;
    shadows.push(`${b}px ${b}px 0 ${s.border2Color}`, `-${b}px ${b}px 0 ${s.border2Color}`,
      `${b}px -${b}px 0 ${s.border2Color}`, `-${b}px -${b}px 0 ${s.border2Color}`);
  }
  if (s.shadowBlur > 0) shadows.push(`${s.shadowOffsetX || 2}px ${s.shadowOffsetY || 2}px ${s.shadowBlur}px ${s.shadowColor}`);
  return {
    fontFamily: s.fontFamily,
    fontSize: `${Math.min(s.fontSize, 36)}px`,
    fontWeight: String(s.fontWeight),
    color: s.textColor,
    letterSpacing: `${s.letterSpacing}px`,
    lineHeight: String(s.lineHeight),
    textShadow: shadows.join(', ') || 'none',
    padding: s.backgroundEnabled ? `${s.padding}px ${Math.round(s.padding * 1.5)}px` : '0',
    borderRadius: s.backgroundEnabled ? `${s.borderRadius}px` : '0',
    background: s.backgroundEnabled ? s.backgroundColor : 'transparent',
  };
});

function isActiveSegment(seg: TranscriptSegment) {
  const t = props.currentTime ?? 0;
  return t >= seg.start && t < seg.end;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Get default settings for a specific animation style
function getStyleDefaults(styleId: string): Partial<SubtitleSettings> {
  const defaults: Record<string, Partial<SubtitleSettings>> = {
    'single-word': {
      // CapCut-style defaults for single-word
      fontFamily: 'Montserrat',
      fontSize: 80,
      fontWeight: 900,
      textColor: '#FFFFFF',
      border1Width: 8,
      border1Color: '#000000',
      border2Width: 0,
      border2Color: '#000000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowColor: '#000000',
      backgroundEnabled: false,
      backgroundColor: 'transparent',
      multiColorEnabled: false,
      highlightColor: '#FFFFFF',
    },
    'karaoke': {
      fontFamily: 'Montserrat',
      fontSize: 48,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 3,
      border1Color: '#000000',
      border2Width: 0,
      border2Color: '#000000',
      shadowBlur: 0,
      highlightColor: '#0ea5e9',
      backgroundEnabled: false,
      backgroundColor: 'transparent',
    },
    'zoom': {
      fontFamily: 'Montserrat',
      fontSize: 48,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 3,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 0,
      highlightColor: '#22D3EE',
      backgroundEnabled: false,
    },
    'pop': {
      fontFamily: 'Montserrat',
      fontSize: 48,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 3,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 0,
      highlightColor: '#EC4899',
      backgroundEnabled: false,
    },
    'glow': {
      fontFamily: 'Montserrat',
      fontSize: 44,
      fontWeight: 700,
      textColor: '#FFFFFF',
      border1Width: 0,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 15,
      shadowColor: '#22D3EE',
      highlightColor: '#22D3EE',
      backgroundEnabled: false,
    },
    'wave': {
      fontFamily: 'Montserrat',
      fontSize: 42,
      fontWeight: 600,
      textColor: '#FFFFFF',
      border1Width: 2,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 4,
      shadowColor: 'rgba(0,0,0,0.8)',
      backgroundEnabled: false,
    },
    'none': {
      fontFamily: 'Montserrat',
      fontSize: 42,
      fontWeight: 600,
      textColor: '#FFFFFF',
      border1Width: 0,
      border1Color: '#000000',
      border2Width: 0,
      shadowBlur: 4,
      shadowColor: 'rgba(0,0,0,0.8)',
      backgroundEnabled: false,
    },
  };
  
  return defaults[styleId] || {};
}

function update<K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) {
  // When changing animation style, apply style-specific defaults
  if (key === 'animationStyle') {
    const styleDefaults = getStyleDefaults(value as string);
    emit('updateSettings', { ...styleDefaults, [key]: value } as Partial<SubtitleSettings>);
  } else {
    emit('updateSettings', { [key]: value } as Partial<SubtitleSettings>);
  }
}

function onSegmentTextInput(index: number, text: string) {
  if (!dirtySegmentSources.value.has(index) && editableSegments.value[index]) {
    dirtySegmentSources.value.set(index, { ...editableSegments.value[index] });
  }
  if (editableSegments.value[index]) {
    editableSegments.value[index].text = text;
  }
  dirtySegmentIndices.value.add(index);
  emit('draftSegmentText', index, text, dirtySegmentSources.value.get(index));
}

function onSegmentTextBlur(index: number, text: string) {
  const sourceSegment = dirtySegmentSources.value.get(index);
  dirtySegmentIndices.value.delete(index);
  dirtySegmentSources.value.delete(index);
  emit('commitSegmentText', index, text, sourceSegment);
}

// Highlight color presets
const highlightColorPresets = [
  { name: 'Neon Green', value: '#04F827' },
  { name: 'Yellow', value: '#FFFD03' },
  { name: 'App Cyan', value: '#0ea5e9' },
];

// Check if current highlight color is a custom color (not in presets)
const isCustomHighlightColor = computed(() => {
  return !highlightColorPresets.some(p => p.value === props.settings.highlightColor);
});

// Show custom highlight picker
const showCustomHighlightPicker = ref(false);

// Multi-color palette helper functions
function updatePaletteColor(index: number, color: string) {
  const newPalette = [...props.settings.colorPalette];
  newPalette[index] = color;
  update('colorPalette', newPalette);
}

function addPaletteColor() {
  const newPalette = [...props.settings.colorPalette, '#FFFFFF'];
  update('colorPalette', newPalette);
}

function removePaletteColor(index: number) {
  const newPalette = props.settings.colorPalette.filter((_, i) => i !== index);
  update('colorPalette', newPalette);
}

// Initialize colorPalette if empty when custom mode is selected
watch(() => [props.settings.multiColorMode, props.settings.colorPalette.length], ([mode, length]) => {
  if (mode === 'custom' && length === 0) {
    // Initialize with default palette colors
    update('colorPalette', ['#04F827', '#0ea5e9', '#FFFD03', '#FFFFFF']);
  }
});

</script>

<style scoped src="./propertyPanel.css"></style>

<style scoped>
/* Subtitle-specific pieces; shared inspector controls live in propertyPanel.css */

/* Transcript */
.sp__segments {
  display: flex;
  max-height: 200px;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.sp__seg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  transition:
    border-color 0.12s ease,
    background-color 0.12s ease;
}

.sp__seg--active {
  border-color: var(--brand-line);
  background: var(--brand-soft);
}

/* No “live playback” segment highlight in creator defaults */
.pp--embedded .sp__seg--active {
  border-color: transparent;
  background: transparent;
}

.sp__seg-ts {
  min-width: 32px;
  padding-top: 7px;
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--fg-subtle);
}

.sp__seg-ta {
  font-size: var(--text-xs);
}

.sp__empty {
  padding: 12px 0;
  text-align: center;
  font-size: var(--text-xs);
  color: var(--fg-subtle);
}

/* Animation style tiles */
.sp__style-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.sp__style-btn {
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 2px;
  padding: 7px 10px;
  text-align: left;
}

.sp__style-name {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--fg);
}

.pp__tile--active .sp__style-name {
  color: var(--brand);
}

.sp__style-desc {
  font-size: var(--text-2xs);
  line-height: var(--text-2xs--line-height);
  color: var(--fg-subtle);
}

/* Multi-color palette */
.sp__radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.sp__radio-option input[type='radio'] {
  margin: 0;
  accent-color: var(--brand);
  cursor: pointer;
}

.sp__radio-label {
  font-size: var(--text-sm);
  color: var(--fg);
}

.sp__color-palette-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0 22px;
}

/* Swatches below are user palette colors */
.sp__palette-dot {
  width: 18px;
  height: 18px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
}

.sp__color-palette {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 22px;
}

.sp__icon-btn {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: var(--control-sm);
  height: var(--control-sm);
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-subtle);
  cursor: pointer;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.sp__icon-btn:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.sp__btn-add {
  display: inline-flex;
  height: var(--control-sm);
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-muted);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    color 150ms ease;
}

.sp__btn-add:hover {
  border-color: var(--brand-line);
  color: var(--fg);
}

/* Highlight presets (swatch colors are user content) */
.sp__preset-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sp__color-preset {
  display: grid;
  place-items: center;
  width: var(--control-sm);
  height: var(--control-sm);
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: box-shadow 150ms ease;
}

.sp__color-preset:hover {
  box-shadow: 0 0 0 2px var(--line-strong);
}

.sp__color-preset--active,
.sp__color-preset--active:hover {
  box-shadow:
    0 0 0 2px var(--panel),
    0 0 0 4px var(--brand);
}

.sp__color-preset--custom {
  overflow: hidden;
  border-style: dashed;
  background: transparent;
  color: var(--fg-muted);
}

.sp__color-preset-swatch {
  width: 100%;
  height: 100%;
}
</style>
