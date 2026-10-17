<script setup lang="ts">
  import type { DropdownMenuSubTriggerProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { ChevronRight } from 'lucide-vue-next'
  import { DropdownMenuSubTrigger, useForwardProps } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<DropdownMenuSubTriggerProps & { class?: HTMLAttributes['class'] }>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuSubTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-fg outline-none focus:bg-surface-active data-[state=open]:bg-surface-active',
        props.class
      )
    "
  >
    <slot />
    <ChevronRight class="ml-auto h-4 w-4" />
  </DropdownMenuSubTrigger>
</template>
