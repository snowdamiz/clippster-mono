<template>
  <div class="sp">
    <!-- Header -->
    <div class="sp__header">
      <button class="sp__back" @click="$emit('close')" title="Back to Clips">
        <ChevronLeft :size="15" />
      </button>
      <span class="sp__title">Subtitles</span>
    </div>

    <!-- Single scrolling body -->
    <div class="sp__body">

      <!-- ── TRANSCRIPT ── -->
      <div class="sp__section">
        <div class="sp__section-hd">Transcript <span class="sp__section-hint">· edit to fix typos</span></div>
        <div class="sp__segments">
          <div
            v-for="(seg, si) in editableSegments"
            :key="si"
            class="sp__seg"
            :class="{ 'sp__seg--active': isActiveSegment(seg) }"
          >
            <span class="sp__seg-ts">{{ formatTime(seg.start) }}</span>
            <textarea
              class="sp__seg-ta"
              :value="seg.text"
              rows="2"
              @input="onSegmentTextChange(si, ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
          <div v-if="editableSegments.length === 0" class="sp__empty">No transcript for this clip.</div>
        </div>
      </div>

      <!-- ── ANIMATION STYLE ── -->
      <div class="sp__section">
        <div class="sp__section-hd">Animation Style</div>
        <div class="sp__style-grid">
          <button
            v-for="style in animationStyles"
            :key="style.id"
            class="sp__style-btn"
            :class="{ 'sp__style-btn--active': settings.animationStyle === style.id }"
            @click="update('animationStyle', style.id)"
          >
            <span class="sp__style-name">{{ style.name }}</span>
            <span class="sp__style-desc">{{ style.desc }}</span>
          </button>
        </div>
      </div>

      <!-- ── FONT ── -->
      <div class="sp__section">
        <div class="sp__section-hd">Font</div>
        <div class="sp__font-grid">
          <button
            v-for="f in fonts" :key="f"
            class="sp__font-btn"
            :class="{ 'sp__font-btn--active': settings.fontFamily === f }"
            :style="{ fontFamily: f }"
            @click="update('fontFamily', f)"
          >{{ f }}</button>
        </div>

        <div class="sp__row2 sp__mt">
          <div class="sp__field">
            <span class="sp__label">Size <em class="sp__val">{{ settings.fontSize }}px</em></span>
            <input type="range" class="sp__slider" :value="settings.fontSize" min="8" max="120" step="1"
              @input="update('fontSize', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="sp__field">
            <span class="sp__label">Weight</span>
            <div class="sp__pill-row">
              <button v-for="w in weights" :key="w.v" class="sp__pill"
                :class="{ 'sp__pill--active': settings.fontWeight === w.v }"
                @click="update('fontWeight', w.v)">{{ w.l }}</button>
            </div>
          </div>
        </div>

        <div class="sp__field sp__mt">
          <span class="sp__label">Alignment</span>
          <div class="sp__seg-ctrl">
            <button class="sp__seg-btn" :class="{ 'sp__seg-btn--active': settings.textAlign === 'left' }" @click="update('textAlign', 'left')"><AlignLeft :size="13" /></button>
            <button class="sp__seg-btn" :class="{ 'sp__seg-btn--active': settings.textAlign === 'center' }" @click="update('textAlign', 'center')"><AlignCenter :size="13" /></button>
            <button class="sp__seg-btn" :class="{ 'sp__seg-btn--active': settings.textAlign === 'right' }" @click="update('textAlign', 'right')"><AlignRight :size="13" /></button>
          </div>
        </div>
      </div>

      <!-- ── COLORS ── -->
      <div class="sp__section">
        <div class="sp__section-hd">Colors</div>
        <div class="sp__color-grid">
          <div class="sp__color-item" v-for="ci in colorItems" :key="ci.key">
            <span class="sp__label">{{ ci.label }}</span>
            <div class="sp__swatch-row">
              <label class="sp__swatch-wrap">
                <input type="color" :value="(settings as any)[ci.key]"
                  @input="update(ci.key as any, ($event.target as HTMLInputElement).value)" />
                <span class="sp__swatch" :style="{ background: (settings as any)[ci.key] }"></span>
              </label>
              <input class="sp__hex" type="text" :value="(settings as any)[ci.key]" maxlength="7"
                @change="update(ci.key as any, ($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── OUTLINE ── -->
      <div class="sp__section">
        <div class="sp__section-hd">Outline</div>
        <div class="sp__row2">
          <div class="sp__field">
            <span class="sp__label">Outer <em class="sp__val">{{ settings.border2Width }}px</em></span>
            <input type="range" class="sp__slider" :value="settings.border2Width" min="0" max="20" step="1"
              @input="update('border2Width', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="sp__field">
            <span class="sp__label">Outer Color</span>
            <div class="sp__swatch-row">
              <label class="sp__swatch-wrap">
                <input type="color" :value="settings.border2Color" @input="update('border2Color', ($event.target as HTMLInputElement).value)" />
                <span class="sp__swatch" :style="{ background: settings.border2Color }"></span>
              </label>
              <input class="sp__hex" type="text" :value="settings.border2Color" maxlength="7" @change="update('border2Color', ($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>
        <div class="sp__row2 sp__mt">
          <div class="sp__field">
            <span class="sp__label">Inner <em class="sp__val">{{ settings.border1Width }}px</em></span>
            <input type="range" class="sp__slider" :value="settings.border1Width" min="0" max="20" step="1"
              @input="update('border1Width', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="sp__field">
            <span class="sp__label">Inner Color</span>
            <div class="sp__swatch-row">
              <label class="sp__swatch-wrap">
                <input type="color" :value="settings.border1Color" @input="update('border1Color', ($event.target as HTMLInputElement).value)" />
                <span class="sp__swatch" :style="{ background: settings.border1Color }"></span>
              </label>
              <input class="sp__hex" type="text" :value="settings.border1Color" maxlength="7" @change="update('border1Color', ($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── BACKGROUND ── -->
      <div class="sp__section">
        <div class="sp__section-hd-row">
          <span class="sp__section-hd">Background</span>
          <label class="sp__toggle">
            <input type="checkbox" :checked="settings.backgroundEnabled"
              @change="update('backgroundEnabled', ($event.target as HTMLInputElement).checked)" />
            <span class="sp__toggle-track"><span class="sp__toggle-thumb"></span></span>
          </label>
        </div>
        <template v-if="settings.backgroundEnabled">
          <div class="sp__row2 sp__mt">
            <div class="sp__field">
              <span class="sp__label">Color</span>
              <div class="sp__swatch-row">
                <label class="sp__swatch-wrap">
                  <input type="color" :value="settings.backgroundColor" @input="update('backgroundColor', ($event.target as HTMLInputElement).value)" />
                  <span class="sp__swatch" :style="{ background: settings.backgroundColor }"></span>
                </label>
                <input class="sp__hex" type="text" :value="settings.backgroundColor" maxlength="7" @change="update('backgroundColor', ($event.target as HTMLInputElement).value)" />
              </div>
            </div>
            <div class="sp__field">
              <span class="sp__label">Padding <em class="sp__val">{{ settings.padding }}px</em></span>
              <input type="range" class="sp__slider" :value="settings.padding" min="0" max="40" step="1"
                @input="update('padding', Number(($event.target as HTMLInputElement).value))" />
            </div>
          </div>
          <div class="sp__field sp__mt">
            <span class="sp__label">Corner Radius <em class="sp__val">{{ settings.borderRadius }}px</em></span>
            <input type="range" class="sp__slider" :value="settings.borderRadius" min="0" max="40" step="1"
              @input="update('borderRadius', Number(($event.target as HTMLInputElement).value))" />
          </div>
        </template>
      </div>

      <!-- ── SHADOW ── -->
      <div class="sp__section">
        <div class="sp__section-hd">Shadow</div>
        <div class="sp__row2">
          <div class="sp__field">
            <span class="sp__label">Blur <em class="sp__val">{{ settings.shadowBlur }}px</em></span>
            <input type="range" class="sp__slider" :value="settings.shadowBlur" min="0" max="30" step="1"
              @input="update('shadowBlur', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="sp__field">
            <span class="sp__label">Color</span>
            <div class="sp__swatch-row">
              <label class="sp__swatch-wrap">
                <input type="color" :value="settings.shadowColor" @input="update('shadowColor', ($event.target as HTMLInputElement).value)" />
                <span class="sp__swatch" :style="{ background: settings.shadowColor }"></span>
              </label>
              <input class="sp__hex" type="text" :value="settings.shadowColor" maxlength="7" @change="update('shadowColor', ($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── SPACING ── -->
      <div class="sp__section sp__section--last">
        <div class="sp__section-hd">Spacing</div>
        <div class="sp__field">
          <span class="sp__label">Line Height <em class="sp__val">{{ settings.lineHeight }}</em></span>
          <input type="range" class="sp__slider" :value="settings.lineHeight" min="0.8" max="3" step="0.05"
            @input="update('lineHeight', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="sp__field sp__mt">
          <span class="sp__label">Letter Spacing <em class="sp__val">{{ settings.letterSpacing }}px</em></span>
          <input type="range" class="sp__slider" :value="settings.letterSpacing" min="-5" max="20" step="0.5"
            @input="update('letterSpacing', Number(($event.target as HTMLInputElement).value))" />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, AlignLeft, AlignCenter, AlignRight } from 'lucide-vue-next';

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
  position: string;
  positionPercentage: number;
  maxWidth: number;
  animationStyle: string;
  highlightColor: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: string;
  textOffsetX: number;
  textOffsetY: number;
  padding: number;
  borderRadius: number;
  wordSpacing: number;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface Props {
  settings: SubtitleSettings;
  segments: TranscriptSegment[];
  currentTime?: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updateSettings', settings: Partial<SubtitleSettings>): void;
  (e: 'updateSegmentText', segmentIndex: number, text: string): void;
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

const animationStyles = [
  { id: 'karaoke', name: 'Karaoke', desc: 'Word-by-word color highlight' },
  { id: 'zoom', name: 'Zoom', desc: 'Current word scales up' },
  { id: 'pop', name: 'Pop', desc: 'Bouncy emphasis effect' },
  { id: 'glow', name: 'Glow', desc: 'Glowing word highlight' },
  { id: 'wave', name: 'Wave', desc: 'Floating wave motion' },
  { id: 'none', name: 'None', desc: 'Static text, no animation' },
];

const editableSegments = ref<TranscriptSegment[]>([]);
watch(() => props.segments, (segs) => {
  editableSegments.value = segs.map(s => ({ ...s }));
}, { immediate: true });

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

function update<K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) {
  emit('updateSettings', { [key]: value } as Partial<SubtitleSettings>);
}

