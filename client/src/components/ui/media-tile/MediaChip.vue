<template>
  <span
    class="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 text-2xs font-medium leading-none backdrop-blur-sm [&_svg]:size-3 [&_svg]:shrink-0"
    :class="variant === 'live' ? 'bg-live uppercase tracking-[0.04em] text-white' : 'bg-black/65 text-white/90'"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
  /**
   * Compact label that sits on top of media (thumbnails, previews): duration,
   * processing status, part counts. Dark translucent so it reads on any frame.
   */
  withDefaults(defineProps<{ variant?: 'default' | 'live' }>(), { variant: 'default' });
</script>
