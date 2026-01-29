import type { Ref } from 'vue';
import type { VideoEditorAudioTrackRecord } from '@/services/database/video-editor-edits';

/**
 * Options for useAudioTrackToggles
 */
export interface AudioTrackTogglesOptions {
  /** Function to get track by ID (from usePanelCRUD) */
  getById: (id: string) => VideoEditorAudioTrackRecord | undefined;
  /** Function to update track (from usePanelCRUD) */
  updateTrack: (id: string, data: Partial<VideoEditorAudioTrackRecord>) => Promise<void>;
}

/**
 * Return type for useAudioTrackToggles
 */
export interface AudioTrackTogglesReturn {
  /** Toggle mute state for a track */
  toggleMute: (trackId: string) => Promise<void>;
  /** Toggle solo state for a track */
  toggleSolo: (trackId: string) => Promise<void>;
}

/**
 * useAudioTrackToggles - Extract track toggle logic
 *
 * Extracted from AudioPanel.vue:
 * - toggleTrackMute() lines 270-275
 * - toggleTrackSolo() lines 277-281
 *
 * This composable handles:
 * - Reading current track state before toggling
 * - Updating track mute/solo state in database
 *
 * Usage:
 * ```ts
 * const { getById, update: updateTrack } = useAudioTracksCRUD(editIdRef);
 *
 * const { toggleMute, toggleSolo } = useAudioTrackToggles({
 *   getById,
 *   updateTrack,
 * });
 *
 * // In template
 * <button @click="toggleMute(track.id)">Mute</button>
 * <button @click="toggleSolo(track.id)">Solo</button>
 * ```
 */
export function useAudioTrackToggles(
  options: AudioTrackTogglesOptions
): AudioTrackTogglesReturn {
  const { getById, updateTrack } = options;

  /**
   * Toggle mute state for a track
   * @param trackId - ID of the track to toggle
   */
  async function toggleMute(trackId: string): Promise<void> {
    const track = getById(trackId);
    if (track) {
      await updateTrack(trackId, { is_muted: track.is_muted ? 0 : 1 });
    }
  }

  /**
   * Toggle solo state for a track
   * @param trackId - ID of the track to toggle
   */
  async function toggleSolo(trackId: string): Promise<void> {
    const track = getById(trackId);
    if (track) {
      await updateTrack(trackId, { is_solo: track.is_solo ? 0 : 1 });
    }
  }

  return {
    toggleMute,
    toggleSolo,
  };
}
