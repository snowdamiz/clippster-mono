<script setup lang="ts">
  /**
   * Form row: label, control (default slot), optional hint or error.
   *
   *   <Field label="Project name" :error="errors.name" required>
   *     <Input v-model="name" />
   *   </Field>
   */
  import type { HTMLAttributes } from 'vue'
  import { cn } from '@/lib/utils'

  const props = defineProps<{
    label?: string
    hint?: string
    error?: string | null
    required?: boolean
    /** id of the control, links the label for click-to-focus. */
    for?: string
    /** Put label and control on one row (e.g. toggles). */
    inline?: boolean
    class?: HTMLAttributes['class']
  }>()
</script>

<template>
  <div
    :class="
      cn(inline ? 'flex items-center justify-between gap-4' : 'flex flex-col gap-1.5', props.class)
    "
  >
    <div v-if="label || $slots.label" :class="inline ? 'flex min-w-0 flex-col gap-0.5' : 'flex items-center justify-between gap-2'">
      <label :for="props.for" class="text-xs font-medium text-fg-muted">
        <slot name="label">{{ label }}</slot>
        <span v-if="required" class="ml-0.5 text-danger">*</span>
      </label>
      <p v-if="inline && hint" class="text-xs text-fg-subtle">{{ hint }}</p>
      <slot name="label-end" />
    </div>
    <slot />
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>
    <p v-else-if="hint && !inline" class="text-xs text-fg-subtle">{{ hint }}</p>
  </div>
</template>