function onSegmentTextChange(index: number, text: string) {
  editableSegments.value[index].text = text;
  emit('updateSegmentText', index, text);
}
</script>

<style scoped>
/* Root */
.sp {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sidebar-surface);
  color: var(--sidebar-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.sp__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.sp__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.sp__back:hover {
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.sp__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  letter-spacing: -0.01em;
}

/* Body */
.sp__body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Preview */
.sp__preview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 68px;
  padding: 16px;
  border-bottom: 1px solid var(--sidebar-border);
}

.sp__preview-text {
  display: inline-block;
  transition: all 0.2s;
}

/* Sections */
.sp__section {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.sp__section--last {
  border-bottom: none;
  padding-bottom: 1.5rem;
}

.sp__section-hd {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--sidebar-text-muted);
  margin-bottom: 0.75rem;
}

.sp__section-hd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0;
}

.sp__section-hd-row .sp__section-hd {
  margin-bottom: 0;
}

.sp__section-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

/* Utility */
.sp__mt {
  margin-top: 8px;
}

.sp__row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 10px;
}

.sp__field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sp__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sidebar-text);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.sp__val {
  font-style: normal;
  font-weight: 400;
  color: var(--sidebar-text-muted);
  margin-left: auto;
}

/* Slider */
.sp__slider {
  width: 100%;
  accent-color: var(--sidebar-accent);
  cursor: pointer;
}

