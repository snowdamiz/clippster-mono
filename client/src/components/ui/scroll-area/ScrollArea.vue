<script setup lang="ts">
  import type { ScrollAreaRootProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui'
  import { cn } from '@/lib/utils'
  import ScrollBar from './ScrollBar.vue'

  const props = defineProps<ScrollAreaRootProps & { class?: HTMLAttributes['class'] }>()

  const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <ScrollAreaRoot v-bind="delegatedProps" :class="cn('relative overflow-hidden group', props.class)">
    <ScrollAreaViewport class="h-full w-full rounded-[inherit]"><slot /></ScrollAreaViewport>
    <ScrollBar class="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
