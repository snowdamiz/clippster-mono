<script setup lang="ts">
  import type { SelectTriggerProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { ChevronDown } from 'lucide-vue-next'
  import { SelectIcon, SelectTrigger, useForwardProps } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<SelectTriggerProps & { class?: HTMLAttributes['class'] }>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'flex h-[var(--control-md)] w-full items-center justify-between gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-sm text-fg transition-[border-color,box-shadow] hover:border-line-strong data-[placeholder]:text-fg-subtle focus:outline-none focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] data-[state=open]:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate text-start',
        props.class
      )
    "
  >
    <slot />
    <SelectIcon as-child><ChevronDown class="w-4 h-4 opacity-50 shrink-0" /></SelectIcon>
  </SelectTrigger>
</template>
