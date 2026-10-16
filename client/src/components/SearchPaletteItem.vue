<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:shadow-[inset_0_0_0_1px_var(--brand-line)]"
    @click="emit('select')"
  >
    <span
      class="relative grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-line-subtle bg-surface-sunken bg-cover bg-center text-fg-disabled"
      :style="thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined"
    >
      <component :is="icon" v-if="!thumbnail && icon" class="size-4" />
      <slot name="thumbnail" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium text-fg">{{ title }}</span>
      <span v-if="$slots.meta" class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
        <slot name="meta" />
      </span>
    </span>
    <ChevronRight class="size-4 shrink-0 text-fg-disabled transition-colors group-hover:text-fg-muted" />
  </button>
</template>

<script setup lang="ts">
  /**
   * One result row inside <SearchPalette>: thumbnail, title, meta line and a
   * trailing chevron. Use the #thumbnail slot for overlays (e.g. a live dot)
   * and #meta for platform / counts.
   */
  import type { Component } from 'vue';
  import { ChevronRight } from 'lucide-vue-next';

  defineProps<{ title: string; thumbnail?: string | null; icon?: Component }>();
  const emit = defineEmits<{ select: [] }>();
</script>
