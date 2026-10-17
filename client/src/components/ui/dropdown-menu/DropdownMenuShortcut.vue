<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { cn } from '@/lib/utils'

  const props = defineProps<{
    class?: HTMLAttributes['class']
  }>()
</script>

<template>
  <span :class="cn('ml-auto pl-4 font-mono text-2xs tracking-wide text-fg-subtle', props.class)"><slot /></span>
</template>
