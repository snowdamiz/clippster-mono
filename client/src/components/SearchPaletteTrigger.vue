<template>
  <div :class="cn('relative min-w-0', props.class)">
    <button
      type="button"
      class="group flex w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised pl-2.5 text-left text-sm transition-[border-color,box-shadow] hover:border-line-strong focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none"
      :class="[size === 'sm' ? 'h-[var(--control-sm)]' : 'h-[var(--control-md)]', query ? 'pr-7' : 'pr-2.5']"
      @click="emit('open')"
    >
      <Search class="size-3.5 shrink-0 text-fg-subtle group-hover:text-fg-muted" />
      <span class="min-w-0 flex-1 truncate" :class="query ? 'text-fg' : 'text-fg-subtle'">
        {{ query || placeholder }}
      </span>
    </button>
    <button
      v-if="query"
      type="button"
      class="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      aria-label="Clear search"
      title="Clear search"
      @click.stop="emit('clear')"
    >
      <X class="size-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
  /**
   * Looks like a search field but opens <SearchPalette> on click — the
   * toolbar entry point for library pages whose search lives in the palette
   * (Video library, Built clips, Video editor). Shows the applied query (with
   * a clear button) once the palette has set one.
   *
   *   <SearchPaletteTrigger placeholder="Search clips…" :query="searchQuery" @open="openPalette" @clear="searchQuery = ''" />
   *
   * For a real inline search input use `SearchField` (`@/components/ui/search-field`).
   */
  import type { HTMLAttributes } from 'vue';
  import { Search, X } from 'lucide-vue-next';
  import { cn } from '@/lib/utils';

  const props = withDefaults(
    defineProps<{
      placeholder?: string;
      /** The applied search query, shown instead of the placeholder. */
      query?: string;
      size?: 'sm' | 'md';
      class?: HTMLAttributes['class'];
    }>(),
    { placeholder: 'Search…', query: '', size: 'md' }
  );

  const emit = defineEmits<{ open: []; clear: [] }>();
</script>
