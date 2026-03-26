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

      <!-- ── MULTI-COLOR (Single-Word Mode Only) ── -->
      <div v-if="settings.animationStyle === 'single-word'" class="sp__section">
        <div class="sp__section-hd-row">
          <div>
            <div class="sp__section-hd">Multi-Color Words</div>
            <p class="sp__hint" style="margin-top: 4px;">Cycle through colors for each word</p>
          </div>
          <label class="sp__toggle">
            <input type="checkbox" :checked="settings.multiColorEnabled"
              @change="update('multiColorEnabled', ($event.target as HTMLInputElement).checked)" />
            <span class="sp__toggle-track"><span class="sp__toggle-thumb"></span></span>
          </label>
        </div>
        
        <template v-if="settings.multiColorEnabled">
          <div class="sp__mt" style="margin-top: 12px;">
            <label class="sp__radio-option">
              <input type="radio" name="multiColorMode" :checked="settings.multiColorMode === 'default'"
                @change="update('multiColorMode', 'default')" />
              <span class="sp__radio-label">Default Palette</span>
            </label>
            <div class="sp__color-palette-preview sp__mt" style="margin-left: 24px; margin-top: 6px;">
              <span class="sp__palette-dot" style="background: #04F827;" title="Green"></span>
              <span class="sp__palette-dot" style="background: #0ea5e9;" title="Cyan"></span>
              <span class="sp__palette-dot" style="background: #FFFD03;" title="Yellow"></span>
              <span class="sp__palette-dot" style="background: #FFFFFF;" title="White"></span>
            </div>
          </div>
          
          <div class="sp__mt" style="margin-top: 12px;">
            <label class="sp__radio-option">
              <input type="radio" name="multiColorMode" :checked="settings.multiColorMode === 'custom'"
                @change="update('multiColorMode', 'custom')" />
              <span class="sp__radio-label">Custom Palette</span>
            </label>
          </div>
          
          <div v-if="settings.multiColorMode === 'custom'" class="sp__color-palette sp__mt" style="margin-top: 12px; padding-left: 24px;">
            <div v-for="(color, index) in settings.colorPalette" :key="index" class="sp__palette-item">
              <label class="sp__swatch-wrap">
                <input type="color" :value="color"
                  @input="updatePaletteColor(index, ($event.target as HTMLInputElement).value)" />
                <span class="sp__swatch" :style="{ background: color }"></span>
              </label>
              <input class="sp__hex" type="text" :value="color" maxlength="7"
                @change="updatePaletteColor(index, ($event.target as HTMLInputElement).value)" />
              <button v-if="settings.colorPalette.length > 1" @click="removePaletteColor(index)" class="sp__btn-remove" title="Remove color">✕</button>
            </div>
            <button @click="addPaletteColor" class="sp__btn-add">+ Add Color</button>
          </div>
        </template>
      </div>

      <!-- ── HIGHLIGHT COLOR (Karaoke/Pop/Zoom Modes) ── -->
      <div v-if="['karaoke', 'pop', 'zoom'].includes(settings.animationStyle)" class="sp__section">
        <div class="sp__section-hd">Highlight Color</div>
        <p class="sp__hint sp__mb">Color when word is active</p>
        
        <div class="sp__preset-colors">
          <button 
            v-for="preset in highlightColorPresets" 
            :key="preset.value"
            class="sp__color-preset"
            :class="{ 'sp__color-preset--active': settings.highlightColor === preset.value }"
            :style="{ background: preset.value }"
            @click="update('highlightColor', preset.value)"
            :title="preset.name"
          >
            <span class="sp__color-preset-check">✓</span>
          </button>
          
          <button 
            class="sp__color-preset sp__color-preset--custom"
            :class="{ 'sp__color-preset--active': isCustomHighlightColor }"
            @click="showCustomHighlightPicker = true"
            title="Custom Color"
          >
            <span v-if="isCustomHighlightColor" class="sp__color-preset-swatch" :style="{ background: settings.highlightColor }"></span>
            <span v-else class="sp__color-preset-icon">🎨</span>
          </button>
        </div>
        
        <div v-if="showCustomHighlightPicker || isCustomHighlightColor" class="sp__custom-color sp__mt">
          <label class="sp__swatch-wrap">
            <input type="color" :value="settings.highlightColor"
              @input="update('highlightColor', ($event.target as HTMLInputElement).value)" />
            <span class="sp__swatch" :style="{ background: settings.highlightColor }"></span>
          </label>
          <input class="sp__hex" type="text" :value="settings.highlightColor" maxlength="7"
            @change="update('highlightColor', ($event.target as HTMLInputElement).value)" />
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
        <p class="sp__hint sp__mb">Layered strokes (Border 1 on top, Border 2 behind it)</p>
        <div class="sp__row2">
          <div class="sp__field">
            <span class="sp__label">Border 1 <em class="sp__val">{{ settings.border1Width }}px</em></span>
            <input type="range" class="sp__slider" :value="settings.border1Width" min="0" max="20" step="1"
              @input="update('border1Width', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="sp__field">
            <span class="sp__label">Border 1 Color</span>
            <div class="sp__swatch-row">
              <label class="sp__swatch-wrap">
                <input type="color" :value="settings.border1Color" @input="update('border1Color', ($event.target as HTMLInputElement).value)" />
                <span class="sp__swatch" :style="{ background: settings.border1Color }"></span>
              </label>
              <input class="sp__hex" type="text" :value="settings.border1Color" maxlength="7" @change="update('border1Color', ($event.target as HTMLInputElement).value)" />
            </div>
          </div>
        </div>
        <div class="sp__row2 sp__mt">
          <div class="sp__field">
            <span class="sp__label">Border 2 <em class="sp__val">{{ settings.border2Width }}px</em></span>
            <input type="range" class="sp__slider" :value="settings.border2Width" min="0" max="20" step="1"
              @input="update('border2Width', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="sp__field">
            <span class="sp__label">Border 2 Color</span>
            <div class="sp__swatch-row">
              <label class="sp__swatch-wrap">
                <input type="color" :value="settings.border2Color" @input="update('border2Color', ($event.target as HTMLInputElement).value)" />
                <span class="sp__swatch" :style="{ background: settings.border2Color }"></span>
              </label>
              <input class="sp__hex" type="text" :value="settings.border2Color" maxlength="7" @change="update('border2Color', ($event.target as HTMLInputElement).value)" />
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
  multiColorEnabled: boolean;
  multiColorMode: 'default' | 'custom';
  colorPalette: string[];
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
  { id: 'single-word', name: 'Single Word', desc: 'One word at a time with punchy effect' },
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
  padding-bottom: 2.5rem;
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
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 200ms ease;
  display: block;
}

