/**
 * useTimelineAudioTransform - Transform audio track database records to player format
 *
 * Extracted from ClipEditorPreview.vue to centralize the conversion
 * from database audio track records to the format expected by the audio player/mixer.
 */

import { computed, type ComputedRef, type Ref, isRef } from 'vue';

/** Audio track as stored in the database */
export interface AudioTrackRecord {
  id: string;
  file_path: string;
  start_time: number;
  end_time: number;
  volume: number;
  is_muted: number; // Database stores as 0/1
  fade_in: number;
  fade_out: number;
}

/** Audio track format for the player/mixer */
export interface PlayerAudioTrack {
  id: string;
  filePath: string;
  startTime: number;
  endTime: number;
  volume: number;
  isMuted: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

/** Timeline state structure for the renderer */
export interface TimelineAudioState {
  duration: number;
  videoSources: any[];
  audioTracks: PlayerAudioTrack[];
}

export interface TimelineAudioTransformOptions {
  /** Audio tracks from the editor edit (database format) */
  audioTracks: Ref<AudioTrackRecord[] | undefined> | AudioTrackRecord[] | undefined;
  /** Total timeline duration */
  duration: Ref<number> | number;
}

export interface TimelineAudioTransformReturn {
  /** Transformed audio tracks in player format */
  playerAudioTracks: ComputedRef<PlayerAudioTrack[]>;
  /** Full timeline state for the renderer */
  timelineState: ComputedRef<TimelineAudioState>;
  /** Transform a single audio track record to player format */
  transformTrack: (track: AudioTrackRecord) => PlayerAudioTrack;
}

/**
 * Transform a single audio track from database format to player format
 */
export function transformAudioTrack(track: AudioTrackRecord): PlayerAudioTrack {
  return {
    id: track.id,
    filePath: track.file_path,
    startTime: track.start_time,
    endTime: track.end_time,
    volume: track.volume,
    isMuted: track.is_muted === 1,
    fadeInDuration: track.fade_in,
    fadeOutDuration: track.fade_out,
  };
}

/**
 * Composable for transforming audio tracks from database to player format
 */
export function useTimelineAudioTransform(
  options: TimelineAudioTransformOptions
): TimelineAudioTransformReturn {
  const { audioTracks, duration } = options;

  const playerAudioTracks = computed<PlayerAudioTrack[]>(() => {
    const tracks = isRef(audioTracks) ? audioTracks.value : audioTracks;
    if (!tracks) return [];
    return tracks.map(transformAudioTrack);
  });

  const timelineState = computed<TimelineAudioState>(() => {
    const durationValue = isRef(duration) ? duration.value : duration;
    const tracks = playerAudioTracks.value;

    if (tracks.length > 0) {
      console.log('[useTimelineAudioTransform] Timeline state updated with', tracks.length, 'audio tracks');
    }

    return {
      duration: durationValue || 0,
      videoSources: [],
      audioTracks: tracks,
    };
  });

  return {
    playerAudioTracks,
    timelineState,
    transformTrack: transformAudioTrack,
  };
}
