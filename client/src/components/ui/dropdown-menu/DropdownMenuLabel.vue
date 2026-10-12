<script setup lang="ts">
  import type { DropdownMenuLabelProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { DropdownMenuLabel, useForwardProps } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<DropdownMenuLabelProps & { class?: HTMLAttributes['class']; inset?: boolean }>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuLabel
    v-bind="forwardedProps"
    :class="cn('px-2 pt-1.5 pb-1 text-2xs font-semibold uppercase tracking-[0.06em] text-fg-subtle', inset && 'pl-8', props.class)"
  >
    <slot />
  </DropdownMenuLabel>
</template>
