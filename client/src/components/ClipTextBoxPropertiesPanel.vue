<template>
  <div class="pp" :class="{ 'pp--embedded': variant === 'embedded' }">
    <div v-if="variant !== 'embedded'" class="pp__header">
      <button class="pp__back" type="button" title="Back" aria-label="Back" @click="$emit('close')">
        <ChevronLeft :size="16" />
      </button>
      <span class="pp__title">Text box</span>
    </div>

    <div v-if="!state" class="pp__empty-state">No text box for this clip.</div>

    <div v-else class="pp__body">
      <!-- ── CONTENT ── -->
      <div class="pp__section">
        <div class="pp__section-hd-row">
          <span class="pp__section-hd">Text</span>
          <label class="pp__toggle" title="Show text box">
            <input
              type="checkbox"
              :checked="state.enabled"
              @change="patch({ enabled: ($event.target as HTMLInputElement).checked })"
            />
            <span class="pp__toggle-track"><span class="pp__toggle-thumb" /></span>
          </label>
        </div>
        <textarea
          class="pp__textarea pp__mt"
          :value="state.text"
          rows="3"
          placeholder="Your message"
          @input="patch({ text: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>

      <!-- ── VISIBLE ON CLIP ── -->
      <div class="pp__section">
        <div class="pp__section-hd-row">
          <span class="pp__section-hd">Visible on clip</span>
          <span class="ctp__range-readout">
            {{ state.startTime.toFixed(1) }}s – {{ state.endTime.toFixed(1) }}s
            <span class="ctp__range-readout-span">({{ visibleDuration.toFixed(1) }}s)</span>
          </span>
        </div>
        <p v-if="effectiveDuration <= 0" class="pp__hint pp__mt">
          Clip length unavailable; timing can be set after duration is known.
        </p>
        <template v-else>
          <div ref="visibilityTrackRef" class="ctp__range-track pp__mt" @mousedown.prevent="onVisibilityTrackPress">
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
      <div class="pp__section">
        <div class="pp__section-hd">Font</div>
        <div class="pp__font-grid">
          <button
            v-for="f in fontChoices"
            :key="f"
            type="button"
            class="pp__font-btn"
            :class="{ 'pp__font-btn--active': state.style.fontFamily === f }"
            :style="{ fontFamily: f }"
            @click="patchStyle({ fontFamily: f })"
          >
            {{ f }}
          </button>
        </div>

        <div class="pp__field pp__mt">
          <span class="pp__label">Size <em class="pp__val">{{ state.style.fontSize }}px</em></span>
          <input
            type="range"
            class="pp__slider"
            :value="state.style.fontSize"
            min="10"
            max="120"
            step="1"
            @input="patchStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>

        <div class="pp__field pp__mt">
          <span class="pp__label">Weight</span>
          <div class="pp__seg-ctrl pp__seg-ctrl--block">
            <button
              v-for="w in weightChoices"
              :key="w.value"
              type="button"
              class="pp__seg-btn"
              :class="{ 'pp__seg-btn--active': Number(state.style.fontWeight) === w.value }"
              @click="patchStyle({ fontWeight: w.value })"
            >
              {{ w.label }}
            </button>
          </div>
        </div>

        <div class="pp__field pp__mt">
          <span class="pp__label">Transform</span>
          <div class="pp__seg-ctrl">
            <button
              v-for="opt in transformChoices"
              :key="opt.value"
              type="button"
              class="pp__seg-btn"
              :class="{ 'pp__seg-btn--active': (state.style.textTransform ?? 'none') === opt.value }"
              :title="opt.label"
              @click="patchStyle({ textTransform: opt.value })"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── COLOR ── -->
      <div class="pp__section">
        <div class="pp__section-hd">Color</div>
        <p class="pp__hint pp__mb">Text fill color</p>
        <div class="pp__colors-grid">
          <div class="pp__colors-row">
            <span class="pp__label">Text</span>
            <div class="pp__swatch-row pp__colors-swatch-row">
              <label class="pp__swatch-wrap">
                <input
                  type="color"
                  :value="state.style.color"
                  @input="patchStyle({ color: ($event.target as HTMLInputElement).value })"
                />
                <span class="pp__swatch" :style="{ background: state.style.color }" />
              </label>
              <input
                class="pp__hex"
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
      <div class="pp__section">
        <div class="pp__section-hd-row">
          <span class="pp__section-hd">Background</span>
          <label class="pp__toggle" title="Show background">
            <input
              type="checkbox"
              :checked="state.style.backgroundEnabled"
              @change="patchStyle({ backgroundEnabled: ($event.target as HTMLInputElement).checked })"
            />
            <span class="pp__toggle-track"><span class="pp__toggle-thumb" /></span>
          </label>
        </div>
        <div v-if="state.style.backgroundEnabled" class="pp__stack pp__mt">
          <div class="pp__row2">
            <div class="pp__field">
              <span class="pp__label">Color</span>
              <div class="pp__swatch-row">
                <label class="pp__swatch-wrap">
                  <input
                    type="color"
                    :value="state.style.backgroundColor || '#000000'"
                    @input="patchStyle({ backgroundColor: ($event.target as HTMLInputElement).value })"
                  />
                  <span class="pp__swatch" :style="{ background: state.style.backgroundColor || '#000000' }" />
                </label>
                <input
                  class="pp__hex"
                  type="text"
                  maxlength="7"
                  :value="state.style.backgroundColor || '#000000'"
                  @change="patchStyle({ backgroundColor: ($event.target as HTMLInputElement).value })"
                />
              </div>
            </div>
            <div class="pp__field">
              <span class="pp__label">Padding <em class="pp__val">{{ state.style.padding }}px</em></span>
              <input
                type="range"
                class="pp__slider"
                :value="state.style.padding"
                min="0"
                max="48"
                step="1"
                @input="patchStyle({ padding: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
          <div class="pp__field">
            <span class="pp__label">Corner radius <em class="pp__val">{{ state.style.borderRadius }}px</em></span>
            <input
              type="range"
              class="pp__slider"
              :value="state.style.borderRadius"
              min="0"
              max="48"
              step="1"
              @input="patchStyle({ borderRadius: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>
      </div>

      <!-- ── REMOVE ── -->
      <div class="pp__section pp__section--danger">
        <button class="pp__delete-btn" type="button" @click="$emit('delete')">
          <Trash2 :size="14" />
          Remove text box
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref } from 'vue';
  import { ChevronLeft, Trash2 } from 'lucide-vue-next';
  import type { ClipTextBoxState, TextOverlayStyle } from '@clippster/shared-types';

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

