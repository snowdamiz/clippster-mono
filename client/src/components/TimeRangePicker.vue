<template>
  <div class="space-y-4">
    <!-- Time Range Slider -->
    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{{ formatTime(startTime) }}</span>
        <span>Duration: {{ formatDuration(selectedDuration) }}</span>
        <span>{{ formatTime(endTime) }}</span>
      </div>
      <div ref="sliderRef" class="relative">
        <!-- Background track -->
        <div class="w-full h-2 bg-muted rounded-full relative">
          <!-- Selected range -->
          <div
            class="absolute h-full bg-purple-500 rounded-full"
            :style="{
              left: `${(startTime / totalDuration) * 100}%`,
              right: `${100 - (endTime / totalDuration) * 100}%`,
            }"
          ></div>
        </div>

        <!-- Draggable handles -->
        <div
          class="absolute w-4 h-4 bg-purple-600 rounded-full border-2 border-white shadow-lg cursor-grab active:cursor-grabbing z-40"
          :style="{
            left: `calc(${(startTime / totalDuration) * 100}% - 8px)`,
            top: '-4px',
          }"
          @mousedown="startDragging($event, 'start')"
          @touchstart="startDragging($event, 'start')"
        ></div>

        <div
          class="absolute w-4 h-4 bg-purple-600 rounded-full border-2 border-white shadow-lg cursor-grab active:cursor-grabbing z-40"
          :style="{
            left: `calc(${(endTime / totalDuration) * 100}% - 8px)`,
            top: '-4px',
          }"
          @mousedown="startDragging($event, 'end')"
          @touchstart="startDragging($event, 'end')"
        ></div>
      </div>
    </div>

    <!-- Selection Info -->
    <div class="bg-muted/50 rounded-lg p-3 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">Selected Duration:</span>
        <span class="font-medium text-foreground">{{ formatDuration(selectedDuration) }}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">Estimated Size:</span>
        <span class="font-medium text-foreground">{{ estimatedSize }}</span>
      </div>
      <div v-if="selectionError" class="text-xs text-red-400">
        {{ selectionError }}
      </div>
    </div>

    <!-- Thumbnail Tooltip -->
    <ThumbnailTooltip
      :show="showTooltip"
      :position="tooltipPosition"
      :thumbnail-url="thumbnailUrl"
      :time="tooltipTime"
      :loading="isLoading"
      :has-error="hasError"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { useVideoThumbnail } from '@/composables/useVideoThumbnail';
  import ThumbnailTooltip from '@/components/ThumbnailTooltip.vue';

  interface Props {
    totalDuration: number; // in seconds
    modelValue?: {
      startTime: number;
      endTime: number;
    };
    videoUrl?: string; // Video URL for thumbnail generation
    videoDuration?: number; // Actual video duration for pre-fetching strategy
  }

  interface Emits {
    (e: 'update:modelValue', value: { startTime: number; endTime: number }): void;
    (e: 'change', value: { startTime: number; endTime: number }): void;
  }

  const props = withDefaults(defineProps<Props>(), {
    totalDuration: 0,
    modelValue: () => ({ startTime: 0, endTime: 0 }),
    videoUrl: '',
    videoDuration: 0,
  });

  const emit = defineEmits<Emits>();

  // Initialize video thumbnail
  const {
    showTooltipAtTime,
    hideTooltip,
    updatePosition,
    tooltipPosition,
    thumbnailUrl,
    tooltipTime,
    showTooltip,
    isLoading,
    hasError,
    formatTime: formatTooltipTime,
    smartPreFetch,
    cleanup,
  } = useVideoThumbnail();

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

  const estimatedSize = computed(() => {
    // Rough estimate: 1MB per minute of video
    const sizeMB = (selectedDuration.value / 60) * 1;
    if (sizeMB < 1024) {
      return `~${sizeMB.toFixed(1)} MB`;
    } else {
      return `~${(sizeMB / 1024).toFixed(1)} GB`;
    }
  });

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

    let currentTime = 0;
    if (dragType.value === 'start') {
      // Ensure start doesn't go beyond end
      const newValue = Math.min(value, endRangeValue.value - 1);
      startRangeValue.value = Math.max(0, newValue);
      currentTime = startTime.value;
    } else {
      // Ensure end doesn't go before start
      const newValue = Math.max(value, startRangeValue.value + 1);
      endRangeValue.value = Math.min(props.totalDuration, newValue);
      currentTime = endTime.value;
    }

    // Update thumbnail tooltip position and content
    if (props.videoUrl) {
      const tooltipY = rect.top - 20; // Position above the slider
      showTooltipAtTime(props.videoUrl, clientX, tooltipY, currentTime);
    }

    emitChange();
  }

  function endDragging() {
    isDragging.value = false;
    dragType.value = null;

    // Hide thumbnail tooltip
    hideTooltip();

    // Remove event listeners
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', endDragging);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('touchend', endDragging);
  }

  function emitChange() {
    const start = startTime.value;
    const end = endTime.value;

    emit('update:modelValue', { startTime: start, endTime: end });
    emit('change', { startTime: start, endTime: end });
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

  // Trigger smart pre-fetching when video URL and duration are available
  watch(
    [() => props.videoUrl, () => props.videoDuration],
    async ([videoUrl, videoDuration]) => {
      if (videoUrl && videoDuration && videoDuration > 0) {
        smartPreFetch(videoUrl, videoDuration);
      }
    },
    { immediate: true }
  );

  // Expose cleanup method to parent components
  defineExpose({
    cleanup,
  });
</script>

<style scoped>
  /* Handle hover and active states */
  .w-4:hover {
    transform: scale(1.1);
  }

  .w-4:active {
    transform: scale(1.2);
  }
</style>
