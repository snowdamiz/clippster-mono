<script setup lang="ts">
  /**
   * Settings row: label (+ optional icon and description) on the left, a
   * control (Switch, Button, select, SegmentedControl, ...) on the right.
   * Consecutive rows separate themselves with hairlines, so stack them
   * directly in a card body (`SectionCard`) or a `SettingsSection` list.
   *
   *   <SectionCard title="Access" body-class="py-0">
   *     <SettingRow label="AI editor" description="Can open the AI video editor">
   *       <Switch v-model="user.ai_editor_enabled" />
   *     </SettingRow>
   *     <SettingRow label="Delete user" description="Schedules the account for deletion" tone="danger">
   *       <Button variant="destructive-soft" size="sm" @click="confirmDelete">Delete</Button>
   *     </SettingRow>
   *   </SectionCard>
   *
   * `inset` adds the card's 16px side padding (for full-bleed lists such as
   * `SettingsSection`); `disabled` greys the row out and blocks interaction
   * (e.g. when a parent toggle is off); `tone="danger"` tints the label.
   */
  import type { Component, HTMLAttributes } from 'vue';
  import { cn } from '@/lib/utils';

  const props = defineProps<{
    label: string;
    description?: string;
    icon?: Component;
    tone?: 'default' | 'danger';
    disabled?: boolean;
    inset?: boolean;
    class?: HTMLAttributes['class'];
  }>();
</script>

<template>
  <div
    :class="
      cn(
        'flex min-h-11 min-w-0 items-center justify-between gap-4 border-b border-line-subtle py-2 transition-opacity last:border-0',
        inset && 'px-4',
        disabled && 'pointer-events-none opacity-45',
        props.class
      )
    "
    :aria-disabled="disabled || undefined"
  >
    <div class="flex min-w-0 items-center gap-3">
      <slot name="icon">
        <component :is="icon" v-if="icon" class="size-4 shrink-0 text-fg-subtle" />
      </slot>
      <div class="flex min-w-0 flex-col gap-0.5">
        <span class="text-sm font-medium" :class="tone === 'danger' ? 'text-danger' : 'text-fg'">
          <slot name="label">{{ label }}</slot>
        </span>
        <span v-if="description || $slots.description" class="text-xs text-fg-muted">
          <slot name="description">{{ description }}</slot>
        </span>
      </div>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-2">
      <slot />
    </div>
  </div>
</template>
