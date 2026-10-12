<script setup lang="ts">
  /**
   * Toolbar multi-select filter: a compact trigger ("Specialties · 2") that
   * opens a checklist. Emits `toggle` per option so callers keep their own
   * filter state.
   */
  import { ChevronDown } from 'lucide-vue-next';
  import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';

  defineProps<{
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
  }>();

  const emit = defineEmits<{ toggle: [value: string]; clear: [] }>();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="inline-flex h-[var(--control-sm)] shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-xs font-medium transition-colors"
        :class="
          selected.length
            ? 'border-brand-line bg-brand-soft text-brand'
            : 'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg'
        "
      >
        {{ label }}
        <span v-if="selected.length" class="tabular rounded bg-brand-soft px-1 text-2xs leading-4">{{ selected.length }}</span>
        <ChevronDown class="size-3.5 opacity-70" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="max-h-80 min-w-44 overflow-y-auto">
      <DropdownMenuCheckboxItem
        v-for="option in options"
        :key="option.value"
        :model-value="selected.includes(option.value)"
        @select.prevent
        @update:model-value="emit('toggle', option.value)"
      >
        {{ option.label }}
      </DropdownMenuCheckboxItem>
      <template v-if="selected.length">
        <DropdownMenuSeparator />
        <DropdownMenuItem class="text-fg-muted" @select="emit('clear')">Clear selection</DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
