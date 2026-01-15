import { ref, type Ref } from 'vue';
import type { AudioTrack } from '@/types';

export interface AudioTrackPlaybackOptions {
  videoServerPort: Ref<number | null>;
  audioTracks: Ref<AudioTrack[]>;
  trackDbValues: Ref<Record<string, number>>;
  isPlaying: Ref<boolean>;
  getCurrentTime: () => number; // Returns current timeline position
}

/**
 * Composable for managing audio track playback using the Web Audio API.
 * Handles audio element creation, gain control, sync with video, and fade effects.
 */
export function useAudioTrackPlayback(options: AudioTrackPlaybackOptions) {
  const { videoServerPort, audioTracks, trackDbValues, isPlaying, getCurrentTime } = options;

  // Audio playback elements
  const audioElements = ref<Map<string, HTMLAudioElement>>(new Map());
  const audioContext = ref<AudioContext | null>(null);
  const gainNodes = ref<Map<string, GainNode>>(new Map());

  /**
   * Construct streaming URL from file path.
   */
  function getAudioStreamingUrl(filePath: string): string | null {
    // If path already looks like an HTTP URL (legacy data), use it directly
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    // Otherwise, construct the HTTP URL from the file path
    if (!videoServerPort.value) {
      console.warn('[useAudioTrackPlayback] Video server port not available for audio streaming');
      return null;
    }

    const encodedPath = btoa(unescape(encodeURIComponent(filePath)));
    return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  }

  /**
   * Set up audio element for a track with Web Audio API nodes.
   */
  async function setupAudioElement(track: AudioTrack): Promise<void> {
    // Initialize audio context if not already
    if (!audioContext.value) {
      audioContext.value = new AudioContext();
    }

    // Construct the streaming URL from the file path
    const audioSrc = getAudioStreamingUrl(track.filePath);
    if (!audioSrc) {
      console.error(
        '[useAudioTrackPlayback] Failed to get audio streaming URL for track:',
        track.id
      );
      return;
    }

    // Create audio element with CORS enabled for Web Audio API support
    // IMPORTANT: crossOrigin must be set BEFORE src to avoid CORS errors
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = audioSrc;
    audio.loop = true; // Loop the audio track
    audio.preload = 'auto';

    // Create Web Audio nodes for gain control
    const source = audioContext.value.createMediaElementSource(audio);
    const gainNode = audioContext.value.createGain();

    // Apply initial volume and dB gain
    const dbValue = trackDbValues.value[track.id] ?? 0;
    const linearGain = Math.pow(10, dbValue / 20);
    gainNode.gain.value = track.volume * linearGain;

    source.connect(gainNode);
    gainNode.connect(audioContext.value.destination);

    audioElements.value.set(track.id, audio);
    gainNodes.value.set(track.id, gainNode);
  }

  /**
   * Update audio element gain for a specific track.
   */
  function updateAudioGain(trackId: string): void {
    const gainNode = gainNodes.value.get(trackId);
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (!gainNode || !track) return;

    // Check if any track is soloed
    const hasSoloedTrack = audioTracks.value.some((t) => t.isSolo);
    const isMutedBySolo = hasSoloedTrack && !track.isSolo;

    const dbValue = trackDbValues.value[trackId] ?? 0;
    const linearGain = Math.pow(10, dbValue / 20);
    gainNode.gain.value = track.isMuted || isMutedBySolo ? 0 : track.volume * linearGain;
  }

  /**
   * Apply fade in/out effects to a track.
   */
  function applyFades(track: AudioTrack, currentTime: number): void {
    const gainNode = gainNodes.value.get(track.id);
    if (!gainNode) return;

    // Check if track is muted or muted by solo
    const hasSoloedTrack = audioTracks.value.some((t) => t.isSolo);
    const isMutedBySolo = hasSoloedTrack && !track.isSolo;

    if (track.isMuted || isMutedBySolo) {
      gainNode.gain.value = 0;
      return;
    }

    const dbValue = trackDbValues.value[track.id] ?? 0;
    const baseLinearGain = Math.pow(10, dbValue / 20);
    let fadeMultiplier = 1;

    const timeInTrack = currentTime - track.startTime;
    const timeFromEnd = track.endTime - currentTime;

    // Fade in
    if (track.fadeIn > 0 && timeInTrack < track.fadeIn) {
      fadeMultiplier = timeInTrack / track.fadeIn;
    }

    // Fade out
    if (track.fadeOut > 0 && timeFromEnd < track.fadeOut) {
      fadeMultiplier = Math.min(fadeMultiplier, timeFromEnd / track.fadeOut);
    }

    gainNode.gain.value = track.volume * baseLinearGain * Math.max(0, fadeMultiplier);
  }

  /**
   * Sync audio tracks with video playback.
   * Call this on each video time update.
   */
  function syncAudioWithVideo(): void {
    const currentTime = getCurrentTime();

    // Check if any track is soloed
    const hasSoloedTrack = audioTracks.value.some((t) => t.isSolo);

    audioTracks.value.forEach((track) => {
      const audio = audioElements.value.get(track.id);
      if (!audio) return;

      // Determine if track should be muted based on solo state
      // If any track is soloed, only soloed tracks should play
      const isMutedBySolo = hasSoloedTrack && !track.isSolo;

      // Check if this track should be playing at current time
      const shouldPlay =
        currentTime >= track.startTime &&
        currentTime <= track.endTime &&
        isPlaying.value &&
        !track.isMuted &&
        !isMutedBySolo;

      // Calculate the audio position within its range
      const audioTime = currentTime - track.startTime;

      if (shouldPlay) {
        // Sync audio time if it's drifted too far
        if (Math.abs(audio.currentTime - audioTime) > 0.1) {
          audio.currentTime = audioTime % audio.duration || 0;
        }

        if (audio.paused) {
          audioContext.value?.resume();
          audio.play().catch(() => {});
        }

        // Apply fade in/out
        applyFades(track, currentTime);
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    });
  }

  /**
   * Immediately apply mute/solo state to all audio tracks.
   * This ensures audio stops/starts immediately when mute/solo is toggled.
   */
  function applyMuteSoloState(): void {
    const hasSoloedTrack = audioTracks.value.some((t) => t.isSolo);

    audioTracks.value.forEach((track) => {
      const audio = audioElements.value.get(track.id);
      const gainNode = gainNodes.value.get(track.id);
      if (!audio || !gainNode) return;

      const isMutedBySolo = hasSoloedTrack && !track.isSolo;
      const shouldBeMuted = track.isMuted || isMutedBySolo;

      // Update gain immediately
      if (shouldBeMuted) {
        gainNode.gain.value = 0;
        // Pause the audio element to stop playback
        if (!audio.paused) {
          audio.pause();
        }
      } else {
        // Restore gain based on volume and dB settings
        const dbValue = trackDbValues.value[track.id] ?? 0;
        const linearGain = Math.pow(10, dbValue / 20);
        gainNode.gain.value = track.volume * linearGain;
        // Note: We don't auto-resume here - syncAudioWithVideo will handle playback start
      }
    });
  }

  /**
   * Remove an audio element for a specific track.
   */
  function removeAudioElement(trackId: string): void {
    const audio = audioElements.value.get(trackId);
    if (audio) {
      audio.pause();
      audio.src = '';
      audioElements.value.delete(trackId);
    }
    gainNodes.value.delete(trackId);
  }

  /**
   * Clean up all audio elements and Web Audio API resources.
   * Call this when the component unmounts.
   */
  function cleanup(): void {
    audioElements.value.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    audioElements.value.clear();
    gainNodes.value.clear();

    if (audioContext.value) {
      audioContext.value.close();
      audioContext.value = null;
    }
  }

  return {
    // State (exposed for debugging/testing if needed)
    audioElements,
    audioContext,
    gainNodes,

    // Methods
    getAudioStreamingUrl,
    setupAudioElement,
    updateAudioGain,
    syncAudioWithVideo,
    applyMuteSoloState,
    removeAudioElement,
    cleanup,
  };
}
