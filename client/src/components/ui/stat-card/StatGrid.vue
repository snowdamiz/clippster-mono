<script setup lang="ts">
  /**
   * A row of key figures framed as ONE strip: `StatCard` children render as
   * cells divided by hairlines (no card per figure). With `count` it picks a
   * layout that never leaves an orphan cell (4 → 2×2 at the 800px window, one
   * row at the default window); without it cells auto-fit at ≥150px.
   *
   *   <StatGrid :count="4">
   *     <StatCard label="Total" :value="12" :icon="Users" />
   *     ...
   *   </StatGrid>
   *
   * `items` renders the cells for you. `size="sm"` is the compact variant for
   * inside cards, dialogs and headers: no frame, figures separated only by
   * vertical hairlines and aligned with the surrounding content.
   *
   *   <StatGrid size="sm" :items="[{ label: 'Payout', value: '$2.50', hint: 'per 1K views' }, ...]" />
   */
  import type { HTMLAttributes } from 'vue';
  import { computed, provide } from 'vue';
  import { cn } from '@/lib/utils';
  import type { StatItem } from './types';
  import StatCard from './StatCard.vue';
  import { STAT_GRID_SIZE } from './context';

  const props = withDefaults(
    defineProps<{
      /** Number of cells; picks the column layout (defaults to `items.length`). */
      count?: number;
      items?: StatItem[];
      size?: 'sm' | 'md';
      class?: HTMLAttributes['class'];
    }>(),
    { size: 'md' }
  );

  provide(STAT_GRID_SIZE, props.size);

  const columns = computed(() => {
    if (props.size === 'sm') return 'grid-cols-[repeat(auto-fit,minmax(96px,1fr))]';
    switch (props.count ?? props.items?.length) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-1 @sm:grid-cols-3';
      case 4:
        return 'grid-cols-2 @2xl:grid-cols-4';
      case 6:
        return 'grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-6';
      default:
        return 'grid-cols-[repeat(auto-fit,minmax(150px,1fr))]';
    }
  });
</script>

<template>
  <!-- Cells draw their own right/bottom hairlines; the negative margins push the
       outermost ones under the clipped edge so only inner dividers show. -->
  <div
    :class="
      cn(
        '@container overflow-hidden',
        size === 'sm' ? '' : 'rounded-[var(--radius-card)] border border-line-subtle bg-surface',
        props.class
      )
    "
  >
    <div :class="cn('grid', size === 'sm' ? '-mb-px -ml-3 -mr-px' : '-mb-px -mr-px', columns)">
      <StatCard
        v-for="item in items"
        :key="item.label"
        :label="item.label"
        :value="item.value"
        :hint="item.hint"
        :icon="item.icon"
        :tone="item.tone"
      />
      <slot />
    </div>
  </div>
</template>
