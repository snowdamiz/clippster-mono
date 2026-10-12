<script setup lang="ts">
  /**
   * Compact header for the full-screen Create sessions (AI Image / Thumbnail
   * creator, AI Video editor, Recording studio): back button + title on the
   * left, optional centered control (e.g. a SegmentedControl), actions on the
   * right. Same height as the PageLayout header.
   *
   *   <SessionHeader :title="name" back-label="Back to projects" @back="exit">
   *     <template #badge><Badge>Ready</Badge></template>
   *     <template #actions><Button variant="primary" size="sm">Export</Button></template>
   *   </SessionHeader>
   *
   * Slots: #title (replace the static title, e.g. inline rename), #badge,
   * #center, #actions.
   */
  import type { Component } from 'vue';
  import { ArrowLeft } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';

  withDefaults(
    defineProps<{
      title?: string;
      icon?: Component;
      backLabel?: string;
      backDisabled?: boolean;
    }>(),
    { title: '', backLabel: 'Back', backDisabled: false }
  );

  const emit = defineEmits<{ back: [] }>();
</script>

<template>
  <header
    class="relative z-10 grid h-[var(--page-header-height)] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line-subtle bg-panel px-3"
  >
    <div class="flex min-w-0 items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        :title="backLabel"
        :aria-label="backLabel"
        :disabled="backDisabled"
        @click.stop="emit('back')"
      >
        <ArrowLeft />
      </Button>
      <component :is="icon" v-if="icon" class="ml-0.5 size-4 shrink-0 text-fg-subtle" />
      <div class="flex min-w-0 items-center gap-2">
        <slot name="title">
          <h1 class="truncate px-0.5 text-sm font-semibold text-fg" :title="title">{{ title }}</h1>
        </slot>
        <slot name="badge" />
      </div>
    </div>

    <div class="flex items-center justify-center">
      <slot name="center" />
    </div>

    <div class="flex min-w-0 items-center justify-end gap-1.5">
      <slot name="actions" />
    </div>
  </header>
</template>
