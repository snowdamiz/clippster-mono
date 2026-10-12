<script setup lang="ts">
  import type { SelectLabelProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { SelectLabel } from 'reka-ui'
  import { cn } from '@/lib/utils'

  const props = defineProps<SelectLabelProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <SelectLabel :class="cn('px-2 pt-1.5 pb-1 text-2xs font-semibold uppercase tracking-[0.06em] text-fg-subtle', props.class)"><slot /></SelectLabel>
</template>
