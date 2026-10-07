<template>
  <header
    class="flex shrink-0 items-center justify-between border-b border-[var(--sidebar-border)] bg-black/40 px-3 py-2"
  >
    <div class="flex min-w-0 items-center gap-2">
      <div
        class="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/20 text-violet-400"
      >
        <Film :size="14" />
      </div>
      <h2 class="m-0 truncate text-sm font-semibold tracking-tight text-[var(--sidebar-text)]" :title="title">
        {{ title }}
      </h2>
      <span
        v-if="badge"
        class="shrink-0 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
      >
        {{ badge }}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <slot />
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--sidebar-text-muted)] hover:bg-white/10 hover:text-[var(--sidebar-text)]"
        title="Close (Esc)"
        aria-label="Close workspace"
        @click="$emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
  </header>
</template>
<script setup lang="ts">
  import { Film, X } from 'lucide-vue-next';
  defineProps<{ title: string; badge?: string }>();
  defineEmits<{ close: [] }>();
</script>
