import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { ActiveAudioTrack } from './useTimelineRenderer';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Audio source entry in the mixer
 */
interface AudioSourceEntry {
  id: string;
  element: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
  filePath: string;
  isConnected: boolean;
}

/**
 * Audio mixer options
 */
export interface AudioMixerOptions {
  /** Initial master volume (0-1, default: 1) */
  initialVolume?: number;
  /** Sync tolerance in seconds (default: 0.1) */
  syncTolerance?: number;
}

/**
 * Audio mixer return type
 */
export interface AudioMixerReturn {
  // State
  masterVolume: Ref<number>;
  isMuted: Ref<boolean>;
  isInitialized: Ref<boolean>;

  // Control
  initialize: () => Promise<void>;
  syncToTime: (time: number, activeTracks: ActiveAudioTrack[], isPlaying: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;

  // Video audio control
  connectVideoElement: (video: HTMLVideoElement) => void;
  disconnectVideoElement: () => void;
  setVideoVolume: (volume: number) => void;
  setVideoMuted: (muted: boolean) => void;

  // Cleanup
  dispose: () => void;
}

/**
 * Audio mixer composable
 * 
 * Manages all audio playback using Web Audio API.
 * Driven by the playback engine's timeline clock.
 * 
 * Key principles:
 * 1. Single AudioContext for all audio
 * 2. Video audio routed through gain node for volume control
 * 3. Each audio track has its own MediaElementSource + GainNode
 * 4. syncToTime() is called every frame to keep audio in sync
 */
export function useAudioMixer(options: AudioMixerOptions = {}): AudioMixerReturn {
  const { initialVolume = 1, syncTolerance = 0.1 } = options;

  // State
  const masterVolume = ref(initialVolume);
  const isMuted = ref(false);
  const isInitialized = ref(false);

  // Web Audio API
  let audioContext: AudioContext | null = null;
  let masterGainNode: GainNode | null = null;

  // Video audio
  let videoElement: HTMLVideoElement | null = null;
  let videoSourceNode: MediaElementAudioSourceNode | null = null;
  let videoGainNode: GainNode | null = null;
  const videoVolume = ref(1);
  const videoMuted = ref(false);

  // Audio track sources
  const audioSources = new Map<string, AudioSourceEntry>();

  /**
   * Initialize the audio context
   * Must be called after user interaction (browser autoplay policy)
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) return;

    try {
      audioContext = new AudioContext();

      // Create master gain node
      masterGainNode = audioContext.createGain();
      masterGainNode.gain.value = isMuted.value ? 0 : masterVolume.value;
      masterGainNode.connect(audioContext.destination);

      // Resume context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      isInitialized.value = true;
    } catch (error) {
      console.error('[AudioMixer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Connect a video element's audio to the mixer
   */
  function connectVideoElement(video: HTMLVideoElement): void {
    if (!audioContext || !masterGainNode) {
      console.warn('[AudioMixer] Cannot connect video: not initialized');
      return;
    }

    // Disconnect existing video if any
    disconnectVideoElement();

    videoElement = video;

    try {
      // Create source node from video element
      videoSourceNode = audioContext.createMediaElementSource(video);

      // Create gain node for video volume control
      videoGainNode = audioContext.createGain();
      videoGainNode.gain.value = videoMuted.value ? 0 : videoVolume.value;

      // Connect: video -> videoGain -> masterGain -> destination
      videoSourceNode.connect(videoGainNode);
      videoGainNode.connect(masterGainNode);
    } catch (error) {
      // Video element might already be connected to another context
      console.warn('[AudioMixer] Could not connect video element:', error);
    }
  }

  /**
   * Disconnect the video element from the mixer
   */
  function disconnectVideoElement(): void {
    if (videoSourceNode) {
      try {
        videoSourceNode.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      videoSourceNode = null;
    }

    if (videoGainNode) {
      try {
        videoGainNode.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      videoGainNode = null;
    }

    videoElement = null;
  }

  /**
   * Set video volume (0-1)
   */
  function setVideoVolume(volume: number): void {
    videoVolume.value = Math.max(0, Math.min(1, volume));
    if (videoGainNode && !videoMuted.value) {
      videoGainNode.gain.value = videoVolume.value;
    }
  }

  /**
   * Set video muted state
   */
  function setVideoMuted(muted: boolean): void {
    videoMuted.value = muted;
    if (videoGainNode) {
      videoGainNode.gain.value = muted ? 0 : videoVolume.value;
    }
  }

  /**
   * Get or create an audio source for a track
   */
  function getOrCreateAudioSource(track: ActiveAudioTrack): AudioSourceEntry | null {
    if (!audioContext || !masterGainNode) return null;

    let entry = audioSources.get(track.id);

    // Check if we need to create or recreate the source
    if (!entry || entry.filePath !== track.filePath) {
      // Remove old entry if exists
      if (entry) {
        cleanupAudioSource(entry);
        audioSources.delete(track.id);
      }

      // Create new audio element
      const element = new Audio();
      
      // Convert file path to proper URL using Tauri's convertFileSrc
      // This is required for Tauri to serve local files to the browser
      const audioUrl = convertFileSrc(track.filePath);
      
      element.src = audioUrl;
      element.preload = 'auto';
      element.crossOrigin = 'anonymous';
      
      console.log('[AudioMixer] Loading audio track:', track.id, 'from', audioUrl);

      entry = {
        id: track.id,
        element,
        sourceNode: null,
        gainNode: null,
        filePath: track.filePath,
        isConnected: false,
      };

      audioSources.set(track.id, entry);
      
      // Listen for load events to debug
      element.addEventListener('loadeddata', () => {
        console.log('[AudioMixer] Audio loaded successfully:', track.id, 'duration:', element.duration);
      });
      
      element.addEventListener('error', (e) => {
        console.error('[AudioMixer] Failed to load audio:', track.id, e);
      });
    }

    // Connect to Web Audio if not already connected
    if (!entry.isConnected && entry.element.readyState >= 2) {
      try {
        entry.sourceNode = audioContext.createMediaElementSource(entry.element);
        entry.gainNode = audioContext.createGain();
        entry.sourceNode.connect(entry.gainNode);
        entry.gainNode.connect(masterGainNode);
        entry.isConnected = true;
      } catch (error) {
        console.warn('[AudioMixer] Could not connect audio track:', track.id, error);
      }
    }

    return entry;
  }

  /**
   * Cleanup an audio source entry
   */
  function cleanupAudioSource(entry: AudioSourceEntry): void {
    try {
      entry.element.pause();
      entry.element.src = '';
      entry.sourceNode?.disconnect();
      entry.gainNode?.disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  /**
   * Sync all audio to the given timeline time
   * Called every frame by the playback engine
   */
  function syncToTime(time: number, activeTracks: ActiveAudioTrack[], isPlaying: boolean): void {
    if (!audioContext || !masterGainNode) {
      console.warn('[AudioMixer] Cannot sync: not initialized');
      return;
    }

    // Resume context if needed
    if (audioContext.state === 'suspended' && isPlaying) {
      console.log('[AudioMixer] Resuming suspended audio context');
      audioContext.resume();
    }

    // Log active tracks for debugging
    if (activeTracks.length > 0) {
      console.log('[AudioMixer] Syncing', activeTracks.length, 'active tracks at time', time, 'isPlaying:', isPlaying);
    }

    // Track which sources are still active
    const activeIds = new Set(activeTracks.map((t) => t.id));

    // Pause sources that are no longer active
    for (const [id, entry] of audioSources) {
      if (!activeIds.has(id) && !entry.element.paused) {
        console.log('[AudioMixer] Pausing inactive track:', id);
        entry.element.pause();
      }
    }

    // Sync active tracks
    for (const track of activeTracks) {
      const entry = getOrCreateAudioSource(track);
      if (!entry) {
        console.warn('[AudioMixer] Could not get audio source for track:', track.id);
        continue;
      }

      console.log('[AudioMixer] Track', track.id, '- readyState:', entry.element.readyState, 'paused:', entry.element.paused, 'audioTime:', track.audioTime);

      // Update gain
      if (entry.gainNode) {
        entry.gainNode.gain.value = track.computedVolume;
      }

      // Sync time if drifted too far
      const drift = Math.abs(entry.element.currentTime - track.audioTime);
      if (drift > syncTolerance) {
        console.log('[AudioMixer] Syncing time for track', track.id, 'from', entry.element.currentTime, 'to', track.audioTime);
        entry.element.currentTime = track.audioTime;
      }

      // Sync play state
      if (isPlaying && entry.element.paused && entry.element.readyState >= 2) {
        console.log('[AudioMixer] Playing track:', track.id);
        entry.element.play().catch((err) => {
          console.error('[AudioMixer] Failed to play track:', track.id, err);
        });
      } else if (!isPlaying && !entry.element.paused) {
        console.log('[AudioMixer] Pausing track:', track.id);
        entry.element.pause();
      } else if (isPlaying && entry.element.paused && entry.element.readyState < 2) {
        console.warn('[AudioMixer] Track not ready to play:', track.id, 'readyState:', entry.element.readyState);
      }
    }
  }

  /**
   * Set master volume (0-1)
   */
  function setMasterVolume(volume: number): void {
    masterVolume.value = Math.max(0, Math.min(1, volume));
    if (masterGainNode && !isMuted.value) {
      masterGainNode.gain.value = masterVolume.value;
    }
  }

  /**
   * Set muted state
   */
  function setMuted(muted: boolean): void {
    isMuted.value = muted;
    if (masterGainNode) {
      masterGainNode.gain.value = muted ? 0 : masterVolume.value;
    }
  }

  /**
   * Toggle mute
   */
  function toggleMute(): void {
    setMuted(!isMuted.value);
  }

  /**
   * Cleanup all resources
   */
  function dispose(): void {
    // Cleanup all audio sources
    for (const entry of audioSources.values()) {
      cleanupAudioSource(entry);
    }
    audioSources.clear();

    // Disconnect video
    disconnectVideoElement();

    // Close audio context
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }

    masterGainNode = null;
    isInitialized.value = false;
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    dispose();
  });

  return {
    // State
    masterVolume,
    isMuted,
    isInitialized,

    // Control
    initialize,
    syncToTime,
    setMasterVolume,
    setMuted,
    toggleMute,

    // Video audio
    connectVideoElement,
    disconnectVideoElement,
    setVideoVolume,
    setVideoMuted,

    // Cleanup
    dispose,
  };
}
