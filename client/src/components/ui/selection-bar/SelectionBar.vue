<script setup lang="ts">
  /**
   * Bulk-selection row for library pages (video, clips, images, audio,
   * assets, ...). Render it in the page `#toolbar` slot in place of the
   * search/filters while items are selected:
   *
   *   <SelectionBar :count="selected.size" :total="items.length" @select-all="…" @clear="…">
   *     <Button variant="secondary" size="sm">Export</Button>
   *   </SelectionBar>
   */
  import { X } from 'lucide-vue-next';
  import { Button } from '../button';

  defineProps<{
    count: number;
    /** When set and not everything is selected, shows a "Select all" link. */
    total?: number;
  }>();

  const emit = defineEmits<{ clear: []; 'select-all': [] }>();
</script>

<template>
  <div class="flex h-[var(--control-md)] min-w-0 flex-1 items-center gap-2">
    <Button variant="ghost" size="icon-sm" title="Clear selection" aria-label="Clear selection" @click="emit('clear')">
      <X />
    </Button>
    <span class="tabular whitespace-nowrap text-sm font-medium text-fg">{{ count }} selected</span>
    <Button
      v-if="total !== undefined && count < total"
      variant="link"
      size="sm"
      class="ml-1"
      @click="emit('select-all')"
    >
      Select all {{ total }}
    </Button>
    <div class="ml-auto flex shrink-0 items-center gap-1.5">
      <slot />
    </div>
  </div>
</template>
