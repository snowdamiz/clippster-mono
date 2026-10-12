<script setup lang="ts">
  import type { Component, HTMLAttributes } from 'vue'
  import type { IconTileVariants } from '.'
  import { cn } from '@/lib/utils'
  import { iconTileVariants } from '.'

  const props = defineProps<{
    icon?: Component
    tone?: IconTileVariants['tone']
    size?: IconTileVariants['size']
    class?: HTMLAttributes['class']
  }>()
</script>

<template>
  <span :class="cn(iconTileVariants({ tone, size }), props.class)" aria-hidden="true">
    <slot>
      <component :is="icon" v-if="icon" />
    </slot>
  </span>
</template>
