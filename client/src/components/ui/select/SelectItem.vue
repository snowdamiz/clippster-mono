<script setup lang="ts">
  import type { SelectItemProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { Check } from 'lucide-vue-next'
  import { SelectItem, SelectItemIndicator, SelectItemText, useForwardProps } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<SelectItemProps & { class?: HTMLAttributes['class'] }>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectItem
    v-bind="forwardedProps"
    :class="
      cn(
        'relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-2 pr-8 text-sm text-fg outline-none focus:bg-surface-active data-[state=checked]:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class
      )
    "
  >
    <span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectItemIndicator><Check class="h-3.5 w-3.5 text-brand" /></SelectItemIndicator>
    </span>
    <SelectItemText><slot /></SelectItemText>
  </SelectItem>
</template>
