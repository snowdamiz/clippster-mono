<script setup lang="ts">
  /**
   * Compact row for accounts / channels / contacts in profile side cards:
   * leading visual (slot), title + subtitle, and an external-link affordance
   * when `href` is set (renders as an anchor opening in a new tab).
   */
  import { ExternalLink } from 'lucide-vue-next';

  defineProps<{
    title: string;
    subtitle?: string | null;
    href?: string | null;
  }>();
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href="href || undefined"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
    class="group -mx-2 flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5"
    :class="href ? 'transition-colors hover:bg-surface-hover' : ''"
  >
    <slot name="leading" />
    <div class="min-w-0 flex-1">
      <p class="flex min-w-0 items-center gap-1 text-sm text-fg">
        <span class="truncate">{{ title }}</span>
        <slot name="title-end" />
      </p>
      <p v-if="subtitle" class="truncate text-xs text-fg-muted">{{ subtitle }}</p>
    </div>
    <ExternalLink v-if="href" class="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
  </component>
</template>
