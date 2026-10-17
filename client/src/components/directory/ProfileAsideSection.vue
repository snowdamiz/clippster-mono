<script setup lang="ts">
  /**
   * One block of a public profile's side column (details, contact, linked
   * accounts...). Stack several inside ONE framed aside instead of giving each
   * its own card — the frame divides them with hairlines:
   *
   *   <aside class="divide-y divide-line-subtle rounded-xl border border-line-subtle bg-surface">
   *     <ProfileAsideSection title="Professional" :icon="Briefcase"><InfoList compact :rows="rows" /></ProfileAsideSection>
   *     <ProfileAsideSection title="Hiring"><template #actions><Badge>Open</Badge></template>...</ProfileAsideSection>
   *   </aside>
   */
  import type { Component } from 'vue';

  defineProps<{ title: string; icon?: Component }>();
</script>

<template>
  <section class="flex min-w-0 flex-col gap-2 px-4 py-3">
    <div class="flex min-h-5 items-center justify-between gap-2">
      <h3 class="flex min-w-0 items-center gap-1.5 text-xs font-medium text-fg-muted">
        <component :is="icon" v-if="icon" class="size-3.5 shrink-0 text-fg-subtle" />
        <span class="truncate">{{ title }}</span>
      </h3>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
