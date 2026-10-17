<script setup lang="ts">
  /**
   * Card section for detail pages, profile pages and side panels: a
   * `SectionHeader` row (icon, title, count, description, actions) over a
   * padded body, with an optional right-aligned footer action row.
   *
   *   <SectionCard title="Subscription" :icon="CreditCard" body-class="py-1">
   *     <InfoRow label="Plan">Pro</InfoRow>
   *     <InfoRow label="Status"><Badge variant="success">Active</Badge></InfoRow>
   *   </SectionCard>
   *
   *   <SectionCard title="Rates" :icon="Percent">
   *     ...form fields...
   *     <template #footer><Button variant="primary" size="sm" @click="save">Save</Button></template>
   *   </SectionCard>
   *
   *   <SectionCard title="Referrals" :count="12" flush>
   *     <template #actions><Button size="xs" variant="ghost">View all</Button></template>
   *     <DataTable bare ... />
   *   </SectionCard>
   *
   * `flush` drops the body padding for content that brings its own (tables,
   * full-bleed row lists). For a titled group whose header sits above the
   * card (settings dialogs) use `SettingsSection`.
   */
  import type { Component, HTMLAttributes } from 'vue';
  import { cn } from '@/lib/utils';
  import { SectionHeader } from '../section-header';

  const props = defineProps<{
    title: string;
    description?: string;
    count?: number | string;
    icon?: Component;
    /** Remove the body padding. */
    flush?: boolean;
    class?: HTMLAttributes['class'];
    bodyClass?: HTMLAttributes['class'];
  }>();
</script>

<template>
  <section :class="cn('min-w-0 rounded-[var(--radius-card)] border border-line-subtle bg-surface', props.class)">
    <SectionHeader
      :title="title"
      :description="description"
      :count="count"
      :icon="icon"
      class="border-b border-line-subtle px-4 py-2.5"
    >
      <template v-if="$slots.actions" #default>
        <slot name="actions" />
      </template>
    </SectionHeader>
    <div :class="cn(flush ? '' : 'px-4 py-3', bodyClass)">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="flex flex-wrap items-center justify-end gap-2 border-t border-line-subtle px-4 py-2.5"
    >
      <slot name="footer" />
    </div>
  </section>
</template>
