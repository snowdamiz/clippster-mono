<template>
  <div
    v-if="videoSrc && !videoLoading"
    class="relative z-20 mt-1.5 flex h-10 items-center justify-between gap-2 rounded-lg border border-line-subtle bg-surface px-1.5"
  >
    <!-- Left Controls -->
    <div class="flex min-w-0 items-center gap-0.5">
      <button type="button" :class="iconButton" title="Go to beginning" aria-label="Go to beginning" @click="goToBeginning">
        <SkipBack />
      </button>
      <button
        type="button"
        :class="[iconButton, 'text-fg']"
        :title="isPlaying ? 'Pause (Space)' : 'Play (Space)'"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlayPause"
      >
        <Play v-if="!isPlaying" class="fill-current" />
        <Pause v-else class="fill-current" />
      </button>
      <!-- Time Display -->
      <div class="ml-1.5 whitespace-nowrap font-mono text-xs tabular-nums">
        <span class="text-fg">{{ formatDuration(currentTime) }}</span>
        <span class="mx-1 text-fg-disabled">/</span>
        <span class="text-fg-subtle">{{ formatDuration(duration) }}</span>
      </div>
    </div>
    <!-- Right Controls -->
    <div class="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        :class="iconButton"
        :title="isMuted || volume === 0 ? 'Unmute' : 'Mute'"
        :aria-label="isMuted || volume === 0 ? 'Unmute' : 'Mute'"
        @click="toggleMute"
      >
        <VolumeX v-if="isMuted || volume === 0" />
        <Volume2 v-else />
      </button>
      <div class="relative mr-2 hidden h-1 w-20 rounded-full bg-line-strong sm:block">
        <div
          class="absolute left-0 top-0 h-full rounded-full bg-fg-muted transition-[width] duration-150"
          :style="{ width: `${volume * 100}%` }"
        ></div>
        <input
          v-model="localVolume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label="Volume"
          class="slider absolute inset-x-0 top-1/2 z-10 h-4 w-full -translate-y-1/2 cursor-pointer"
          @input="updateVolume"
        />
      </div>
      <button
        type="button"
        :class="iconButton"
        :title="isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'"
        :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        @click="toggleFullscreen"
      >
        <Minimize2 v-if="isFullscreen" />
        <Maximize2 v-else />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
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
  }

  const emit = defineEmits<Emits>();

  // Shared with apps/web (no ui primitives there): mirrors Button ghost + icon-sm.
  const iconButton =
    'grid size-7 shrink-0 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none [&_svg]:size-4';

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
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds - mins * 60;
    const secsWithHundredths = secs.toFixed(2); // always show hundredths

    if (mins === 0) {
      return `${secsWithHundredths}`;
    }

    const [wholeSecs, hundredths] = secsWithHundredths.split('.');
    return `${mins}:${wholeSecs.padStart(2, '0')}.${hundredths}`;
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
</script>

<style scoped>
  /* Transparent range input over the painted track; only the thumb is visible */
  input[type='range'].slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }

  input[type='range'].slider::-webkit-slider-runnable-track {
    background: transparent;
    height: 4px;
  }

  input[type='range'].slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    margin-top: -3px;
    border: none;
    border-radius: 50%;
    background: var(--fg);
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease;
  }

  input[type='range'].slider:hover::-webkit-slider-thumb {
    transform: scale(1.2);
  }

  input[type='range'].slider::-moz-range-track {
    background: transparent;
    height: 4px;
  }

  input[type='range'].slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border: none;
    border-radius: 50%;
    background: var(--fg);
    box-shadow: var(--shadow-sm);
  }
</style>
