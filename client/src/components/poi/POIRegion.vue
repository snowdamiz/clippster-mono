<template>
  <!-- Shared with apps/web: plain scoped CSS on tokens (no Tailwind/ui primitives). Region color is user data. -->
  <div
    ref="regionRef"
    class="poi-region"
    :class="{ 'is-selected': isSelected }"
    :style="regionStyle"
    @mousedown.stop="onDragStart"
  >
    <!-- Region border with dashed style — only visible when selected or hovered -->
    <div
      class="poi-region__outline poi-region__reveal"
      :style="{ borderColor: color, borderRadius: cornerRadiusPx ? `${cornerRadiusPx}px` : undefined }"
    />

    <!-- Label badge — visible on hover or when selected -->
    <div
      v-if="label"
      class="poi-region__label poi-region__reveal"
      :style="{ backgroundColor: color, color: getContrastColor(color) }"
    >
      {{ label }}
    </div>

    <!-- Delete button (center, shows on hover) -->
    <button
      v-if="showControls"
      type="button"
      class="poi-region__delete"
      title="Remove region"
      aria-label="Remove region"
      @mousedown.stop
      @click.stop="$emit('delete')"
    >
      <XIcon :size="13" />
    </button>

    <!-- Resize handles — only visible on hover or when selected -->
    <template v-if="resizable && showResizeHandles">
      <div
        class="resize-handle poi-region__handle poi-region__handle--corner poi-region__handle--nw"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'nw')"
      />
      <div
        class="resize-handle poi-region__handle poi-region__handle--corner poi-region__handle--ne"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'ne')"
      />
      <div
        class="resize-handle poi-region__handle poi-region__handle--corner poi-region__handle--sw"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'sw')"
      />
      <div
        class="resize-handle poi-region__handle poi-region__handle--corner poi-region__handle--se"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'se')"
      />
      <div
        class="resize-handle poi-region__handle poi-region__handle--edge poi-region__handle--n"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'n')"
      />
      <div
        class="resize-handle poi-region__handle poi-region__handle--edge poi-region__handle--s"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 's')"
      />
      <div
        class="resize-handle poi-region__handle poi-region__handle--edge poi-region__handle--w"
        :style="{ backgroundColor: color }"
        @mousedown.stop="onResizeStart($event, 'w')"
      />
      <div
        class="resize-handle poi-region__handle poi-region__handle--edge poi-region__handle--e"
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
    aspectRatioLocked?: boolean; // Lock aspect ratio during resize (default true)
    snapToCenter?: boolean; // Enable snap-to-center behavior
    snapThreshold?: number; // Snap threshold in pixels
    cornerRadiusPx?: number; // Rounded corners preview (in px, scaled to container)
  }

  const props = withDefaults(defineProps<Props>(), {
    isSelected: false,
    resizable: true,
    draggable: true,
    showControls: true,
    showResizeHandles: true,
    minWidth: 0.05,
    minHeight: 0.05,
    aspectRatioLocked: true,
    snapToCenter: true,
    snapThreshold: 8,
    cornerRadiusPx: 0,
  });

  const emit = defineEmits<{
    update: [rect: ManualRegionRect];
    delete: [];
    select: [];
    dragStart: [];
    dragEnd: [];
    centerGuide: [{ vertical: boolean; horizontal: boolean }];
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

  // Handle dragging with snap-to-center
  function onDrag(event: MouseEvent) {
    if (!isDragging.value) return;

    const deltaX = (event.clientX - startMouseX.value) / props.containerWidth;
    const deltaY = (event.clientY - startMouseY.value) / props.containerHeight;

    // Calculate new position, clamped to container bounds
    let newX = clamp(startRect.value.x + deltaX, 0, 1 - props.rect.width);
    let newY = clamp(startRect.value.y + deltaY, 0, 1 - props.rect.height);

    // Center values (where element would be perfectly centered)
    const centerX = (1 - props.rect.width) / 2;
    const centerY = (1 - props.rect.height) / 2;
    
    // Convert snap threshold from pixels to percentage
    const snapThresholdX = props.snapThreshold / props.containerWidth;
    const snapThresholdY = props.snapThreshold / props.containerHeight;
    
    // Check proximity to center
    const nearVerticalCenter = props.snapToCenter && Math.abs(newX - centerX) < snapThresholdX;
    const nearHorizontalCenter = props.snapToCenter && Math.abs(newY - centerY) < snapThresholdY;
    
    // Snap to center if close
    if (nearVerticalCenter) newX = centerX;
    if (nearHorizontalCenter) newY = centerY;
    
    // Emit center guide visibility
    emit('centerGuide', { vertical: nearVerticalCenter, horizontal: nearHorizontalCenter });

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
    emit('centerGuide', { vertical: false, horizontal: false });
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

    if (props.aspectRatioLocked) {
      // Aspect ratio locked - maintain proportions
      const aspectRatio = startRect.value.width / startRect.value.height;

      // For corner handles, use the dominant direction (larger delta)
      if (dir.includes('e') || dir.includes('w')) {
        // Horizontal resize - adjust height to maintain aspect ratio
        if (dir.includes('w')) {
          const maxDeltaX = startRect.value.width - props.minWidth;
          const clampedDeltaX = clamp(deltaX, -startRect.value.x, maxDeltaX);
          newRect.x = startRect.value.x + clampedDeltaX;
          newRect.width = startRect.value.width - clampedDeltaX;
        } else {
          const maxWidth = 1 - startRect.value.x;
          newRect.width = clamp(startRect.value.width + deltaX, props.minWidth, maxWidth);
        }
        
        // Adjust height to maintain aspect ratio
        const newHeight = newRect.width / aspectRatio;
        
        // For north corners, adjust y position
        if (dir.includes('n')) {
          const heightDelta = newHeight - startRect.value.height;
          newRect.y = clamp(startRect.value.y - heightDelta, 0, 1 - newHeight);
        }
        
        newRect.height = clamp(newHeight, props.minHeight, 1 - newRect.y);
      } else {
        // Vertical resize - adjust width to maintain aspect ratio
        if (dir.includes('n')) {
          const maxDeltaY = startRect.value.height - props.minHeight;
          const clampedDeltaY = clamp(deltaY, -startRect.value.y, maxDeltaY);
          newRect.y = startRect.value.y + clampedDeltaY;
          newRect.height = startRect.value.height - clampedDeltaY;
        } else {
          const maxHeight = 1 - startRect.value.y;
          newRect.height = clamp(startRect.value.height + deltaY, props.minHeight, maxHeight);
        }
        
        // Adjust width to maintain aspect ratio
        const newWidth = newRect.height * aspectRatio;
        
        // For west handles, adjust x position
        if (dir.includes('w')) {
          const widthDelta = newWidth - startRect.value.width;
          newRect.x = clamp(startRect.value.x - widthDelta, 0, 1 - newWidth);
        }
        
        newRect.width = clamp(newWidth, props.minWidth, 1 - newRect.x);
      }
    } else {
      // Aspect ratio unlocked - free resize
      // Handle horizontal resize (west/left side)
      if (dir.includes('w')) {
        const maxDeltaX = startRect.value.width - props.minWidth;
        const clampedDeltaX = clamp(deltaX, -startRect.value.x, maxDeltaX);
        newRect.x = startRect.value.x + clampedDeltaX;
        newRect.width = startRect.value.width - clampedDeltaX;
      }
      // Handle horizontal resize (east/right side)
      if (dir.includes('e')) {
        const maxWidth = 1 - startRect.value.x;
        newRect.width = clamp(startRect.value.width + deltaX, props.minWidth, maxWidth);
      }

      // Handle vertical resize (north/top side)
      if (dir.includes('n')) {
        const maxDeltaY = startRect.value.height - props.minHeight;
        const clampedDeltaY = clamp(deltaY, -startRect.value.y, maxDeltaY);
        newRect.y = startRect.value.y + clampedDeltaY;
        newRect.height = startRect.value.height - clampedDeltaY;
      }
      // Handle vertical resize (south/bottom side)
      if (dir.includes('s')) {
        const maxHeight = 1 - startRect.value.y;
        newRect.height = clamp(startRect.value.height + deltaY, props.minHeight, maxHeight);
      }
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
    position: absolute;
    z-index: 10;
    cursor: move;
    user-select: none;
  }

  /* Tab-selected region must win hit-testing over overlapping siblings */
  .poi-region.is-selected {
    z-index: 25;
  }

  .poi-region:not(.is-selected):hover {
    z-index: 20;
  }

  .poi-region.is-selected:hover {
    z-index: 30;
  }

  /* Chrome that appears on hover, and stays while selected */
  .poi-region__reveal,
  .poi-region__handle {
    opacity: 0;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .poi-region:hover .poi-region__reveal,
  .poi-region.is-selected .poi-region__reveal {
    opacity: 1;
  }

  .poi-region__outline {
    position: absolute;
    inset: 0;
    border: 1px dashed;
    border-radius: 4px;
  }

  .poi-region.is-selected .poi-region__outline {
    border-style: solid;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
  }

  .poi-region__label {
    position: absolute;
    top: -20px;
    left: 4px;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: var(--text-2xs);
    font-weight: 500;
    line-height: var(--text-2xs--line-height);
    white-space: nowrap;
  }

  .poi-region__delete {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 10;
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--surface-raised);
    color: var(--fg-muted);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
    transition:
      opacity 0.15s ease,
      transform 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .poi-region:hover .poi-region__delete {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  .poi-region__delete:hover {
    background: var(--danger-solid);
    color: #fff;
  }

  /* Resize handles (filled with the region color, outlined for contrast) */
  .poi-region__handle {
    position: absolute;
    border: 1px solid rgba(0, 0, 0, 0.45);
    border-radius: 999px;
  }

  .poi-region:hover .poi-region__handle {
    opacity: 0.85;
  }

  .poi-region.is-selected .poi-region__handle {
    opacity: 1;
  }

  .poi-region__handle:hover {
    opacity: 1;
    transform: scale(1.3);
  }

  .poi-region__handle--corner {
    width: 10px;
    height: 10px;
  }

  .poi-region__handle--nw {
    top: -5px;
    left: -5px;
    cursor: nw-resize;
  }

  .poi-region__handle--ne {
    top: -5px;
    right: -5px;
    cursor: ne-resize;
  }

  .poi-region__handle--sw {
    bottom: -5px;
    left: -5px;
    cursor: sw-resize;
  }

  .poi-region__handle--se {
    bottom: -5px;
    right: -5px;
    cursor: se-resize;
  }

  .poi-region__handle--edge.poi-region__handle--n,
  .poi-region__handle--edge.poi-region__handle--s {
    left: calc(50% - 8px);
    width: 16px;
    height: 6px;
  }

  .poi-region__handle--edge.poi-region__handle--w,
  .poi-region__handle--edge.poi-region__handle--e {
    top: calc(50% - 8px);
    width: 6px;
    height: 16px;
  }

  .poi-region__handle--n {
    top: -3px;
    cursor: n-resize;
  }

  .poi-region__handle--s {
    bottom: -3px;
    cursor: s-resize;
  }

  .poi-region__handle--w {
    left: -3px;
    cursor: w-resize;
  }

  .poi-region__handle--e {
    right: -3px;
    cursor: e-resize;
  }
</style>
