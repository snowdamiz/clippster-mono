<template>
  <div
    class="transition-opacity duration-150"
    :class="checked || visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'"
    @click.stop
  >
    <Checkbox
      :model-value="checked"
      :aria-label="label"
      class="shadow-[var(--shadow-sm)]"
      :class="overlay && !checked && 'border-white/60 bg-black/40'"
      @update:model-value="emit('toggle')"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * Selection checkbox for library cards: hidden until the card is hovered or
   * focused, always shown once checked. Clicks never open the card.
   */
  import { Checkbox } from '@/components/ui/checkbox';

  withDefaults(defineProps<{ checked: boolean; label: string; overlay?: boolean; visible?: boolean }>(), {
    overlay: true,
    visible: false,
  });
  const emit = defineEmits<{ toggle: [] }>();
</script>
