<script setup lang="ts">
  /**
   * Section shell for the Recording studio side rails: small title row
   * (+ optional actions) above the panel's fields, with no card chrome —
   * rails stack these with hairline dividers. For a bordered card section
   * use `SectionCard` (`@/components/ui/section-card`).
   */
  import { SectionHeader } from '@/components/ui/section-header';

  defineProps<{ title: string }>();
</script>

<template>
  <section class="flex flex-col gap-3 px-4 py-4">
    <SectionHeader :title="title" class="min-h-6">
      <slot name="actions" />
    </SectionHeader>
    <slot />
  </section>
</template>
