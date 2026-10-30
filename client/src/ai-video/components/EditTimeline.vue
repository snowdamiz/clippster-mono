<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useElementSize } from '@vueuse/core';
  import { Maximize2, Pause, Play, SkipBack, Undo2, ZoomIn, ZoomOut } from 'lucide-vue-next';
  import ToolbarButton from '@/editor/components/chrome/ToolbarButton.vue';
  import ToolbarSeparator from '@/editor/components/chrome/ToolbarSeparator.vue';
  import TimelineTick from '@/editor/components/timeline/TimelineTick.vue';
  import { TIMELINE_CONSTANTS, TRACK_COLORS, TRACK_HEIGHTS, TRACK_GAP } from '@/editor/constants/timeline-constants';
  import { getRulerConfig, shouldShowLabel } from '@/editor/lib/timeline/ruler-utils';
  import { formatTimeCode } from '@/editor/lib/time';
  import { placeShots } from '../compiler/compile';
  import { sceneTextFields } from '../director/sceneText';
  import type { EditDocument, MediaItem } from '../types';
  import { useSegmentTrim } from '../useSegmentTrim';
  import { trimBlock } from '../director/timing';
  import type { SceneInventory } from '../director/sceneLayers';
  import { timelineLayers } from '../director/timelineLayers';
  import { TIMELINE_TRACKS, type TimelineLane as Lane } from '../director/timelineTracks';
  const props = defineProps<{
    document: EditDocument;
    media: MediaItem[];
    files?: Record<string, string>;
    inventories?: SceneInventory[];
    time: number;
    playing?: boolean;
    canUndo?: boolean;
    busy?: boolean;
    maxSeconds?: number;
    selected: string | null;
    showCuts: boolean;
    cutTimes: number[];
    beats: number[];
    peaks: number[];
  }>();
  const emit = defineEmits<{
    select: [id: string];
    seek: [time: number];
    play: [];
    undo: [];
    apply: [document: EditDocument];
  }>();
  const trim = useSegmentTrim({
    document: () => props.document,
    media: () => props.media,
    files: () => props.files ?? {},
    inventories: () => props.inventories ?? [],
    maxSeconds: () => props.maxSeconds ?? 60,
    commit: (document) => emit('apply', document),
  });
  interface Block {
    id: string;
    start: number;
    duration: number;
    label: string;
    row?: number;
    trim?: boolean;
  }
  const viewport = ref<HTMLDivElement | null>(null);
  const canvas = ref<HTMLDivElement | null>(null);
  const { width: viewportWidth } = useElementSize(viewport);
  const zoom = ref(1);
  const scrubbing = ref(false);
  const collapsed = ref(new Set<Lane>(['icons', 'shapes', 'animation']));
  function toggleLane(key: Lane) {
    const next = new Set(collapsed.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsed.value = next;
  }
  const total = computed(() => {
    const placed = placeShots(trim.document.value);
    return placed[placed.length - 1]?.end ?? 0;
  });
  const pixelsPerSecond = computed(
    () =>
      trim.drag.value?.pixelsPerSecond ??
      Math.max(1, (viewportWidth.value - 24) / Math.max(total.value, 1)) * zoom.value
  );
  const width = computed(() => Math.max(viewportWidth.value, total.value * pixelsPerSecond.value + 24));
  const zoomLevel = computed(() => pixelsPerSecond.value / TIMELINE_CONSTANTS.PIXELS_PER_SECOND);
  const names = computed(() => new Map(props.media.map((item) => [item.id, item.name])));
  const blocks = computed(() => {
    const result: Record<Lane, Block[]> = {
      graphics: [],
      text: [],
      video: [],
      music: [],
      icons: [],
      images: [],
      shapes: [],
      animation: [],
      transitions: [],
    };
    const placed = placeShots(trim.document.value);
    trim.document.value.shots.forEach((shot, index) => {
      const block = {
        id: shot.id,
        start: placed[index].start,
        duration: shot.duration,
        label: shot.scene?.label || names.value.get(shot.mediaId ?? '') || shot.description,
        trim: true,
      };
      result[
        shot.scene
          ? 'graphics'
          : props.media.find((item) => item.id === shot.mediaId)?.kind === 'photo'
            ? 'images'
            : 'video'
      ].push(block);
      if (shot.scene)
        for (const field of sceneTextFields(shot.id, shot.scene, props.files))
          result.text.push({ ...block, id: field.id, label: field.value || field.label });
      if (index > 0)
        result.transitions.push({
          id: `transition:${shot.id}`,
          start: Math.max(0, block.start - 0.2),
          duration: 0.4,
          label: shot.transitionIn,
        });
    });
    for (const overlay of trim.document.value.overlays) result[overlay.lane].push({ ...overlay, trim: true });
    for (const block of timelineLayers(trim.document.value, props.inventories ?? []))
      result[block.category].push(block);
    const music = trim.document.value.music;
    const song = music && props.media.find((item) => item.id === music.mediaId);
    if (music && song)
      result.music.push({
        id: `music:${music.mediaId}`,
        start: 0,
        duration: Math.min(total.value, Math.max(0, song.duration - music.start)),
        label: song.name,
      });
    return result;
  });
  const lanes = computed(() =>
    TIMELINE_TRACKS.filter((lane) => blocks.value[lane.key].length).map((lane) => {
      const ends: number[] = [];
      const items = [...blocks.value[lane.key]]
        .sort((a, b) => a.start - b.start)
        .map((block) => {
          let row = ends.findIndex((end) => end <= block.start);
          if (row < 0) row = ends.length;
          ends[row] = block.start + block.duration;
          return { ...block, row };
        });
      return {
        ...lane,
        count: items.length,
        collapsed: collapsed.value.has(lane.key),
        items: collapsed.value.has(lane.key) ? [] : items,
        rowHeight: TRACK_HEIGHTS[lane.type],
        height: (collapsed.value.has(lane.key) ? 1 : ends.length) * (TRACK_HEIGHTS[lane.type] + TRACK_GAP),
      };
    })
  );
  const ruler = computed(() => {
    const { tickIntervalSeconds, labelIntervalSeconds } = getRulerConfig({
      zoomLevel: zoomLevel.value,
      fps: props.document.format.fps,
    });
    return Array.from({ length: Math.floor(total.value / tickIntervalSeconds) + 1 }, (_, i) => {
      const time = i * tickIntervalSeconds;
      return { time, label: shouldShowLabel({ time, labelIntervalSeconds }) };
    });
  });
  const timecode = (time: number) =>
    formatTimeCode({ timeInSeconds: time, fps: props.document.format.fps, format: 'HH:MM:SS:FF' });
  function seekAt(event: PointerEvent) {
    const rect = canvas.value?.getBoundingClientRect();
    if (!rect) return;
    emit(
      'seek',
      Math.max(
        0,
        Math.min(total.value - 1 / props.document.format.fps, (event.clientX - rect.left) / pixelsPerSecond.value)
      )
    );
  }
  function startScrub(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    scrubbing.value = true;
    seekAt(event);
  }
  function select(block: Block) {
    emit('select', block.id);
    if (props.time < block.start || props.time >= block.start + block.duration)
      emit('seek', Math.min(block.start + block.duration / 2, block.start + 0.1));
  }
  function zoomBy(factor: number) {
    zoom.value = Math.min(12, Math.max(1, zoom.value * factor));
  }
  function nudgeTrim(event: KeyboardEvent, id: string, edge: 'start' | 'end') {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = trimBlock(
      props.document,
      id,
      edge,
      (event.key === 'ArrowRight' ? 1 : -1) / props.document.format.fps,
      props.media,
      props.maxSeconds ?? 60,
      props.files,
      props.inventories
    );
    if (next !== props.document) emit('apply', next);
  }
</script>
<template>
  <section aria-label="Video timeline" class="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
    <div class="flex h-11 shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-line-subtle px-2">
      <div class="flex shrink-0 items-center gap-0.5">
        <ToolbarButton :label="playing ? 'Pause' : 'Play'" @click="emit('play')">
          <component :is="playing ? Pause : Play" />
        </ToolbarButton>
        <ToolbarButton label="Go to start" @click="emit('seek', 0)"><SkipBack /></ToolbarButton>
        <div class="flex items-center gap-1.5 px-2 font-mono text-xs tabular">
          <span class="text-fg">{{ timecode(time) }}</span>
          <span class="text-fg-disabled">/</span>
          <span class="text-fg-subtle">{{ timecode(total) }}</span>
        </div>
        <ToolbarSeparator />
        <ToolbarButton label="Undo" :disabled="!canUndo || busy" @click="emit('undo')"><Undo2 /></ToolbarButton>
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <slot name="controls" />
        <ToolbarButton label="Zoom to fit" @click="zoom = 1"><Maximize2 /></ToolbarButton>
        <ToolbarButton
          label="Zoom out"
          :disabled="zoom <= 1"
          @click="zoomBy(1 / TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR)"
        >
          <ZoomOut />
        </ToolbarButton>
        <input
          v-model.number="zoom"
          type="range"
          min="1"
          max="12"
          step="0.05"
          aria-label="Timeline zoom"
          class="mx-1 w-20"
        />
        <ToolbarButton label="Zoom in" :disabled="zoom >= 12" @click="zoomBy(TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR)">
          <ZoomIn />
        </ToolbarButton>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="flex min-h-full">
        <div class="sticky left-0 z-20 w-44 shrink-0 border-r border-line-subtle bg-panel">
          <div class="h-6 border-b border-line-subtle" />
          <div
            v-for="lane in lanes"
            :key="lane.key"
            class="flex items-start gap-2 px-3 pt-1 text-xs text-fg-muted"
            :style="{ height: `${lane.height}px` }"
          >
            <component :is="lane.icon" class="size-3.5 shrink-0" />
            <button
              class="flex min-w-0 flex-1 items-center gap-1 text-left"
              :aria-label="`${lane.collapsed ? 'Expand' : 'Collapse'} ${lane.label}`"
              :aria-expanded="!lane.collapsed"
              @click="toggleLane(lane.key)"
            >
              <span>{{ lane.collapsed ? '▸' : '▾' }}</span>
              <span class="truncate">{{ lane.label }}</span>
              <span class="ml-auto text-fg-subtle">{{ lane.count }}</span>
            </button>
          </div>
        </div>
        <div ref="viewport" class="min-w-0 flex-1 overflow-x-auto">
          <div ref="canvas" class="relative min-h-full" :style="{ width: `${width}px` }">
            <div
              role="slider"
              tabindex="0"
              aria-label="Timeline ruler"
              :aria-valuemin="0"
              :aria-valuemax="total"
              :aria-valuenow="time"
              class="relative z-10 h-6 touch-none select-none border-b border-line-subtle bg-panel"
              @pointerdown="startScrub"
              @pointermove="scrubbing && seekAt($event)"
              @pointerup="scrubbing = false"
              @pointercancel="scrubbing = false"
              @lostpointercapture="scrubbing = false"
              @keydown.left.prevent="emit('seek', Math.max(0, time - 1 / document.format.fps))"
              @keydown.right.prevent="
                emit('seek', Math.min(total - 1 / document.format.fps, time + 1 / document.format.fps))
              "
            >
              <TimelineTick
                v-for="tick in ruler"
                :key="tick.time"
                :time="tick.time"
                :zoom-level="zoomLevel"
                :fps="document.format.fps"
                :show-label="tick.label"
              />
              <span
                v-for="(beat, i) in beats.filter((b) => b >= 0 && b <= total)"
                :key="`beat-${i}`"
                class="absolute bottom-0 h-1 border-l border-line-strong"
                :style="{ left: `${beat * pixelsPerSecond}px` }"
              />
            </div>
            <div v-for="lane in lanes" :key="lane.key" class="relative" :style="{ height: `${lane.height}px` }">
              <button
                v-if="lane.collapsed"
                class="absolute inset-y-1 left-1 rounded border border-line-subtle bg-surface px-3 text-xs text-fg-subtle"
                @click="toggleLane(lane.key)"
              >
                {{ lane.count }} {{ lane.label.toLowerCase() }} · Expand to edit
              </button>
              <button
                v-for="block in lane.items"
                :key="`${block.id}:${block.start}`"
                type="button"
                class="absolute flex cursor-pointer flex-col overflow-hidden rounded-[0.4rem] border text-left transition-colors hover:brightness-125"
                :class="[TRACK_COLORS[lane.type].background, selected === block.id ? 'ring-2 ring-brand' : '']"
                :style="{
                  left: `${block.start * pixelsPerSecond}px`,
                  width: `${Math.max(3, block.duration * pixelsPerSecond - 2)}px`,
                  top: `${block.row * (lane.rowHeight + TRACK_GAP) + 2}px`,
                  height: `${lane.rowHeight - 2}px`,
                  borderColor: selected === block.id ? 'var(--brand)' : TRACK_COLORS[lane.type].border,
                }"
                :title="block.label"
                :aria-label="`${lane.label}: ${block.label}`"
                :aria-pressed="selected === block.id"
                @click="select(block)"
              >
                <span
                  v-for="edge in !block.trim || busy ? [] : (['start', 'end'] as const)"
                  :key="edge"
                  role="slider"
                  tabindex="0"
                  :aria-label="`Trim ${edge}: ${block.label}`"
                  :aria-valuenow="edge === 'start' ? block.start : block.start + block.duration"
                  :aria-valuemin="0"
                  :aria-valuemax="maxSeconds ?? 60"
                  class="absolute inset-y-0 z-20 w-2 cursor-ew-resize touch-none bg-white/10 hover:bg-brand/70 focus:bg-brand/70"
                  :class="edge === 'start' ? 'left-0' : 'right-0'"
                  @click.stop
                  @pointerdown="
                    (event) => {
                      emit('select', block.id);
                      if (playing) emit('play');
                      trim.start(event, block.id, edge, pixelsPerSecond);
                    }
                  "
                  @pointermove="trim.move"
                  @pointerup="trim.finish"
                  @pointercancel="trim.cancel"
                  @lostpointercapture="trim.cancel"
                  @keydown.esc="trim.cancel"
                  @keydown="nudgeTrim($event, block.id, edge)"
                />
                <span class="flex w-full items-center gap-1 truncate px-1.5 py-0.5 text-[10px] font-medium text-fg">
                  <component :is="lane.icon" class="size-3 shrink-0" />
                  {{ block.label }}
                </span>
                <svg
                  v-if="lane.key === 'music' && peaks.length"
                  width="100%"
                  height="20"
                  preserveAspectRatio="none"
                  :viewBox="`0 0 ${peaks.length * 4} 20`"
                >
                  <rect
                    v-for="(peak, i) in peaks"
                    :key="i"
                    :x="i * 4"
                    :y="10 - peak * 9"
                    width="2"
                    :height="Math.max(1, peak * 18)"
                    fill="currentColor"
                    class="text-fg-muted"
                  />
                </svg>
              </button>
            </div>
            <template v-if="showCuts">
              <span
                v-for="(cut, i) in cutTimes"
                :key="i"
                class="pointer-events-none absolute inset-y-6 border-l border-dashed border-fg-disabled"
                :style="{ left: `${cut * pixelsPerSecond}px` }"
              />
            </template>
            <div
              class="pointer-events-none absolute inset-y-0 z-30 w-px bg-brand"
              :style="{ left: `${Math.min(time * pixelsPerSecond, width - 2)}px` }"
            >
              <span
                role="slider"
                tabindex="0"
                aria-label="Timeline playhead"
                :aria-valuemin="0"
                :aria-valuemax="total"
                :aria-valuenow="time"
                class="pointer-events-auto absolute -left-[7px] top-0 cursor-col-resize touch-none border-x-[8px] border-t-[12px] border-x-transparent border-t-brand"
                @pointerdown="startScrub"
                @pointermove="scrubbing && seekAt($event)"
                @pointerup="scrubbing = false"
                @pointercancel="scrubbing = false"
                @lostpointercapture="scrubbing = false"
                @keydown.left.prevent="emit('seek', Math.max(0, time - 1 / document.format.fps))"
                @keydown.right.prevent="
                  emit('seek', Math.min(total - 1 / document.format.fps, time + 1 / document.format.fps))
                "
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
