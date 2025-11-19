// Core Database Types

export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  created_at: number;
  updated_at: number;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface Transcript {
  id: string;
  raw_video_id: string;
  raw_json: string;
  text: string;
  language: string | null;
  duration: number | null;
  created_at: number;
  updated_at: number;
}

export interface ChunkedTranscript {
  id: string;
  raw_video_id: string;
  total_chunks: number;
  chunk_duration_minutes: number;
  overlap_seconds: number;
  total_duration: number;
  language: string | null;
  is_complete: boolean;
  created_at: number;
  updated_at: number;
}

export interface TranscriptChunk {
  id: string;
  chunked_transcript_id: string;
  chunk_index: number;
  chunk_id: string;
  start_time: number;
  end_time: number;
  duration: number;
  raw_json: string;
  text: string;
  language: string | null;
  file_size: number;
  created_at: number;
}

export interface TranscriptSegment {
  id: string;
  transcript_id: string;
  clip_id: string | null;
  start_time: number;
  end_time: number;
  text: string;
  segment_index: number;
  created_at: number;
}

export interface IntroOutro {
  id: string;
  type: 'intro' | 'outro';
  name: string;
  file_path: string;
  duration: number | null;
  thumbnail_path: string | null;
  thumbnail_generation_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  created_at: number;
  updated_at: number;
}

export interface Clip {
  id: string;
  project_id: string;
  name: string | null;
  file_path: string;
  duration: number | null;
  start_time: number | null;
  end_time: number | null;
  order_index: number | null;
  intro_id: string | null;
  outro_id: string | null;
  status: 'detected' | 'generated' | 'processing' | null;
  // Build status fields
  build_status: 'pending' | 'building' | 'completed' | 'failed' | null;
  built_file_path: string | null;
  built_thumbnail_path: string | null;
  build_progress: number | null;
  build_error: string | null;
  built_at: number | null;
  built_file_size: number | null;
  built_duration: number | null;
  created_at: number;
  updated_at: number;
}

export interface Thumbnail {
  id: string;
  clip_id: string;
  file_path: string;
  width: number | null;
  height: number | null;
  created_at: number;
}

export interface RawVideo {
  id: string;
  project_id: string | null;
  file_path: string;
  original_filename: string | null;
  thumbnail_path: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  frame_rate: number | null;
  codec: string | null;
  file_size: number | null;
  original_project_id: string | null;
  created_at: number;
  updated_at: number;
  // Segment tracking fields
  source_clip_id: string | null;
  source_mint_id: string | null;
  segment_number: number | null;
  is_segment: boolean;
  segment_start_time: number | null;
  segment_end_time: number | null;
}

export interface FocalPoint {
  id: string;
  raw_video_id: string;
  time_offset: number;
  focal_x: number;
  focal_y: number;
  confidence: number;
  created_at: number;
}

export interface ClipDetectionSession {
  id: string;
  project_id: string;
  prompt: string;
  detection_model: string;
  server_response_id: string | null;
  quality_score: number | null;
  total_clips_detected: number;
  processing_time_ms: number | null;
  validation_data: string | null;
  run_color: string;
  created_at: number;
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
  relevance_score: number | null;
  detection_reason: string | null;
  tags: string | null;
  change_type: 'detected' | 'modified' | 'deleted';
  change_description: string | null;
  created_at: number;
}

export interface ClipSegment {
  id: string;
  clip_version_id: string;
  segment_index: number;
  start_time: number;
  end_time: number;
  duration: number;
  transcript: string | null;
  created_at: number;
}

export interface ClipWithVersion extends Clip {
  current_version_id: string | null;
  detection_session_id: string | null;
  session_created_at?: number;
  session_run_color?: string;
  session_prompt?: string;
  run_number?: number;
  // Additional fields from JOIN
  current_version_name?: string;
  current_version_description?: string;
  current_version_start_time?: number;
  current_version_end_time?: number;
  current_version_confidence_score?: number;
  current_version_relevance_score?: number;
  current_version_detection_reason?: string;
  current_version_tags?: string;
  current_version_change_type?: string;
  current_version_created_at?: number;
  current_version?: ClipVersion;
  current_version_segments?: ClipSegment[];
}

export interface CustomSubtitlePreset {
  id: string;
  name: string;
  description: string | null;
  // Font settings
  font_family: string;
  font_size: number;
  font_weight: number;
  // Color settings
  text_color: string;
  background_color: string;
  background_enabled: boolean | number; // SQLite stores as 0/1, converted to boolean
  // Border settings
  border1_width: number;
  border1_color: string;
  border2_width: number;
  border2_color: string;
  // Shadow settings
  shadow_offset_x: number;
  shadow_offset_y: number;
  shadow_blur: number;
  shadow_color: string;
  // Position settings
  position: string;
  position_percentage: number;
  max_width: number;
  // Animation
  animation_style: string;
  // Advanced settings
  line_height: number;
  letter_spacing: number;
  text_align: string;
  text_offset_x: number;
  text_offset_y: number;
  padding: number;
  border_radius: number;
  word_spacing: number;
  // Metadata
  created_at: number;
  updated_at: number;
}

export interface SubtitleSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundEnabled: boolean;
  border1Width: number;
  border1Color: string;
  border2Width: number;
  border2Color: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;
  position: 'top' | 'middle' | 'bottom';
  positionPercentage: number;
  maxWidth: number;
  animationStyle: 'none' | 'fade' | 'word-by-word';
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  textOffsetX: number;
  textOffsetY: number;
  padding: number;
  borderRadius: number;
  wordSpacing: number;
  selectedPresetId?: string | null;
}
