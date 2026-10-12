<script setup lang="ts">
  /**
   * Selectable option card (radio-like) for the Create dialogs: title,
   * optional icon and description, brand outline + check when selected.
   *
   *   <OptionTile title="Editable" description="…" :selected="mode === 'editable'" @select="mode = 'editable'" />
   */
  import type { Component } from 'vue';
  import { Check } from 'lucide-vue-next';

  defineProps<{ title: string; description?: string; icon?: Component; selected?: boolean; disabled?: boolean }>();
  const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="!!selected"
    :disabled="disabled"
    class="relative flex min-w-0 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
    :class="selected ? 'border-brand-line bg-brand-soft' : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'"
    @click="emit('select')"
  >
    <span class="flex w-full items-center gap-1.5 pr-5 text-sm font-medium text-fg">
      <component :is="icon" v-if="icon" class="size-4 shrink-0" :class="selected ? 'text-brand' : 'text-fg-muted'" />
      {{ title }}
    </span>
    <span v-if="description" class="text-xs text-fg-muted">{{ description }}</span>
    <span
      v-if="selected"
      class="absolute right-2.5 top-2.5 grid size-4 place-items-center rounded-full bg-brand text-brand-fg"
      aria-hidden="true"
    >
      <Check class="size-3" :stroke-width="3" />
    </span>
  </button>
</template>
