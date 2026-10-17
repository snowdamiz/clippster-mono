<template>
  <span ref="label" class="pointer-events-none absolute top-full mt-2 flex w-max max-w-52 select-none flex-col gap-0.5 text-2xs" :style="placement">
    <span class="truncate font-medium text-fg">{{ title }}</span>
    <span class="tabular-nums text-fg-muted">{{ formatDuration(start) }} – {{ formatDuration(end) }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatDuration } from '@/utils/timelineUtils';
defineProps<{ title: string; start: number; end: number }>();
const label = ref<HTMLElement | null>(null);
const wide = ref(false);
const rightAligned = ref(false);
let observer: ResizeObserver | undefined;
let viewport: HTMLElement | null = null;
const placement = computed(() => wide.value
  ? { left: '50%', transform: 'translateX(-50%)', textAlign: 'center' as const }
  : rightAligned.value
    ? { right: '10px', textAlign: 'right' as const }
    : { left: '10px', textAlign: 'left' as const });
function measure() {
  const segment = label.value?.parentElement?.getBoundingClientRect();
  if (!segment) return;
  wide.value = segment.width >= 180;
  rightAligned.value = Boolean(viewport && viewport.getBoundingClientRect().right - segment.right < 220);
}
onMounted(() => {
  viewport = label.value?.closest('.overflow-x-auto') as HTMLElement | null;
  observer = new ResizeObserver(measure);
  if (label.value?.parentElement) observer.observe(label.value.parentElement);
  viewport?.addEventListener('scroll', measure, { passive: true });
  measure();
});
onUnmounted(() => { observer?.disconnect(); viewport?.removeEventListener('scroll', measure); });
</script>
