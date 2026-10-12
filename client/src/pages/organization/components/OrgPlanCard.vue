<script setup lang="ts">
  /**
   * Organization subscription tier card (name, price, included features).
   * Used by the billing plan picker and the change-plan dialog; the action
   * button goes in the default slot. `selectable` turns it into a radio-like
   * option that emits `select`.
   */
  import { computed } from 'vue';
  import { Check, Sparkles } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { cn } from '@/lib/utils';

  const props = withDefaults(
    defineProps<{
      tier: { id: string; name: string; usd: number | string; seats: number | null; monthly_credits: number };
      highlighted?: boolean;
      selectable?: boolean;
      selected?: boolean;
    }>(),
    { highlighted: false, selectable: false, selected: false }
  );

  const emit = defineEmits<{ select: [] }>();

  const features = computed(() => {
    const t = props.tier;
    const list = [
      t.seats === null ? 'Unlimited team seats' : t.seats === 0 ? 'Owner only (no team seats)' : `${t.seats} team seats`,
    ];
    if (t.monthly_credits > 0) list.push(`${t.monthly_credits.toLocaleString()} credits/month`);
    list.push(
      'Team collaboration tools',
      'Shared assets & profiles',
      'Unlimited marketing campaigns',
      'Browse clipper talent directory',
      'Post job listings for clippers & video editors'
    );
    return list;
  });
</script>

<template>
  <component
    :is="selectable ? 'button' : 'div'"
    :type="selectable ? 'button' : undefined"
    :aria-pressed="selectable ? selected : undefined"
    :class="
      cn(
        'flex min-w-0 flex-col gap-3 rounded-xl border bg-surface p-4 text-left',
        selected ? 'border-brand-line bg-brand-soft' : highlighted ? 'border-line-strong' : 'border-line-subtle',
        selectable && 'transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]'
      )
    "
    @click="selectable && emit('select')"
  >
    <div class="flex flex-wrap items-center gap-1.5">
      <h3 class="mr-auto text-sm font-semibold text-fg">{{ tier.name }}</h3>
      <Badge v-if="tier.monthly_credits > 0" variant="ai"><Sparkles />Includes AI</Badge>
      <Badge>0% fees</Badge>
    </div>
    <p class="flex items-baseline gap-0.5">
      <span class="tabular text-lg font-semibold tracking-[-0.01em] text-fg">${{ tier.usd }}</span>
      <span class="text-xs text-fg-muted">/mo</span>
    </p>
    <ul class="flex flex-1 flex-col gap-1.5">
      <li v-for="feature in features" :key="feature" class="flex items-start gap-2 text-xs text-fg-muted">
        <Check class="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
        <span>{{ feature }}</span>
      </li>
    </ul>
    <slot />
  </component>
</template>
