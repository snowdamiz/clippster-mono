<template>
  <div v-if="currentTrack" class="global-audio-player">
    <div class="global-audio-player__track">
      <div class="global-audio-player__thumbnail">
        <Music :size="20" />
      </div>
      <div class="global-audio-player__info">
        <div class="global-audio-player__title">{{ currentTrack.title }}</div>
        <div class="global-audio-player__meta">
          <span v-if="currentTrack.platform" class="global-audio-player__platform">
            {{ currentTrack.platform }}
          </span>
          <span class="global-audio-player__source">
            {{ currentTrack.source === 'upload' ? 'Uploaded' : 'Downloaded' }}
          </span>
        </div>
      </div>
    </div>

    <div class="global-audio-player__controls">
      <button
        @click="audioPlayerStore.toggleShuffle()"
        class="global-audio-player__control"
        :class="{ 'global-audio-player__control--active': audioPlayerStore.shuffleMode }"
        title="Shuffle"
      >
        <Shuffle :size="18" />
      </button>

      <button
        @click="audioPlayerStore.previousTrack()"
        :disabled="!audioPlayerStore.hasPrevious"
        class="global-audio-player__control"
        title="Previous"
      >
        <SkipBack :size="18" />
      </button>

      <button
        @click="audioPlayerStore.togglePlay()"
        class="global-audio-player__control global-audio-player__control--play"
        title="Play/Pause"
      >
        <Pause v-if="audioPlayerStore.isPlaying" :size="24" />
        <Play v-else :size="24" />
      </button>

      <button
        @click="audioPlayerStore.nextTrack()"
        :disabled="!audioPlayerStore.hasNext"
        class="global-audio-player__control"
        title="Next"
      >
        <SkipForward :size="18" />
      </button>

      <button
        @click="audioPlayerStore.cycleRepeatMode()"
        class="global-audio-player__control"
        :class="{ 'global-audio-player__control--active': audioPlayerStore.repeatMode !== 'off' }"
        :title="repeatModeTitle"
      >
        <Repeat v-if="audioPlayerStore.repeatMode !== 'one'" :size="18" />
        <Repeat1 v-else :size="18" />
      </button>
    </div>

    <div class="global-audio-player__progress">
      <span class="global-audio-player__time">{{ formatTime(audioPlayerStore.currentTime) }}</span>
      <div class="global-audio-player__progress-bar" @click="handleProgressClick">
        <div
          class="global-audio-player__progress-fill"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
      <span class="global-audio-player__time">{{ formatTime(audioPlayerStore.duration) }}</span>
    </div>

    <div class="global-audio-player__volume">
      <button
        @click="audioPlayerStore.toggleMute()"
        class="global-audio-player__control"
        title="Mute/Unmute"
      >
        <VolumeX v-if="audioPlayerStore.isMuted" :size="18" />
        <Volume2 v-else-if="audioPlayerStore.volume > 0.5" :size="18" />
        <Volume1 v-else-if="audioPlayerStore.volume > 0" :size="18" />
        <Volume v-else :size="18" />
      </button>
      <input
        type="range"
        min="0"
        max="100"
        :value="audioPlayerStore.volume * 100"
        @input="handleVolumeChange"
        class="global-audio-player__volume-slider"
      />
    </div>

    <button
      @click="audioPlayerStore.clearPlaylist()"
      class="global-audio-player__control global-audio-player__close"
      title="Close player"
    >
      <X :size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useAudioPlayerStore } from '@/stores/audioPlayer';
  import {
    Music,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Shuffle,
    Repeat,
    Repeat1,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
    X,
  } from 'lucide-vue-next';

  const audioPlayerStore = useAudioPlayerStore();

  const currentTrack = computed(() => audioPlayerStore.currentTrack);

  const progressPercent = computed(() => {
    if (audioPlayerStore.duration === 0) return 0;
    return (audioPlayerStore.currentTime / audioPlayerStore.duration) * 100;
  });

  const repeatModeTitle = computed(() => {
    switch (audioPlayerStore.repeatMode) {
      case 'off': return 'Repeat: Off';
      case 'all': return 'Repeat: All';
      case 'one': return 'Repeat: One';
      default: return 'Repeat';
    }
  });

  function formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleProgressClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newTime = percent * audioPlayerStore.duration;
    audioPlayerStore.seek(newTime);
  }

  function handleVolumeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const volume = parseInt(target.value) / 100;
    audioPlayerStore.setVolume(volume);
  }
</script>

<style scoped>
  .global-audio-player {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: var(--sidebar-surface);
    border-top: 1px solid var(--sidebar-border);
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 0 24px;
    z-index: 1000;
  }

  .global-audio-player__track {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 200px;
    max-width: 300px;
  }

  .global-audio-player__thumbnail {
    width: 48px;
    height: 48px;
    background: var(--sidebar-hover);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text);
    flex-shrink: 0;
  }

  .global-audio-player__info {
    flex: 1;
    min-width: 0;
  }

  .global-audio-player__title {
    font-size: 14px;
    font-weight: 500;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .global-audio-player__meta {
    display: flex;
    gap: 8px;
    font-size: 12px;
    color: var(--sidebar-text-secondary);
    margin-top: 2px;
  }

  .global-audio-player__platform {
    font-weight: 500;
  }

  .global-audio-player__controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .global-audio-player__control {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--sidebar-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .global-audio-player__control:hover:not(:disabled) {
    background: var(--sidebar-hover);
    color: var(--accent-primary);
  }

  .global-audio-player__control:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .global-audio-player__control--active {
    color: var(--accent-primary);
  }

  .global-audio-player__control--play {
    width: 40px;
    height: 40px;
    background: var(--accent-primary);
    color: white;
  }

  .global-audio-player__control--play:hover {
    background: var(--accent-primary);
    opacity: 0.9;
  }

  .global-audio-player__progress {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .global-audio-player__time {
    font-size: 12px;
    color: var(--sidebar-text-secondary);
    font-variant-numeric: tabular-nums;
    min-width: 40px;
  }

  .global-audio-player__progress-bar {
    flex: 1;
    height: 4px;
    background: var(--sidebar-hover);
    border-radius: 2px;
    cursor: pointer;
    position: relative;
  }

  .global-audio-player__progress-bar:hover {
    height: 6px;
  }

  .global-audio-player__progress-fill {
    height: 100%;
    background: var(--accent-primary);
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .global-audio-player__volume {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 150px;
  }

  .global-audio-player__volume-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--sidebar-hover);
    border-radius: 2px;
    outline: none;
  }

  .global-audio-player__volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: var(--accent-primary);
    border-radius: 50%;
    cursor: pointer;
  }

  .global-audio-player__volume-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: var(--accent-primary);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .global-audio-player__close {
    margin-left: auto;
  }
</style>
