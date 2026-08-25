<template>
  <div class="ctp" :class="{ 'ctp--embedded': variant === 'embedded' }">
    <div v-if="variant !== 'embedded'" class="ctp__header">
      <button class="ctp__back" type="button" title="Back" @click="$emit('close')">
        <ChevronLeft :size="15" />
      </button>
      <span class="ctp__title">Text box</span>
    </div>

    <div v-if="!state" class="ctp__empty-state">No text box for this clip.</div>

    <div v-else class="ctp__body">
      <!-- ── CONTENT ── -->
      <div class="ctp__section">
        <div class="ctp__section-hd-row">
          <span class="ctp__section-hd">Text</span>
          <label class="ctp__toggle">
            <input
              type="checkbox"
              :checked="state.enabled"
              @change="patch({ enabled: ($event.target as HTMLInputElement).checked })"
            />
            <span class="ctp__toggle-track"><span class="ctp__toggle-thumb" /></span>
          </label>
        </div>
        <textarea
          class="ctp__textarea ctp__mt"
          :value="state.text"
          rows="3"
          placeholder="Your message"
          @input="patch({ text: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>

      <!-- ── VISIBLE ON CLIP ── -->
      <div class="ctp__section">
        <div class="ctp__section-hd-row">
          <span class="ctp__section-hd">Visible on clip</span>
          <span class="ctp__range-readout">
            {{ state.startTime.toFixed(1) }}s — {{ state.endTime.toFixed(1) }}s
            <span class="ctp__range-readout-span">({{ visibleDuration.toFixed(1) }}s)</span>
          </span>
        </div>
        <p v-if="effectiveDuration <= 0" class="ctp__hint ctp__mt">
          Clip length unavailable; timing can be set after duration is known.
        </p>
        <template v-else>
          <div
            ref="visibilityTrackRef"
            class="ctp__range-track ctp__mt"
            @mousedown.prevent="onVisibilityTrackPress"
          >
            <div class="ctp__range-bg" />
            <div
              class="ctp__range-fill"
              :style="{
                left: `calc(0.5rem + (100% - 1rem) * ${rangeStartFrac})`,
                width: `calc((100% - 1rem) * ${rangeWidthFrac})`,
              }"
            />
            <div
              class="ctp__range-body"
              title="Drag to move visible range"
              :style="{
                left: `calc(0.5rem + (100% - 1rem) * ${rangeStartFrac})`,
                width: `calc((100% - 1rem) * ${rangeWidthFrac})`,
              }"
              @mousedown.stop.prevent="startVisibilityDrag('move', $event)"
            />
            <button
              type="button"
              class="ctp__range-handle"
              :style="{ left: `calc(0.5rem + (100% - 1rem) * ${rangeStartFrac})` }"
              title="Drag start time"
              aria-label="Text visible from"
              @mousedown.stop.prevent="startVisibilityDrag('start', $event)"
            />
            <button
              type="button"
              class="ctp__range-handle"
              :style="{ left: `calc(0.5rem + (100% - 1rem) * ${rangeEndFrac})` }"
              title="Drag end time"
              aria-label="Text visible until"
              @mousedown.stop.prevent="startVisibilityDrag('end', $event)"
            />
          </div>
          <div class="ctp__range-axis">
            <span>0s</span>
            <span>{{ effectiveDuration.toFixed(1) }}s</span>
          </div>
        </template>
      </div>

      <!-- ── FONT ── -->
      <div class="ctp__section ctp__section--font">
        <div class="ctp__section-hd">Font</div>
        <div class="ctp__font-grid">
          <button
            v-for="f in fontChoices"
            :key="f"
            type="button"
            class="ctp__font-btn"
            :class="{ 'ctp__font-btn--active': state.style.fontFamily === f }"
            :style="{ fontFamily: f }"
            @click="patchStyle({ fontFamily: f })"
          >
            {{ f }}
          </button>
        </div>

        <div class="ctp__row2 ctp__font-controls ctp__mt">
          <div class="ctp__field">
            <span class="ctp__label">Size <em class="ctp__val">{{ state.style.fontSize }}px</em></span>
            <input
              type="range"
              class="ctp__slider"
              :value="state.style.fontSize"
              min="10"
              max="120"
              step="1"
              @input="patchStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div class="ctp__field">
            <span class="ctp__label">Weight</span>
            <div class="ctp__pill-row">
              <button
                v-for="w in weightChoices"
                :key="w.value"
                type="button"
                class="ctp__pill"
                :class="{ 'ctp__pill--active': Number(state.style.fontWeight) === w.value }"
                @click="patchStyle({ fontWeight: w.value })"
              >
                {{ w.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="ctp__field ctp__mt">
          <span class="ctp__label">Transform</span>
          <div class="ctp__seg-ctrl">
            <button
              v-for="opt in transformChoices"
              :key="opt.value"
              type="button"
              class="ctp__seg-btn"
              :class="{ 'ctp__seg-btn--active': (state.style.textTransform ?? 'none') === opt.value }"
              :title="opt.label"
              @click="patchStyle({ textTransform: opt.value })"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── COLOR ── -->
      <div class="ctp__section ctp__section--colors">
        <div class="ctp__section-hd">Color</div>
        <p class="ctp__hint ctp__mb">Text fill color</p>
        <div class="ctp__colors-grid">
          <div class="ctp__colors-row">
            <span class="ctp__label">Text</span>
            <div class="ctp__swatch-row ctp__colors-swatch-row">
              <label class="ctp__swatch-wrap">
                <input
                  type="color"
                  :value="state.style.color"
                  @input="patchStyle({ color: ($event.target as HTMLInputElement).value })"
                />
                <span class="ctp__swatch" :style="{ background: state.style.color }" />
              </label>
              <input
                class="ctp__hex"
                type="text"
                maxlength="7"
                :value="state.style.color"
                @change="patchStyle({ color: ($event.target as HTMLInputElement).value })"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ── BACKGROUND ── -->
      <div class="ctp__section">
        <div class="ctp__section-hd-row">
          <span class="ctp__section-hd">Background</span>
          <label class="ctp__toggle">
            <input
              type="checkbox"
              :checked="state.style.backgroundEnabled"
              @change="patchStyle({ backgroundEnabled: ($event.target as HTMLInputElement).checked })"
            />
            <span class="ctp__toggle-track"><span class="ctp__toggle-thumb" /></span>
          </label>
        </div>
        <template v-if="state.style.backgroundEnabled">
          <div class="ctp__row2 ctp__mt">
            <div class="ctp__field">
              <span class="ctp__label">Color</span>
              <div class="ctp__swatch-row">
                <label class="ctp__swatch-wrap">
                  <input
                    type="color"
                    :value="state.style.backgroundColor || '#000000'"
                    @input="patchStyle({ backgroundColor: ($event.target as HTMLInputElement).value })"
                  />
                  <span class="ctp__swatch" :style="{ background: state.style.backgroundColor || '#000000' }" />
                </label>
                <input
                  class="ctp__hex"
                  type="text"
                  maxlength="7"
                  :value="state.style.backgroundColor || '#000000'"
                  @change="patchStyle({ backgroundColor: ($event.target as HTMLInputElement).value })"
                />
              </div>
            </div>
            <div class="ctp__field">
              <span class="ctp__label">Padding <em class="ctp__val">{{ state.style.padding }}px</em></span>
              <input
                type="range"
                class="ctp__slider"
                :value="state.style.padding"
                min="0"
                max="48"
                step="1"
                @input="patchStyle({ padding: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
          <div class="ctp__field ctp__mt">
            <span class="ctp__label">Corner radius <em class="ctp__val">{{ state.style.borderRadius }}px</em></span>
            <input
              type="range"
              class="ctp__slider"
              :value="state.style.borderRadius"
              min="0"
              max="48"
              step="1"
              @input="patchStyle({ borderRadius: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </template>
      </div>

      <!-- ── REMOVE ── -->
      <div class="ctp__section ctp__section--danger">
        <button class="ctp__delete-btn" type="button" @click="$emit('delete')">
          <Trash2 :size="15" />
          Remove text box
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref } from 'vue';
  import { ChevronLeft, Trash2 } from 'lucide-vue-next';
  import type { ClipTextBoxState } from '@/utils/clipTextBox';
  import type { TextOverlayStyle } from '@/types';

  const props = withDefaults(
    defineProps<{
      state: ClipTextBoxState | null;
      clipDuration: number;
      /** Hide outer header (parent supplies Done/Cancel in POI). */
      variant?: 'default' | 'embedded';
    }>(),
    { variant: 'default' }
  );

  const emit = defineEmits<{
    close: [];
    updateState: [patch: Partial<ClipTextBoxState>];
    delete: [];
  }>();

  const fontChoices = [
    'Montserrat',
    'Inter',
    'Impact',
    'Oswald',
    'Poppins',
    'Roboto',
    'Arial',
    'Georgia',
    'Helvetica Neue',
  ];

  const weightChoices = [
    { value: 400, label: 'Regular' },
    { value: 600, label: 'Semi' },
    { value: 700, label: 'Bold' },
    { value: 800, label: 'Extra' },
    { value: 900, label: 'Black' },
  ] as const;

  const transformChoices = [
    { value: 'none' as const, label: 'None' },
    { value: 'uppercase' as const, label: 'AA' },
    { value: 'lowercase' as const, label: 'aa' },
    { value: 'capitalize' as const, label: 'Aa' },
  ];

  const MIN_VISIBLE = 0.1;
  const STEP = 0.1;

  const visibilityTrackRef = ref<HTMLElement | null>(null);

  const effectiveDuration = computed(() =>
    Number.isFinite(props.clipDuration) && props.clipDuration > 0 ? props.clipDuration : 0
  );

  /** Normalized span for drawing (handles inverted or out-of-range persisted values). */
  const displaySpan = computed(() => {
    const d = effectiveDuration.value;
    const st = props.state;
    if (!st || d <= 0) return { s: 0, e: Math.max(MIN_VISIBLE, d) };
    let s = st.startTime;
    let e = st.endTime;
    if (e < s) {
      const t = s;
      s = e;
      e = t;
    }
    s = Math.max(0, Math.min(s, d - MIN_VISIBLE));
    e = Math.min(d, Math.max(e, MIN_VISIBLE));
    if (e - s < MIN_VISIBLE) e = Math.min(d, s + MIN_VISIBLE);
    return { s, e };
  });

  const visibleDuration = computed(() => {
    const { s, e } = displaySpan.value;
    return Math.max(0, e - s);
  });

  const rangeStartFrac = computed(() => {
    const d = effectiveDuration.value;
    if (d <= 0) return 0;
    return Math.min(1, Math.max(0, displaySpan.value.s / d));
  });

  const rangeEndFrac = computed(() => {
    const d = effectiveDuration.value;
    if (d <= 0) return 1;
    return Math.min(1, Math.max(0, displaySpan.value.e / d));
  });

  const rangeWidthFrac = computed(() => Math.max(0, rangeEndFrac.value - rangeStartFrac.value));

  function roundTime(t: number): number {
    return Math.round(t / STEP) * STEP;
  }

  function patch(partial: Partial<ClipTextBoxState>) {
    emit('updateState', partial);
  }

  function patchStyle(stylePatch: Partial<TextOverlayStyle>) {
    emit('updateState', { style: stylePatch as TextOverlayStyle });
  }

  /** Keep start/end inside [0, duration] with at least MIN_VISIBLE between them. */
  function commitRange(start: number, end: number) {
    const d = effectiveDuration.value;
    if (d <= 0 || !props.state) return;
    let s = roundTime(start);
    let e = roundTime(end);
    s = Math.max(0, Math.min(s, d - MIN_VISIBLE));
    e = Math.min(d, Math.max(e, MIN_VISIBLE));
    if (e - s < MIN_VISIBLE) {
      if (s > d - MIN_VISIBLE) s = roundTime(d - MIN_VISIBLE);
      e = roundTime(Math.min(d, s + MIN_VISIBLE));
    }
    patch({ startTime: s, endTime: e });
  }

  type DragMode = 'start' | 'end' | 'move';
  let dragMode: DragMode | null = null;
  let moveAnchorClientX = 0;
  let moveStart0 = 0;
  let moveEnd0 = 0;

  function timeFromClientX(clientX: number): number {
    const el = visibilityTrackRef.value;
    const d = effectiveDuration.value;
    if (!el || d <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const inner = Math.max(1, rect.width - pad * 2);
    const x = clientX - rect.left - pad;
    const frac = Math.min(1, Math.max(0, x / inner));
    return frac * d;
  }

  function startVisibilityDrag(mode: DragMode, e: MouseEvent) {
    if (!props.state || effectiveDuration.value <= 0) return;
    dragMode = mode;
    if (mode === 'move') {
      moveStart0 = props.state.startTime;
      moveEnd0 = props.state.endTime;
      moveAnchorClientX = e.clientX;
    }
    document.addEventListener('mousemove', onVisibilityDragMove);
    document.addEventListener('mouseup', endVisibilityDrag, { once: true });
  }

  function onVisibilityDragMove(e: MouseEvent) {
    if (!dragMode || !props.state || effectiveDuration.value <= 0) return;
    const d = effectiveDuration.value;
    const { startTime: curS, endTime: curE } = props.state;

    if (dragMode === 'start') {
      const t = timeFromClientX(e.clientX);
      const s = Math.max(0, Math.min(t, curE - MIN_VISIBLE));
      commitRange(s, curE);
      return;
    }
    if (dragMode === 'end') {
      const t = timeFromClientX(e.clientX);
      const end = Math.min(d, Math.max(t, curS + MIN_VISIBLE));
      commitRange(curS, end);
      return;
    }
    const el = visibilityTrackRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inner = Math.max(1, rect.width - 16);
    const deltaT = ((e.clientX - moveAnchorClientX) / inner) * d;
    const span = moveEnd0 - moveStart0;
    let ns = moveStart0 + deltaT;
    let ne = moveEnd0 + deltaT;
    if (ns < 0) {
      ns = 0;
      ne = Math.min(d, span);
    }
    if (ne > d) {
      ne = d;
      ns = Math.max(0, d - span);
    }
    commitRange(ns, ne);
  }

  function endVisibilityDrag() {
    dragMode = null;
    document.removeEventListener('mousemove', onVisibilityDragMove);
  }

  /** Click empty track: jump nearest edge toward click. */
  function onVisibilityTrackPress(e: MouseEvent) {
    if (!props.state || effectiveDuration.value <= 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.ctp__range-handle')) return;
    if (target.closest('.ctp__range-body')) return;
    const t = timeFromClientX(e.clientX);
    const { startTime: s, endTime: end } = props.state;
    const mid = (s + end) / 2;
    if (t < mid) commitRange(t, end);
    else commitRange(s, t);
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onVisibilityDragMove);
  });
</script>

<style scoped>
  /* Root */
  .ctp {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--sidebar-surface);
    color: var(--sidebar-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* Embedded variant: fill flex parent and scroll the body. */
  .ctp--embedded {
    min-height: 0;
    flex: 1 1 0%;
    height: 100%;
    font-size: 0.8125rem;
  }

  .ctp--embedded .ctp__body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .ctp--embedded .ctp__section {
    padding: 1rem 1rem;
  }

  .ctp--embedded .ctp__section--danger {
    padding-bottom: 1.25rem;
  }

  .ctp--embedded .ctp__section-hd {
    font-size: 0.625rem;
    margin-bottom: 0.625rem;
    letter-spacing: 0.07em;
  }

  .ctp--embedded .ctp__label {
    font-size: 0.6875rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .ctp--embedded .ctp__val {
    font-size: 0.625rem;
  }

  .ctp--embedded .ctp__field {
    gap: 8px;
    min-width: 0;
  }

  /* Narrow rail: stack paired controls so sliders aren't crushed. */
  .ctp--embedded .ctp__row2 {
    grid-template-columns: 1fr;
    gap: 12px 0;
  }

  .ctp--embedded .ctp__font-controls {
    gap: 14px 0;
  }

  .ctp--embedded .ctp__mt {
    margin-top: 10px;
  }

  .ctp--embedded .ctp__hint {
    font-size: 0.625rem;
    line-height: 1.45;
  }

  .ctp--embedded .ctp__hint.ctp__mb {
    margin-bottom: 0.625rem;
  }

  .ctp--embedded .ctp__slider {
    margin-top: 1px;
  }

  .ctp--embedded .ctp__swatch-row {
    gap: 8px;
  }

  .ctp--embedded .ctp__colors-grid {
    gap: 6px 8px;
  }

  .ctp--embedded .ctp__colors-row {
    gap: 6px;
  }

  .ctp--embedded .ctp__section--colors .ctp__colors-row > .ctp__label {
    font-size: 0.6875rem;
    margin: 0;
    min-width: 0;
  }

  .ctp--embedded .ctp__section--colors .ctp__colors-swatch-row .ctp__swatch {
    width: 24px;
    height: 24px;
  }

  .ctp--embedded .ctp__section--colors .ctp__colors-swatch-row .ctp__hex {
    padding: 0.35rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 500;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }

  .ctp--embedded .ctp__swatch {
    width: 28px;
    height: 28px;
  }

  .ctp--embedded .ctp__hex {
    flex: 1;
    min-width: 0;
    font-size: 0.6875rem;
    padding: 0.375rem 0.5rem;
  }

  .ctp--embedded .ctp__font-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.375rem;
  }

  .ctp--embedded .ctp__font-btn {
    padding: 0.38rem 0.45rem;
    font-size: 0.625rem;
  }

  .ctp--embedded .ctp__pill {
    font-size: 0.6875rem;
    padding: 0.4rem 0.65rem;
  }

  .ctp--embedded .ctp__seg-ctrl {
    border-radius: 5px;
    gap: 2px;
    padding: 2px;
  }

  .ctp--embedded .ctp__seg-btn {
    min-width: 28px;
    min-height: 28px;
    padding: 0.4rem 0.55rem;
    font-size: 0.6875rem;
  }

  .ctp--embedded .ctp__textarea {
    font-size: 0.75rem;
    padding: 0.5rem 0.625rem;
  }

  .ctp--embedded .ctp__section-hd-row {
    margin-bottom: 0.625rem;
    align-items: center;
    gap: 0.75rem;
  }

  .ctp--embedded .ctp__range-readout {
    font-size: 0.625rem;
  }

  /* Header */
  .ctp__header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  .ctp__back {
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

  .ctp__back:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .ctp__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    letter-spacing: -0.01em;
  }

  /* Body */
  .ctp__body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .ctp__empty-state {
    padding: 1.5rem 1.25rem;
    color: var(--sidebar-text-muted);
    font-size: 0.8125rem;
  }

  /* Sections */
  .ctp__section {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .ctp__section--danger {
    border-bottom: none;
    padding-bottom: 2.5rem;
  }

  .ctp__section-hd {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.75rem;
  }

  .ctp__section-hd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .ctp__section-hd-row .ctp__section-hd {
    margin-bottom: 0;
  }

  .ctp__hint {
    color: var(--sidebar-text-muted);
    font-size: 0.6875rem;
    font-weight: 400;
    line-height: 1.35;
  }

  .ctp__hint.ctp__mb {
    margin-bottom: 8px;
  }

  /* Utility */
  .ctp__mt {
    margin-top: 8px;
  }

  .ctp__mb {
    margin-bottom: 12px;
  }

  .ctp__row2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10px;
  }

  .ctp__field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .ctp__label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .ctp__val {
    font-style: normal;
    font-weight: 400;
    color: var(--sidebar-text-muted);
    margin-left: auto;
  }

  /* Textarea */
  .ctp__textarea {
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

  .ctp__textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    background: rgba(255, 255, 255, 0.03);
  }

  /* Slider */
  .ctp__slider {
    width: 100%;
    accent-color: var(--sidebar-accent);
    cursor: pointer;
  }

  /* Visibility range track */
  .ctp__range-track {
    position: relative;
    height: 40px;
    border-radius: 8px;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    user-select: none;
    touch-action: none;
  }

  .ctp__range-bg {
    position: absolute;
    top: 0.5rem;
    bottom: 0.5rem;
    left: 0.5rem;
    right: 0.5rem;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.35);
    pointer-events: none;
  }

  .ctp__range-fill {
    position: absolute;
    top: 0.5rem;
    bottom: 0.5rem;
    border-radius: 6px;
    background: rgba(6, 182, 212, 0.28);
    border: 1px solid rgba(6, 182, 212, 0.55);
    pointer-events: none;
  }

  .ctp__range-body {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 1;
    cursor: grab;
  }

  .ctp__range-body:active {
    cursor: grabbing;
  }

  .ctp__range-handle {
    position: absolute;
    top: 50%;
    z-index: 2;
    width: 14px;
    height: 14px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: #fff;
    border: 2px solid var(--sidebar-accent);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    cursor: ew-resize;
    transition: transform 150ms ease;
  }

  .ctp__range-handle:hover {
    transform: translate(-50%, -50%) scale(1.12);
  }

  .ctp__range-handle:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.45);
  }

  .ctp__range-readout {
    font-family: 'Courier New', monospace;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .ctp__range-readout-span {
    opacity: 0.65;
  }

  .ctp__range-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    font-family: 'Courier New', monospace;
    font-variant-numeric: tabular-nums;
  }

  /* Font grid */
  .ctp__font-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
  }

  .ctp__font-btn {
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    padding: 0.45rem 0.5rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ctp__font-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .ctp__font-btn--active {
    background: rgba(6, 182, 212, 0.15);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .ctp__font-controls {
    column-gap: 18px;
    align-items: start;
  }

  .ctp__font-controls .ctp__field {
    min-width: 0;
  }

  /* Pills (weight) */
  .ctp__pill-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .ctp__pill {
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 999px;
    padding: 0.45rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .ctp__pill:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--sidebar-text);
  }

  .ctp__pill--active {
    background: rgba(6, 182, 212, 0.15);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  /* Segmented control (transform) */
  .ctp__seg-ctrl {
    display: flex;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    gap: 2px;
    padding: 2px;
    width: fit-content;
  }

  .ctp__seg-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    min-height: 30px;
    padding: 0.45rem 0.75rem;
    background: var(--sidebar-hover);
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .ctp__seg-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--sidebar-text);
  }

  .ctp__seg-btn--active {
    background: rgba(6, 182, 212, 0.15);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
    z-index: 1;
  }

  /* Colors */
  .ctp__colors-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px 12px;
    align-items: center;
  }

  .ctp__colors-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .ctp__section--colors .ctp__colors-row > .ctp__label {
    flex: 0 0 auto;
    margin: 0;
    width: auto;
    min-width: 60px;
    white-space: nowrap;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--sidebar-text);
  }

  .ctp__colors-swatch-row {
    flex: 1 1 0%;
    min-width: 0;
    gap: 6px;
    align-items: center;
  }

  .ctp__section--colors .ctp__colors-swatch-row .ctp__swatch {
    width: 28px;
    height: 28px;
    border-radius: 5px;
  }

  .ctp__section--colors .ctp__colors-swatch-row .ctp__hex {
    min-width: 0;
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 500;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }

  .ctp__swatch-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .ctp__swatch-wrap {
    position: relative;
    cursor: pointer;
    display: block;
    flex-shrink: 0;
  }

  .ctp__swatch-wrap input[type='color'] {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .ctp__swatch {
    display: block;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: 1px solid var(--sidebar-border);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .ctp__swatch:hover {
    border-color: var(--sidebar-accent);
    transform: scale(1.05);
  }

  .ctp__hex {
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

  .ctp__hex:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    background: rgba(255, 255, 255, 0.03);
  }

  /* Toggle */
  .ctp__toggle {
    position: relative;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .ctp__toggle input {
    display: none;
  }

  .ctp__toggle-track {
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

  .ctp__toggle input:checked + .ctp__toggle-track {
    background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
    border-color: rgba(14, 165, 233, 0.5);
    box-shadow: 0 0 12px rgba(14, 165, 233, 0.3);
  }

  .ctp__toggle-thumb {
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

  .ctp__toggle input:checked + .ctp__toggle-track .ctp__toggle-thumb {
    transform: translateX(20px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  /* Delete button */
  .ctp__delete-btn {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.625rem;
    border: 1px solid rgba(248, 113, 113, 0.35);
    background: rgba(248, 113, 113, 0.08);
    color: #f87171;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .ctp__delete-btn:hover {
    background: rgba(248, 113, 113, 0.14);
    border-color: rgba(248, 113, 113, 0.55);
  }
</style>
