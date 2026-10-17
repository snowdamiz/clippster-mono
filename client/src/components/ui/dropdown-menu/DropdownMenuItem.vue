<script setup lang="ts">
  import type { DropdownMenuItemProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DropdownMenuItem, useForwardProps } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<DropdownMenuItemProps & { class?: HTMLAttributes['class']; inset?: boolean }>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuItem
    v-bind="forwardedProps"
    :class="
      cn(
        'relative flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm text-fg outline-none transition-colors focus:bg-surface-active data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-fg-muted',
        inset && 'pl-8',
        props.class
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
