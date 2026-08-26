/** Cloud project snapshot v1 — stored in PostgreSQL, not a full SQLite dump. */

export interface ActiveVodPresetConfig {
  targetAspectRatio?: string;
  sourceRegion?: { x: number; y: number; width: number; height: number };
  targetRegion?: { x: number; y: number; width: number; height: number };
  [key: string]: unknown;
}

export interface ClipSegmentSnapshot {
  id: string;
  clip_version_id: string;
  segment_index: number;
  start_time: number;
  end_time: number;
  duration: number;
  transcript: string | null;
  created_at: number;
}

export interface ClipVersionSnapshot {
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
  segments: ClipSegmentSnapshot[];
}

export interface ClipSnapshot {
  id: string;
  project_id: string;
  name: string | null;
  duration: number | null;
  start_time: number | null;
  end_time: number | null;
  order_index: number | null;
  current_version_id: string | null;
  detection_session_id: string | null;
  subtitle_enabled: number | null;
  subtitle_preset_id: string | null;
  subtitle_settings: string | null;
  clip_text_overlay: string | null;
  created_at: number;
  updated_at: number;
  versions: ClipVersionSnapshot[];
}

export interface RawVideoSnapshot {
  id: string;
  title: string;
  duration: number | null;
  platform: string | null;
  source_url: string | null;
  cloud_media_asset_id: string | null;
  local_file_hash: string | null;
  original_filename: string | null;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  file_size: number | null;
}

export interface TranscriptSnapshot {
  id: string;
  raw_video_id: string;
  raw_json: string;
  text: string;
  language: string | null;
  duration: number | null;
  created_at: number;
  updated_at: number;
  /** gzip+base64 when raw_json exceeds 500KB */
  compressed?: boolean;
}

export interface ClipBuildSnapshot {
  id: string;
  clip_id: string;
  aspect_ratio: string | null;
  quality: string | null;
  frame_rate: number | null;
  output_format: string | null;
  include_subtitles: number | null;
  file_path: string;
  thumbnail_path: string | null;
  file_size: number | null;
  duration: number | null;
  build_number: number;
  status: string;
  error_message: string | null;
  cloud_media_asset_id: string | null;
  created_at: number;
  completed_at: number | null;
}

export interface CloudProjectSnapshot {
  schema_version: 1;
  project: {
    id: string;
    name: string;
    description: string | null;
    platform: string | null;
    active_vod_preset_id: string | null;
    active_vod_preset_config: ActiveVodPresetConfig | string | null;
    thumbnail_path: string | null;
    updated_at: number;
  };
  raw_videos: RawVideoSnapshot[];
  clips: ClipSnapshot[];
  transcripts: TranscriptSnapshot[];
  clip_builds: ClipBuildSnapshot[];
}

export type CloudSyncStatus = 'synced' | 'pending' | 'conflict' | 'local-only';

export const CLOUD_STORAGE_TIERS = {
  cloud_none: 0,
  cloud_50: 50 * 1024 * 1024 * 1024,
  cloud_200: 200 * 1024 * 1024 * 1024,
} as const;

export type CloudStorageTier = keyof typeof CLOUD_STORAGE_TIERS;
