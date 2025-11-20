<template>
  <div
    v-if="videoSrc && duration > 0"
    class="fixed z-60 transition-all duration-100"
    :style="{
      left: `${position - 1}px`,
      top: `${timelineBoundsTop}px`,
      height: `${timelineBoundsBottom - timelineBoundsTop}px`,
      width: '2px',
      cursor: isDragging ? 'grabbing' : 'col-resize',
      'pointer-events': isDraggingToZoom ? 'none' : 'auto',
    }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
  >
    <!-- Visible playhead line -->
    <div
      class="absolute top-0 bottom-0 bg-white/70 shadow-lg transition-all duration-100"
      :class="{
        'bg-white/90': isHovered || isDragging,
        'shadow-xl': isHovered || isDragging,
      }"
      :style="{
        left: '0',
        width: '2px',
        'pointer-events': 'none',
      }"
    >
      <!-- Top circle -->
      <div
        class="absolute top-1 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-md"
        :class="{
          'w-2.5 h-2.5': isHovered || isDragging,
        }"
      ></div>
      <!-- Bottom circle -->
      <div
        class="absolute bottom-1 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white/80 rounded-full shadow-md"
        :class="{
          'w-2.5 h-2.5': isHovered || isDragging,
        }"
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

<style scoped>
  /* Hitbox container - 16px wide invisible area */
  .hitbox-container {
    user-select: none;
  }

  /* Visible playhead line styling */
  .playhead-line {
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
    transition:
      width 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease;
    user-select: none;
  }

  .playhead-line:hover,
  .playhead-line.dragging {
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 12px rgba(0, 0, 0, 0.9);
  }

  /* Playhead handle dots */
  .playhead-line::before {
    content: '';
    position: absolute;
    left: -4px;
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform 0.2s ease;
  }

  .playhead-line::after {
    content: '';
    position: absolute;
    bottom: 0px;
    left: -4px;
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    transition: transform 0.2s ease;
  }

  .playhead-line:hover::before,
  .playhead-line.dragging::before,
  .playhead-line:hover::after,
  .playhead-line.dragging::after {
    transform: scale(1.2);
  }
</style>
