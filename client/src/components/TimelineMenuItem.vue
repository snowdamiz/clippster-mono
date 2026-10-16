<template>
  <!-- A 32px row for TimelineFloatingMenu, matching DropdownMenuItem. -->
  <button
    type="button"
    role="menuitem"
    class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors disabled:pointer-events-none disabled:opacity-45"
    :class="danger ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft' : 'text-fg hover:bg-surface-active focus-visible:bg-surface-active'"
    :disabled="disabled"
  >
    <component :is="icon" v-if="icon" class="size-4 shrink-0" :class="danger ? 'text-danger' : 'text-fg-muted'" />
    <span class="flex-1 truncate">{{ label }}</span>
    <kbd v-if="shortcut" class="ml-3 text-2xs text-fg-subtle">{{ shortcut }}</kbd>
  </button>
</template>

<script setup lang="ts">
  import type { Component } from 'vue';

  defineProps<{
    label: string;
    icon?: Component;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
  }>();
</script>
