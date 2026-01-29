<template>
  <div class="livestream-seek-bar w-full" @click.stop>
    <!-- Timeline Container -->
    <div
      ref="timelineRef"
      class="relative h-2 bg-zinc-800 rounded-full cursor-pointer group"
      @mousedown.stop="handleMouseDown"
      @mouseenter="isHovering = true"
      @mouseleave="handleMouseLeave"
      @mousemove="handleMouseMove"
    >
      <!-- Buffered Ranges -->
      <div
        v-for="(range, index) in bufferedRanges"
        :key="index"
        class="absolute top-0 h-full bg-zinc-600 rounded-full"
        :style="{
          left: `${getPercentage(range.start)}%`,
          width: `${getPercentage(range.end) - getPercentage(range.start)}%`,
        }"
      />

      <!-- Progress (playback position) -->
      <div
        class="absolute top-0 h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-100"
        :style="{ width: `${progressPercentage}%` }"
      />

      <!-- Live Edge Indicator -->
      <div
        v-if="!isAtLiveEdge && duration > 0"
        class="absolute top-0 h-full flex items-center"
        :style="{ left: `${liveEdgePercentage}%` }"
      >
        <div class="relative w-1 h-full bg-red-500 rounded-full">
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </div>
      </div>

      <!-- Hover Preview -->
      <div
        v-if="isHovering && !isDragging"
        class="absolute top-0 h-full w-0.5 bg-white/50 pointer-events-none"
        :style="{ left: `${hoverPercentage}%` }"
      />

      <!-- Scrubber Handle -->
      <div
        class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-100"
        :class="[isDragging ? 'scale-125' : 'scale-0 group-hover:scale-100']"
        :style="{ left: `calc(${progressPercentage}% - 8px)` }"
      />

      <!-- Hover Time Tooltip -->
      <div
        v-if="isHovering || isDragging"
        class="absolute -top-8 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white whitespace-nowrap pointer-events-none transform -translate-x-1/2"
        :style="{ left: `${isDragging ? progressPercentage : hoverPercentage}%` }"
      >
        {{ formatTime(isDragging ? currentTime : hoverTime) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';

  interface BufferedRange {
    start: number;
    end: number;
  }

  interface Props {
    currentTime: number;
    duration: number;
    liveEdgeTime: number;
    bufferedRanges: BufferedRange[];
    isAtLiveEdge: boolean;
  }

  interface Emits {
    (e: 'seek', time: number): void;
    (e: 'seek-to-live'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  // Refs
  const timelineRef = ref<HTMLDivElement | null>(null);

  // UI State
  const isHovering = ref(false);
  const isDragging = ref(false);
  const hoverPercentage = ref(0);
  const dragPercentage = ref(0);

  // Computed
  const progressPercentage = computed(() => {
    if (props.duration <= 0) return 0;
    if (isDragging.value) {
      return Math.max(0, Math.min(100, dragPercentage.value));
    }
    return Math.max(0, Math.min(100, (props.currentTime / props.duration) * 100));
  });

  const liveEdgePercentage = computed(() => {
    if (props.duration <= 0) return 100;
    return Math.max(0, Math.min(100, (props.liveEdgeTime / props.duration) * 100));
  });

  const hoverTime = computed(() => {
    return (hoverPercentage.value / 100) * props.duration;
  });

  // Helper functions
  function getPercentage(time: number): number {
    if (props.duration <= 0) return 0;
    return Math.max(0, Math.min(100, (time / props.duration) * 100));
  }

  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getPercentageFromEvent(event: MouseEvent): number {
    if (!timelineRef.value) return 0;

    const rect = timelineRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    return Math.max(0, Math.min(100, percentage));
  }

  function getTimeFromPercentage(percentage: number): number {
    return (percentage / 100) * props.duration;
  }

  // Event handlers
  function handleMouseDown(event: MouseEvent) {
    if (props.duration <= 0) return;

    isDragging.value = true;
    dragPercentage.value = getPercentageFromEvent(event);

    // Add window event listeners for drag
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging.value) {
      hoverPercentage.value = getPercentageFromEvent(event);
    }
  }

  function handleMouseLeave() {
    if (!isDragging.value) {
      isHovering.value = false;
    }
  }

  function handleWindowMouseMove(event: MouseEvent) {
    if (!isDragging.value) return;
    dragPercentage.value = getPercentageFromEvent(event);
  }

  function handleWindowMouseUp(event: MouseEvent) {
    if (!isDragging.value) return;

    isDragging.value = false;

    // Emit seek event with final position
    const finalPercentage = getPercentageFromEvent(event);
    const seekTime = getTimeFromPercentage(finalPercentage);
    emit('seek', seekTime);

    // Remove window event listeners
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
  }

  // Cleanup
  onUnmounted(() => {
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
  });
</script>

<style scoped>
  .livestream-seek-bar {
    user-select: none;
  }
</style>
