<template>
  <div v-if="videoSrc && !videoLoading" class="bg-black/60 backdrop-blur-sm">
    <!-- Full-width Timeline/Progress Bar -->
    <div
      ref="timelineRef"
      class="relative h-4 w-full cursor-pointer group flex items-center"
      @mousedown="startDrag($event)"
      @mousemove="onTimelineHover($event)"
      @mouseleave="onTimelineLeave"
    >
      <!-- Visual track (centered in larger hit area) -->
      <div class="absolute inset-x-0 h-1 top-1/2 -translate-y-1/2">
        <!-- Background track -->
        <div class="absolute inset-0 bg-white/20"></div>
        <!-- Progress Bar -->
        <div
          class="absolute h-full bg-violet-500"
          :class="{ 'transition-all duration-75': !isDragging }"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
      <!-- Seek thumb - always visible, larger during drag -->
      <div
        class="absolute top-1/2 bg-violet-400 rounded-full shadow-md pointer-events-none"
        :class="[
          isDragging ? 'w-4 h-4' : 'w-3 h-3',
          { 'transition-all duration-75': !isDragging }
        ]"
        :style="{
          left: `${progressPercent}%`,
          transform: 'translate(-50%, -50%)',
        }"
      ></div>
      <!-- Hover/drag time preview -->
      <div
        v-if="hoverTime !== null || isDragging"
        class="absolute -top-8 bg-black/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium whitespace-nowrap z-20 pointer-events-none"
        :style="{ left: `${isDragging ? progressPercent : hoverPosition}%`, transform: 'translateX(-50%)' }"
      >
        {{ formatDuration(isDragging ? (progressPercent / 100) * duration : hoverTime) }}
      </div>
    </div>
    <!-- Control Buttons and Time Display -->
    <div class="flex items-center justify-between px-2 py-1.5">
      <!-- Left Controls -->
      <div class="flex items-center gap-1">
        <!-- Go to Beginning Button -->
        <button
          @click="goToBeginning"
          class="p-2.5 hover:bg-white/[0.08] rounded-lg transition-all duration-200 group"
          title="Go to Beginning"
        >
          <SkipBack class="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
        </button>
        <!-- Play/Pause Button -->
        <button
          @click="togglePlayPause"
          class="p-2.5 hover:bg-white/[0.08] rounded-lg transition-all duration-200 grou"
          title="Play/Pause (Space)"
        >
          <Play v-if="!isPlaying" class="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
          <Pause v-else class="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
        </button>
        <!-- Time Display -->
        <div
          class="text-white/80 text-xs font-mono bg-white/[0.04] px-3 py-2 rounded-lg ml-1 tabular-nums tracking-tight"
        >
          <span class="text-white/90">{{ formatDuration(currentTime) }}</span>
          <span class="text-white/40 mx-1">/</span>
          <span class="text-white/50">{{ formatDuration(duration) }}</span>
        </div>
      </div>
      <!-- Right Controls -->
      <div class="flex items-center gap-2 pr-1">
        <!-- Volume Control -->
        <div class="flex items-center gap-2 px-2 py-1.5">
          <button
            @click="toggleMute"
            class="p-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group"
            title="Mute/Unmute"
          >
            <VolumeX
              v-if="isMuted || volume === 0"
              class="h-4 w-4 text-white/50 group-hover:text-white/80 transition-colors"
            />
            <Volume2 v-else class="h-4 w-4 text-white/60 group-hover:text-white/90 transition-colors" />
          </button>
          <div class="relative w-24 h-1 bg-white/10 rounded-full">
            <div
              class="absolute left-0 top-0 h-full bg-white/40 rounded-full transition-all duration-150"
              :style="{ width: `${volume * 100}%` }"
            ></div>
            <input
              v-model="localVolume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="absolute inset-0 w-full h-full cursor-pointer slider z-10 pt-0.5"
              @input="updateVolume"
            />
          </div>
        </div>
        <!-- Fullscreen Button -->
        <button
          @click="toggleFullscreen"
          class="p-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group ml-1"
          :title="isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'"
        >
          <Minimize2
            v-if="isFullscreen"
            class="h-4 w-4 text-white/60 group-hover:text-white/90 transition-colors"
          />
          <Maximize2
            v-else
            class="h-4 w-4 text-white/60 group-hover:text-white/90 transition-colors"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onUnmounted } from 'vue';
  import { SkipBack, Play, Pause, VolumeX, Volume2, Maximize2, Minimize2 } from 'lucide-vue-next';

  interface Props {
    videoSrc: string | null;
    videoLoading: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    isFullscreen?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    isFullscreen: false,
  });

  interface Emits {
    (e: 'togglePlayPause'): void;
    (e: 'toggleMute'): void;
    (e: 'updateVolume', value: number): void;
    (e: 'goToBeginning'): void;
    (e: 'toggleFullscreen'): void;
    (e: 'seekTo', time: number): void;
  }

  const emit = defineEmits<Emits>();

  // Local volume state for the slider
  const localVolume = ref(props.volume);

  // Timeline refs and state
  const timelineRef = ref<HTMLElement | null>(null);
  const hoverTime = ref<number | null>(null);
  const hoverPosition = ref(0);
  const isDragging = ref(false);
  const dragPercent = ref(0);

  // Progress percentage for timeline (use drag position while dragging)
  const progressPercent = computed(() => {
    if (isDragging.value) return dragPercent.value;
    if (!props.duration || props.duration <= 0) return 0;
    return Math.min(100, (props.currentTime / props.duration) * 100);
  });

  // Sync local volume with prop changes
  watch(
    () => props.volume,
    (newVolume) => {
      localVolume.value = newVolume;
    }
  );

  function formatDuration(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';

    const totalSeconds = Math.floor(seconds);

    if (totalSeconds < 60) {
      return `0:${totalSeconds.toString().padStart(2, '0')}`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  function togglePlayPause() {
    emit('togglePlayPause');
  }

  function toggleMute() {
    emit('toggleMute');
  }

  function updateVolume() {
    emit('updateVolume', Number(localVolume.value));
  }

  function goToBeginning() {
    emit('goToBeginning');
  }

  function toggleFullscreen() {
    emit('toggleFullscreen');
  }

  // Calculate percent from mouse position
  function getPercentFromEvent(event: MouseEvent): number {
    if (!timelineRef.value) return 0;
    const rect = timelineRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  }

  // Start dragging
  function startDrag(event: MouseEvent) {
    if (!props.duration || props.duration <= 0) return;
    
    isDragging.value = true;
    dragPercent.value = getPercentFromEvent(event);
    
    // Add document-level listeners for drag
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    
    // Prevent text selection while dragging
    event.preventDefault();
  }

  // Handle drag movement
  function onDrag(event: MouseEvent) {
    if (!isDragging.value) return;
    dragPercent.value = getPercentFromEvent(event);
  }

  // Stop dragging and seek to final position
  function stopDrag() {
    if (!isDragging.value) return;
    
    // Seek to the final position
    const seekTime = (dragPercent.value / 100) * props.duration;
    emit('seekTo', seekTime);
    
    isDragging.value = false;
    
    // Remove document-level listeners
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  // Handle hover for time preview
  function onTimelineHover(event: MouseEvent) {
    if (isDragging.value) return; // Don't update hover during drag
    if (!props.duration || props.duration <= 0) return;

    const percent = getPercentFromEvent(event);
    hoverTime.value = (percent / 100) * props.duration;
    hoverPosition.value = percent;
  }

  // Clear hover state when leaving timeline
  function onTimelineLeave() {
    if (!isDragging.value) {
      hoverTime.value = null;
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  });
</script>

<style scoped>
  /* Custom range input styling */
  input[type='range'].slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }

  input[type='range'].slider::-webkit-slider-track {
    background: transparent;
    height: 4px;
    border-radius: 2px;
  }

  input[type='range'].slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    background: white;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    margin-top: -3px;
  }

  input[type='range'].slider::-webkit-slider-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.15);
    box-shadow: 0 3px 8px rgba(139, 92, 246, 0.4);
  }

  input[type='range'].slider::-moz-range-track {
    background: transparent;
    height: 4px;
    border-radius: 2px;
  }

  input[type='range'].slider::-moz-range-thumb {
    border: none;
    background: white;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  input[type='range'].slider::-moz-range-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.15);
    box-shadow: 0 3px 8px rgba(139, 92, 246, 0.4);
  }

  /* Smooth transitions */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }

  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(8px);
  }
</style>
