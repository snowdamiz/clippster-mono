<script setup lang="ts">
  /**
   * Key figure: label, value and optional hint. Put several in `<StatGrid>`,
   * which frames them as ONE strip with hairline dividers — never lay out a
   * row of separate bordered stat cards.
   *
   *   <StatGrid :count="3">
   *     <StatCard label="Total users" :value="1240" :icon="Users" />
   *     ...
   *   </StatGrid>
   *   <StatCard size="sm" label="Payout" value="$2.50" hint="per 1K views" />
   *
   * `icon` is a small glyph before the label (colored by `tone`), not a tile.
   * `size="sm"` is the compact figure for dialogs and cards: smaller value,
   * hint inline after the value. A lone StatCard outside a grid renders as a
   * framed tile.
   */
  import type { Component, HTMLAttributes } from 'vue';
  import { computed, inject } from 'vue';
  import { cn } from '@/lib/utils';
  import { STAT_GRID_SIZE } from './context';

  type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'ai';

  const props = withDefaults(
    defineProps<{
      label: string;
      value: string | number;
      hint?: string;
      icon?: Component;
      tone?: Tone | null;
      loading?: boolean;
      size?: 'sm' | 'md';
      class?: HTMLAttributes['class'];
    }>(),
    { tone: 'neutral', size: undefined }
  );

  const gridSize = inject(STAT_GRID_SIZE, null);
  const resolvedSize = computed(() => props.size ?? gridSize ?? 'md');

  const toneClass: Record<Tone, string> = {
    neutral: 'text-fg-subtle',
    brand: 'text-brand',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    ai: 'text-ai',
  };

  const frame = computed(() => {
    // Inside a StatGrid each cell draws its right/bottom hairline; the grid clips the outer ones.
    if (gridSize) {
      return gridSize === 'sm'
        ? 'border-r border-b border-line-subtle px-3 py-1'
        : 'border-r border-b border-line-subtle px-4 py-3';
    }
    return resolvedSize.value === 'sm'
      ? 'rounded-lg border border-line-subtle bg-surface px-3 py-2'
      : 'rounded-[var(--radius-card)] border border-line-subtle bg-surface px-4 py-3';
  });
</script>

<template>
  <div :class="cn('min-w-0', frame, props.class)">
    <p
      :class="[
        'flex min-w-0 items-center gap-1.5',
        resolvedSize === 'sm' ? 'text-2xs text-fg-subtle' : 'text-xs text-fg-muted',
      ]"
    >
      <component
        :is="icon"
        v-if="icon"
        :class="['shrink-0', resolvedSize === 'sm' ? 'size-3' : 'size-3.5', toneClass[tone ?? 'neutral']]"
      />
      <span class="truncate">{{ label }}</span>
    </p>
    <template v-if="resolvedSize === 'sm'">
      <div v-if="loading" class="skeleton mt-1 h-4 w-12" />
      <p v-else class="tabular mt-0.5 truncate text-base font-semibold text-fg">
        <slot name="value">{{ value }}</slot>
        <span v-if="hint" class="ml-1 text-2xs font-normal text-fg-muted">{{ hint }}</span>
      </p>
    </template>
    <template v-else>
      <div v-if="loading" class="skeleton mt-1.5 h-5 w-14" />
      <p v-else class="tabular mt-0.5 truncate text-lg font-semibold leading-6 tracking-[-0.01em] text-fg">
        <slot name="value">{{ value }}</slot>
      </p>
      <p v-if="hint" class="mt-0.5 truncate text-2xs text-fg-subtle">{{ hint }}</p>
    </template>
    <slot />
  </div>
</template>
