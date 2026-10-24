<template>
  <!-- Keep playback controls outside page stacking contexts and teleported workspaces. -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-3 opacity-0"
    >
      <AudioPlayerBar
        v-if="currentTrack"
        :title="currentTrack.title"
        :is-playing="isPlaying"
        :progress="progress"
        :current-time-label="formattedCurrentTime"
        :duration-label="formattedDuration"
        :volume="volume"
        :muted="isMuted"
        :shuffle="isShuffle"
        :repeat-mode="repeatMode"
        :has-previous="hasPrevious"
        :has-next="hasNext"
        :queue-controls="playlist.length > 0"
        close-label="Stop"
        @toggle-play="togglePlayPause"
        @previous="playPrevious"
        @next="playNext"
        @toggle-shuffle="toggleShuffle"
        @toggle-repeat="toggleRepeat"
        @toggle-mute="toggleMute"
        @volume="setVolume"
        @seek="handleSeek"
        @restart="restart"
        @close="stop"
      />
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { useAudioPlayer } from '@/composables/useAudioPlayer';
  import AudioPlayerBar from '@/components/media/AudioPlayerBar.vue';

  const {
    currentTrack,
    playlist,
    hasNext,
    hasPrevious,
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
    restart,
    setVolume,
    toggleMute,
    stop,
  } = useAudioPlayer();

  function handleSeek(fraction: number) {
    const duration = currentTrack.value?.duration || 0;
    seek(fraction * duration);
  }
</script>
