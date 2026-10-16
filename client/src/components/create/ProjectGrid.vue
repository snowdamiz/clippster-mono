<script setup lang="ts" generic="T">
  /**
   * Project grid shared by the Create tools (Video Editor, Image Editor,
   * AI Video Editor, AI Image Creator, Recording). Renders skeleton tiles on
   * the first load only (refetches keep the current tiles), then an auto-fill
   * tile grid that fades in — optionally split into "Today / Yesterday / Last 7
   * days / Older" sections. Each item is rendered through the `#tile` slot,
   * normally a <MediaTile>. Empty / no-results states stay in the page: guard
   * them with `loading && !allItems.length` so they never flash during a load.
   *
   *   <ProjectGrid :items="filtered" :loading="loading" :item-key="(p) => p.id" :group-date="(p) => p.updated_at">
   *     <template #tile="{ item }"><MediaTile :title="item.name" … /></template>
   *   </ProjectGrid>
   */
  import { computed } from 'vue';
  import { SectionHeader } from '@/components/ui/section-header';
  import { toDate as parseDate } from '@/utils/dateTimeUtils';

  const props = withDefaults(
    defineProps<{
      items: T[];
      itemKey: (item: T) => string | number;
      loading?: boolean;
      /**
       * Date used to group items into sections (Date, ISO string, or unix
       * seconds / milliseconds). Omit for a single flat grid.
       */
      groupDate?: (item: T) => Date | string | number | null | undefined;
      skeletonCount?: number;
    }>(),
    { loading: false, skeletonCount: 6 }
  );

  defineSlots<{ tile(props: { item: T }): unknown }>();

  const gridClass = 'card-grid';

  function toDate(value: Date | string | number | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseDate(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const sections = computed<{ label: string | null; items: T[] }[]>(() => {
    if (!props.groupDate) return [{ label: null, items: props.items }];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = 24 * 60 * 60 * 1000;
    const buckets: { label: string; from: number; items: T[] }[] = [
      { label: 'Today', from: today, items: [] },
      { label: 'Yesterday', from: today - day, items: [] },
      { label: 'Last 7 days', from: today - 7 * day, items: [] },
      { label: 'Older', from: -Infinity, items: [] },
    ];

    for (const item of props.items) {
      const time = toDate(props.groupDate(item))?.getTime() ?? -Infinity;
      (buckets.find((bucket) => time >= bucket.from) ?? buckets[buckets.length - 1]).items.push(item);
    }

    return buckets.filter((bucket) => bucket.items.length > 0);
  });
</script>

<template>
  <div class="flex flex-col gap-6 px-5 py-4">
    <!-- skeleton-group: placeholder tiles stay hidden for the skeleton delay so fast loads never flash -->
    <div v-if="loading && !items.length" :class="[gridClass, 'skeleton-group']" aria-busy="true">
      <div
        v-for="i in skeletonCount"
        :key="`skeleton-${i}`"
        class="overflow-hidden rounded-xl border border-line-subtle bg-surface"
      >
        <div class="skeleton aspect-video rounded-none" />
        <div class="flex flex-col gap-1.5 px-3 py-2.5">
          <div class="skeleton h-3.5 w-2/3 rounded" />
          <div class="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
    </div>

    <template v-else>
      <section v-for="section in sections" :key="section.label ?? 'all'" class="animate-fade-in">
        <SectionHeader v-if="section.label" :title="section.label" :count="section.items.length" class="mb-3" />
        <div :class="gridClass">
          <template v-for="item in section.items" :key="itemKey(item)">
            <slot name="tile" :item="item" />
          </template>
        </div>
      </section>
    </template>
  </div>
</template>
