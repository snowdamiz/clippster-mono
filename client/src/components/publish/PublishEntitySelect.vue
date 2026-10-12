<script setup lang="ts">
  /**
   * Rich single select for creator profiles, campaigns, branding profiles and
   * intro/outro assets: each option can show a small avatar (image or fallback
   * icon), the name, a tag (e.g. "Global", organization name) and a trailing
   * value (e.g. a duration). Only the name is used as the selected label.
   * Pass `noneLabel` to offer an explicit "none" option (emits `null`).
   */
  import type { Component } from 'vue';
  import { computed } from 'vue';
  import { Check } from 'lucide-vue-next';
  import { SelectItem as SelectItemRoot, SelectItemIndicator, SelectItemText } from 'reka-ui';
  import { Select, SelectContent, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
  import type { PublishEntityOption } from './types';

  const NONE = '__none__';

  const props = withDefaults(
    defineProps<{
      modelValue: string | number | null | undefined;
      options: PublishEntityOption[];
      placeholder?: string;
      /** Fallback avatar icon; omit to render options without avatars. */
      icon?: Component;
      noneLabel?: string;
      disabled?: boolean;
      id?: string;
    }>(),
    { placeholder: 'Select' }
  );

  const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>();

  const selected = computed(() => props.options.find((o) => o.id === props.modelValue) ?? null);
  const value = computed({
    get: () => (props.modelValue ?? (props.noneLabel ? NONE : undefined)) as string | number | undefined,
    set: (v) => emit('update:modelValue', v === NONE ? null : (v ?? null)),
  });

  const itemClass =
    'relative flex w-full cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm text-fg outline-none focus:bg-surface-active data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
</script>

<template>
  <Select v-model="value" :disabled="disabled">
    <SelectTrigger :id="id">
      <SelectValue :placeholder="placeholder">
        <span v-if="selected" class="flex min-w-0 items-center gap-2">
          <span
            v-if="icon"
            class="grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-active text-fg-subtle"
          >
            <img v-if="selected.imageUrl" :src="selected.imageUrl" alt="" class="size-full object-cover" />
            <component :is="icon" v-else class="size-3" />
          </span>
          <span class="truncate">{{ selected.name }}</span>
          <span v-if="selected.trailing" class="tabular shrink-0 text-fg-subtle">{{ selected.trailing }}</span>
        </span>
        <span v-else-if="noneLabel" class="text-fg">{{ noneLabel }}</span>
      </SelectValue>
    </SelectTrigger>
    <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
      <template v-if="noneLabel">
        <SelectItemRoot :value="NONE" :class="itemClass">
          <SelectItemText>{{ noneLabel }}</SelectItemText>
          <span class="absolute right-2 flex size-3.5 items-center justify-center">
            <SelectItemIndicator><Check class="size-3.5 text-brand" /></SelectItemIndicator>
          </span>
        </SelectItemRoot>
        <SelectSeparator v-if="options.length > 0" />
      </template>
      <SelectItemRoot v-for="option in options" :key="option.id" :value="option.id" :class="itemClass">
        <span
          v-if="icon"
          class="grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-active text-fg-subtle"
        >
          <img v-if="option.imageUrl" :src="option.imageUrl" alt="" class="size-full object-cover" />
          <component :is="icon" v-else class="size-3" />
        </span>
        <SelectItemText class="min-w-0 flex-1 truncate">{{ option.name }}</SelectItemText>
        <span v-if="option.tag" class="shrink-0 rounded bg-surface-hover px-1.5 text-2xs leading-4 text-fg-subtle">
          {{ option.tag }}
        </span>
        <span v-if="option.trailing" class="tabular shrink-0 text-xs text-fg-subtle">{{ option.trailing }}</span>
        <span class="absolute right-2 flex size-3.5 items-center justify-center">
          <SelectItemIndicator><Check class="size-3.5 text-brand" /></SelectItemIndicator>
        </span>
      </SelectItemRoot>
      <div v-if="options.length === 0 && $slots.empty" class="px-2 py-1.5 text-xs text-fg-subtle">
        <slot name="empty" />
      </div>
    </SelectContent>
  </Select>
</template>
