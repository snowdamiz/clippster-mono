<template>
  <div class="flex flex-col gap-2.5">
    <div class="tabular flex items-center justify-between text-2xs text-fg-muted">
      <span>{{ formatTime(startTime) }}</span>
      <span class="text-fg">
        <span class="text-fg-subtle">Selected</span> {{ formatDuration(selectedDuration) }}
      </span>
      <span>{{ formatTime(endTime) }}</span>
    </div>

    <!-- Range slider (padding keeps the handles inside the container) -->
    <div class="px-[7px] py-1">
      <div ref="sliderRef" class="relative">
        <div class="relative h-1.5 w-full rounded-full bg-surface-hover">
          <div
            class="absolute h-full rounded-full bg-brand"
            :style="{
              left: `${(startTime / totalDuration) * 100}%`,
              right: `${100 - (endTime / totalDuration) * 100}%`,
            }"
          ></div>
        </div>

        <div
          class="range-handle absolute z-10 size-3.5 cursor-grab rounded-full border-2 border-brand bg-fg shadow-[var(--shadow-sm)] active:cursor-grabbing"
          :style="{ left: `calc(${(startTime / totalDuration) * 100}% - 7px)`, top: '-4px' }"
          role="slider"
          aria-label="Range start"
          :aria-valuenow="startTime"
          @mousedown="startDragging($event, 'start')"
          @touchstart="startDragging($event, 'start')"
        ></div>

        <div
          class="range-handle absolute z-10 size-3.5 cursor-grab rounded-full border-2 border-brand bg-fg shadow-[var(--shadow-sm)] active:cursor-grabbing"
          :style="{ left: `calc(${(endTime / totalDuration) * 100}% - 7px)`, top: '-4px' }"
          role="slider"
          aria-label="Range end"
          :aria-valuenow="endTime"
          @mousedown="startDragging($event, 'end')"
          @touchstart="startDragging($event, 'end')"
        ></div>
      </div>
    </div>

    <p v-if="selectionError" class="text-xs text-danger">{{ selectionError }}</p>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';

  interface Props {
    totalDuration: number; // in seconds
    modelValue?: {
      startTime: number;
      endTime: number;
    };
  }

  interface Emits {
    (e: 'update:modelValue', value: { startTime: number; endTime: number }): void;
    (e: 'change', value: { startTime: number; endTime: number }): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    totalDuration: 0,
  });

  const emit = defineEmits<Emits>();

  // Range slider values
  const startRangeValue = ref(0);
  const endRangeValue = ref(0);

  // Computed values
  const startTime = computed(() => {
    return Math.min(parseInt(startRangeValue.value.toString()) || 0, props.totalDuration - 1);
  });

  const endTime = computed(() => {
    return Math.min(parseInt(endRangeValue.value.toString()) || 0, props.totalDuration);
  });

  const selectedDuration = computed(() => Math.max(0, endTime.value - startTime.value));

  const selectionError = computed(() => {
    if (startTime.value >= endTime.value) {
      return 'Start time must be before end time';
    }
    if (selectedDuration.value < 10) {
      return 'Selection too short (minimum 10 seconds)';
    }
    if (selectedDuration.value > props.totalDuration) {
      return 'Selection exceeds video duration';
    }
    return '';
  });

  // Helper functions
  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  }

  function formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}m ${s}s`;
    } else {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h}h ${m}m ${s}s`;
    }
  }

  const sliderRef = ref<HTMLElement>();
  const isDragging = ref(false);
  const dragType = ref<'start' | 'end' | null>(null);

  function startDragging(event: MouseEvent | TouchEvent, type: 'start' | 'end') {
    event.preventDefault();
    isDragging.value = true;
    dragType.value = type;

    const moveHandler = (e: MouseEvent | TouchEvent) => handleDrag(e);
    const endHandler = () => endDragging();

    if (event instanceof MouseEvent) {
      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', endHandler);
    } else {
      document.addEventListener('touchmove', moveHandler);
      document.addEventListener('touchend', endHandler);
    }
  }

  function handleDrag(event: MouseEvent | TouchEvent) {
    if (!isDragging.value || !sliderRef.value || !dragType.value) return;

    const rect = sliderRef.value.getBoundingClientRect();
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const value = Math.round(percentage * props.totalDuration);

    if (dragType.value === 'start') {
      // Ensure start doesn't go beyond end
      const newValue = Math.min(value, endRangeValue.value - 1);
      startRangeValue.value = Math.max(0, newValue);
    } else {
      // Ensure end doesn't go before start
      const newValue = Math.max(value, startRangeValue.value + 1);
      endRangeValue.value = Math.min(props.totalDuration, newValue);
    }

    emitChange();
  }

  function endDragging() {
    isDragging.value = false;
    dragType.value = null;

    // Remove event listeners
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', endDragging);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('touchend', endDragging);
  }

  function emitChange() {
    const start = startTime.value;
    const end = endTime.value;

    // Only emit if we have a valid time range
    if (start < end && end > 0) {
      emit('update:modelValue', { startTime: start, endTime: end });
      emit('change', { startTime: start, endTime: end });
    }
  }

  // Initialize with provided values or defaults
  function initializeTimeRange() {
    if (props.modelValue) {
      startRangeValue.value = props.modelValue.startTime;
      endRangeValue.value = props.modelValue.endTime;
    } else {
      // Default to full video
      startRangeValue.value = 0;
      endRangeValue.value = props.totalDuration;
    }
  }

  // Watch for prop changes
  watch(
    () => props.totalDuration,
    () => {
      initializeTimeRange();
    },
    { immediate: true }
  );

  watch(
    () => props.modelValue,
    (newValue) => {
      if (newValue) {
        startRangeValue.value = newValue.startTime;
        endRangeValue.value = newValue.endTime;
      }
    }
  );

  // Expose empty cleanup method to parent components for compatibility
  defineExpose({
    cleanup: async () => {},
  });
</script>

<style scoped>
  .range-handle {
    transition: transform 150ms ease;
  }

  .range-handle:hover {
    transform: scale(1.1);
  }

  .range-handle:active {
    transform: scale(1.2);
  }
</style>
