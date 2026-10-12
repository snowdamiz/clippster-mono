<script setup lang="ts">
  /**
   * Placeholder for empty lists, empty search results and first-run screens.
   *
   *   <EmptyState :icon="Folder" title="No projects yet" description="...">
   *     <Button variant="primary" @click="create"><Plus /> New project</Button>
   *   </EmptyState>
   */
  import type { Component, HTMLAttributes } from 'vue'
  import type { IconTileVariants } from '../icon-tile'
  import { cn } from '@/lib/utils'
  import { IconTile } from '../icon-tile'

  const props = withDefaults(
    defineProps<{
      icon?: Component
      title: string
      description?: string
      tone?: IconTileVariants['tone']
      /** `sm` for inside cards/panels, `md` for full-page states. */
      size?: 'sm' | 'md'
      class?: HTMLAttributes['class']
    }>(),
    { size: 'md', tone: 'neutral' }
  )
</script>

<template>
  <div
    :class="
      cn(
        'flex animate-fade-in flex-col items-center justify-center text-center',
        size === 'md' ? 'min-h-[260px] flex-1 gap-2.5 px-6 py-10' : 'gap-2 px-4 py-6',
        props.class
      )
    "
  >
    <slot name="icon">
      <IconTile v-if="icon" :icon="icon" :tone="tone" :size="size === 'md' ? 'lg' : 'md'" class="mb-1" />
    </slot>
    <div class="flex max-w-[360px] flex-col gap-1">
      <h3 :class="size === 'md' ? 'text-base font-semibold text-fg' : 'text-sm font-medium text-fg'">{{ title }}</h3>
      <p v-if="description || $slots.description" :class="size === 'md' ? 'text-sm text-fg-muted' : 'text-xs text-fg-muted'">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.default" class="mt-2 flex flex-wrap items-center justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
