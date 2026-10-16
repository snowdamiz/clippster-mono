<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { useVModel } from '@vueuse/core'
  import { cn } from '@/lib/utils'

  const props = defineProps<{
    defaultValue?: string | number
    modelValue?: string | number
    class?: HTMLAttributes['class']
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
  <input
    v-model="modelValue"
    :class="
      cn(
        'flex h-[var(--control-md)] w-full rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-sm text-fg transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-fg-subtle hover:border-line-strong focus-visible:outline-none focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--danger-line)]',
        props.class
      )
    "
  />
</template>
