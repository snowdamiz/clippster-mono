import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { ActiveAudioTrack } from './useTimelineRenderer';
import { invoke } from '@tauri-apps/api/core';

// Video server port for streaming audio files
let videoServerPort: number | null = null;

/**
 * Get the streaming server URL for a local file path.
 * This bypasses the asset protocol scope restrictions.
 */
async function getStreamingUrl(filePath: string): Promise<string> {
  if (videoServerPort === null) {
    try {
      videoServerPort = await invoke<number>('get_video_server_port');
    } catch (error) {
      console.error('[AudioMixer] Failed to get video server port:', error);
      // Fallback to default port
      videoServerPort = 48276;
    }
  }
  
  // Encode the path as base64 for the streaming server
  const encodedPath = btoa(unescape(encodeURIComponent(filePath)));
  return `http://localhost:${videoServerPort}/video/${encodedPath}`;
}

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

  // Video/Audio element control
  connectVideoElement: (element: HTMLVideoElement | HTMLAudioElement) => void;
  disconnectVideoElement: () => void;
  setVideoVolume: (volume: number) => void;
  setVideoMuted: (muted: boolean) => void;

  // Individual track control
  setTrackVolume: (trackId: string, volume: number) => void;
  clearTrackVolumeOverride: (trackId: string) => void;
  setTrackMuted: (trackId: string, muted: boolean) => void;

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
  let videoElement: HTMLVideoElement | HTMLAudioElement | null = null;
  let videoSourceNode: MediaElementAudioSourceNode | null = null;
  let videoGainNode: GainNode | null = null;
  const videoVolume = ref(1);
  const videoMuted = ref(false);

  // Audio track sources
  const audioSources = new Map<string, AudioSourceEntry>();
  
  // Manual volume overrides (prevents syncToTime from overwriting user changes)
  const manualVolumeOverrides = new Map<string, number>();

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
   * Connect a video or audio element to the mixer
   */
  function connectVideoElement(element: HTMLVideoElement | HTMLAudioElement): void {
    if (!audioContext || !masterGainNode) {
      console.warn('[AudioMixer] Cannot connect element: not initialized');
      return;
    }

    // Disconnect existing video if any
    disconnectVideoElement();

    videoElement = element;

    try {
      // Create source node from video/audio element
      videoSourceNode = audioContext.createMediaElementSource(element);

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
      element.preload = 'auto';
      element.crossOrigin = 'anonymous';
      
      // Listen for load events to debug
      element.addEventListener('loadeddata', () => {
        console.log('[AudioMixer] Audio loaded successfully:', track.id, 'duration:', element.duration);
      });
      
      element.addEventListener('canplaythrough', () => {
        console.log('[AudioMixer] Audio can play through:', track.id);
      });
      
      element.addEventListener('error', (e) => {
        console.error('[AudioMixer] Failed to load audio:', track.id, 'error:', element.error?.message || 'unknown', e);
      });

      entry = {
        id: track.id,
        element,
        sourceNode: null,
        gainNode: null,
        filePath: track.filePath,
        isConnected: false,
      };

      audioSources.set(track.id, entry);
      
      // Get streaming URL and set src - this triggers loading
      getStreamingUrl(track.filePath).then(audioUrl => {
        console.log('[AudioMixer] Setting audio src:', track.id, 'from', audioUrl);
        element.src = audioUrl;
        element.load(); // Explicitly trigger loading
      }).catch(err => {
        console.error('[AudioMixer] Failed to get streaming URL for track:', track.id, err);
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

    // Log active tracks for debugging (only occasionally to reduce spam)
    if (activeTracks.length > 0 && Math.floor(time * 2) !== Math.floor((time - 0.5) * 2)) {
      console.log('[AudioMixer] Syncing', activeTracks.length, 'active tracks at time', time.toFixed(2), 'isPlaying:', isPlaying);
      // Log each track's status
      for (const track of activeTracks) {
        const entry = audioSources.get(track.id);
        console.log(`[AudioMixer]   Track ${track.id.slice(0, 8)}... readyState=${entry?.element.readyState ?? 'N/A'} src=${entry?.element.src ? 'SET' : 'EMPTY'} volume=${track.computedVolume.toFixed(2)}`);
      }
    }

    // Track which sources are still active
    const activeIds = new Set(activeTracks.map((t) => t.id));

    // Pause sources that are no longer active and clear manual overrides
    for (const [id, entry] of audioSources) {
      if (!activeIds.has(id)) {
        if (!entry.element.paused) {
          console.log('[AudioMixer] Pausing inactive track:', id);
          entry.element.pause();
        }
        // Clear manual volume override when track becomes inactive
        manualVolumeOverrides.delete(id);
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

      // Update gain (skip entirely if manual override is active to avoid interference)
      if (entry.gainNode && audioContext) {
        const manualVolume = manualVolumeOverrides.get(track.id);
        const currentGain = entry.gainNode.gain.value;
        
        // If there's a manual override, don't touch the gain at all
        // The manual override from setTrackVolume() is controlling it
        if (manualVolume === undefined) {
          // No manual override - use computed volume from timeline
          const targetVolume = track.computedVolume;
          
          // Only update if the volume has changed significantly (avoid unnecessary updates)
          if (Math.abs(currentGain - targetVolume) > 0.001) {
            console.log(`[AudioMixer] syncToTime updating gain: ${track.id.slice(0,8)} from ${currentGain.toFixed(3)} to ${targetVolume.toFixed(3)} (NO OVERRIDE)`);
            // Set directly without ramping since this is from timeline data
            entry.gainNode.gain.value = targetVolume;
          }
        } else {
          console.log(`[AudioMixer] syncToTime SKIPPING gain update: ${track.id.slice(0,8)} has manual override=${manualVolume.toFixed(3)}, current=${currentGain.toFixed(3)}`);
        }
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
   * Update a specific track's volume in real-time
   * This allows immediate volume changes during playback without waiting for syncToTime
   * Sets a manual override that persists until the track becomes inactive or is cleared
   */
  function setTrackVolume(trackId: string, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(2, volume));
    
    // Store manual override to prevent syncToTime from overwriting
    manualVolumeOverrides.set(trackId, clampedVolume);
    
    // Apply immediately if track is loaded
    const entry = audioSources.get(trackId);
    if (entry && entry.gainNode) {
      // Set volume instantly - no ramping, no automation
      // This ensures real-time response as the user drags the slider
      entry.gainNode.gain.value = clampedVolume;
      console.log('[AudioMixer] Set track volume:', trackId, 'to', clampedVolume);
    } else {
      console.log('[AudioMixer] Queued track volume:', trackId, 'to', clampedVolume, '(track not loaded yet)');
    }
  }

  /**
   * Clear a manual volume override for a track
   * After this, the track will use the computed volume from the timeline
   */
  function clearTrackVolumeOverride(trackId: string): void {
    const hadOverride = manualVolumeOverrides.has(trackId);
    const overrideValue = manualVolumeOverrides.get(trackId);
    if (manualVolumeOverrides.delete(trackId)) {
      console.log(`[AudioMixer] ⚠️ CLEARED volume override for track: ${trackId.slice(0,8)} (was ${overrideValue?.toFixed(3)})`);
      console.trace('[AudioMixer] Clear override called from:');
    }
  }

  /**
   * Update a specific track's muted state in real-time
   */
  function setTrackMuted(trackId: string, muted: boolean): void {
    const entry = audioSources.get(trackId);
    if (entry && entry.gainNode) {
      // Store the current volume to restore later
      const currentVolume = entry.gainNode.gain.value;
      entry.gainNode.gain.value = muted ? 0 : currentVolume;
      console.log('[AudioMixer] Set track muted:', trackId, 'to', muted);
    }
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
    
    // Clear manual overrides
    manualVolumeOverrides.clear();

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

    // Individual track control
    setTrackVolume,
    clearTrackVolumeOverride,
    setTrackMuted,

    // Cleanup
    dispose,
  };
}
