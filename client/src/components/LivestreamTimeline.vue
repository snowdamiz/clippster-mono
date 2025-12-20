<template>
  <div class="livestream-timeline">
    <!-- Timeline Track -->
    <div
      ref="trackRef"
      class="relative h-2 bg-zinc-700/50 rounded-full cursor-pointer group"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    >
      <!-- Recorded/Available Progress -->
      <div
        class="absolute h-full bg-zinc-600 rounded-full transition-all"
        :style="{ width: `${recordedPercent}%` }"
      />

      <!-- Playback Progress -->
      <div
        class="absolute h-full bg-gradient-to-r from-violet-600 to-purple-600 rounded-full transition-all"
        :style="{ width: `${playbackPercent}%` }"
      />

      <!-- Segment Markers (subtle indicators for segment boundaries) -->
      <div
        v-for="segment in segments"
        :key="segment.segmentNumber"
        class="absolute top-0 h-full w-px bg-zinc-500/30"
        :style="{ left: `${getSegmentPosition(segment.endTime)}%` }"
      />

      <!-- Playback Position Handle -->
      <div
        class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform"
        :style="{ left: `${playbackPercent}%` }"
      >
        <div
          :class="[
            'w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg transition-transform',
            isDragging || isHovering ? 'scale-125 bg-violet-500' : 'scale-100 bg-white',
          ]"
        />
      </div>

      <!-- Live Edge Indicator (pulsing red dot) -->
      <div
        v-if="isAtLiveEdge"
        class="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 pointer-events-none"
      >
        <div class="relative">
          <div class="w-3 h-3 bg-red-500 rounded-full" />
          <div class="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
        </div>
      </div>

      <!-- Hover Preview Tooltip -->
      <div
        v-if="hoverPosition !== null && isHovering"
        class="absolute -top-10 transform -translate-x-1/2 pointer-events-none"
        :style="{ left: `${hoverPositionPercent}%` }"
      >
        <div class="bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-zinc-700">
          {{ formatTime(hoverPosition) }}
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-zinc-900 border-b border-r border-zinc-700 rotate-45" />
      </div>

      <!-- Hover Line -->
      <div
        v-if="hoverPosition !== null && isHovering"
        class="absolute top-0 h-full w-0.5 bg-white/50 pointer-events-none"
        :style="{ left: `${hoverPositionPercent}%` }"
      />
    </div>

    <!-- Time Labels and Controls Row -->
    <div class="flex items-center justify-between mt-2 text-xs">
      <!-- Current Time -->
      <div class="text-white font-mono min-w-[60px]">
        {{ formatTime(playbackPosition) }}
      </div>

      <!-- Center: Behind Live / Go Live Button -->
      <div class="flex items-center gap-2">
        <button
          v-if="!isAtLiveEdge"
          @click="$emit('go-live')"
          class="flex items-center gap-1.5 px-3 py-1 bg-red-600/90 hover:bg-red-500 text-white text-xs font-medium rounded-full transition-colors"
        >
          <div class="relative w-2 h-2">
            <div class="absolute inset-0 bg-white rounded-full" />
            <div class="absolute inset-0 bg-white rounded-full animate-ping opacity-75" />
          </div>
          <span>LIVE</span>
        </button>
        <span v-if="!isAtLiveEdge" class="text-zinc-400 text-xs">
          {{ behindLiveFormatted }}
        </span>
        <span v-else class="text-red-400 font-medium flex items-center gap-1">
          <div class="relative w-2 h-2">
            <div class="absolute inset-0 bg-red-500 rounded-full" />
            <div class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
          </div>
          LIVE
        </span>
      </div>

      <!-- Total Duration -->
      <div class="text-zinc-400 font-mono min-w-[60px] text-right">
        {{ formatTime(liveEdgeTime) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { SegmentInfo } from '@/composables/useLivestreamViewer';

interface Props {
  playbackPosition: number;
  liveEdgeTime: number;
  totalRecordedDuration: number;
  isAtLiveEdge: boolean;
  availableSegments: SegmentInfo[];
}

interface Emits {
  (e: 'seek', position: number): void;
  (e: 'go-live'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Refs
const trackRef = ref<HTMLDivElement | null>(null);
const isDragging = ref(false);
const isHovering = ref(false);
const hoverPosition = ref<number | null>(null);

// Computed
const segments = computed(() => props.availableSegments);

const playbackPercent = computed(() => {
  if (props.liveEdgeTime <= 0) return 0;
  return Math.min(100, (props.playbackPosition / props.liveEdgeTime) * 100);
});

const recordedPercent = computed(() => {
  if (props.liveEdgeTime <= 0) return 0;
  return Math.min(100, (props.totalRecordedDuration / props.liveEdgeTime) * 100);
});

const hoverPositionPercent = computed(() => {
  if (hoverPosition.value === null || props.liveEdgeTime <= 0) return 0;
  return Math.min(100, (hoverPosition.value / props.liveEdgeTime) * 100);
});

const behindLiveFormatted = computed(() => {
  const seconds = props.liveEdgeTime - props.playbackPosition;
  if (seconds < 60) return `${Math.floor(seconds)}s behind`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (minutes < 60) return `${minutes}m ${secs}s behind`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m behind`;
});

// Helper functions
function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSegmentPosition(endTime: number): number {
  if (props.liveEdgeTime <= 0) return 0;
  return Math.min(100, (endTime / props.liveEdgeTime) * 100);
}

function getPositionFromEvent(event: MouseEvent): number {
  if (!trackRef.value) return 0;
  
  const rect = trackRef.value.getBoundingClientRect();
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  const percent = x / rect.width;
  return percent * props.liveEdgeTime;
}

// Event handlers
function handleMouseDown(event: MouseEvent) {
  event.preventDefault();
  isDragging.value = true;
  
  const position = getPositionFromEvent(event);
  emit('seek', position);
  
  // Add global mouse event listeners for dragging
  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup', handleGlobalMouseUp);
}

function handleMouseMove(event: MouseEvent) {
  isHovering.value = true;
  hoverPosition.value = getPositionFromEvent(event);
}

function handleMouseLeave() {
  if (!isDragging.value) {
    isHovering.value = false;
    hoverPosition.value = null;
  }
}

function handleGlobalMouseMove(event: MouseEvent) {
  if (isDragging.value) {
    const position = getPositionFromEvent(event);
    emit('seek', position);
  }
}

function handleGlobalMouseUp() {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', handleGlobalMouseUp);
}

// Cleanup
onUnmounted(() => {
  document.removeEventListener('mousemove', handleGlobalMouseMove);
  document.removeEventListener('mouseup', handleGlobalMouseUp);
});
</script>

<style scoped>
.livestream-timeline {
  width: 100%;
  user-select: none;
}

/* Custom animation for smooth pulsing */
@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}
</style>

