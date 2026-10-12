<template>
  <!--
    Toolbar button for the clip timeline header: a 28px ghost button that can be
    toggled on (brand-soft) and stays hoverable while disabled so its title
    tooltip can still explain why.
  -->
  <Button
    variant="ghost"
    :size="$slots.default ? 'sm' : 'icon-sm'"
    :disabled="disabled"
    :aria-pressed="active === undefined ? undefined : active"
    :class="
      cn(
        'disabled:pointer-events-auto disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-muted',
        active && 'bg-brand-soft text-brand hover:bg-[var(--brand-soft-hover)] hover:text-brand'
      )
    "
  >
    <slot name="icon" />
    <slot />
  </Button>
</template>

<script setup lang="ts">
  import { Button } from '@/components/ui/button';
  import { cn } from '@/lib/utils';

  defineProps<{
    active?: boolean;
    disabled?: boolean;
  }>();
</script>