/* Animation style grid */
.sp__style-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.sp__style-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 150ms ease;
  text-align: left;
}

.sp__style-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--sidebar-border);
  color: var(--sidebar-text);
}

.sp__style-btn--active {
  background: rgba(6, 182, 212, 0.15);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.sp__style-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.sp__style-desc {
  font-size: 0.6875rem;
  opacity: 0.7;
  line-height: 1.4;
}

/* Font grid */
.sp__font-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.sp__font-btn {
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
  text-align: center;
}

.sp__font-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--sidebar-border);
  color: var(--sidebar-text);
}

.sp__font-btn--active {
  background: rgba(6, 182, 212, 0.15);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

/* Pills (weight) */
.sp__pill-row {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.sp__pill {
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 20px;
  padding: 3px 7px;
  font-size: 10px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.sp__pill:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--sidebar-text);
}

.sp__pill--active {
  background: rgba(6, 182, 212, 0.15);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

/* Segmented alignment */
.sp__seg-ctrl {
  display: flex;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  overflow: hidden;
  width: fit-content;
}

.sp__seg-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.sp__seg-btn:first-child {
  border-radius: 6px 0 0 6px;
}

.sp__seg-btn:last-child {
  border-radius: 0 6px 6px 0;
}

.sp__seg-btn:not(:last-child) {
  border-right: none;
}

.sp__seg-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--sidebar-text);
}

