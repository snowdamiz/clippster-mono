<script setup lang="ts">
  /**
   * Heading row for a section inside a page or card: title (+ optional count
   * and description) on the left, actions on the right.
   */
  import type { Component, HTMLAttributes } from 'vue'
  import { cn } from '@/lib/utils'

  const props = withDefaults(
    defineProps<{
      title: string
      description?: string
      count?: number | string
      icon?: Component
      /** `eyebrow` renders a small uppercase label; `title` a regular heading. */
      variant?: 'title' | 'eyebrow'
      class?: HTMLAttributes['class']
    }>(),
    { variant: 'title' }
  )
</script>

<template>
  <div :class="cn('flex min-h-7 items-center justify-between gap-3', props.class)">
    <div class="flex min-w-0 items-center gap-2">
      <component :is="icon" v-if="icon" class="size-4 shrink-0 text-fg-subtle" />
      <div class="min-w-0">
        <h2
          :class="
            variant === 'eyebrow'
              ? 'eyebrow'
              : 'truncate text-sm font-semibold text-fg'
          "
        >
          {{ title }}
          <span v-if="count !== undefined" class="tabular ml-1 font-normal text-fg-subtle">{{ count }}</span>
        </h2>
        <p v-if="description" class="mt-0.5 truncate text-xs text-fg-muted">{{ description }}</p>
      </div>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-1.5">
      <slot />
    </div>
  </div>
</template>
