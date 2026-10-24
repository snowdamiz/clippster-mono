<script setup lang="ts">
  /**
   * The edit as four lanes (graphics, text, video, music) on a seconds ruler with the song's beats,
   * the example's cuts as dashed lines and the playhead. Click a block to select it, the ruler to seek.
   */
  import { computed } from 'vue';
  import { placeShots } from '../compiler/compile';
  import { formatClock, formatDuration } from '../format';
  import type { EditDocument, MediaItem } from '../types';

  const PX_PER_SECOND = 22;
  const HEADER_WIDTH = 84;
  const RULER_HEIGHT = 22;
  const LANE_HEIGHT = 34;
  const BAR_SPACING = 4;

  const props = defineProps<{
    document: EditDocument;
    media: MediaItem[];
    time: number;
    selected: string | null;
    showCuts: boolean;
    /** Example cut positions on the output timeline. */
    cutTimes: number[];
    /** Song beats on the output timeline. */
    beats: number[];
    /** Music loudness per bar, 0..1. */
    peaks: number[];
  }>();

  const emit = defineEmits<{ select: [id: string]; seek: [time: number] }>();

  type LaneKey = 'graphics' | 'text' | 'video' | 'music';
  const lanes: Array<{ key: LaneKey; name: string; color: string }> = [
    { key: 'graphics', name: 'Graphics', color: 'var(--ai)' },
    { key: 'text', name: 'Text', color: 'var(--warning)' },
    { key: 'video', name: 'Video', color: 'var(--track-video)' },
    { key: 'music', name: 'Music', color: 'var(--success)' },
  ];

  interface Block {
    id: string;
    start: number;
    duration: number;
    label: string;
  }

  const total = computed(() => {
    const placed = placeShots(props.document);
    return placed[placed.length - 1]?.end ?? 0;
  });
  const width = computed(() => Math.ceil(total.value * PX_PER_SECOND));
  const names = computed(() => new Map(props.media.map((item) => [item.id, item.name.replace(/\.[^.]+$/, '')])));

  const blocks = computed((): Record<Exclude<LaneKey, 'music'>, Block[]> => {
    const placed = placeShots(props.document);
    const overlays = (lane: 'graphics' | 'text') =>
      props.document.overlays.filter((overlay) => overlay.lane === lane).map(({ id, start, duration, label }) => ({ id, start, duration, label }));
    return {
      graphics: overlays('graphics'),
      text: overlays('text'),
      video: props.document.shots.map((shot, index) => ({
        id: shot.id,
        start: placed[index].start,
        duration: shot.duration,
        label: names.value.get(shot.mediaId) ?? shot.mediaId,
      })),
    };
  });

  const music = computed(() => {
    const track = props.document.music;
    const song = track ? props.media.find((item) => item.id === track.mediaId) : undefined;
    if (!track || !song) return null;
    const seconds = Math.min(total.value, Math.max(0, song.duration - track.start));
    const blockWidth = Math.max(seconds * PX_PER_SECOND - 2, 3);
    const bars = Math.floor(blockWidth / BAR_SPACING);
    const heights = Array.from({ length: bars }, (_, index) => {
      const peak = props.peaks.length ? props.peaks[Math.min(props.peaks.length - 1, Math.floor((index / bars) * props.peaks.length))] : 0;
      return 4 + peak * 18;
    });
    return { width: blockWidth, heights };
  });

  const labels = computed(() => Array.from({ length: Math.floor(total.value / 5) + 1 }, (_, index) => index * 5));
  const beatTicks = computed(() => props.beats.filter((beat) => beat >= 0 && beat <= total.value));

  function blockStyle(block: Block, color: string) {
    return {
      left: `${block.start * PX_PER_SECOND + 1}px`,
      width: `${Math.max(block.duration * PX_PER_SECOND - 2, 3)}px`,
      borderLeftColor: color,
    };
  }

  function seek(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    emit('seek', Math.min(Math.max(0, total.value - 0.01), Math.max(0, (event.clientX - rect.left) / PX_PER_SECOND)));
  }
