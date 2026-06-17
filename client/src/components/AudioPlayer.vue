<template>
  <Transition name="player-slide">
    <div v-if="currentTrack" class="audio-player">
      <div class="audio-player__content">
        <!-- Track Info -->
        <div class="audio-player__track">
          <div class="audio-player__track-icon">
            <Music :size="14" />
          </div>
          <div class="audio-player__track-info">
            <div class="audio-player__track-title">{{ currentTrack.title }}</div>
            <div v-if="currentTrack.platform" class="audio-player__track-platform">
              {{ currentTrack.platform }}
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="audio-player__controls">
          <!-- Previous Button -->
          <button
            v-if="playlist.length > 0"
            @click="playPrevious"
            class="audio-player__control-btn"
            :disabled="currentTrackIndex === 0 && !isShuffle && repeatMode !== 'all'"
            title="Previous"
          >
            <SkipBack :size="16" />
          </button>

          <!-- Play/Pause Button -->
          <button
            @click="togglePlayPause"
            class="audio-player__control-btn audio-player__control-btn--play"
            :title="isPlaying ? 'Pause' : 'Play'"
          >
            <Pause v-if="isPlaying" :size="16" />
            <Play v-else :size="16" />
          </button>

          <!-- Next Button -->
          <button
            v-if="playlist.length > 0"
            @click="playNext"
            class="audio-player__control-btn"
            :disabled="currentTrackIndex === playlist.length - 1 && !isShuffle && repeatMode !== 'all'"
            title="Next"
          >
            <SkipForward :size="16" />
          </button>

          <div class="audio-player__time">
            {{ formattedCurrentTime }}
          </div>

          <!-- Progress Bar -->
          <div class="audio-player__progress-container" @click="handleProgressClick">
            <div class="audio-player__progress-bg">
              <div class="audio-player__progress-fill" :style="{ width: `${progress}%` }"></div>
              <div
                class="audio-player__progress-handle"
                :style="{ left: `${progress}%` }"
                @mousedown="startDragging"
              ></div>
            </div>
          </div>

          <div class="audio-player__time">
            {{ formattedDuration }}
          </div>
        </div>

        <!-- Volume & Actions -->
        <div class="audio-player__actions">
          <!-- Shuffle Button -->
          <button
            v-if="playlist.length > 0"
            @click="toggleShuffle"
            class="audio-player__control-btn"
            :class="{ 'audio-player__control-btn--active': isShuffle }"
            title="Shuffle"
          >
            <Shuffle :size="14" />
          </button>

          <!-- Repeat Button -->
          <button
            v-if="playlist.length > 0"
            @click="toggleRepeat"
            class="audio-player__control-btn"
            :class="{ 'audio-player__control-btn--active': repeatMode !== 'off' }"
            :title="repeatMode === 'off' ? 'Repeat Off' : repeatMode === 'all' ? 'Repeat All' : 'Repeat One'"
          >
            <Repeat v-if="repeatMode !== 'one'" :size="14" />
            <Repeat1 v-else :size="14" />
          </button>

          <!-- Volume Control -->
          <div class="audio-player__volume">
            <button
              @click="toggleMute"
              class="audio-player__control-btn"
              :title="isMuted ? 'Unmute' : 'Mute'"
            >
              <VolumeX v-if="isMuted" :size="14" />
              <Volume2 v-else-if="volume > 0.5" :size="14" />
              <Volume1 v-else-if="volume > 0" :size="14" />
              <Volume v-else :size="14" />
            </button>
            <div class="audio-player__volume-slider-container">
              <input
                type="range"
                min="0"
                max="100"
                :value="volume * 100"
                @input="handleVolumeChange"
                class="audio-player__volume-slider"
                :style="{ '--volume-percent': `${volume * 100}%` }"
              />
            </div>
          </div>

          <!-- Close Button -->
          <button
            @click="stop"
            class="audio-player__control-btn"
            title="Stop"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useAudioPlayer } from '@/composables/useAudioPlayer';
  import { Music, Play, Pause, Volume, Volume1, Volume2, VolumeX, X, Shuffle, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-vue-next';

  const {
    currentTrack,
    playlist,
    currentTrackIndex,
    isPlaying,
    isShuffle,
    repeatMode,
    progress,
    formattedCurrentTime,
    formattedDuration,
    volume,
    isMuted,
    togglePlayPause,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    seek,
    setVolume,
    toggleMute,
    stop,
  } = useAudioPlayer();

  const isDragging = ref(false);

  function handleProgressClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const duration = currentTrack.value?.duration || 0;
    seek(percent * duration);
  }

  function startDragging(event: MouseEvent) {
    isDragging.value = true;
    event.preventDefault();

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.value) return;
      const progressContainer = (event.target as HTMLElement).parentElement?.parentElement;
      if (!progressContainer) return;
      
      const rect = progressContainer.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const duration = currentTrack.value?.duration || 0;
      seek(percent * duration);
    };

    const handleMouseUp = () => {
      isDragging.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function handleVolumeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    setVolume(parseInt(target.value) / 100);
  }
