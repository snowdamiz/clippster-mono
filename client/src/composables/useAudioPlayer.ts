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
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.7);
const isMuted = ref(false);
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
        isPlaying.value = false;
        currentTime.value = 0;
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

  async function playTrack(track: AudioTrack) {
    initAudioElement();
    
    if (!audioElement.value) return;
    
    // If same track, just toggle play/pause
    if (currentTrack.value?.id === track.id) {
      togglePlayPause();
      return;
    }
    
    // Load new track
    currentTrack.value = track;
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
  }

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

  // Watch volume changes
  watch(volume, (newVolume) => {
    if (audioElement.value) {
      audioElement.value.volume = newVolume;
    }
  });

  // Watch mute changes
  watch(isMuted, (newMuted) => {
    if (audioElement.value) {
      audioElement.value.muted = newMuted;
    }
  });

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    progress,
    formattedCurrentTime,
    formattedDuration,
    playTrack,
    togglePlayPause,
    pause,
    play,
    seek,
    setVolume,
    toggleMute,
    stop,
  };
}
