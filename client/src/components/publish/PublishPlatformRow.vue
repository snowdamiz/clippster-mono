<script setup lang="ts">
  import { PlatformLogo } from '@/components/ui/platform-logo';
  /**
   * One row per selected platform: logo + name on the left, controls (account
   * select, time, aspect ratio, ...) on the right.
   */

  defineProps<{
    platform: string;
    label: string;
    /** Small trailing note after the label, e.g. "(9:16)". */
    note?: string | null;
  }>();
</script>

<template>
  <div class="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-3">
    <div class="flex h-[var(--control-md)] min-w-0 items-center gap-2 text-sm text-fg">
      <PlatformLogo :platform="platform" size="xs" />
      <span class="truncate">{{ label }}</span>
      <span v-if="note" class="tabular shrink-0 text-xs text-fg-subtle">{{ note }}</span>
    </div>
    <div class="flex min-w-0 flex-col gap-2">
      <slot />
    </div>
  </div>
</template>
