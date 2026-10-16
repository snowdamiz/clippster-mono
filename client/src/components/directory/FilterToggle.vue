<script setup lang="ts">
  /**
   * Single on/off filter button for page toolbars ("Available", "Verified");
   * v-model is a boolean. Styled like the toolbar's other `sm` controls.
   * For multi-select chip groups in forms use `ToggleChips`
   * (`@/components/ui/toggle-chips`).
   */
  import type { Component } from 'vue';

  const model = defineModel<boolean>({ default: false });
  defineProps<{ icon?: Component }>();
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    class="inline-flex h-[var(--control-sm)] shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-xs font-medium transition-colors [&_svg]:size-3.5"
    :class="
      model
        ? 'border-brand-line bg-brand-soft text-brand'
        : 'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg'
    "
    @click="model = !model"
  >
    <component :is="icon" v-if="icon" />
    <slot />
  </button>
</template>
