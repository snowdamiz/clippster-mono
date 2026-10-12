<script setup lang="ts">
  /**
   * One label / value row. Use inside `<InfoList>` or directly in a card
   * body (`SectionCard`) — consecutive rows separate themselves with
   * hairlines. The value comes from the default slot (badges, buttons, ...)
   * or the `value` prop.
   *
   *   <InfoRow label="User ID" mono>{{ user.id }}</InfoRow>
   *   <InfoRow label="Status"><Badge variant="success">Active</Badge></InfoRow>
   *   <InfoRow label="Website" :value="site" :href="site" external />
   */
  import { computed, inject } from 'vue';
  import { INFO_LIST_KEY } from './types';

  const props = defineProps<{
    label: string;
    value?: string | number | null;
    href?: string | null;
    external?: boolean;
    /** Highlight the value. */
    strong?: boolean;
    /** Monospace value (ids, codes, wallet addresses). */
    mono?: boolean;
  }>();

  const list = inject(INFO_LIST_KEY, null);
  const compact = computed(() => list?.compact.value ?? false);
  const text = computed(() => (props.value === null || props.value === undefined ? '' : String(props.value)));
</script>

<template>
  <div
    class="flex min-w-0 justify-between"
    :class="
      compact ? 'items-center gap-3' : 'min-h-9 items-center gap-4 border-b border-line-subtle py-1.5 last:border-0'
    "
  >
    <component :is="list ? 'dt' : 'span'" class="shrink-0 text-xs text-fg-muted">{{ label }}</component>
    <component
      :is="list ? 'dd' : 'span'"
      class="flex min-w-0 items-center justify-end gap-1.5 truncate text-right text-fg"
      :class="[
        mono ? 'font-mono text-xs' : compact ? 'text-xs' : 'text-sm',
        strong ? 'font-semibold' : compact ? 'font-medium' : '',
      ]"
    >
      <slot>
        <a
          v-if="href"
          :href="href"
          :target="external ? '_blank' : undefined"
          :rel="external ? 'noopener noreferrer' : undefined"
          class="truncate text-brand transition-colors hover:text-brand-hover hover:underline"
          :title="text"
        >
          {{ text }}
        </a>
        <span v-else class="tabular truncate" :title="text">{{ text || '—' }}</span>
      </slot>
    </component>
  </div>
</template>
