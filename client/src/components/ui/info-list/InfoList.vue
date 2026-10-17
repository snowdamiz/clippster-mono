<script setup lang="ts">
  /**
   * Label / value list for details and summary cards. Pass `rows` for plain
   * values (optionally links), or put `<InfoRow>` children in the slot for
   * custom values (badges, buttons).
   *
   *   <InfoList :rows="[{ label: 'Budget', value: '$5,000', strong: true }, { label: 'Site', value: url, href: url, external: true }]" />
   *   <InfoList compact :rows="summaryRows" class="rounded-lg border border-line-subtle bg-surface px-3 py-2.5" />
   *
   * Default rows are 36px with hairline dividers; `compact` packs small
   * rows without dividers (job summaries in confirm dialogs).
   */
  import { provide, toRef } from 'vue';
  import InfoRow from './InfoRow.vue';
  import { INFO_LIST_KEY, type InfoListItem } from './types';

  const props = withDefaults(defineProps<{ rows?: InfoListItem[]; compact?: boolean }>(), {
    rows: () => [],
    compact: false,
  });

  provide(INFO_LIST_KEY, { compact: toRef(props, 'compact') });
</script>

<template>
  <dl class="flex min-w-0 flex-col" :class="compact ? 'gap-1' : ''">
    <InfoRow
      v-for="row in rows"
      :key="row.label"
      :label="row.label"
      :value="row.value"
      :href="row.href"
      :external="row.external"
      :strong="row.strong"
      :mono="row.mono"
    />
    <slot />
  </dl>
</template>
