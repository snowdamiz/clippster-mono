<template>
  <!--
    One feature row in the framing editors' footer strip (Subtitles, Clip text
    box, B-roll): optional leading control, icon, label + hint, action, ratio.
  -->
  <div class="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-2">
    <slot name="control" />
    <component :is="icon" class="size-4 shrink-0" :class="iconClass ?? 'text-fg-muted'" />
    <div class="min-w-0 flex-1 truncate">
      <span class="text-sm font-medium text-fg">{{ label }}</span>
      <span v-if="$slots.default" class="ml-2 text-xs text-fg-subtle"><slot /></span>
    </div>
    <slot name="action" />
    <span v-if="ratio" class="shrink-0 font-mono text-2xs text-fg-subtle">{{ ratio }}</span>
  </div>
</template>

<script setup lang="ts">
  import type { Component } from 'vue';

  defineProps<{
    icon: Component;
    label: string;
    iconClass?: string;
    ratio?: string;
  }>();
</script>
