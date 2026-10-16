<script setup lang="ts">
  /** Selectable creator-profile row with avatar, name, description and a check. */
  import type { Component } from 'vue';
  import { Check } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';

  defineProps<{
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    icon?: Component;
    selected: boolean;
    disabled?: boolean;
  }>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="selected"
    class="flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
    :class="
      selected
        ? 'border-brand-line bg-brand-soft'
        : 'border-line-subtle bg-surface hover:border-line hover:bg-surface-hover'
    "
  >
    <Avatar :src="imageUrl" :name="icon ? null : name" :icon="icon" size="md" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-fg">{{ name }}</p>
      <p v-if="description" class="truncate text-xs text-fg-muted">{{ description }}</p>
    </div>
    <span
      class="grid size-5 shrink-0 place-items-center rounded-full border transition-colors"
      :class="selected ? 'border-brand bg-brand text-brand-fg' : 'border-line-strong'"
    >
      <Check v-if="selected" class="size-3" />
    </span>
  </button>
</template>
