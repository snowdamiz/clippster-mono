<template>
  <!--
    Shared with the browser app (apps/web): keep this file free of
    '@/components/ui/*', '@/lib/utils', reka-ui and cva imports. Plain elements
    styled with the design tokens via var() so it renders the same in both apps.
  -->
  <header
    class="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--line-subtle)] bg-[var(--canvas)] px-4"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <Film class="size-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
      <h2 class="m-0 truncate text-[13px] font-semibold leading-5 tracking-[-0.005em] text-[var(--fg)]" :title="title">
        {{ title }}
      </h2>
      <span
        v-if="badge"
        class="inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-md border border-[var(--brand-line)] bg-[var(--brand-soft)] px-1.5 text-[11px] font-medium leading-none text-[var(--brand)]"
      >
        {{ badge }}
      </span>
    </div>
    <div class="flex shrink-0 items-center gap-1.5">
      <slot />
      <span v-if="$slots.default" class="mx-1 h-4 w-px bg-[var(--line)]" aria-hidden="true" />
      <button
        type="button"
        class="grid size-7 place-items-center rounded-[var(--radius-control)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
        title="Close (Esc)"
        aria-label="Close workspace"
        @click="$emit('close')"
      >
        <X class="size-4" />
      </button>
    </div>
  </header>
</template>
<script setup lang="ts">
  import { Film, X } from 'lucide-vue-next';
  defineProps<{ title: string; badge?: string }>();
  defineEmits<{ close: [] }>();
</script>
