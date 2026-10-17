<script setup lang="ts">
  /**
   * In-thread progress / status row for the AI chat panels, e.g. "Generating
   * prompt…". Shows a spinner by default; pass `icon` for a static state.
   * Extra content (progress bars, scene lists) goes in the default slot.
   */
  import type { Component } from 'vue';
  import { Loader2 } from 'lucide-vue-next';

  withDefaults(
    defineProps<{
      title: string;
      description?: string;
      icon?: Component;
      /** `brand` for active AI work, `neutral` for passive states. */
      tone?: 'neutral' | 'brand';
    }>(),
    { tone: 'brand' }
  );
</script>

<template>
  <div
    class="flex animate-enter gap-2.5 rounded-xl border px-3 py-2.5"
    :class="tone === 'brand' ? 'border-brand-line bg-brand-soft' : 'border-line-subtle bg-surface'"
    role="status"
  >
    <component
      :is="icon || Loader2"
      class="mt-0.5 size-4 shrink-0"
      :class="[tone === 'brand' ? 'text-brand' : 'text-fg-muted', !icon && 'animate-spin']"
    />
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-fg">{{ title }}</p>
      <p v-if="description" class="mt-0.5 text-xs text-fg-muted">{{ description }}</p>
      <slot />
    </div>
  </div>
</template>
