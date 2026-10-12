<template>
  <div
    v-if="videoSrc && duration > 0"
    class="fixed z-50 transition-all duration-100"
    :style="{
      left: `${position - 8}px`,
      top: `${timelineBoundsTop}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`,
      width: '16px',
      cursor: isDragging ? 'grabbing' : 'col-resize',
      'pointer-events': isDraggingToZoom ? 'none' : 'auto',
      clipPath: `inset(0 0 0 ${Math.max(0, timelineBoundsLeft - position + 8)}px)`,
    }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
  >
    <!-- Visible playhead line -->
    <div
      class="pointer-events-none absolute inset-y-0 left-[7px] w-0.5 transition-colors duration-100"
      :class="isHovered || isDragging ? 'bg-brand-hover' : 'bg-brand'"
    >
      <!-- Head marker (sits in the ruler) -->
      <div
        class="absolute left-1/2 top-0 h-2.5 w-3 -translate-x-1/2 rounded-b-[3px] shadow-[var(--shadow-sm)] transition-[background-color,scale] duration-100"
        :class="isHovered || isDragging ? 'scale-110 bg-brand-hover' : 'bg-brand'"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import type { TimelinePlayheadProps, TimelinePlayheadEmits } from '../types';

  defineProps<TimelinePlayheadProps>();
  const emit = defineEmits<TimelinePlayheadEmits>();

  // Local state for hover and drag
  const isHovered = ref(false);
  const isDragging = ref(false);

  function onMouseEnter() {
    isHovered.value = true;
  }

  function onMouseLeave() {
    // Don't change hover state if we're still dragging
    if (!isDragging.value) {
      isHovered.value = false;
    }
  }

  function onMouseDown(event: MouseEvent) {
    // Only handle left mouse button
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    isDragging.value = true;
    emit('playheadDragStart', event);
  }

  // Expose methods for parent component to control drag state
  function setDraggingState(dragging: boolean) {
    isDragging.value = dragging;
    if (!dragging) {
      isHovered.value = false;
    }
  }

  defineExpose({
    setDraggingState,
  });
</script>
