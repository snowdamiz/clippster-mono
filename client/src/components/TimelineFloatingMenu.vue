<template>
  <!--
    Cursor-anchored context menu shell for the clip timeline, styled like
    DropdownMenu (surface-raised, shadow-md, 32px rows). Handles viewport
    clamping, Escape, scroll-to-close and the click-away backdrop; content goes
    in the default slot (use TimelineMenuItem rows) and an optional #header.
  -->
  <Teleport to="body">
    <Transition name="timeline-menu">
      <div
        v-if="show"
        class="fixed z-[10060] min-w-48 overflow-hidden rounded-lg bg-surface-raised p-1 text-fg shadow-[var(--shadow-md)]"
        :style="menuStyle"
        role="menu"
        @contextmenu.prevent
      >
        <div v-if="$slots.header" class="mb-1 border-b border-line-subtle px-2 pb-1.5 pt-1">
          <slot name="header" />
        </div>
        <slot />
      </div>
    </Transition>

    <!-- Backdrop for closing menu -->
    <div v-if="show" class="fixed inset-0 z-[10059]" @click="emit('close')" @contextmenu.prevent="emit('close')"></div>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, watch } from 'vue';

  const props = withDefaults(
    defineProps<{
      show: boolean;
      x?: number;
      y?: number;
      /** Approximate menu size, used to keep the menu inside the viewport. */
      width?: number;
      height?: number;
    }>(),
    { x: 0, y: 0, width: 200, height: 160 }
  );

  const emit = defineEmits<{ (e: 'close'): void }>();

  const menuStyle = computed(() => {
    const padding = 8;
    let x = props.x;
    let y = props.y;
    if (x + props.width > window.innerWidth - padding) x = window.innerWidth - props.width - padding;
    if (y + props.height > window.innerHeight - padding) y = window.innerHeight - props.height - padding;
    return { left: `${Math.max(padding, x)}px`, top: `${Math.max(padding, y)}px` };
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (props.show && event.key === 'Escape') {
      event.preventDefault();
      emit('close');
    }
  }

  function handleScroll() {
    emit('close');
  }

  onMounted(() => document.addEventListener('keydown', handleKeyDown));
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('scroll', handleScroll, true);
  });

  // Close on any scroll while open
  watch(
    () => props.show,
    (show) => {
      if (show) window.addEventListener('scroll', handleScroll, true);
      else window.removeEventListener('scroll', handleScroll, true);
    }
  );
</script>

<style scoped>
  .timeline-menu-enter-active {
    transition:
      opacity 0.12s ease-out,
      transform 0.12s ease-out;
  }

  .timeline-menu-leave-active {
    transition: opacity 0.08s ease-in;
  }

  .timeline-menu-enter-from {
    opacity: 0;
    transform: scale(0.97);
  }

  .timeline-menu-leave-to {
    opacity: 0;
  }
</style>
