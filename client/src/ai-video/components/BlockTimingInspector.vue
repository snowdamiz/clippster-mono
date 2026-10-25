<script setup lang="ts">
  import { computed } from 'vue';
  import { Input } from '@/components/ui/input';
  import { blockTiming, trimBlock } from '../director/timing';
  import type { EditDocument, MediaItem } from '../types';
  const props = defineProps<{
    document: EditDocument;
    media: MediaItem[];
    files?: Record<string, string>;
    selected: string | null;
    maxSeconds: number;
  }>();
  const emit = defineEmits<{ apply: [document: EditDocument] }>();
  const timing = computed(() => blockTiming(props.document, props.selected, props.files));
  function change(event: Event, edge: 'start' | 'end') {
    const value = Number((event.target as HTMLInputElement).value);
    const current = timing.value;
    if (!current || !Number.isFinite(value)) return;
    const delta = edge === 'end' ? value - current.duration : value - current.start;
    const next = trimBlock(props.document, props.selected!, edge, delta, props.media, props.maxSeconds, props.files);
    const resolved = blockTiming(next, props.selected, props.files);
    if (resolved)
      (event.target as HTMLInputElement).value = String(
        Math.round((edge === 'end' ? resolved.duration : resolved.start) * 1000) / 1000
      );
    if (next !== props.document) emit('apply', next);
  }
</script>
<template>
  <div v-if="timing" class="mb-3 flex flex-col gap-2 border-b border-line-subtle pb-3">
    <label class="flex flex-col gap-1 text-xs text-fg-muted">
      {{ timing.linked ? 'Scene duration (seconds)' : 'Duration (seconds)' }}
      <Input
        aria-label="Segment duration"
        type="number"
        :min="Math.ceil(0.1 * document.format.fps) / document.format.fps"
        :max="maxSeconds"
        :step="1 / document.format.fps"
        :model-value="Math.round(timing.duration * 1000) / 1000"
        @change="change($event, 'end')"
      />
    </label>
    <label v-if="!timing.shot" class="flex flex-col gap-1 text-xs text-fg-muted">
      Start (seconds)
      <Input
        aria-label="Segment start"
        type="number"
        min="0"
        :max="maxSeconds"
        :step="1 / document.format.fps"
        :model-value="timing.start"
        @change="change($event, 'start')"
      />
    </label>
    <p class="text-xs text-fg-subtle">
      {{
        timing.linked
          ? 'This text is animated inside its scene. Trimming resizes the scene and its linked text together.'
          : timing.shot
            ? 'Changing the duration moves later segments with the cut.'
            : 'Drag either edge to trim this overlay.'
      }}
    </p>
  </div>
</template>
