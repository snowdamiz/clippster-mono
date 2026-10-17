export interface WordInfo {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordInfo[];
}

export const SHORT_VIDEO_CLIP_THRESHOLD_SECONDS = 90;
export function isShortVideoAutoClipEligible(duration: number | null | undefined): boolean {
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration < SHORT_VIDEO_CLIP_THRESHOLD_SECONDS;
}

export interface ClipSegment {
  id?: string;
  clip_version_id?: string;
  segment_index?: number;
  start_time: number;
  end_time: number;
  duration: number;
  transcript: string | null;
  created_at?: number;
}

export interface Clip {
  id: string;
  project_id: string | null;
  /** Preserved when the parent project is deleted (desktop/mobile retention). */
  project_name?: string | null;
  name: string | null;
  file_path: string;
  duration: number | null;
  start_time: number | null;
  end_time: number | null;
  current_version_id: string | null;
  detection_session_id: string | null;
  subtitle_enabled?: number | null;
  subtitle_preset_id?: string | null;
  subtitle_settings?: string | null;
  clip_text_overlay?: string | null;
  created_at: number;
  updated_at: number;
}

export interface ClipVersion {
  id: string;
  clip_id: string;
  session_id: string;
  version_number: number;
  parent_version_id: string | null;
  name: string;
  description: string | null;
  start_time: number;
  end_time: number;
  confidence_score: number | null;
  virality_score: number | null;
  relevance_score: number | null;
  detection_reason: string | null;
  tags: string | null;
  change_type: 'detected' | 'modified' | 'deleted';
  change_description: string | null;
  created_at: number;
}

export interface ClipWithVersion extends Clip {
  current_version?: ClipVersion;
  current_version_segments?: ClipSegment[];
}
