<script setup lang="ts" generic="T extends string">
  /**
   * Aspect-ratio switcher for the branding pickers (watermark, overlay and
   * intro/outro per ratio). Looks like <SegmentedControl>, plus a small
   * status dot on ratios that are enabled / configured.
   */
  import type { Component } from 'vue';
  import { cn } from '@/lib/utils';

  defineProps<{
    modelValue: T;
    options: { id: T; label: string; icon?: Component }[];
    /** Ratios that get the "configured" dot. */
    marked?: Partial<Record<T, boolean>>;
    class?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
</script>

<template>
  <div
    role="tablist"
    :class="
      cn(
        'inline-flex h-[var(--control-md)] shrink-0 items-center gap-0.5 rounded-[var(--radius-control)] border border-line-subtle bg-surface p-0.5',
        $props.class
      )
    "
  >
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === option.id"
      :class="
        cn(
          'inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius-control)-2px)] px-2.5 text-xs font-medium transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none',
          modelValue === option.id
            ? 'bg-surface-raised text-fg shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_0_0_1px_var(--line)]'
            : 'text-fg-muted hover:text-fg'
        )
      "
      @click="emit('update:modelValue', option.id)"
    >
      <component :is="option.icon" v-if="option.icon" class="size-3.5 shrink-0" />
      {{ option.label }}
      <span
        class="size-1.5 shrink-0 rounded-full"
        :class="marked?.[option.id] ? 'bg-success' : 'bg-line-strong'"
        :title="marked?.[option.id] ? 'Configured' : 'Not configured'"
      />
    </button>
  </div>
</template>
