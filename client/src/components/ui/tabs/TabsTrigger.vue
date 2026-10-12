<script setup lang="ts">
  import type { TabsTriggerProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { TabsTrigger, useForwardProps } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes['class'] }>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <TabsTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius-control)-2px)] px-2.5 text-xs font-medium transition-colors hover:text-fg focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface-raised data-[state=active]:text-fg data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_0_0_1px_var(--line)] [&_svg]:size-3.5',
        props.class
      )
    "
  >
    <span class="truncate"><slot /></span>
  </TabsTrigger>
</template>