</script>

<template>
  <div class="flex overflow-hidden rounded-md border border-line-subtle">
    <div class="shrink-0 border-r border-line-subtle bg-panel" :style="{ width: `${HEADER_WIDTH}px` }">
      <div class="border-b border-line-subtle" :style="{ height: `${RULER_HEIGHT}px` }" />
      <div
        v-for="lane in lanes"
        :key="lane.key"
        class="flex items-center gap-1.5 border-b border-line-subtle px-2"
        :style="{ height: `${LANE_HEIGHT}px` }"
      >
        <span class="size-2 shrink-0 rounded-full" :style="{ background: lane.color }" />
        <span class="text-xs text-fg-muted">{{ lane.name }}</span>
      </div>
    </div>

    <div class="min-w-0 flex-1 overflow-x-auto">
      <div class="relative" :style="{ width: `${width}px` }">
        <div class="relative cursor-pointer border-b border-line-subtle" :style="{ height: `${RULER_HEIGHT}px` }" @click="seek">
          <div
            v-for="second in labels"
            :key="second"
            class="absolute inset-y-0 border-l border-line pl-[3px]"
            :style="{ left: `${second * PX_PER_SECOND}px` }"
          >
            <span class="text-[10px] text-fg-subtle">{{ formatDuration(second) }}</span>
          </div>
          <div
            v-for="(beat, index) in beatTicks"
            :key="`beat-${index}`"
            class="absolute bottom-0 border-l border-line-strong"
            :style="{ left: `${beat * PX_PER_SECOND}px`, height: index % 4 === 0 ? '7px' : '4px' }"
          />
        </div>

        <div v-for="lane in lanes" :key="lane.key" class="relative border-b border-line-subtle" :style="{ height: `${LANE_HEIGHT}px` }">
          <template v-if="lane.key !== 'music'">
            <div
              v-for="block in blocks[lane.key]"
              :key="block.id"
              class="absolute inset-y-1 flex cursor-pointer items-center overflow-hidden rounded border-l-[3px] bg-surface-active px-1"
              :class="selected === block.id && 'outline outline-2 outline-brand'"
              :style="blockStyle(block, lane.color)"
              :title="`${block.label} (${formatClock(block.start)}, ${block.duration.toFixed(1)}s)`"
              @click="emit('select', block.id)"
            >
              <span class="whitespace-nowrap text-[10px] text-fg-muted">{{ block.duration * PX_PER_SECOND > 34 ? block.label : '' }}</span>
            </div>
          </template>
          <div
            v-else-if="music"
            class="absolute inset-y-1 left-px overflow-hidden rounded border-l-[3px] bg-surface-hover"
            :style="{ width: `${music.width}px`, borderLeftColor: lane.color }"
          >
            <svg :width="Math.max(music.width - 6, 0)" height="26" class="block">
              <rect
                v-for="(height, index) in music.heights"
                :key="index"
                :x="index * BAR_SPACING + 4"
                :y="13 - height / 2"
                width="2"
                :height="height"
                :fill="lane.color"
                opacity="0.55"
              />
            </svg>
          </div>
        </div>

        <template v-if="showCuts">
          <div
            v-for="(cut, index) in cutTimes"
            :key="`cut-${index}`"
            class="pointer-events-none absolute border-l border-dashed border-fg-disabled"
            title="Cut in the example"
            :style="{ left: `${cut * PX_PER_SECOND}px`, top: `${RULER_HEIGHT}px`, height: `${LANE_HEIGHT * lanes.length}px` }"
          />
        </template>

        <div class="pointer-events-none absolute inset-y-0 w-0.5 bg-brand" :style="{ left: `${time * PX_PER_SECOND}px` }" />
      </div>
    </div>
  </div>
</template>
