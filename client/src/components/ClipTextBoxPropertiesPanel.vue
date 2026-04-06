<template>
  <div
    class="clip-text-props flex flex-col h-full min-h-0 bg-[#0d0d0d]"
    :class="variant === 'embedded' ? '' : 'border-l border-white/10'"
  >
    <div
      v-if="variant !== 'embedded'"
      class="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0"
    >
      <button
        type="button"
        class="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
        title="Back"
        @click="$emit('close')"
      >
        <ChevronLeft :size="18" />
      </button>
      <span class="text-sm font-semibold text-white">Text box</span>
    </div>

    <div v-if="!state" class="p-4 text-sm text-zinc-500">No text box for this clip.</div>

    <div v-else class="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      <label class="flex items-center gap-2 text-sm text-zinc-300">
        <input :checked="state.enabled" type="checkbox" class="rounded border-zinc-600" @change="patch({ enabled: ($event.target as HTMLInputElement).checked })" />
        Enable text box
      </label>

      <div>
        <label class="text-[10px] uppercase tracking-wide text-zinc-500">Text</label>
        <textarea
          :value="state.text"
          rows="3"
          class="mt-1 w-full rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-sm text-white"
          placeholder="Your message"
          @input="patch({ text: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>

      <div>
        <div class="flex justify-between items-baseline gap-2 text-[10px] text-zinc-500 mb-1.5">
          <span class="uppercase tracking-wide">Visible on clip</span>
          <span class="font-mono text-zinc-400 shrink-0 tabular-nums">
            {{ state.startTime.toFixed(1) }}s — {{ state.endTime.toFixed(1) }}s
            <span class="text-zinc-600">({{ visibleDuration.toFixed(1) }}s)</span>
          </span>
        </div>
        <div
          v-if="effectiveDuration <= 0"
          class="text-xs text-zinc-500 py-2"
        >
          Clip length unavailable; timing can be set after duration is known.
        </div>
        <div
          v-else
          ref="visibilityTrackRef"
          class="relative h-10 rounded-md bg-zinc-800/90 border border-zinc-700 select-none touch-none group/track"
          @mousedown.prevent="onVisibilityTrackPress"
        >
          <!-- Full clip length (subtle) -->
          <div class="absolute inset-y-2 left-2 right-2 rounded bg-zinc-900/80 pointer-events-none" />
          <!-- Visible span -->
          <div
            class="absolute top-2 bottom-2 rounded-md bg-blue-600/40 border border-blue-500/50 pointer-events-none"
            :style="{
              left: `calc(0.5rem + (100% - 1rem) * ${rangeStartFrac})`,
              width: `calc((100% - 1rem) * ${rangeWidthFrac})`,
            }"
          />
          <!-- Draggable body: move whole window -->
          <div
            class="clip-text-visibility-body absolute top-0 bottom-0 z-[1] cursor-grab active:cursor-grabbing"
            :style="{
              left: `calc(0.5rem + (100% - 1rem) * ${rangeStartFrac})`,
              width: `calc((100% - 1rem) * ${rangeWidthFrac})`,
            }"
            title="Drag to move visible range"
            @mousedown.stop.prevent="startVisibilityDrag('move', $event)"
          />
          <!-- Start handle -->
          <button
            type="button"
            class="visibility-handle absolute top-1/2 z-[2] w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-blue-500 shadow-md hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            :style="{ left: `calc(0.5rem + (100% - 1rem) * ${rangeStartFrac})` }"
            title="Drag start time"
            aria-label="Text visible from"
            @mousedown.stop.prevent="startVisibilityDrag('start', $event)"
          />
          <!-- End handle -->
          <button
            type="button"
            class="visibility-handle absolute top-1/2 z-[2] w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-blue-500 shadow-md hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            :style="{ left: `calc(0.5rem + (100% - 1rem) * ${rangeEndFrac})` }"
            title="Drag end time"
            aria-label="Text visible until"
            @mousedown.stop.prevent="startVisibilityDrag('end', $event)"
          />
        </div>
        <div
          v-if="effectiveDuration > 0"
          class="flex justify-between mt-1 text-[9px] font-mono text-zinc-600 tabular-nums"
        >
          <span>0s</span>
          <span>{{ effectiveDuration.toFixed(1) }}s</span>
        </div>
      </div>

      <div>
        <label class="text-[10px] uppercase tracking-wide text-zinc-500">Font</label>
        <div class="clip-text-prop-dropdown relative">
          <button
            type="button"
            class="ctp-input ctp-select mt-1 w-full"
            @click.stop="toggleFontDropdown"
          >
          <span class="truncate">{{ state.style.fontFamily }}</span>
          <ChevronDown class="h-3.5 w-3.5 shrink-0 transition-transform" :class="{ 'rotate-180': fontDropdownOpen }" />
          </button>
          <div v-if="fontDropdownOpen" class="ctp-dropdown">
            <button
              v-for="f in fontChoices"
              :key="f"
              type="button"
              class="ctp-dropdown-item"
              :class="{ 'ctp-dropdown-item--selected': state.style.fontFamily === f }"
              @click="selectFontFamily(f)"
            >
              {{ f }}
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] text-zinc-500">Size</label>
          <input
            :value="state.style.fontSize"
            type="range"
            class="w-full accent-amber-500"
            min="10"
            max="96"
            step="1"
            @input="patchStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
          />
          <span class="text-[10px] text-zinc-400">{{ state.style.fontSize }}px</span>
        </div>
        <div>
          <label class="text-[10px] text-zinc-500">Weight</label>
          <div class="clip-text-prop-dropdown relative">
            <button
              type="button"
              class="ctp-input ctp-select mt-1 w-full"
              @click.stop="toggleWeightDropdown"
            >
            <span class="truncate">{{ weightLabel }}</span>
            <ChevronDown class="h-3.5 w-3.5 shrink-0 transition-transform" :class="{ 'rotate-180': weightDropdownOpen }" />
            </button>
            <div v-if="weightDropdownOpen" class="ctp-dropdown">
              <button
                v-for="opt in weightChoices"
                :key="opt.value"
                type="button"
                class="ctp-dropdown-item"
                :class="{ 'ctp-dropdown-item--selected': Number(state.style.fontWeight) === opt.value }"
                @click="selectWeight(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label class="text-[10px] text-zinc-500">Text transform</label>
        <div class="clip-text-prop-dropdown relative">
          <button
            type="button"
            class="ctp-input ctp-select mt-1 w-full"
            @click.stop="toggleTransformDropdown"
          >
            <span class="truncate">{{ transformLabel }}</span>
            <ChevronDown class="h-3.5 w-3.5 shrink-0 transition-transform" :class="{ 'rotate-180': transformDropdownOpen }" />
          </button>
          <div v-if="transformDropdownOpen" class="ctp-dropdown">
            <button
              v-for="opt in transformChoices"
              :key="opt.value"
              type="button"
              class="ctp-dropdown-item"
              :class="{ 'ctp-dropdown-item--selected': (state.style.textTransform ?? 'none') === opt.value }"
              @click="selectTransform(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <span class="text-[10px] text-zinc-500">Text color</span>
          <div class="flex items-center gap-2 mt-1">
            <input
              :value="state.style.color"
              type="color"
              class="h-8 w-10 rounded border border-zinc-600 bg-zinc-900"
              @input="patchStyle({ color: ($event.target as HTMLInputElement).value })"
            />
            <input
              :value="state.style.color"
              type="text"
              class="flex-1 rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs font-mono text-white"
              @change="patchStyle({ color: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
        <div>
          <label class="flex items-center gap-2 text-[10px] text-zinc-500">
            <input
              :checked="state.style.backgroundEnabled"
              type="checkbox"
              class="rounded border-zinc-600"
              @change="patchStyle({ backgroundEnabled: ($event.target as HTMLInputElement).checked })"
            />
            Background
          </label>
          <div v-if="state.style.backgroundEnabled" class="flex items-center gap-2 mt-1">
            <input
              :value="state.style.backgroundColor || '#FFFFFF'"
              type="color"
              class="h-8 w-10 rounded border border-zinc-600 bg-zinc-900"
              @input="patchStyle({ backgroundColor: ($event.target as HTMLInputElement).value })"
            />
            <input
              :value="state.style.backgroundColor || '#FFFFFF'"
              type="text"
              class="flex-1 rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs font-mono text-white"
              @change="patchStyle({ backgroundColor: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] text-zinc-500">Corner radius</label>
          <input
            :value="state.style.borderRadius"
            type="range"
            class="w-full accent-amber-500"
            min="0"
            max="48"
            step="1"
            @input="patchStyle({ borderRadius: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
        <div>
          <label class="text-[10px] text-zinc-500">Padding</label>
          <input
            :value="state.style.padding"
            type="range"
            class="w-full accent-amber-500"
            min="4"
            max="48"
            step="1"
            @input="patchStyle({ padding: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue';
  import { ChevronDown, ChevronLeft } from 'lucide-vue-next';
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
  }>();

  const fontChoices = ['Montserrat', 'Inter', 'Arial', 'Helvetica Neue', 'Georgia', 'Impact'];

  const weightChoices = [
    { value: 400, label: 'Normal' },
    { value: 600, label: 'Semibold' },
    { value: 700, label: 'Bold' },
    { value: 800, label: 'Extra bold' },
    { value: 900, label: 'Black' },
  ] as const;

  const transformChoices = [
    { value: 'none' as const, label: 'None' },
    { value: 'uppercase' as const, label: 'Uppercase' },
    { value: 'lowercase' as const, label: 'Lowercase' },
    { value: 'capitalize' as const, label: 'Capitalize' },
  ];

  const fontDropdownOpen = ref(false);
  const weightDropdownOpen = ref(false);
  const transformDropdownOpen = ref(false);

  const weightLabel = computed(() => {
    const w = Number(props.state?.style.fontWeight ?? 700);
    return weightChoices.find((o) => o.value === w)?.label ?? 'Bold';
  });

  const transformLabel = computed(() => {
    const t = props.state?.style.textTransform ?? 'none';
    return transformChoices.find((o) => o.value === t)?.label ?? 'None';
  });

  function closeAllDropdowns() {
    fontDropdownOpen.value = false;
    weightDropdownOpen.value = false;
    transformDropdownOpen.value = false;
  }

  function onDocMouseDown(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('.clip-text-prop-dropdown')) return;
    closeAllDropdowns();
  }

  function toggleFontDropdown() {
    const next = !fontDropdownOpen.value;
    closeAllDropdowns();
    fontDropdownOpen.value = next;
  }

  function toggleWeightDropdown() {
    const next = !weightDropdownOpen.value;
    closeAllDropdowns();
    weightDropdownOpen.value = next;
  }

  function toggleTransformDropdown() {
    const next = !transformDropdownOpen.value;
    closeAllDropdowns();
    transformDropdownOpen.value = next;
  }

  function selectFontFamily(f: string) {
    patchStyle({ fontFamily: f });
    closeAllDropdowns();
  }

  function selectWeight(value: number) {
    patchStyle({ fontWeight: value });
    closeAllDropdowns();
  }

  function selectTransform(value: 'none' | 'uppercase' | 'lowercase' | 'capitalize') {
    patchStyle({ textTransform: value });
    closeAllDropdowns();
  }

  onMounted(() => {
    document.addEventListener('mousedown', onDocMouseDown);
  });

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

  /** 0–1 positions along the clip for the visible window (for layout). */
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

  const rangeWidthFrac = computed(() =>
    Math.max(0, rangeEndFrac.value - rangeStartFrac.value)
  );

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
    if (target.closest('.visibility-handle')) return;
    if (target.closest('.clip-text-visibility-body')) return;
    const t = timeFromClientX(e.clientX);
    const { startTime: s, endTime: end } = props.state;
    const mid = (s + end) / 2;
    if (t < mid) commitRange(t, end);
    else commitRange(s, t);
  }

  onUnmounted(() => {
    document.removeEventListener('mousedown', onDocMouseDown);
    document.removeEventListener('mousemove', onVisibilityDragMove);
  });
