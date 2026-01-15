<template>
  <!-- Selection box fills parent bounds exactly - no container-level transforms -->
  <div class="transform-controls absolute inset-0 pointer-events-none">
    <!-- Selection Border - using outline for precise edge alignment -->
    <div class="absolute inset-0 pointer-events-none" :style="borderStyle"></div>

    <!-- Resize Handles - use transform for consistent visual size -->
    <!-- Top Left -->
    <div
      class="handle absolute bg-white border-2 border-violet-500 rounded-full cursor-nw-resize pointer-events-auto z-50"
      :style="handleStyle('tl')"
      @mousedown.stop.prevent="onResizeStart('tl', $event)"
    ></div>
    <!-- Top Right -->
    <div
      class="handle absolute bg-white border-2 border-violet-500 rounded-full cursor-ne-resize pointer-events-auto z-50"
      :style="handleStyle('tr')"
      @mousedown.stop.prevent="onResizeStart('tr', $event)"
    ></div>
    <!-- Bottom Left -->
    <div
      class="handle absolute bg-white border-2 border-violet-500 rounded-full cursor-sw-resize pointer-events-auto z-50"
      :style="handleStyle('bl')"
      @mousedown.stop.prevent="onResizeStart('bl', $event)"
    ></div>
    <!-- Bottom Right -->
    <div
      class="handle absolute bg-white border-2 border-violet-500 rounded-full cursor-se-resize pointer-events-auto z-50"
      :style="handleStyle('br')"
      @mousedown.stop.prevent="onResizeStart('br', $event)"
    ></div>

    <!-- Rotation Handle (Top Center offset) -->
    <div class="absolute left-1/2 bg-violet-500 pointer-events-none" :style="rotateLineStyle"></div>
    <div
      class="rotate-handle absolute left-1/2 bg-white border-2 border-violet-500 rounded-full cursor-pointer pointer-events-auto z-50 flex items-center justify-center shadow-sm hover:brightness-95 transition-all"
      :style="rotateHandleStyle"
      @mousedown.stop.prevent="$emit('rotateStart', $event)"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-violet-600"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  const props = withDefaults(
    defineProps<{
      scale?: number;
    }>(),
    {
      scale: 1,
    }
  );

  const emit = defineEmits<{
    (e: 'resizeStart', handle: 'tl' | 'tr' | 'bl' | 'br', event: MouseEvent): void;
    (e: 'rotateStart', event: MouseEvent): void;
  }>();

  // Calculate inverse scale to counter the parent's scale transform
  // This keeps UI elements at a consistent visual size
  const inverseScale = computed(() => {
    const s = props.scale || 1;
    return s > 0 ? 1 / s : 1;
  });

  // Border style using inset box-shadow for precise alignment
  // Box-shadow doesn't affect layout and renders inside the element bounds
  const borderStyle = computed(() => {
    const width = 2 * inverseScale.value;
    return {
      boxShadow: `inset 0 0 0 ${width}px #8b5cf6`,
    };
  });

  // Handle size in pixels (fixed DOM size, visually consistent after transforms)
  const handleSize = 10;
  const handleOffset = handleSize / 2;

  // Calculate handle styles with transform-based scaling
  // Handles use CSS transform to counter-scale, which composes with parent's scale
  function handleStyle(position: 'tl' | 'tr' | 'bl' | 'br') {
    const base: Record<string, string> = {
      width: `${handleSize}px`,
      height: `${handleSize}px`,
      // Counter-scale to maintain consistent visual size
      // Parent has scale(s), handle has scale(1/s), net visual scale = 1
      transform: `scale(${inverseScale.value})`,
      transformOrigin: 'center',
    };

    // Position handles so their center is at the corner
    // Offset by half the DOM size (positioning happens before transform)
    switch (position) {
      case 'tl':
        base.left = `${-handleOffset}px`;
        base.top = `${-handleOffset}px`;
        break;
      case 'tr':
        base.right = `${-handleOffset}px`;
        base.top = `${-handleOffset}px`;
        break;
      case 'bl':
        base.left = `${-handleOffset}px`;
        base.bottom = `${-handleOffset}px`;
        break;
      case 'br':
        base.right = `${-handleOffset}px`;
        base.bottom = `${-handleOffset}px`;
        break;
    }

    return base;
  }

  // Rotation line style - scale dimensions for consistent visual size
  // The line has no border/stroke classes, so we use scaled dimensions
  const rotateLineStyle = computed(() => {
    const inv = inverseScale.value;
    return {
      width: `${2 * inv}px`,
      height: `${24 * inv}px`,
      top: `${-28 * inv}px`,
      transform: 'translateX(-50%)',
    };
  });

  // Rotation handle style - use transform to scale (including border from class)
  // Position with scaled offset so visual position is consistent
  const rotateHandleStyle = computed(() => {
    const inv = inverseScale.value;
    // Base size and offset (before scaling)
    const baseSize = 20;
    const baseOffset = 48;

    return {
      width: `${baseSize}px`,
      height: `${baseSize}px`,
      // Position with scaled offset, then transform scales the handle
      top: `${-baseOffset * inv}px`,
      transform: `translateX(-50%) scale(${inv})`,
      transformOrigin: 'top center',
    };
  });

  function onResizeStart(handle: 'tl' | 'tr' | 'bl' | 'br', event: MouseEvent) {
    emit('resizeStart', handle, event);
  }
</script>

<style scoped>
  .handle {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .rotate-handle {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
</style>