.sp__seg-btn--active {
  background: rgba(6, 182, 212, 0.15);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
  z-index: 1;
}

/* Color grid */
.sp__color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sp__color-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sp__swatch-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.sp__swatch-wrap {
  position: relative;
  cursor: pointer;
  display: block;
  flex-shrink: 0;
}

.sp__swatch-wrap input[type="color"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.sp__swatch {
  display: block;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--sidebar-border);
  cursor: pointer;
  transition: all 150ms ease;
}

.sp__swatch:hover {
  border-color: var(--sidebar-accent);
  transform: scale(1.05);
}

.sp__hex {
  flex: 1;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
  color: var(--sidebar-text);
  text-transform: uppercase;
  transition: all 150ms ease;
}

.sp__hex:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  background: rgba(255, 255, 255, 0.03);
}

/* Toggle */
.sp__toggle {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.sp__toggle input {
  display: none;
}

.sp__toggle-track {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--sidebar-border);
  border-radius: 12px;
  cursor: pointer;
  transition: background 200ms ease;
}

.sp__toggle--on {
  background: var(--sidebar-accent);
}

.sp__toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 200ms ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.sp__toggle--on .sp__toggle-knob {
  transform: translateX(20px);
}

/* Transcript */
.sp__segments {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 200px;
  overflow-y: auto;
}

.sp__seg {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  padding: 3px 4px;
  border-radius: 5px;
  border: 1px solid transparent;
  transition: border-color 0.12s, background 0.12s;
}

.sp__seg--active {
  border-color: rgba(16, 185, 129, 0.28);
  background: rgba(16, 185, 129, 0.04);
}

.sp__seg-ts {
  font-size: 9px;
  color: #3a3a3a;
  min-width: 28px;
  padding-top: 7px;
  font-variant-numeric: tabular-nums;
  font-family: monospace;
}

.sp__seg-ta {
  width: 100%;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  resize: vertical;
  font-family: inherit;
  transition: all 150ms ease;
}

.sp__seg-ta:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  background: rgba(255, 255, 255, 0.03);
}

.sp__empty {
  color: #3a3a3a;
  font-size: 11px;
  text-align: center;
  padding: 16px 0;
}
</style>