.sp__toggle input:checked + .sp__toggle-track {
  background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
  border-color: rgba(14, 165, 233, 0.5);
  box-shadow: 0 0 12px rgba(14, 165, 233, 0.3);
}

.sp__toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: all 200ms ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  display: block;
}

.sp__toggle input:checked + .sp__toggle-track .sp__toggle-thumb {
  transform: translateX(20px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
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

/* Radio options */
.sp__radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.sp__radio-option input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.sp__radio-label {
  font-size: 13px;
  cursor: pointer;
}

/* Multi-color palette */
.sp__color-palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sp__color-palette-preview {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sp__palette-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
  cursor: default;
}

.sp__palette-dot:hover {
  transform: scale(1.1);
}

.sp__palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp__btn-remove {
  width: 24px;
  height: 24px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 150ms ease;
}

.sp__btn-remove:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

.sp__btn-add {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--sidebar-text);
  border: 1px dashed var(--sidebar-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 150ms ease;
}

.sp__btn-add:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

/* Highlight color presets */
.sp__preset-colors {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sp__color-preset {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sp__color-preset:hover {
  transform: scale(1.05);
  border-color: rgba(255, 255, 255, 0.3);
}

.sp__color-preset--active {
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
}

.sp__color-preset-check {
  color: white;
  font-size: 20px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 150ms ease;
}

.sp__color-preset--active .sp__color-preset-check {
  opacity: 1;
}

.sp__color-preset--custom {
  background: linear-gradient(135deg, 
    #ff0000 0%, #ff7f00 14%, #ffff00 28%, 
    #00ff00 42%, #0000ff 57%, #4b0082 71%, 
    #9400d3 85%, #ff0000 100%);
}

.sp__color-preset-icon {
  font-size: 24px;
}

.sp__color-preset-swatch {
  width: 100%;
  height: 100%;
  border-radius: 6px;
}

.sp__custom-color {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp__mb {
  margin-bottom: 12px;
}
</style>
