<template>
  <div v-if="videoSrc && !videoLoading" class="mt-3 bg-[#0a0a0a]/50 rounded-lg backdrop-blur-sm">
    <!-- Control Buttons and Time Display -->
    <div class="flex items-center justify-between">
      <!-- Left Controls -->
      <div class="flex items-center gap-2">
        <!-- Go to Beginning Button -->
        <button
          @click="goToBeginning"
          class="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all duration-200 backdrop-blur-sm"
          title="Go to Beginning"
        >
          <SkipBack class="h-6 w-6 text-white" />
        </button>
        <!-- Play/Pause Button -->
        <button
          @click="togglePlayPause"
          class="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all duration-200 backdrop-blur-sm"
          title="Play/Pause"
        >
          <Play v-if="!isPlaying" class="h-6 w-6 text-white" />
          <Pause v-else class="h-6 w-6 text-white" />
        </button>
        <!-- Time Display -->
        <div class="text-white text-sm font-mono font-medium bg-white/5 px-4 py-2 rounded-md backdrop-blur-sm">
          {{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}
        </div>
      </div>
      <!-- Right Controls -->
      <div class="flex items-center gap-2">
        <!-- Volume Control -->
        <div class="flex items-center gap-1.5">
          <button
            @click="toggleMute"
            class="p-3 rounded-md transition-all duration-200 backdrop-blur-sm"
            title="Mute/Unmute"
          >
            <VolumeX v-if="isMuted || volume === 0" class="h-5 w-5 text-white" />
            <Volume2 v-else class="h-5 w-5 text-white" />
          </button>
          <div class="relative w-30 h-1.5 bg-gray-700 rounded-md">
            <div
              class="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-md transition-all duration-200"
              :style="{ width: `${volume * 100}%` }"
            ></div>
            <input
              v-model="localVolume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="absolute inset-0 w-full h-full cursor-pointer slider z-10 mt-0.5"
              @input="updateVolume"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { SkipBack, Play, Pause, VolumeX, Volume2 } from 'lucide-vue-next';

  interface Props {
    videoSrc: string | null;
    videoLoading: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
  }

  const props = defineProps<Props>();

  interface Emits {
    (e: 'togglePlayPause'): void;
    (e: 'toggleMute'): void;
    (e: 'updateVolume', value: number): void;
    (e: 'goToBeginning'): void;
  }

  const emit = defineEmits<Emits>();

  // Local volume state for the slider
  const localVolume = ref(props.volume);

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
</script>

<style scoped>
  /* Custom range input styling */
  input[type='range'].slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
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
    height: 12px;
    width: 12px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    margin-top: -4px;
  }

  input[type='range'].slider::-webkit-slider-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.1);
  }

  input[type='range'].slider::-moz-range-track {
    background: transparent;
    height: 4px;
    border-radius: 2px;
  }

  input[type='range'].slider::-moz-range-thumb {
    border: none;
    background: white;
    height: 12px;
    width: 12px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  input[type='range'].slider::-moz-range-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.1);
  }

  /* Control buttons */
  .control-button {
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
  }

  .control-button:hover {
    transform: scale(1.05);
  }

  .control-button:active {
    transform: scale(0.95);
  }

  /* Smooth transitions */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }

  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }
</style>
