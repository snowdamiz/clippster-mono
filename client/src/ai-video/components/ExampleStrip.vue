<script setup lang="ts">
  /** The example's shots as proportional bars under its section names; the hero section is highlighted. */
  import { computed } from 'vue';
  import type { Blueprint } from '../types';
  import { formatClock, formatDuration } from '../format';

  const props = defineProps<{ blueprint: Blueprint }>();

  const total = computed(() => props.blueprint.duration || 1);
  const sections = computed(() => props.blueprint.sections ?? []);
  const isHero = (start: number) =>
    !!props.blueprint.hero && start >= props.blueprint.hero.start && start < props.blueprint.hero.end;
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="sections.length" class="relative h-4">
      <div
        v-for="section in sections"
        :key="`${section.name}-${section.start}`"
        class="absolute border-l border-line pl-1"
        :style="{
          left: `${(section.start / total) * 100}%`,
          width: `${((section.end - section.start) / total) * 100}%`,
        }"
      >
        <span class="block truncate whitespace-nowrap text-2xs text-fg-subtle">{{ section.name }}</span>
      </div>
    </div>
    <div class="flex h-[34px] gap-px">
      <div
        v-for="shot in blueprint.shots"
        :key="shot.index"
        class="rounded-sm"
        :class="isHero(shot.start) ? 'bg-brand opacity-75' : 'bg-surface-active'"
        :style="{ flex: shot.duration }"
        :title="`Shot ${shot.index + 1}: ${formatClock(shot.start)}, ${shot.duration.toFixed(1)}s`"
      />
    </div>
    <div class="flex justify-between text-2xs text-fg-subtle">
      <span>0:00</span>
      <span>{{ formatDuration(blueprint.duration) }}</span>
    </div>
  </div>
</template>
