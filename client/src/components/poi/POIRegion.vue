<template>
  <div
    ref="regionRef"
    class="poi-region absolute cursor-move select-none group"
    :style="regionStyle"
    @mousedown.stop="onDragStart"
  >
    <!-- Region border with dashed style -->
    <div
      class="absolute inset-0 border border-dashed rounded transition-colors"
      :style="{ borderColor: color }"
      :class="{ 'ring-1 ring-white/30': isSelected }"
    />

    <!-- Label badge -->
    <div
      v-if="label"
      class="absolute -top-5 left-1 px-1.5 py-0.5 text-[10px] font-medium rounded whitespace-nowrap"
      :style="{ backgroundColor: color, color: getContrastColor(color) }"
    >
      {{ label }}
    </div>

    <!-- Delete button (center, shows on hover) -->
    <button
      v-if="showControls"
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-600 flex items-center justify-center text-white shadow-lg z-10 transition-all opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
      @mousedown.stop
      @click.stop="$emit('delete')"
      title="Remove region"
    >
      <XIcon class="w-3.5 h-3.5" />
    </button>

    <!-- Resize handles -->
    <template v-if="resizable && showResizeHandles">
      <!-- Corner handles -->
      <div
        class="resize-handle absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full cursor-nw-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'nw')"
      />
      <div
        class="resize-handle absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full cursor-ne-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'ne')"
      />
      <div
        class="resize-handle absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full cursor-sw-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'sw')"
      />
      <div
        class="resize-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full cursor-se-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'se')"
      />

      <!-- Edge handles -->
      <div
        class="resize-handle absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-1.5 rounded-full cursor-n-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'n')"
      />
      <div
        class="resize-handle absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-1.5 rounded-full cursor-s-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 's')"
      />
      <div
        class="resize-handle absolute top-1/2 -left-0.5 -translate-y-1/2 w-1.5 h-4 rounded-full cursor-w-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'w')"
      />
      <div
        class="resize-handle absolute top-1/2 -right-0.5 -translate-y-1/2 w-1.5 h-4 rounded-full cursor-e-resize"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'e')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onUnmounted } from 'vue';
  import { XIcon } from 'lucide-vue-next';
  import type { ManualRegionRect } from '@/types';

  interface Props {
    rect: ManualRegionRect;
    color: string;
    label?: string;
    isSelected?: boolean;
    resizable?: boolean;
    draggable?: boolean;
    showControls?: boolean; // Show delete button
    showResizeHandles?: boolean; // Show resize handles (defaults to true when resizable)
    minWidth?: number; // Minimum width as percentage (0-1)
    minHeight?: number; // Minimum height as percentage (0-1)
    containerWidth: number; // Container width in pixels
    containerHeight: number; // Container height in pixels
  }

  const props = withDefaults(defineProps<Props>(), {
    isSelected: false,
    resizable: true,
    draggable: true,
    showControls: true,
    showResizeHandles: true,
    minWidth: 0.05,
    minHeight: 0.05,
  });

  const emit = defineEmits<{
    update: [rect: ManualRegionRect];
    delete: [];
    select: [];
    dragStart: [];
    dragEnd: [];
  }>();

  const regionRef = ref<HTMLElement | null>(null);

  // Track drag state
  const isDragging = ref(false);
  const isResizing = ref(false);
  const resizeDirection = ref<string | null>(null);
  const startMouseX = ref(0);
  const startMouseY = ref(0);
  const startRect = ref<ManualRegionRect>({ x: 0, y: 0, width: 0, height: 0 });

  // Computed style for the region
  const regionStyle = computed(() => ({
    left: `${props.rect.x * 100}%`,
    top: `${props.rect.y * 100}%`,
    width: `${props.rect.width * 100}%`,
    height: `${props.rect.height * 100}%`,
  }));

  // Get contrasting text color for the label
  function getContrastColor(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // Clamp value between min and max
  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // Handle drag start
  function onDragStart(event: MouseEvent) {
    if (!props.draggable) return;

    emit('select');
    emit('dragStart');

    isDragging.value = true;
    startMouseX.value = event.clientX;
    startMouseY.value = event.clientY;
    startRect.value = { ...props.rect };

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
  }

  // Handle dragging
  function onDrag(event: MouseEvent) {
    if (!isDragging.value) return;

    const deltaX = (event.clientX - startMouseX.value) / props.containerWidth;
    const deltaY = (event.clientY - startMouseY.value) / props.containerHeight;

    // Calculate new position, clamped to container bounds
    const newX = clamp(startRect.value.x + deltaX, 0, 1 - props.rect.width);
    const newY = clamp(startRect.value.y + deltaY, 0, 1 - props.rect.height);

    emit('update', {
      ...props.rect,
      x: newX,
      y: newY,
    });
  }

  // Handle drag end
  function onDragEnd() {
    isDragging.value = false;
    emit('dragEnd');
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // Handle resize start
  function onResizeStart(event: MouseEvent, direction: string) {
    if (!props.resizable) return;

    emit('select');
    emit('dragStart');

    isResizing.value = true;
    resizeDirection.value = direction;
    startMouseX.value = event.clientX;
    startMouseY.value = event.clientY;
    startRect.value = { ...props.rect };

    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', onResizeEnd);
  }

  // Handle resizing
  function onResize(event: MouseEvent) {
    if (!isResizing.value || !resizeDirection.value) return;

    const deltaX = (event.clientX - startMouseX.value) / props.containerWidth;
    const deltaY = (event.clientY - startMouseY.value) / props.containerHeight;

    let newRect = { ...startRect.value };
    const dir = resizeDirection.value;

    // Handle horizontal resize
    if (dir.includes('w')) {
      const maxDeltaX = startRect.value.width - props.minWidth;
      const clampedDeltaX = clamp(deltaX, -startRect.value.x, maxDeltaX);
      newRect.x = startRect.value.x + clampedDeltaX;
      newRect.width = startRect.value.width - clampedDeltaX;
    }
    if (dir.includes('e')) {
      const maxWidth = 1 - startRect.value.x;
      newRect.width = clamp(startRect.value.width + deltaX, props.minWidth, maxWidth);
    }

    // Handle vertical resize
    if (dir.includes('n')) {
      const maxDeltaY = startRect.value.height - props.minHeight;
      const clampedDeltaY = clamp(deltaY, -startRect.value.y, maxDeltaY);
      newRect.y = startRect.value.y + clampedDeltaY;
      newRect.height = startRect.value.height - clampedDeltaY;
    }
    if (dir.includes('s')) {
      const maxHeight = 1 - startRect.value.y;
      newRect.height = clamp(startRect.value.height + deltaY, props.minHeight, maxHeight);
    }

    emit('update', newRect);
  }

  // Handle resize end
  function onResizeEnd() {
    isResizing.value = false;
    resizeDirection.value = null;
    emit('dragEnd');
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  // Cleanup event listeners on unmount
  onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', onResizeEnd);
  });
</script>

<style scoped>
  .poi-region {
    z-index: 10;
  }

  .poi-region:hover {
    z-index: 20;
  }

  .resize-handle {
    opacity: 0.7;
    transition:
      opacity 0.15s,
      transform 0.15s;
  }

  .resize-handle:hover {
    opacity: 1;
    transform: scale(1.3);
  }
</style>
