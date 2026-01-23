/**
 * useAudioTrackCreation - Audio track creation workflow from file selection
 *
 * Extracted from AudioPanel.vue to centralize the audio file selection,
 * duration retrieval, and track creation workflow.
 */

import { ref, type Ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { extractFileName } from './useEditorFormatters';

/** Supported audio file extensions */
export const AUDIO_FILE_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];

/** Default values for new audio tracks */
export const DEFAULT_AUDIO_TRACK_VALUES = {
  volume: 1.0,
  pan: 0,
  fade_in: 0,
  fade_out: 0,
  is_muted: 0,
  is_solo: 0,
} as const;

export interface AudioTrackData {
  file_path: string;
  name: string;
  start_time: number;
  end_time: number;
  volume: number;
  pan: number;
  fade_in: number;
  fade_out: number;
  track_order: number;
  is_muted: number;
  is_solo: number;
}

export interface AudioTrackCreationOptions {
  /** Function to create the track in the database */
  createTrack: (data: AudioTrackData) => Promise<any>;
  /** Current number of audio tracks (for track_order) */
  currentTrackCount: Ref<number>;
  /** Callback when track is successfully created */
  onTrackCreated?: (filePath: string) => void;
  /** Callback when an error occurs */
  onError?: (error: unknown) => void;
}

export interface AudioTrackCreationReturn {
  /** Whether a file is currently being processed */
  isProcessing: Ref<boolean>;
  /** Open file dialog and create audio track */
  addMusicTrack: () => Promise<void>;
  /** Create audio track from a given file path */
  createTrackFromFile: (filePath: string) => Promise<void>;
  /** Get audio duration for a file */
  getAudioDuration: (filePath: string) => Promise<number>;
  /** Build track data from file path and duration */
  buildTrackData: (filePath: string, duration: number, trackOrder: number) => AudioTrackData;
}

/**
 * Composable for audio track creation workflow
 */
export function useAudioTrackCreation(options: AudioTrackCreationOptions): AudioTrackCreationReturn {
  const { createTrack, currentTrackCount, onTrackCreated, onError } = options;

  const isProcessing = ref(false);

  /**
   * Get audio duration from a file using Tauri command
   */
  async function getAudioDuration(filePath: string): Promise<number> {
    return await invoke<number>('get_audio_duration', { filePath });
  }

  /**
   * Build track data from file path and duration
   */
  function buildTrackData(filePath: string, duration: number, trackOrder: number): AudioTrackData {
    return {
      file_path: filePath,
      name: extractFileName(filePath, false) || 'Music',
      start_time: 0,
      end_time: duration,
      track_order: trackOrder,
      ...DEFAULT_AUDIO_TRACK_VALUES,
    };
  }

  /**
   * Create audio track from a given file path
   */
  async function createTrackFromFile(filePath: string): Promise<void> {
    isProcessing.value = true;

    try {
      const duration = await getAudioDuration(filePath);
      const trackData = buildTrackData(filePath, duration, currentTrackCount.value);

      await createTrack(trackData);

      onTrackCreated?.(filePath);
    } catch (error) {
      console.error('[useAudioTrackCreation] Failed to create track:', error);
      onError?.(error);
    } finally {
      isProcessing.value = false;
    }
  }

  /**
   * Open file dialog and create audio track
   */
  async function addMusicTrack(): Promise<void> {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Audio',
            extensions: AUDIO_FILE_EXTENSIONS,
          },
        ],
      });

      if (!selected) return;

      const filePath = selected as string;
      await createTrackFromFile(filePath);
    } catch (error) {
      console.error('[useAudioTrackCreation] Failed to open file dialog:', error);
      onError?.(error);
    }
  }

  return {
    isProcessing,
    addMusicTrack,
    createTrackFromFile,
    getAudioDuration,
    buildTrackData,
  };
}
