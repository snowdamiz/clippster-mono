<script setup lang="ts">
  import type { DropdownMenuCheckboxItemEmits, DropdownMenuCheckboxItemProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { Check } from 'lucide-vue-next'
  import { DropdownMenuCheckboxItem, DropdownMenuItemIndicator, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<DropdownMenuCheckboxItemProps & { class?: HTMLAttributes['class'] }>()
  const emits = defineEmits<DropdownMenuCheckboxItemEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuCheckboxItem
    v-bind="forwarded"
    :class="
      cn(
        'relative flex h-8 cursor-default select-none items-center rounded-md pl-8 pr-2 text-sm text-fg outline-none transition-colors focus:bg-surface-active data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        props.class
      )
    "
  >
    <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuItemIndicator><Check class="w-4 h-4" /></DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuCheckboxItem>
</template>
