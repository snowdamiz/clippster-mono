<script setup lang="ts">
  import type { ScrollAreaScrollbarProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { ScrollAreaScrollbar, ScrollAreaThumb } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = withDefaults(defineProps<ScrollAreaScrollbarProps & { class?: HTMLAttributes['class'] }>(), {
    orientation: 'vertical'
  })

  const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <ScrollAreaScrollbar
    v-bind="delegatedProps"
    :class="
      cn(
        'flex touch-none select-none transition-colors opacity-0 hover:opacity-100',
        orientation === 'vertical' && 'h-full w-1.5 border-l border-l-transparent p-px',
        orientation === 'horizontal' && 'h-1.5 flex-col border-t border-t-transparent p-px',
        props.class
      )
    "
  >
    <ScrollAreaThumb class="relative flex-1 rounded-full bg-border/60 hover:bg-border transition-colors duration-200" />
  </ScrollAreaScrollbar>
</template>
