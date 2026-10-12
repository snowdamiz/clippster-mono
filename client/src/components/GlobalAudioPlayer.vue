<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-3 opacity-0"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="translate-y-3 opacity-0"
  >
    <AudioPlayerBar
      v-if="currentTrack"
      :title="currentTrack.title"
      :subtitle="subtitle"
      :is-playing="audioPlayerStore.isPlaying"
      :progress="progressPercent"
      :current-time-label="formatTime(audioPlayerStore.currentTime)"
      :duration-label="formatTime(audioPlayerStore.duration)"
      :volume="audioPlayerStore.volume"
      :muted="audioPlayerStore.isMuted"
      :shuffle="audioPlayerStore.shuffleMode"
      :repeat-mode="audioPlayerStore.repeatMode"
      :has-previous="audioPlayerStore.hasPrevious"
      :has-next="audioPlayerStore.hasNext"
      @toggle-play="audioPlayerStore.togglePlay()"
      @previous="audioPlayerStore.previousTrack()"
      @next="audioPlayerStore.nextTrack()"
      @toggle-shuffle="audioPlayerStore.toggleShuffle()"
      @toggle-repeat="audioPlayerStore.cycleRepeatMode()"
      @toggle-mute="audioPlayerStore.toggleMute()"
      @volume="audioPlayerStore.setVolume"
      @seek="(fraction) => audioPlayerStore.seek(fraction * audioPlayerStore.duration)"
      @close="audioPlayerStore.clearPlaylist()"
    />
  </Transition>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useAudioPlayerStore } from '@/stores/audioPlayer';
  import AudioPlayerBar from '@/components/media/AudioPlayerBar.vue';

  const audioPlayerStore = useAudioPlayerStore();

  const currentTrack = computed(() => audioPlayerStore.currentTrack);

  const subtitle = computed(() => {
    const track = currentTrack.value;
    if (!track) return undefined;
    const source = track.source === 'upload' ? 'Uploaded' : 'Downloaded';
    return track.platform ? `${track.platform} · ${source}` : source;
  });

  const progressPercent = computed(() => {
    if (audioPlayerStore.duration === 0) return 0;
    return (audioPlayerStore.currentTime / audioPlayerStore.duration) * 100;
  });

  function formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>
