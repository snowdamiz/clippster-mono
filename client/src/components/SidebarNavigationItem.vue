<template>
  <component
    :is="disabled ? 'div' : linkComponent || 'a'"
    :to="linkComponent && !disabled ? href : undefined"
    :href="!linkComponent && !disabled ? href : undefined"
    :aria-current="active ? 'page' : undefined"
    :aria-disabled="disabled || undefined"
    class="nav-item group relative flex h-[30px] w-full items-center rounded-md text-sm no-underline transition-colors duration-100"
    :class="[
      collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
      disabled
        ? 'cursor-not-allowed text-fg-disabled'
        : active
          ? 'bg-surface-active font-medium text-fg'
          : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
    ]"
    :title="collapsed ? (badge ? `${name} (${badge})` : name) : undefined"
  >
    <span
      class="relative grid shrink-0 place-items-center transition-colors"
      :class="active ? 'text-brand' : disabled ? '' : 'text-fg-subtle group-hover:text-fg-muted'"
    >
      <span
        v-if="useImage"
        class="size-4 bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
        :style="{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }"
      />
      <component :is="icon" v-else :size="16" :stroke-width="active ? 2.1 : 1.8" />
      <span
        v-if="count && collapsed"
        class="absolute -right-1.5 -top-1 size-2 rounded-full ring-2 ring-canvas"
        :class="countTone === 'brand' ? 'bg-brand' : 'bg-live'"
      />
    </span>
    <span v-if="!collapsed" class="min-w-0 flex-1 truncate">{{ name }}</span>
    <span
      v-if="count && !collapsed"
      class="tabular grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-2xs font-semibold"
      :class="countTone === 'brand' ? 'bg-brand text-brand-fg' : 'bg-live text-white'"
    >
      {{ count > 99 ? '99+' : count }}
    </span>
    <span
      v-else-if="badge && !collapsed"
      class="rounded px-1.5 py-px text-2xs font-medium"
      :class="badge === 'Beta' ? 'bg-brand-soft text-brand' : 'bg-surface-hover text-fg-subtle'"
    >
      {{ badge }}
    </span>
  </component>
</template>

<script setup lang="ts">
  import type { Component } from 'vue';

  withDefaults(
    defineProps<{
      name: string;
      href: string;
      icon: string | Component;
      useImage?: boolean;
      badge?: string;
      disabled?: boolean;
      collapsed?: boolean;
      active?: boolean;
      count?: number;
      /** `live` (red) for live/attention counts, `brand` for unread messages. */
      countTone?: 'live' | 'brand';
      linkComponent?: Component;
    }>(),
    { countTone: 'live' }
  );
</script>
