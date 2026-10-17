<script setup lang="ts">
  /**
   * A row inside `<ListGroup>`: optional icon, title, one-line description and
   * trailing content. Renders a RouterLink with `to`, an `<a>` with `href`, a
   * button when it has a click listener, otherwise a plain row. Interactive
   * rows get a hover wash and a chevron (`:chevron="false"` to hide it).
   *
   *   <ListItem title="Bug reports" description="Track reported issues" :icon="Bug" :to="{ name: 'AdminBugReports' }">
   *     <template #trailing><Badge variant="brand">3</Badge></template>
   *   </ListItem>
   *
   * Slots: `leading` (replaces the icon tile, e.g. an Avatar), `trailing`,
   * default (extra content under the description).
   */
  import type { Component, HTMLAttributes } from 'vue';
  import type { RouteLocationRaw } from 'vue-router';
  import { computed, useAttrs } from 'vue';
  import { RouterLink } from 'vue-router';
  import { ChevronRight } from 'lucide-vue-next';
  import { cn } from '@/lib/utils';
  import type { IconTileVariants } from '../icon-tile';
  import { IconTile } from '../icon-tile';

  defineOptions({ inheritAttrs: false });

  const props = withDefaults(
    defineProps<{
      title: string;
      description?: string;
      icon?: Component;
      tone?: IconTileVariants['tone'];
      to?: RouteLocationRaw;
      href?: string;
      disabled?: boolean;
      /** Show the trailing chevron on interactive rows (default true). */
      chevron?: boolean;
      class?: HTMLAttributes['class'];
    }>(),
    { tone: 'neutral', chevron: true }
  );

  const attrs = useAttrs();
  const interactive = computed(() => !props.disabled && (!!props.to || !!props.href || !!attrs.onClick));
  const tag = computed(() => {
    if (props.disabled) return 'div';
    if (props.to) return RouterLink;
    if (props.href) return 'a';
    return attrs.onClick ? 'button' : 'div';
  });
</script>

<template>
  <component
    :is="tag"
    v-bind="attrs"
    :to="to"
    :href="href"
    :type="tag === 'button' ? 'button' : undefined"
    :aria-disabled="disabled || undefined"
    :class="
      cn(
        'group/item flex min-w-0 items-center gap-3 border-r border-b border-line-subtle px-3.5 py-2.5 text-left',
        interactive &&
          'cursor-pointer transition-colors duration-[var(--duration-fast)] hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none',
        disabled && 'pointer-events-none opacity-50',
        props.class
      )
    "
  >
    <slot name="leading">
      <IconTile v-if="icon" :icon="icon" :tone="tone" size="md" />
    </slot>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-fg">{{ title }}</p>
      <p v-if="description" class="truncate text-xs text-fg-muted">{{ description }}</p>
      <slot />
    </div>
    <slot name="trailing" />
    <ChevronRight
      v-if="interactive && chevron"
      class="size-4 shrink-0 text-fg-subtle transition-transform duration-[var(--duration-fast)] group-hover/item:translate-x-0.5"
    />
  </component>
</template>
