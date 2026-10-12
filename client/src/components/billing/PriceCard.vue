<script setup lang="ts">
  /**
   * Comparable pricing card for subscription plans (Billing) and credit packs
   * (Pricing). Lay several out in a grid; mark at most one card `highlighted`
   * (the recommended option). Put the call-to-action <Button> in the default slot.
   *
   *   <PriceCard name="Creator" price="$39.99" period="/mo" credits="900"
   *     credits-label="credits/month" :features="features" highlighted badge="Most popular">
   *     <Button variant="primary" block>Get started</Button>
   *   </PriceCard>
   */
  import type { HTMLAttributes } from 'vue';
  import { Check, X, Zap } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { cn } from '@/lib/utils';
  import type { PriceFeature } from './types';

  const props = defineProps<{
    name?: string;
    /** Formatted price, e.g. "$39.99". */
    price?: string;
    /** Suffix after the price, e.g. "/mo". */
    period?: string;
    /** Small line under the price, e.g. "$11.91/mo effective". */
    priceNote?: string;
    credits?: string | number;
    creditsLabel?: string;
    features?: PriceFeature[];
    /** Recommended option — brand outline. */
    highlighted?: boolean;
    /** The plan the user is on — shows a "Current plan" badge. */
    current?: boolean;
    /** Label badge, e.g. "Most popular" / "Best value" (hidden when `current`). */
    badge?: string;
    /** Render skeleton placeholders instead of content. */
    loading?: boolean;
    class?: HTMLAttributes['class'];
  }>();
</script>

<template>
  <div
    :class="
      cn(
        'relative flex min-w-0 flex-col rounded-[var(--radius-card)] border bg-surface p-4',
        highlighted ? 'border-brand-line shadow-[inset_0_0_0_1px_var(--brand-line)]' : 'border-line-subtle',
        // The placeholder card draws its own frame: delay it like a .skeleton so fast loads never flash it.
        loading && 'skeleton-group',
        props.class
      )
    "
  >
    <template v-if="loading">
      <div class="skeleton h-4 w-20" />
      <div class="skeleton mt-3 h-6 w-24" />
      <div class="skeleton mt-4 h-4 w-28" />
      <div class="mt-4 flex flex-1 flex-col gap-2.5 border-t border-line-subtle pt-4">
        <div v-for="i in 4" :key="i" class="skeleton h-3 w-[80%]" />
      </div>
      <div class="skeleton mt-5 h-[var(--control-md)] w-full" />
    </template>

    <template v-else>
      <div class="flex min-h-5 items-center justify-between gap-2">
        <h3 class="truncate text-sm font-semibold text-fg">{{ name }}</h3>
        <Badge v-if="current" variant="success">Current plan</Badge>
        <Badge v-else-if="badge" variant="brand">{{ badge }}</Badge>
      </div>

      <div class="mt-1.5 flex items-baseline gap-1">
        <span class="tabular text-lg font-semibold tracking-[-0.01em] text-fg">{{ price }}</span>
        <span v-if="period" class="text-xs text-fg-subtle">{{ period }}</span>
      </div>
      <p v-if="priceNote" class="text-2xs text-fg-subtle">{{ priceNote }}</p>

      <div v-if="credits !== undefined" class="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs">
        <Zap class="size-3.5 shrink-0 text-brand" />
        <span class="tabular font-semibold text-fg">{{ credits }}</span>
        <span class="text-fg-muted">{{ creditsLabel }}</span>
      </div>

      <ul v-if="features?.length" class="mt-3 flex flex-1 flex-col gap-1.5 border-t border-line-subtle pt-3">
        <li
          v-for="feature in features"
          :key="feature.label"
          class="flex items-start gap-2 text-xs"
          :class="feature.note ? 'text-fg-subtle' : feature.included === false ? 'text-fg-subtle' : 'text-fg-muted'"
        >
          <template v-if="!feature.note">
            <Check v-if="feature.included !== false" class="mt-0.5 size-3.5 shrink-0 text-success" />
            <X v-else class="mt-0.5 size-3.5 shrink-0 text-fg-disabled" />
          </template>
          <span :class="{ 'text-2xs': feature.note }">{{ feature.label }}</span>
        </li>
      </ul>
      <div v-else class="flex-1" />

      <div v-if="$slots.default" class="mt-4 flex flex-col gap-2">
        <slot />
      </div>
    </template>
  </div>
</template>
