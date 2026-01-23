import { ref, type Ref } from 'vue';

/**
 * Options for useOriginalAudioControl
 */
export interface OriginalAudioControlOptions {
  /** Initial volume in dB (default: 0) */
  initialVolume?: number;
  /** Initial muted state (default: false) */
  initialMuted?: boolean;
  /** Callback when volume changes */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes */
  onMuteChange?: (muted: boolean) => void;
}

/**
 * Return type for useOriginalAudioControl
 */
export interface OriginalAudioControlReturn {
  /** Current volume in dB */
  volume: Ref<number>;
  /** Whether audio is muted */
  isMuted: Ref<boolean>;
  /** Set volume in dB */
  setVolume: (volume: number) => void;
  /** Toggle mute state */
  toggleMute: () => void;
  /** Set mute state explicitly */
  setMuted: (muted: boolean) => void;
}

/**
 * useOriginalAudioControl - Extract original audio state management
 *
 * Extracted from AudioPanel.vue:
 * - originalAudioVolume ref (line 218)
 * - originalAudioMuted ref (line 219)
 * - toggleOriginalAudioMute() (lines 265-267)
 *
 * This composable manages the state for the video's embedded audio track,
 * which is separate from the additional audio tracks added by the user.
 *
 * The "original audio" refers to the audio that comes with the video file
 * itself, as opposed to music tracks added via the audio panel.
 *
 * Usage:
 * ```ts
 * const {
 *   volume,
 *   isMuted,
 *   setVolume,
 *   toggleMute,
 * } = useOriginalAudioControl({
 *   onVolumeChange: (vol) => updatePlaybackEngine(vol),
 *   onMuteChange: (muted) => updatePlaybackEngine(muted),
 * });
 *
 * // In template
 * <input type="range" v-model.number="volume" />
 * <button @click="toggleMute">{{ isMuted ? 'Unmute' : 'Mute' }}</button>
 * ```
 */
export function useOriginalAudioControl(
  options: OriginalAudioControlOptions = {}
): OriginalAudioControlReturn {
  const {
    initialVolume = 0,
    initialMuted = false,
    onVolumeChange,
    onMuteChange,
  } = options;

  const volume = ref(initialVolume);
  const isMuted = ref(initialMuted);

  /**
   * Set volume in dB
   * @param newVolume - Volume value in dB
   */
  function setVolume(newVolume: number): void {
    volume.value = newVolume;
    onVolumeChange?.(newVolume);
  }

  /**
   * Toggle mute state
   */
  function toggleMute(): void {
    isMuted.value = !isMuted.value;
    onMuteChange?.(isMuted.value);
  }

  /**
   * Set mute state explicitly
   * @param muted - Whether to mute
   */
  function setMuted(muted: boolean): void {
    isMuted.value = muted;
    onMuteChange?.(muted);
  }

  return {
    volume,
    isMuted,
    setVolume,
    toggleMute,
    setMuted,
  };
}