<style scoped src="./propertyPanel.css"></style>

<style scoped>
  /* Text-box-specific: visible-range scrubber. Shared controls live in propertyPanel.css */
  .ctp__range-readout {
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--fg-muted);
  }

  .ctp__range-readout-span {
    color: var(--fg-subtle);
  }

  /* Geometry (0.5rem insets) is mirrored by the inline calc() positions in the template */
  .ctp__range-track {
    position: relative;
    height: 36px;
    border: 1px solid var(--line-subtle);
    border-radius: var(--radius-control);
    background: var(--surface-sunken);
    user-select: none;
    touch-action: none;
  }

  .ctp__range-bg {
    position: absolute;
    inset: 0.5rem;
    border-radius: 4px;
    background: var(--surface-hover);
    pointer-events: none;
  }

  .ctp__range-fill {
    position: absolute;
    top: 0.5rem;
    bottom: 0.5rem;
    border: 1px solid var(--brand-line);
    border-radius: 4px;
    background: var(--brand-soft);
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
    padding: 0;
    transform: translate(-50%, -50%);
    border: 2px solid var(--brand);
    border-radius: 50%;
    background: var(--fg);
    box-shadow: var(--shadow-sm);
    cursor: ew-resize;
    transition: transform 150ms ease;
  }

  .ctp__range-handle:hover {
    transform: translate(-50%, -50%) scale(1.12);
  }

  .ctp__range-handle:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .ctp__range-axis {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    font-variant-numeric: tabular-nums;
    color: var(--fg-subtle);
  }
</style>
