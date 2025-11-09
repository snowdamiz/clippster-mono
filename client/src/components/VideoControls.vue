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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.5 14.5l-3-3 3-3" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.5 14.5l-3-3 3-3" />
          </svg>
        </button>
        <!-- Play/Pause Button -->
        <button
          @click="togglePlayPause"
          class="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all duration-200 backdrop-blur-sm"
          title="Play/Pause"
        >
          <svg
            v-if="!isPlaying"
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />
          </svg>
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
            <svg
              v-if="isMuted || volume === 0"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />

              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
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
