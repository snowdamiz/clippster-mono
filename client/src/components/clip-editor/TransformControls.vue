<template>
  <div class="transform-controls absolute inset-0 pointer-events-none">
    <!-- Selection Border -->
    <div class="absolute inset-0 border-2 border-violet-500 rounded-sm pointer-events-none"></div>

    <!-- Resize Handles -->
    <!-- Top Left -->
    <div
      class="absolute -left-1.5 -top-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-nw-resize pointer-events-auto z-10"
      @mousedown.stop.prevent="$emit('resizeStart', 'tl', $event)"
    ></div>
    <!-- Top Right -->
    <div
      class="absolute -right-1.5 -top-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-ne-resize pointer-events-auto z-10"
      @mousedown.stop.prevent="$emit('resizeStart', 'tr', $event)"
    ></div>
    <!-- Bottom Left -->
    <div
      class="absolute -left-1.5 -bottom-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-sw-resize pointer-events-auto z-10"
      @mousedown.stop.prevent="$emit('resizeStart', 'bl', $event)"
    ></div>
    <!-- Bottom Right -->
    <div
      class="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-white border border-violet-500 rounded-full cursor-se-resize pointer-events-auto z-10"
      @mousedown.stop.prevent="$emit('resizeStart', 'br', $event)"
    ></div>

    <!-- Rotation Handle (Top Center offset) -->
    <div
      class="absolute left-1/2 -top-8 w-0.5 h-6 bg-violet-500 -translate-x-1/2 pointer-events-none"
    ></div>
    <div
      class="absolute left-1/2 -top-8 w-5 h-5 bg-white border border-violet-500 rounded-full cursor-pointer pointer-events-auto z-10 flex items-center justify-center -translate-x-1/2 shadow-sm hover:scale-110 transition-transform"
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
// Handles are standardized:
// tl: Top Left
// tr: Top Right
// bl: Bottom Left
// br: Bottom Right

defineEmits<{
  (e: 'resizeStart', handle: 'tl' | 'tr' | 'bl' | 'br', event: MouseEvent): void;
  (e: 'rotateStart', event: MouseEvent): void;
}>();
</script>

<style scoped>
/* Ensure handles remain circular and visible regardless of parent transform if needed */
/* But here they are children of the transformed element, so they transform with it. 
   Usually desirable for rotation, but scale might distort them. 
   Ideally, we counter-scale handles, but for MVP let's assume item scale isn't extreme. */
</style>
