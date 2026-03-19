import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DownloadedAudio } from '@/services/database/types';

export type RepeatMode = 'off' | 'all' | 'one';

export const useAudioPlayerStore = defineStore('audioPlayer', () => {
  // State
  const currentPlaylist = ref<DownloadedAudio[]>([]);
  const currentTrackIndex = ref(0);
  const isPlaying = ref(false);
  const volume = ref(0.7);
  const isMuted = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const shuffleMode = ref(false);
  const repeatMode = ref<RepeatMode>('off');
  const shuffledIndices = ref<number[]>([]);
  
  // Audio element (created on demand)
  let audioElement: HTMLAudioElement | null = null;

  // Computed
  const currentTrack = computed(() => {
    if (currentPlaylist.value.length === 0) return null;
    const index = shuffleMode.value 
      ? shuffledIndices.value[currentTrackIndex.value] 
      : currentTrackIndex.value;
    return currentPlaylist.value[index] || null;
  });

  const hasNext = computed(() => {
    if (currentPlaylist.value.length === 0) return false;
    if (repeatMode.value === 'all') return true;
    return currentTrackIndex.value < currentPlaylist.value.length - 1;
  });

  const hasPrevious = computed(() => {
    if (currentPlaylist.value.length === 0) return false;
    if (repeatMode.value === 'all') return true;
    return currentTrackIndex.value > 0;
  });

  // Initialize audio element
  function initAudioElement() {
    if (audioElement) return audioElement;

    audioElement = new Audio();
    audioElement.volume = isMuted.value ? 0 : volume.value;

    // Event listeners
    audioElement.addEventListener('timeupdate', () => {
      currentTime.value = audioElement!.currentTime;
    });

    audioElement.addEventListener('durationchange', () => {
      duration.value = audioElement!.duration || 0;
    });

    audioElement.addEventListener('ended', () => {
      handleTrackEnded();
    });

    audioElement.addEventListener('play', () => {
      isPlaying.value = true;
    });

    audioElement.addEventListener('pause', () => {
      isPlaying.value = false;
    });

    audioElement.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      isPlaying.value = false;
    });

    return audioElement;
  }

  // Load and play a track
  async function loadTrack(track: DownloadedAudio) {
    const audio = initAudioElement();
    
    try {
      // Use Tauri's convertFileSrc to get the proper URL
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      const audioUrl = convertFileSrc(track.file_path);
      
      audio.src = audioUrl;
      await audio.load();
    } catch (error) {
      console.error('Failed to load track:', error);
      throw error;
    }
  }

  // Play/pause
  async function togglePlay() {
    if (!currentTrack.value) return;

    const audio = initAudioElement();

    if (isPlaying.value) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
      }
    }
  }

  // Play a specific track
  async function playTrack(index: number) {
    if (index < 0 || index >= currentPlaylist.value.length) return;

    currentTrackIndex.value = index;
    const track = currentTrack.value;
    
    if (!track) return;

    try {
      await loadTrack(track);
      const audio = initAudioElement();
      await audio.play();
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  }

  // Next track
  async function nextTrack() {
    if (!hasNext.value) return;

    if (currentTrackIndex.value >= currentPlaylist.value.length - 1) {
      if (repeatMode.value === 'all') {
        await playTrack(0);
      }
    } else {
      await playTrack(currentTrackIndex.value + 1);
    }
  }

  // Previous track
  async function previousTrack() {
    if (!hasPrevious.value) return;

    // If we're more than 3 seconds into the track, restart it
    if (currentTime.value > 3) {
      seek(0);
      return;
    }

    if (currentTrackIndex.value <= 0) {
      if (repeatMode.value === 'all') {
        await playTrack(currentPlaylist.value.length - 1);
      }
    } else {
      await playTrack(currentTrackIndex.value - 1);
    }
  }

  // Handle track ended
  async function handleTrackEnded() {
    if (repeatMode.value === 'one') {
      // Repeat current track
      const audio = initAudioElement();
      audio.currentTime = 0;
      await audio.play();
    } else if (hasNext.value) {
      await nextTrack();
    } else {
      // Playlist ended
      isPlaying.value = false;
    }
  }

  // Seek to position
  function seek(time: number) {
    const audio = initAudioElement();
    audio.currentTime = time;
    currentTime.value = time;
  }

  // Set volume
  function setVolume(newVolume: number) {
    volume.value = Math.max(0, Math.min(1, newVolume));
    const audio = initAudioElement();
    if (!isMuted.value) {
      audio.volume = volume.value;
    }
    savePlayerState();
  }

  // Toggle mute
  function toggleMute() {
    isMuted.value = !isMuted.value;
    const audio = initAudioElement();
    audio.volume = isMuted.value ? 0 : volume.value;
    savePlayerState();
  }

  // Toggle shuffle
  function toggleShuffle() {
    shuffleMode.value = !shuffleMode.value;
    
    if (shuffleMode.value) {
      // Generate shuffled indices
      shuffledIndices.value = Array.from({ length: currentPlaylist.value.length }, (_, i) => i);
      
      // Fisher-Yates shuffle
      for (let i = shuffledIndices.value.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndices.value[i], shuffledIndices.value[j]] = 
          [shuffledIndices.value[j], shuffledIndices.value[i]];
      }
      
      // Find current track in shuffled array and make it the current index
      const currentActualIndex = currentTrackIndex.value;
      const newIndex = shuffledIndices.value.indexOf(currentActualIndex);
      if (newIndex !== -1) {
        currentTrackIndex.value = newIndex;
      }
    } else {
      // Return to normal order
      if (shuffledIndices.value.length > 0) {
        currentTrackIndex.value = shuffledIndices.value[currentTrackIndex.value];
      }
      shuffledIndices.value = [];
    }
    
    savePlayerState();
  }

  // Cycle repeat mode
  function cycleRepeatMode() {
    if (repeatMode.value === 'off') {
      repeatMode.value = 'all';
    } else if (repeatMode.value === 'all') {
      repeatMode.value = 'one';
    } else {
      repeatMode.value = 'off';
    }
    savePlayerState();
  }

  // Load playlist and start playing
  async function loadPlaylist(tracks: DownloadedAudio[], startIndex = 0) {
    currentPlaylist.value = tracks;
    currentTrackIndex.value = startIndex;
    shuffledIndices.value = [];
    
    if (shuffleMode.value) {
      toggleShuffle(); // Re-shuffle with new playlist
    }
    
    await playTrack(startIndex);
  }

  // Clear playlist
  function clearPlaylist() {
    const audio = initAudioElement();
    audio.pause();
    audio.src = '';
    
    currentPlaylist.value = [];
    currentTrackIndex.value = 0;
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    shuffledIndices.value = [];
  }

  // Save player state to localStorage
  function savePlayerState() {
    localStorage.setItem('audioPlayer', JSON.stringify({
      volume: volume.value,
      shuffleMode: shuffleMode.value,
      repeatMode: repeatMode.value,
    }));
  }

  // Load player state from localStorage
  function loadPlayerState() {
    try {
      const saved = localStorage.getItem('audioPlayer');
      if (saved) {
        const state = JSON.parse(saved);
        volume.value = state.volume ?? 0.7;
        shuffleMode.value = state.shuffleMode ?? false;
        repeatMode.value = state.repeatMode ?? 'off';
        
        // Apply volume to audio element if it exists
        if (audioElement) {
          audioElement.volume = isMuted.value ? 0 : volume.value;
        }
      }
    } catch (error) {
      console.error('Failed to load player state:', error);
    }
  }

  // Initialize on store creation
  loadPlayerState();

  return {
    // State
    currentPlaylist,
    currentTrackIndex,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    shuffleMode,
    repeatMode,
    
    // Computed
    currentTrack,
    hasNext,
    hasPrevious,
    
    // Actions
    togglePlay,
    playTrack,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    loadPlaylist,
    clearPlaylist,
  };
});
