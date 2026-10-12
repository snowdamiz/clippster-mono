<template>
  <button
    type="button"
    :title="title"
    :aria-label="title"
    class="grid size-[var(--control-sm)] shrink-0 place-items-center rounded-md transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5"
    :class="colorClass"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
  /**
   * Icon button for project / segment cards. `overlay` (default) is styled for
   * the dark actions pill LibraryProjectCard draws over thumbnails; set
   * `:overlay="false"` for list rows. `active` marks a state
   * that is already applied (e.g. transcribed, pre-edit set).
   */
  import { computed } from 'vue';

  const props = withDefaults(
    defineProps<{ title: string; active?: boolean; overlay?: boolean; tone?: 'default' | 'danger' }>(),
    { active: false, overlay: true, tone: 'default' }
  );

  const colorClass = computed(() => {
    // Overlay buttons sit on the card's dark actions pill over the thumbnail.
    const surface = props.overlay ? 'hover:bg-white/15' : 'hover:bg-surface-hover';
    if (props.active) return [surface, 'text-brand'];
    const idle = props.overlay ? 'text-white/85' : 'text-fg-muted';
    const hover = props.tone === 'danger' ? 'hover:text-danger' : props.overlay ? 'hover:text-white' : 'hover:text-fg';
    return [surface, idle, hover];
  });
</script>
