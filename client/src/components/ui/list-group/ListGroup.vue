<script setup lang="ts">
  /**
   * One framed list of rows divided by hairlines — the replacement for a grid
   * of separate link/nav cards (hub pages, settings menus, member lists).
   * With `columns` the rows flow into 2–3 columns on wide windows and stack
   * at the 800px minimum.
   *
   *   <ListGroup :columns="2">
   *     <ListItem title="Members" description="Manage team and roles" :icon="Users" :to="membersRoute" />
   *     <ListItem title="Billing" description="Plan and invoices" :icon="CreditCard" @click="openBilling" />
   *   </ListGroup>
   */
  import type { HTMLAttributes } from 'vue';
  import { computed } from 'vue';
  import { cn } from '@/lib/utils';

  const props = withDefaults(
    defineProps<{
      columns?: 1 | 2 | 3;
      class?: HTMLAttributes['class'];
    }>(),
    { columns: 1 }
  );

  const columnClass = computed(() => {
    if (props.columns === 3) return 'grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3';
    if (props.columns === 2) return 'grid-cols-1 @2xl:grid-cols-2';
    return 'grid-cols-1';
  });
</script>

<template>
  <!-- Items draw their right/bottom hairlines; the negative margins hide the outer ones. -->
  <div
    :class="
      cn('@container min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-line-subtle bg-surface', props.class)
    "
  >
    <div :class="cn('-mb-px -mr-px grid', columnClass)">
      <slot />
    </div>
  </div>
</template>