</script>

<style scoped>
  .audio-player {
    position: fixed;
    bottom: 0;
    left: 160px; /* Sidebar width */
    right: 0;
    z-index: 1000;
    background: transparent;
    pointer-events: none;
  }

  .audio-player__content {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 2rem;
    max-width: 50%;
    margin: 0 auto;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    margin-bottom: 1rem;
  }

  /* Track Info */
  .audio-player__track {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 150px;
    max-width: 200px;
  }

  .audio-player__track-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .audio-player__track-info {
    flex: 1;
    min-width: 0;
  }

  .audio-player__track-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .audio-player__track-platform {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.2;
  }

  /* Controls */
  .audio-player__controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .audio-player__control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .audio-player__control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--sidebar-accent);
  }

  .audio-player__control-btn--active {
    color: var(--sidebar-accent);
    background: rgba(6, 182, 212, 0.15);
  }

  .audio-player__control-btn--active:hover {
    background: rgba(6, 182, 212, 0.25);
  }

  .audio-player__control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .audio-player__control-btn:disabled:hover {
    background: transparent;
    color: var(--sidebar-text-muted);
  }

  .audio-player__control-btn--play {
    width: 32px;
    height: 32px;
    background: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border-radius: 50%;
    padding: 0;
  }

  .audio-player__control-btn--play:hover {
    background: var(--sidebar-accent);
    opacity: 0.9;
    transform: scale(1.05);
  }

  .audio-player__time {
    font-size: 0.6875rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    min-width: 36px;
    text-align: center;
  }

  /* Progress Bar */
  .audio-player__progress-container {
    flex: 1;
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .audio-player__progress-bg {
    position: relative;
    height: 3px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: visible;
  }

  .audio-player__progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--sidebar-accent);
    border-radius: 2px;
    transition: width 100ms linear;
  }

  .audio-player__progress-handle {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .audio-player__progress-container:hover .audio-player__progress-handle {
    opacity: 1;
  }

  /* Volume */
  .audio-player__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .audio-player__volume {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .audio-player__volume-slider-container {
    display: flex;
    align-items: center;
    width: 60px;
  }

  .audio-player__volume-slider {
    width: 100%;
    height: 10px;
    margin: 0;
    padding: 0;
    background: transparent;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }

  .audio-player__volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    margin-top: -3.5px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .audio-player__volume-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .audio-player__volume-slider::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--sidebar-accent) 0%,
      var(--sidebar-accent) var(--volume-percent, 70%),
      rgba(255, 255, 255, 0.2) var(--volume-percent, 70%),
      rgba(255, 255, 255, 0.2) 100%
    );
  }

  .audio-player__volume-slider::-moz-range-track {
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--sidebar-accent) 0%,
      var(--sidebar-accent) var(--volume-percent, 70%),
      rgba(255, 255, 255, 0.2) var(--volume-percent, 70%),
      rgba(255, 255, 255, 0.2) 100%
    );
  }

  /* Transitions */
  .player-slide-enter-active,
  .player-slide-leave-active {
    transition: transform 300ms ease, opacity 300ms ease;
  }

  .player-slide-enter-from,
  .player-slide-leave-to {
    transform: translateY(100%);
    opacity: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .audio-player__track {
      min-width: 150px;
      max-width: 200px;
    }

    .audio-player__volume-slider-container {
      display: none;
    }
  }
</style>
