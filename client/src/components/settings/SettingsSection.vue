<script setup lang="ts">
  /**
   * Grouped settings list used by the account settings and profile dialogs:
   * the section title sits ABOVE a card whose children are divided by
   * hairlines (each child brings its own padding). For a card with the
   * header inside it, use `SectionCard` instead.
   *
   *   <SettingsSection title="Password" description="...">
   *     <SettingRow inset label="..."><Switch /></SettingRow>   rows are divided automatically
   *     <div class="p-4">...form...</div>
   *     <template #actions><Button size="sm">Add</Button></template>
   *     <template #footer><Button size="sm">Save</Button></template>
   *   </SettingsSection>
   *
   * `bare` drops the card chrome so the default slot renders directly under the header.
   */
  import type { HTMLAttributes } from 'vue';
  import { SectionHeader } from '@/components/ui/section-header';
  import { cn } from '@/lib/utils';

  const props = defineProps<{
    title: string;
    description?: string;
    count?: number | string;
    bare?: boolean;
    class?: HTMLAttributes['class'];
    bodyClass?: HTMLAttributes['class'];
  }>();
</script>

<template>
  <section :class="cn('flex flex-col gap-2', props.class)">
    <SectionHeader :title="title" :description="description" :count="count">
      <template v-if="$slots.actions" #default>
        <slot name="actions" />
      </template>
    </SectionHeader>
    <slot v-if="bare" />
    <div v-else class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
      <div :class="cn('divide-y divide-line-subtle', bodyClass)">
        <slot />
      </div>
      <footer
        v-if="$slots.footer"
        class="flex flex-wrap items-center justify-end gap-2 border-t border-line-subtle px-4 py-2.5"
      >
        <slot name="footer" />
      </footer>
    </div>
  </section>
</template>
