<template>
  <div class="transform-controls absolute inset-0 pointer-events-none">
    <!-- Selection Border - scales with content (no counter-scale) -->
    <div 
      class="absolute inset-0 border-2 border-violet-500 rounded-sm pointer-events-none"
      :style="borderStyle"
    ></div>

    <!-- Resize Handles - counter-scaled to stay fixed size -->
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

    <!-- Rotation Handle (Top Center offset) - counter-scaled -->
    <div
      class="absolute left-1/2 bg-violet-500 pointer-events-none"
      :style="rotateLineStyle"
    ></div>
    <div
      class="absolute left-1/2 bg-white border-2 border-violet-500 rounded-full cursor-pointer pointer-events-auto z-50 flex items-center justify-center shadow-sm hover:brightness-95 transition-all"
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

const props = withDefaults(defineProps<{
  scale?: number;
}>(), {
  scale: 1,
});

const emit = defineEmits<{
  (e: 'resizeStart', handle: 'tl' | 'tr' | 'bl' | 'br', event: MouseEvent): void;
  (e: 'rotateStart', event: MouseEvent): void;
}>();

// Calculate inverse scale to counter the parent's scale transform
const inverseScale = computed(() => {
  const s = props.scale || 1;
  return s > 0 ? 1 / s : 1;
});

// Border style - keep border width consistent by counter-scaling it
const borderStyle = computed(() => ({
  borderWidth: `${2 * inverseScale.value}px`,
}));

// Handle size in pixels (fixed visual size regardless of item scale)
const handleSize = 10;

function handleStyle(position: 'tl' | 'tr' | 'bl' | 'br') {
  const scaledSize = handleSize * inverseScale.value;
  const offset = scaledSize / 2;
  
  const base: Record<string, string> = {
    width: `${scaledSize}px`,
    height: `${scaledSize}px`,
    borderWidth: `${2 * inverseScale.value}px`,
  };
  
  switch (position) {
    case 'tl':
      base.left = `-${offset}px`;
      base.top = `-${offset}px`;
      break;
    case 'tr':
      base.right = `-${offset}px`;
      base.top = `-${offset}px`;
      break;
    case 'bl':
      base.left = `-${offset}px`;
      base.bottom = `-${offset}px`;
      break;
    case 'br':
      base.right = `-${offset}px`;
      base.bottom = `-${offset}px`;
      break;
  }
  
  return base;
}

// Rotation handle styles - counter-scaled
const rotateLineStyle = computed(() => {
  const lineHeight = 24 * inverseScale.value;
  const lineWidth = 2 * inverseScale.value;
  return {
    width: `${lineWidth}px`,
    height: `${lineHeight}px`,
    top: `-${lineHeight + 4 * inverseScale.value}px`,
    transform: 'translateX(-50%)',
  };
});

const rotateHandleStyle = computed(() => {
  const size = 20 * inverseScale.value;
  const lineHeight = 24 * inverseScale.value;
  return {
    width: `${size}px`,
    height: `${size}px`,
    top: `-${lineHeight + size / 2 + 8 * inverseScale.value}px`,
    transform: 'translateX(-50%)',
    borderWidth: `${2 * inverseScale.value}px`,
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
</style>
