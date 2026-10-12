<script setup lang="ts">
  /**
   * Small rounded chip for the AI chat panels: attached-media pills (with an
   * optional tag and remove button) and quick-action suggestions (`interactive`).
   */
  import type { Component } from 'vue';
  import { X } from 'lucide-vue-next';

  withDefaults(
    defineProps<{
      label: string;
      icon?: Component;
      /** Secondary label shown after the name (e.g. "Hook", "12 frames"). */
      tag?: string;
      /** Dimmed tag, for pending/automatic values. */
      tagMuted?: boolean;
      removable?: boolean;
      /** Render as a clickable suggestion button. */
      interactive?: boolean;
      disabled?: boolean;
    }>(),
    { tagMuted: false, removable: false, interactive: false, disabled: false }
  );

  const emit = defineEmits<{ click: []; remove: [] }>();
</script>

<template>
  <component
    :is="interactive ? 'button' : 'span'"
    :type="interactive ? 'button' : undefined"
    :disabled="interactive ? disabled : undefined"
    class="inline-flex h-6 min-w-0 max-w-full shrink-0 items-center gap-1 rounded-full border border-line bg-surface-raised px-2 text-xs text-fg-muted [&_svg]:size-3 [&_svg]:shrink-0"
    :class="
      interactive &&
      'transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45'
    "
    @click="interactive && emit('click')"
  >
    <component :is="icon" v-if="icon" />
    <span class="truncate" :class="!interactive && 'max-w-[140px] font-medium text-fg'" :title="label">{{ label }}</span>
    <span
      v-if="tag"
      class="shrink-0 rounded-full px-1.5 text-2xs leading-4"
      :class="tagMuted ? 'text-fg-subtle' : 'bg-surface-active text-fg-muted'"
    >
      {{ tag }}
    </span>
    <slot />
    <button
      v-if="removable"
      type="button"
      class="-mr-1 grid size-4 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-surface-active hover:text-fg"
      :aria-label="`Remove ${label}`"
      :title="`Remove ${label}`"
      @click.stop="emit('remove')"
    >
      <X />
    </button>
  </component>
</template>
