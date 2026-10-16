<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { cn } from '@/lib/utils'

  const props = defineProps<{
    class?: HTMLAttributes['class']
  }>()
</script>

<template>
  <h5 :class="cn('mb-0.5 text-sm font-medium leading-5', props.class)"><slot /></h5>
</template>
