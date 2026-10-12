<script setup lang="ts" generic="T extends string | number">
  /**
   * Select for branding assets (intro / outro / watermark): a select-styled
   * trigger with the asset-type icon (or a thumbnail via `preview`), an
   * optional "none" option and the asset list. Built on DropdownMenu so it
   * works inside <Modal>.
   */
  import type { Component } from 'vue';
  import { computed } from 'vue';
  import { Check, ChevronDown, X } from 'lucide-vue-next';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { cn } from '@/lib/utils';

  const props = withDefaults(
    defineProps<{
      modelValue: T | null;
      options: { id: T; name: string }[];
      icon?: Component;
      noneLabel?: string;
      /** Label shown for a selected value that is not in `options`. */
      fallbackLabel?: string;
      /** Show the "none" option. */
      clearable?: boolean;
      /** Thumbnail URL for an option (e.g. watermark images). */
      preview?: (id: T) => string | undefined;
      emptyLabel?: string;
      disabled?: boolean;
      class?: string;
    }>(),
    { noneLabel: 'None', clearable: true, emptyLabel: 'Nothing here yet' }
  );

  const emit = defineEmits<{ 'update:modelValue': [value: T | null] }>();

  const selected = computed(() => props.options.find((o) => o.id === props.modelValue));
  const label = computed(() => {
    if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') return props.noneLabel;
    return selected.value?.name ?? props.fallbackLabel ?? props.noneLabel;
  });
  const isNone = computed(() => !selected.value);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child :disabled="disabled">
      <button
        type="button"
        :class="
          cn(
            'flex h-[var(--control-md)] w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-left text-sm text-fg transition-[border-color,box-shadow] hover:border-line-strong focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:border-line-strong',
            props.class
          )
        "
      >
        <span
          v-if="preview"
          class="transparency-checkerboard -ml-1.5 grid size-6 shrink-0 place-items-center overflow-hidden rounded border border-line-subtle"
        >
          <img v-if="selected && preview(selected.id)" :src="preview(selected.id)" alt="" class="max-h-full max-w-full object-contain" />
          <component :is="icon" v-else-if="icon" class="size-3 text-fg-subtle" />
        </span>
        <component :is="icon" v-else-if="icon" class="size-3.5 shrink-0" :class="isNone ? 'text-fg-subtle' : 'text-fg-muted'" />
        <span class="min-w-0 flex-1 truncate" :class="{ 'text-fg-muted': isNone }">{{ label }}</span>
        <ChevronDown class="size-3.5 shrink-0 text-fg-subtle" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto">
      <template v-if="clearable">
        <DropdownMenuItem @select="emit('update:modelValue', null)">
          <X />
          <span class="flex-1 text-fg-muted">{{ noneLabel }}</span>
          <Check v-if="isNone" class="!text-brand" />
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="options.length" />
      </template>
      <DropdownMenuItem v-for="option in options" :key="option.id" @select="emit('update:modelValue', option.id)">
        <span
          v-if="preview"
          class="transparency-checkerboard grid size-6 shrink-0 place-items-center overflow-hidden rounded border border-line-subtle"
        >
          <img v-if="preview(option.id)" :src="preview(option.id)" alt="" class="max-h-full max-w-full object-contain" />
          <component :is="icon" v-else-if="icon" class="!size-3" />
        </span>
        <component :is="icon" v-else-if="icon" />
        <span class="min-w-0 flex-1 truncate">{{ option.name }}</span>
        <Check v-if="option.id === modelValue" class="!text-brand" />
      </DropdownMenuItem>
      <p v-if="!clearable && !options.length" class="px-2 py-2 text-xs text-fg-subtle">{{ emptyLabel }}</p>
      <template v-if="$slots.actions">
        <DropdownMenuSeparator />
        <slot name="actions" />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
