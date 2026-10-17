<script setup lang="ts">
  import type { DropdownMenuRadioItemEmits, DropdownMenuRadioItemProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { Circle } from 'lucide-vue-next'
  import { DropdownMenuItemIndicator, DropdownMenuRadioItem, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<DropdownMenuRadioItemProps & { class?: HTMLAttributes['class'] }>()

  const emits = defineEmits<DropdownMenuRadioItemEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuRadioItem
    v-bind="forwarded"
    :class="
      cn(
        'relative flex h-8 cursor-default select-none items-center rounded-md pl-8 pr-2 text-sm text-fg outline-none transition-colors focus:bg-surface-active data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        props.class
      )
    "
  >
    <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuItemIndicator><Circle class="h-2 w-2 fill-current text-brand" /></DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuRadioItem>
</template>
