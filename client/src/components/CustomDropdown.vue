<template>
  <div v-bind="rootAttrs" :class="cn('relative inline-block w-full min-w-0', $attrs.class as string)">
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        :id="id"
        type="button"
        :disabled="disabled"
        :aria-label="ariaLabel"
        class="custom-dropdown__trigger flex w-full min-w-0 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-left text-sm text-fg transition-[border-color,box-shadow] hover:border-line-strong focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        :class="[size === 'sm' ? 'h-[var(--control-sm)] text-xs' : 'h-[var(--control-md)]', isOpen && 'border-line-strong', triggerClass]"
        aria-haspopup="listbox"
      >
        <span class="truncate" :class="{ 'text-fg-subtle': !selectedLabel }">
          {{ selectedLabel || placeholder }}
        </span>
        <ChevronDown class="size-3.5 shrink-0 text-fg-subtle transition-transform" :class="{ 'rotate-180': isOpen }" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        role="listbox"
        side="bottom"
        align="start"
        :side-offset="4"
        :collision-padding="8"
        class="z-[10060] max-h-[min(300px,var(--reka-popover-content-available-height))] min-w-[var(--reka-popover-trigger-width)] overflow-y-auto rounded-lg bg-surface-raised p-1 shadow-[var(--shadow-md)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        @open-auto-focus="focusSelected"
      >
        <div
          v-for="option in options"
          :key="option.value"
          class="group flex items-center rounded-md transition-colors hover:bg-surface-active focus-within:bg-surface-active"
        >
          <button
            type="button"
            role="option"
            :aria-selected="modelValue === option.value"
            :data-selected="modelValue === option.value || undefined"
            class="flex h-8 min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm text-fg outline-none"
            @click="selectOption(option)"
          >
            <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
            <Check v-if="modelValue === option.value" class="size-3.5 shrink-0 text-brand" />
          </button>
          <button
            v-if="showDelete"
            type="button"
            class="grid size-7 shrink-0 place-items-center rounded text-fg-subtle opacity-0 transition hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
            title="Delete template"
            @click="handleDelete(option, $event)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
        <div v-if="options.length === 0" class="px-2 py-2 text-center text-sm text-fg-muted">No options</div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
  </div>
</template>

<script setup lang="ts">
  /**
   * Lightweight single-select dropdown driven by an `options` array.
   * Built on reka's Popover so it stacks and dismisses correctly inside Modal.
   * Any value type works, including `''` (e.g. a "None" option).
   *
   *   <CustomDropdown v-model="role" :options="roleOptions" placeholder="Select role" />
   *   <CustomDropdown id="campaign" v-model="campaignId" :options="options" :disabled="saving" class="w-48" />
   *
   * `id` / `aria-label` / `disabled` go to the trigger button (so `<Field for>`
   * labels it); width/layout classes replace the default `w-full`.
   */
  import { ref, computed, useAttrs } from 'vue';
  import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
  import { cn } from '@/lib/utils';
  import { Check, ChevronDown, Trash2 } from 'lucide-vue-next';

  export interface DropdownOption {
    label: string;
    value: any;
  }

  // Width/layout classes from the caller replace the default `w-full` (merged with tailwind-merge).
  defineOptions({ inheritAttrs: false });
  const attrs = useAttrs();
  const rootAttrs = computed(() => {
    const { class: _class, ...rest } = attrs;
    return rest;
  });

  const props = defineProps<{
    modelValue: any;
    options: DropdownOption[];
    placeholder?: string;
    triggerClass?: string;
    showDelete?: boolean;
    size?: 'sm' | 'md';
    disabled?: boolean;
    /** Applied to the trigger button. */
    id?: string;
    ariaLabel?: string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: any];
    delete: [value: any, event: Event];
  }>();

  const isOpen = ref(false);

  const selectedLabel = computed(() => {
    const option = props.options.find((o) => o.value === props.modelValue);
    return option ? option.label : '';
  });

  function focusSelected(event: Event) {
    const content = event.target as HTMLElement | null;
    const selected = content?.querySelector<HTMLElement>('[data-selected]');
    if (selected) {
      event.preventDefault();
      selected.focus();
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectOption(option: DropdownOption) {
    emit('update:modelValue', option.value);
    isOpen.value = false;
  }

  function handleDelete(option: DropdownOption, event: Event) {
    event.stopPropagation();
    emit('delete', option.value, event);
  }
</script>
