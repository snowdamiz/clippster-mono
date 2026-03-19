<script setup lang="ts">
  import { computed } from 'vue';
  import { EditorCore } from '../../core';
  import { TIMELINE_CONSTANTS } from '../../constants/timeline-constants';

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

  const leftPosition = computed(() => props.playheadPosition * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel);
  const effectivePlayheadTime = computed(() => props.playheadTime ?? props.playheadPosition);
  const transitionDuration = computed(() => {
    if (props.isScrubbing) return '0ms';
    if (props.isPlaying) return '0ms';
    return '100ms';
  });
  const transitionTimingFunction = computed(() => (props.isScrubbing ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)'));

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
    :style="{
      left: 0,
      top: 0,
      height: `${totalHeight}px`,
      transform: `translateX(${leftPosition - 6}px)`,
      transitionProperty: 'transform',
      transitionDuration,
      transitionTimingFunction,
      width: '12px',
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
