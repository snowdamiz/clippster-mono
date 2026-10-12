<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { useVModel } from '@vueuse/core'
  import { cn } from '@/lib/utils'

  const props = defineProps<{
    class?: HTMLAttributes['class']
    defaultValue?: string | number
    modelValue?: string | number
  }>()

  const emits = defineEmits<{
    (e: 'update:modelValue', payload: string | number): void
  }>()

  const modelValue = useVModel(props, 'modelValue', emits, {
    passive: true,
    defaultValue: props.defaultValue
  })
</script>

<template>
  <textarea
    v-model="modelValue"
    :class="
      cn(
        'flex min-h-[72px] w-full rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 py-2 text-sm text-fg transition-[border-color,box-shadow] placeholder:text-fg-subtle hover:border-line-strong focus-visible:outline-none focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50',
        props.class
      )
    "
  />
</template>
