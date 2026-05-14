<script setup lang="ts">
  import { computed } from 'vue';
  import { EditorCore } from '../../core';

  const props = defineProps<{
    zoomLevel: number;
    playheadPosition: number;
    playheadTime?: number;
    duration: number;
    isPlaying: boolean;
    totalHeight: number;
    isSnappingToPlayhead?: boolean;
    isScrubbing?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'playheadMouseDown', event: MouseEvent): void;
  }>();
  const playheadRef = defineModel<HTMLDivElement | null>('playheadRef', { default: null });
  const editor = EditorCore.getInstance();

  // Important: the visible position (transform) is written *imperatively*
  // by `useTimelinePlayhead.applyPlayheadPosition` inside an rAF tick.
  // We do NOT bind `transform` reactively here — that would race with the
  // composable's writes and tear during scrub/playback.
  // We DO still bind a transition (only when not scrubbing/playing) so
  // programmatic seeks animate smoothly.
  // `props.zoomLevel` is intentionally referenced once below so Vue tracks
  // it and re-renders the playhead element when zoom changes — the
  // composable picks that up via its own `watch(zoomLevel)`.
  const effectivePlayheadTime = computed(() => props.playheadTime ?? props.playheadPosition);
  const transitionStyle = computed(() => {
    const noTransition = props.isScrubbing || props.isPlaying;
    return {
      transitionProperty: 'transform',
      transitionDuration: noTransition ? '0ms' : '100ms',
      transitionTimingFunction: noTransition ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)',
    };
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const fps = editor.project.getActive()?.settings?.fps ?? 30;
    const step = 1 / Math.max(1, fps);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextTime = Math.max(0, Math.min(props.duration, effectivePlayheadTime.value + direction * step));
    editor.playback.seek({ time: nextTime });
  }
</script>

<template>
  <div
    :ref="(el) => {
      playheadRef = (el as HTMLDivElement | null) ?? null;
    }"
    role="slider"
    aria-label="Timeline playhead"
    :aria-valuemin="0"
    :aria-valuemax="props.duration"
    :aria-valuenow="effectivePlayheadTime"
    tabindex="0"
    class="pointer-events-auto absolute z-60 cursor-col-resize will-change-transform"
    :data-zoom-level="zoomLevel"
    :style="{
      left: 0,
      top: 0,
      height: `${totalHeight}px`,
      width: '12px',
      ...transitionStyle,
    }"
    @mousedown="emit('playheadMouseDown', $event)"
    @keydown="handleKeyDown"
  >
    <!-- 1px white line -->
    <div
      class="absolute left-[5px] h-full w-px transition-[background-color,box-shadow] duration-100"
      :class="props.isScrubbing ? 'bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.22)]' : 'bg-white/50'"
    />
    <!-- Downward triangle head in cyan, sits above the line -->
    <div
      class="absolute -top-[1px] left-1/2 cursor-grab transition-[transform,filter] duration-100 active:cursor-grabbing"
      :style="{
        transform: props.isScrubbing ? 'translateX(-50%) scale(1.05)' : 'translateX(-50%) scale(1)',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '12px solid rgba(255,255,255,0.9)',
        filter: isSnappingToPlayhead ? 'drop-shadow(0 0 4px #0ea5e9)' : 'none',
      }"
    />
  </div>
</template>