</script>

<style scoped>
  .clip-text-props {
    --ctp-surface: rgb(39 39 42);
    --ctp-border: rgb(63 63 70);
    --ctp-text: rgb(244 244 245);
    --ctp-muted: rgb(161 161 170);
    --ctp-accent: rgb(6 182 212);
  }

  .clip-text-props .ctp-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    background-color: var(--ctp-surface);
    border: 1px solid var(--ctp-border);
    border-radius: 8px;
    color: var(--ctp-text);
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .clip-text-props .ctp-input:focus {
    outline: none;
    border-color: var(--ctp-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .clip-text-props .ctp-select {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    cursor: pointer;
    text-align: left;
  }

  .clip-text-props .ctp-select:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .clip-text-props .ctp-dropdown {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    right: 0;
    z-index: 50;
    background-color: rgb(24 24 27);
    border: 1px solid var(--ctp-border);
    border-radius: 8px;
    max-height: 12rem;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
  }

  .clip-text-props .ctp-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .clip-text-props .ctp-dropdown::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .clip-text-props .ctp-dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    color: var(--ctp-text);
    border: none;
    background: transparent;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .clip-text-props .ctp-dropdown-item:hover {
    background-color: var(--ctp-surface);
  }

  .clip-text-props .ctp-dropdown-item--selected {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--ctp-accent);
  }
</style>
