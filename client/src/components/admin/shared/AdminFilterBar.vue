<script setup lang="ts">
  /**
   * Search + filters row for admin list pages. Drop it into PageLayout's
   * `#toolbar` slot: search on the left, filter controls next to it, a result
   * count and trailing actions (export, view toggles) on the right. Wraps onto
   * two lines at the 800px minimum window instead of overflowing.
   *
   *   <template #toolbar>
   *     <AdminFilterBar v-model:search="query" placeholder="Search users…" :count="filtered.length" count-label="user">
   *       <CustomDropdown v-model="status" :options="statusOptions" size="sm" />
   *       <template #end>
   *         <Button variant="ghost" size="sm" @click="exportCsv"><Download /> Export CSV</Button>
   *       </template>
   *     </AdminFilterBar>
   *   </template>
   *
   * Omit `v-model:search` to render only filters/count/end. `count-label` is
   * pluralised with a trailing "s" (pass `count-plural` for irregular words).
   */
  import { computed } from 'vue';
  import { SearchField } from '@/components/ui/search-field';

  const props = withDefaults(
    defineProps<{
      search?: string;
      placeholder?: string;
      searchLoading?: boolean;
      count?: number;
      countLabel?: string;
      countPlural?: string;
    }>(),
    { search: undefined, placeholder: 'Search…', countLabel: 'result' }
  );

  const emit = defineEmits<{
    'update:search': [value: string];
    submit: [value: string];
  }>();

  const countText = computed(() => {
    if (props.count === undefined) return '';
    const word = props.count === 1 ? props.countLabel : props.countPlural || `${props.countLabel}s`;
    return `${props.count.toLocaleString()} ${word}`;
  });
</script>

<template>
  <div class="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
    <SearchField
      v-if="search !== undefined"
      :model-value="search"
      :placeholder="placeholder"
      :loading="searchLoading"
      size="sm"
      class="w-auto min-w-[160px] max-w-[280px] flex-1"
      @update:model-value="emit('update:search', $event)"
      @submit="emit('submit', $event)"
    />
    <div v-if="$slots.default" class="flex min-w-0 flex-wrap items-center gap-2">
      <slot />
    </div>
    <div class="ml-auto flex shrink-0 items-center gap-2">
      <span v-if="countText" class="tabular whitespace-nowrap text-xs text-fg-subtle">{{ countText }}</span>
      <slot name="end" />
    </div>
  </div>
</template>
