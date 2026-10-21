import { ref, computed, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface AudioTrack {
  id: string;
  title: string;
  filePath: string;
  duration?: number;
  platform?: string;
}

const currentTrack = ref<AudioTrack | null>(null);
const playlist = ref<AudioTrack[]>([]);
const playbackQueue = ref<AudioTrack[]>([]);
const playHistory = ref<AudioTrack[]>([]);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.7);
const isMuted = ref(false);
const isShuffle = ref(false);
const repeatMode = ref<'off' | 'all' | 'one'>('off');
const audioElement = ref<HTMLAudioElement | null>(null);

export function useAudioPlayer() {
  function initAudioElement() {
    if (!audioElement.value) {
      audioElement.value = new Audio();

      audioElement.value.addEventListener('timeupdate', () => {
        currentTime.value = audioElement.value?.currentTime || 0;
      });

      audioElement.value.addEventListener('loadedmetadata', () => {
        duration.value = audioElement.value?.duration || 0;
      });

      audioElement.value.addEventListener('ended', () => {
        if (repeatMode.value === 'one') {
          restart();
          return;
        }

        void advanceToNextTrack();
      });

      audioElement.value.addEventListener('play', () => {
        isPlaying.value = true;
      });

      audioElement.value.addEventListener('pause', () => {
        isPlaying.value = false;
      });

      audioElement.value.volume = volume.value;
      audioElement.value.muted = isMuted.value;
    }
  }

  async function playTrack(track: AudioTrack, options?: { force?: boolean }) {
    initAudioElement();

    if (!audioElement.value) return;

    if (!options?.force && currentTrack.value?.id === track.id) {
      togglePlayPause();
      return;
    }

    currentTrack.value = track;
    currentTime.value = 0;
    duration.value = 0;
    const audioUrl = convertFileSrc(track.filePath);
    audioElement.value.src = audioUrl;

    try {
      await audioElement.value.play();
      isPlaying.value = true;
    } catch (error) {
      console.error('[AudioPlayer] Failed to play track:', error);
      isPlaying.value = false;
    }
  }

  function togglePlayPause() {
    if (!audioElement.value) return;

    if (isPlaying.value) {
      audioElement.value.pause();
    } else {
      audioElement.value.play();
    }
  }

  function pause() {
    if (audioElement.value) {
      audioElement.value.pause();
    }
  }

  function play() {
    if (audioElement.value) {
      audioElement.value.play();
    }
  }

  function seek(time: number) {
    if (audioElement.value) {
      audioElement.value.currentTime = time;
      currentTime.value = time;
    }
  }

  function setVolume(value: number) {
    volume.value = Math.max(0, Math.min(1, value));
    if (audioElement.value) {
      audioElement.value.volume = volume.value;
    }
  }

  function toggleMute() {
    isMuted.value = !isMuted.value;
    if (audioElement.value) {
      audioElement.value.muted = isMuted.value;
    }
  }

  function stop() {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value.currentTime = 0;
    }
    currentTrack.value = null;
    isPlaying.value = false;
    currentTime.value = 0;
    playlist.value = [];
    playbackQueue.value = [];
    playHistory.value = [];
  }

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function buildShuffledQueue(tracks: AudioTrack[], startIndex: number): AudioTrack[] {
    const remaining = tracks.filter((_, index) => index !== startIndex);
    return shuffleArray(remaining);
  }

  function rebuildSequentialQueue() {
    if (!currentTrack.value || playlist.value.length === 0) {
      playbackQueue.value = [];
      return;
    }

    const currentId = currentTrack.value.id;
    const currentOriginalIndex = playlist.value.findIndex((t) => t.id === currentId);
    if (currentOriginalIndex === -1) return;

    playbackQueue.value = playlist.value.slice(currentOriginalIndex + 1);
  }

  async function playPlaylist(
    tracks: AudioTrack[],
    startIndex = 0,
    options?: { shuffle?: boolean }
  ) {
    if (tracks.length === 0 || !tracks[startIndex]) return;

    const shouldShuffle = options?.shuffle ?? isShuffle.value;
    playlist.value = tracks;
    playHistory.value = [];

    if (shouldShuffle) {
      isShuffle.value = true;
      playbackQueue.value = buildShuffledQueue(tracks, startIndex);
      await playTrack(tracks[startIndex]);
    } else {
      isShuffle.value = false;
      playbackQueue.value = tracks.slice(startIndex + 1);
      await playTrack(tracks[startIndex]);
    }
  }

  function refillQueueForRepeatAll(): boolean {
    if (!currentTrack.value || playlist.value.length === 0) return false;

    playbackQueue.value = isShuffle.value
      ? shuffleArray(playlist.value.filter((t) => t.id !== currentTrack.value!.id))
      : [...playlist.value];
    if (playbackQueue.value.length === 0) playbackQueue.value = [...playlist.value];
    return playbackQueue.value.length > 0;
  }

  async function advanceToNextTrack() {
    if (!currentTrack.value) return;

    if (playbackQueue.value.length === 0) {
      if (repeatMode.value === 'all' && refillQueueForRepeatAll()) {
        // Queue refilled for repeat-all
      } else {
        isPlaying.value = false;
        currentTime.value = 0;
        return;
      }
    }

    playHistory.value.push(currentTrack.value);
    const nextTrack = playbackQueue.value.shift()!;
    await playTrack(nextTrack, { force: true });
  }

  async function playNext() {
    if (!hasNext.value) return;
    await advanceToNextTrack();
  }

  async function playPrevious() {
    if (!currentTrack.value || !hasPrevious.value) return;

    if (isShuffle.value) {
      playbackQueue.value.unshift(currentTrack.value);
      await playTrack(playHistory.value.pop()!, { force: true });
    } else {
      const previousIndex =
        (currentTrackIndex.value - 1 + playlist.value.length) % playlist.value.length;
      playHistory.value.push(currentTrack.value);
      await playTrack(playlist.value[previousIndex], { force: true });
      rebuildSequentialQueue();
    }
  }

  function restart() {
    seek(0);
    play();
  }

  function toggleShuffle() {
    isShuffle.value = !isShuffle.value;

    if (isShuffle.value) {
      playbackQueue.value = buildShuffledQueue(playlist.value, currentTrackIndex.value);
    } else {
      rebuildSequentialQueue();
    }
  }

  function toggleRepeat() {
    if (repeatMode.value === 'off') {
      repeatMode.value = 'one';
    } else if (repeatMode.value === 'one') {
      repeatMode.value = 'all';
    } else {
      repeatMode.value = 'off';
    }
  }

  const currentTrackIndex = computed(() =>
    playlist.value.findIndex((t) => t.id === currentTrack.value?.id)
  );

  const hasNext = computed(() => {
    if (playbackQueue.value.length > 0) return true;
    if (repeatMode.value === 'all' && playlist.value.length > 0) return true;
    return false;
  });

  const hasPrevious = computed(() => {
    if (!currentTrack.value) return false;
    if (isShuffle.value) return playHistory.value.length > 0;
    return currentTrackIndex.value > 0 || (repeatMode.value === 'all' && playlist.value.length > 0);
  });

  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  const formattedCurrentTime = computed(() => {
    return formatTime(currentTime.value);
  });

  const formattedDuration = computed(() => {
    return formatTime(duration.value);
  });

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  watch(volume, (newVolume) => {
    if (audioElement.value) {
      audioElement.value.volume = newVolume;
    }
  });

  watch(isMuted, (newMuted) => {
    if (audioElement.value) {
      audioElement.value.muted = newMuted;
    }
  });

  return {
    currentTrack,
    playlist,
    currentTrackIndex,
    hasNext,
    hasPrevious,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    progress,
    formattedCurrentTime,
    formattedDuration,
    playTrack,
    playPlaylist,
    playNext,
    playPrevious,
    togglePlayPause,
    toggleShuffle,
    toggleRepeat,
    pause,
    play,
    seek,
    restart,
    setVolume,
    toggleMute,
    stop,
  };
}
