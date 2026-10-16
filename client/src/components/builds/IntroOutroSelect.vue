<script setup lang="ts" generic="T extends IntroOutroOption">
  /**
   * Intro / outro picker used by the build settings dialog: a select-style
   * trigger with a menu of personal and organization assets plus "None".
   */
  import { ref } from 'vue';
  import { Building2, Check, ChevronDown } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Field } from '@/components/ui/field';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import type { IntroOutroOption } from './types';

  defineProps<{
    label: string;
    items: T[];
    modelValue: T | null;
    /** The creator's default asset (marks the selection as "Creator default"). */
    defaultItem?: { id: string } | null;
    loading?: boolean;
    disabled?: boolean;
    emptyText?: string;
    formatDuration: (seconds: number) => string;
  }>();

  const emit = defineEmits<{ select: [item: T | null] }>();

  const open = ref(false);
</script>

<template>
  <Field :label="label">
    <template #label-end>
      <div class="flex items-center gap-1">
        <Badge v-if="modelValue?.isOrgAsset">
          <Building2 />
          Org
        </Badge>
        <Badge v-if="defaultItem && modelValue?.id === defaultItem.id" variant="brand">Creator default</Badge>
      </div>
    </template>

    <DropdownMenu v-model:open="open">
      <DropdownMenuTrigger as-child :disabled="disabled">
        <button
          type="button"
          :disabled="disabled"
          class="flex h-[var(--control-md)] w-full min-w-0 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-left text-sm text-fg transition-[border-color,box-shadow] hover:border-line-strong focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          :class="open && 'border-line-strong'"
        >
          <span class="truncate" :class="!modelValue && 'text-fg-muted'">
            {{ modelValue ? `${modelValue.name} (${formatDuration(modelValue.duration || 0)})` : 'None' }}
          </span>
          <ChevronDown class="size-3.5 shrink-0 text-fg-subtle transition-transform" :class="open && 'rotate-180'" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto">
        <DropdownMenuItem @click="emit('select', null)">
          <span class="flex-1">None</span>
          <Check v-if="!modelValue" class="!text-brand" />
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="items.length > 0" />
        <DropdownMenuItem v-for="item in items" :key="item.id" @click="emit('select', item)">
          <span class="min-w-0 flex-1 truncate">{{ item.name }}</span>
          <Badge v-if="item.isOrgAsset" class="max-w-[120px]">
            <Building2 />
            <span class="truncate">{{ item.organization_name || 'Org' }}</span>
          </Badge>
          <span class="tabular shrink-0 text-xs text-fg-subtle">{{ formatDuration(item.duration || 0) }}</span>
          <Check v-if="modelValue?.id === item.id" class="!text-brand" />
        </DropdownMenuItem>
        <p v-if="loading" class="skeleton-group px-2 py-1.5 text-xs text-fg-muted">Loading…</p>
        <p v-else-if="items.length === 0" class="px-2 py-1.5 text-xs text-fg-muted">{{ emptyText || 'Nothing available' }}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  </Field>
</template>
