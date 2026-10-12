<template>
  <footer
    v-if="totalPages > 1"
    class="flex items-center justify-between gap-4 border-t border-line-subtle px-5 py-2.5"
    :class="mode === 'fixed' ? 'sticky bottom-0 z-10 bg-panel/90 backdrop-blur-md' : 'w-full'"
  >
    <p class="tabular truncate text-xs text-fg-muted">
      <template v-if="totalItems > 0">
        {{ totalItems }} {{ itemLabel }}{{ totalItems !== 1 ? 's' : '' }}
        <span class="text-fg-subtle">· Page {{ currentPage }} of {{ totalPages }}</span>
      </template>
    </p>

    <nav class="flex items-center gap-1" aria-label="Pagination">
      <Button variant="ghost" size="icon-sm" :disabled="currentPage === 1" title="Previous page" @click="$emit('previous')">
        <ChevronLeft />
      </Button>
      <template v-for="(page, i) in pages" :key="i">
        <span v-if="page === null" class="w-6 text-center text-xs text-fg-subtle">…</span>
        <button
          v-else
          type="button"
          class="tabular h-7 min-w-7 rounded-md px-1.5 text-xs font-medium transition-colors"
          :class="page === currentPage ? 'bg-surface-active text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'"
          :aria-current="page === currentPage ? 'page' : undefined"
          @click="$emit('goToPage', page)"
        >
          {{ page }}
        </button>
      </template>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="currentPage === totalPages"
        title="Next page"
        @click="$emit('next')"
      >
        <ChevronRight />
      </Button>
    </nav>
  </footer>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';

  interface Props {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemLabel?: string;
    /** `fixed` sticks to the bottom of the scrolling page; `static` flows inline. */
    mode?: 'fixed' | 'static';
  }

  const props = withDefaults(defineProps<Props>(), {
    itemLabel: 'item',
    mode: 'fixed',
  });

  defineEmits<{
    (e: 'goToPage', page: number): void;
    (e: 'previous'): void;
    (e: 'next'): void;
  }>();

  /** First, last and a window around the current page; `null` marks a gap. */
  const pages = computed<(number | null)[]>(() => {
    const { currentPage: current, totalPages: total } = props;
    const result: (number | null)[] = [];
    for (let page = 1; page <= total; page++) {
      const nearCurrent = page >= current - 1 && page <= current + 1;
      if (page === 1 || page === total || nearCurrent) {
        result.push(page);
      } else if (result[result.length - 1] !== null) {
        result.push(null);
      }
    }
    return result;
  });
</script>
