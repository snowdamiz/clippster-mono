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
const shuffledPlaylist = ref<AudioTrack[]>([]);
const currentTrackIndex = ref(0);
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
        // Handle repeat one mode
        if (repeatMode.value === 'one') {
          audioElement.value!.currentTime = 0;
          audioElement.value!.play();
          return;
        }
        
        const activePlaylist = isShuffle.value && shuffledPlaylist.value.length > 0 
          ? shuffledPlaylist.value 
          : playlist.value;
        
        // Auto-advance to next track if in playlist
        if (activePlaylist.length > 0 && currentTrackIndex.value < activePlaylist.length - 1) {
          playNext();
        } else if (repeatMode.value === 'all' && activePlaylist.length > 0) {
          // Restart playlist from beginning
          currentTrackIndex.value = 0;
          playTrack(activePlaylist[0]);
        } else {
          isPlaying.value = false;
          currentTime.value = 0;
        }
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
    playlist.value = [];
    currentTrackIndex.value = 0;
  }

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async function playPlaylist(tracks: AudioTrack[], startIndex = 0) {
    if (tracks.length === 0) return;
    
    playlist.value = tracks;
    
    if (isShuffle.value) {
      // Create shuffled version
      shuffledPlaylist.value = shuffleArray(tracks);
      currentTrackIndex.value = 0;
      await playTrack(shuffledPlaylist.value[0]);
    } else {
      shuffledPlaylist.value = [];
      currentTrackIndex.value = startIndex;
      await playTrack(tracks[startIndex]);
    }
  }

  async function playNext() {
    const activePlaylist = isShuffle.value && shuffledPlaylist.value.length > 0 
      ? shuffledPlaylist.value 
      : playlist.value;
    
    if (activePlaylist.length === 0) return;
    
    const nextIndex = currentTrackIndex.value + 1;
    if (nextIndex < activePlaylist.length) {
      currentTrackIndex.value = nextIndex;
      await playTrack(activePlaylist[nextIndex]);
    }
  }

  async function playPrevious() {
    const activePlaylist = isShuffle.value && shuffledPlaylist.value.length > 0 
      ? shuffledPlaylist.value 
      : playlist.value;
    
    if (activePlaylist.length === 0) return;
    
    const prevIndex = currentTrackIndex.value - 1;
    if (prevIndex >= 0) {
      currentTrackIndex.value = prevIndex;
      await playTrack(activePlaylist[prevIndex]);
    }
  }

  function toggleShuffle() {
    isShuffle.value = !isShuffle.value;
    
    // If turning shuffle on and we have a playlist, create shuffled version
    if (isShuffle.value && playlist.value.length > 0) {
      shuffledPlaylist.value = shuffleArray(playlist.value);
      // Find current track in shuffled playlist and update index
      const currentTrackId = currentTrack.value?.id;
      if (currentTrackId) {
        const newIndex = shuffledPlaylist.value.findIndex(t => t.id === currentTrackId);
        if (newIndex !== -1) {
          currentTrackIndex.value = newIndex;
        }
      }
    } else {
      // Turning shuffle off - find current track in original playlist
      const currentTrackId = currentTrack.value?.id;
      if (currentTrackId && playlist.value.length > 0) {
        const newIndex = playlist.value.findIndex(t => t.id === currentTrackId);
        if (newIndex !== -1) {
          currentTrackIndex.value = newIndex;
        }
      }
      shuffledPlaylist.value = [];
    }
  }

  function toggleRepeat() {
    if (repeatMode.value === 'off') {
      repeatMode.value = 'all';
    } else if (repeatMode.value === 'all') {
      repeatMode.value = 'one';
    } else {
      repeatMode.value = 'off';
    }
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
    playlist,
    currentTrackIndex,
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
    setVolume,
    toggleMute,
    stop,
  };
}
