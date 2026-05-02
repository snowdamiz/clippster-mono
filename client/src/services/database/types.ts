// Core Database Types

export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  parent_id: string | null;
  platform: 'PumpFun' | 'Kick' | 'YouTube' | 'Twitch' | 'Rumble' | 'Twitter' | 'Manual' | null;
  audio_settings: string | null; // JSON string of AudioSettings
  default_watermark_settings: string | null; // JSON string with watermark_id and watermark_settings from creator profile
  creator_profile_id: string | null; // Direct link to creator profile (for local video imports)
  active_vod_preset_id: string | null; // Reference to saved VOD preset
  active_vod_preset_config: string | null; // JSON snapshot of applied VOD preset config
  selected_branding_profile_id: string | null; // Selected global branding profile
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
  // Organization asset fields (null for local assets)
  organization_id?: string | null;
  organization_name?: string | null;
  server_id?: number | null;
  sync_status?: 'synced' | 'downloading' | 'error' | null;
}

export interface Clip {
  id: string;
  project_id: string | null;
  project_name: string | null;
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
  built_thumbnail_path: string | null; // Thumbnail generated during clip detection
  build_progress: number | null;
  build_error: string | null;
  built_at: number | null;
  built_file_size: number | null;
  built_duration: number | null;
  // Version tracking
  current_version_id: string | null;
  detection_session_id: string | null;
  // Campaign integration
  campaign_id: number | null;
  // Subtitle settings
  subtitle_enabled?: number;
  subtitle_preset_id?: string | null;
  subtitle_position_x?: number | null;
  subtitle_position_y?: number | null;
  subtitle_position_width?: number | null;
  subtitle_settings?: string | null; // JSON string of full subtitle settings
  /** JSON string: ClipTextBoxState — pill text overlay for workspace + POI */
  clip_text_overlay?: string | null;
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

export interface MonitoredStreamerRecord {
  id: string;
  mint_id: string;
  display_name: string;
  platform: string; // 'pumpfun' | 'kick' - stored as lowercase in DB
  last_check_timestamp: number | null;
  is_currently_live: number | boolean;
  current_session_id: string | null;
  profile_image_url?: string | null;
  stream_thumbnail_url?: string | null;
  segment_duration_minutes: number;
  auto_dvr: number | boolean; // When enabled, temp recording starts automatically when streamer goes live
  created_at: number;
  updated_at: number;
}

export interface LivestreamSessionRecord {
  id: string;
  monitored_streamer_id: string;
  mint_id: string;
  stream_start_time: number;
  stream_end_time: number | null;
  is_recording: number | boolean;
  total_segments: number;
  processed_segments: number;
  created_at: number;
  updated_at: number;
  project_id: string | null;
}

export interface LivestreamSegmentRecord {
  id: string;
  session_id: string;
  segment_number: number;
  start_time_offset: number;
  duration: number;
  raw_video_id: string | null;
  status: 'recording' | 'ready' | 'processing' | 'completed' | 'error' | string;
  clips_detected: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
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
  virality_score: number | null;
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
  transcript_raw_json: string | null; // Word-level timing JSON (0-based times relative to clip start)
  audio_peaks: string | null; // JSON string of audio peak data
  created_at: number;
}

export interface ClipBuild {
  id: string;
  clip_id: string;
  // Build settings used
  aspect_ratios: string | null; // JSON array of aspect ratios
  quality: string | null;
  frame_rate: number | null;
  output_format: string | null;
  include_subtitles: boolean | number;
  // Build output
  file_path: string;
  output_paths: string | null; // JSON array of all output file paths (one per aspect ratio)
  thumbnail_path: string | null;
  file_size: number | null;
  duration: number | null;
  // Build metadata
  build_number: number;
  status: 'building' | 'completed' | 'failed';
  error_message: string | null;
  progress: number;
  // Branding context
  organization_id: number | null;
  organization_name: string | null;
  campaign_id: number | null;
  campaign_name: string | null;
  branding_profile_id: string | null;
  branding_type: 'org' | 'campaign' | 'personal' | 'none';
  // Published status
  is_published: boolean | number;
  published_at: number | null;
  // Timestamps
  started_at: number;
  completed_at: number | null;
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
  current_version_virality_score?: number;
  current_version_relevance_score?: number;
  current_version_detection_reason?: string;
  current_version_tags?: string;
  current_version_change_type?: string;
  current_version_created_at?: number;
  current_version?: ClipVersion;
  current_version_segments?: ClipSegment[];
  // Multiple builds support
  builds?: ClipBuild[];
  // Subtitle settings
  subtitle_enabled?: number;
  subtitle_preset_id?: string;
  subtitle_position_x?: number;
  subtitle_position_y?: number;
  subtitle_position_width?: number;
}

// Clip with version data plus segment (child project) info for folder-level view
export interface ClipWithVersionAndSegment extends ClipWithVersion {
  segment_id: string;
  segment_name: string;
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
  highlight_color: string | null;
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
  animationStyle:
    | 'none'
    | 'karaoke'
    | 'zoom'
    | 'pop'
    | 'glow'
    | 'box-highlight'
    | 'typewriter'
    | 'wave';
  highlightColor: string;
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

export interface WatermarkImage {
  id: string;
  name: string;
  file_path: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  created_at: number;
  updated_at: number;
  // Organization asset fields (null for local assets)
  organization_id?: string | null;
  organization_name?: string | null;
  server_id?: number | null;
  sync_status?: 'synced' | 'downloading' | 'error' | null;
}

export interface AudioAsset {
  id: string;
  name: string;
  file_path: string;
  duration: number | null;
  file_size: number | null;
  sample_rate: number | null;
  channels: number | null;
  created_at: number;
  updated_at: number;
  // Organization asset fields (null for local assets)
  organization_id?: string | null;
  organization_name?: string | null;
  server_id?: number | null;
  sync_status?: 'synced' | 'downloading' | 'error' | null;
}

export interface ImageAsset {
  id: string;
  name: string;
  file_path: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: number;
  updated_at: number;
  // Organization asset fields (null for local assets)
  organization_id?: string | null;
  organization_name?: string | null;
  server_id?: number | null;
  sync_status?: 'synced' | 'downloading' | 'error' | null;
}

export interface WatermarkSettings {
  enabled: boolean;
  watermarkId: string | null; // Default watermark (for 16:9 or when no per-ratio set)
  positionX: number; // 0-100 (percentage from left)
  positionY: number; // 0-100 (percentage from top)
  opacity: number; // 0-100
  scale: number; // 0-100 (percentage of video width)
  width?: number | null; // original watermark width (px) if known
  height?: number | null; // original watermark height (px) if known
  isFullFrameOverlay?: boolean; // When true, position at 0,0 with 100% scale (full-frame overlay)
  // Optional per-aspect-ratio settings from creator profile
  // Each ratio can have its own watermark image AND position settings
  perRatioSettings?: CreatorWatermarkSettings | null;
}

export interface AudioSettings {
  volume: number; // dB gain (-20 to +20) - project level
  normalize: boolean; // enable audio normalization (export only)
  // Clip-level audio mixer settings (optional, from clip editor)
  originalAudioDb?: number; // dB gain for original audio track (-20 to +20)
  musicTracks?: MusicTrackSettings[]; // Music tracks to mix in
}

// Music track settings for export
export interface MusicTrackSettings {
  filePath: string; // Path to audio file
  gainDb: number; // dB gain (-20 to +20)
  fadeIn: number; // Fade in duration in seconds
  fadeOut: number; // Fade out duration in seconds
  startTime: number; // When audio starts in clip timeline
  endTime: number; // When audio ends in clip timeline
  isMuted: boolean; // Whether track is muted
}

export interface CreatorWatermarkPosition {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  isFullFrameOverlay?: boolean; // When true, position at 0,0 with 100% scale (full-frame overlay)
}

// Per-aspect-ratio watermark configuration
// Allows using different watermark images for different aspect ratios
export interface CreatorWatermarkRatioConfig {
  watermarkId: string | null; // Different watermark image for this ratio
  position: CreatorWatermarkPosition | null; // Position settings for this ratio
}

// Settings can be null to indicate watermark is disabled for that ratio
// Each ratio can have a completely different watermark image
export interface CreatorWatermarkSettings {
  '16:9': CreatorWatermarkRatioConfig | null;
  '9:16': CreatorWatermarkRatioConfig | null;
  '1:1': CreatorWatermarkRatioConfig | null;
  '4:5': CreatorWatermarkRatioConfig | null;
}

// Per-aspect-ratio intro/outro configuration
// Allows using different intro/outro videos for different aspect ratios
export interface CreatorIntroOutroRatioConfig {
  introId: string | null;
  outroId: string | null;
}

// Per-ratio asset config: stores the asset ID for a single type (intro or outro)
export interface CreatorRatioAssetConfig {
  assetId: string | null;
}

// Settings can be null to indicate intro/outro are disabled for that ratio
// Each ratio can have completely different intro and outro videos
export interface CreatorIntroOutroSettings {
  '16:9': CreatorIntroOutroRatioConfig | null;
  '9:16': CreatorIntroOutroRatioConfig | null;
  '1:1': CreatorIntroOutroRatioConfig | null;
  '4:5': CreatorIntroOutroRatioConfig | null;
}

// Separate per-ratio settings for intro and outro independently
export type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5';
export type RatioAssetMap = Record<AspectRatioId, CreatorRatioAssetConfig | null>;

export interface CreatorProfile {
  id: string;
  name: string;
  description: string | null;
  profile_image_path: string | null;
  intro_id: string | null;
  outro_id: string | null;
  watermark_id: string | null;
  watermark_settings: string | null; // JSON string of WatermarkSettings
  intro_outro_settings: string | null; // JSON string of IntroOutroSettings
  intro_ratio_settings: string | null; // JSON string of RatioAssetMap for intros
  outro_ratio_settings: string | null; // JSON string of RatioAssetMap for outros
  auto_dvr_enabled?: number | boolean; // Auto DVR toggle (default off)
  disabled?: number | boolean; // Whether the profile is disabled
  layout_overlays: string | null; // JSON string of LayoutOverlay[]
  clip_build_defaults?: string | null; // JSON string of CreatorClipBuildDefaults — opt-in clip-build defaults applied via "Use creator layout" on download
  scope: 'streamer' | 'global'; // 'streamer' = tied to platform links, 'global' = universal branding
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreatorPlatformLink {
  id: string;
  creator_profile_id: string;
  platform: 'pumpfun' | 'kick' | 'twitch' | 'YouTube' | 'rumble' | 'twitter';
  platform_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  monitored_streamer_id: string | null;
  is_primary: boolean;
  created_at: number;
}

export interface CreatorProfileWithLinks extends CreatorProfile {
  platform_links: CreatorPlatformLink[];
  organization_id?: number | null;
  organization_name?: string | null;
  campaign_id?: number | null;
  campaign_title?: string | null;
  context_type?: 'personal' | 'organization' | 'campaign';
}

export interface DownloadedAudio {
  id: string;
  title: string;
  source: 'youtube' | 'twitter' | 'upload';
  platform: string | null;
  source_url: string | null;
  file_path: string;
  duration: number | null;
  file_size: number | null;
  sample_rate: number | null;
  channels: number | null;
  thumbnail_url: string | null;
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface SpaceParticipant {
  id: string;
  name: string;
  avatar_url: string | null;
  role: 'host' | 'cohost' | 'speaker' | 'admin' | 'listener' | 'guest' | 'unknown';
  /** X handle (without @) when known — used for secondary avatar fetching. */
  twitter_username?: string;
  /** Periscope user id from AudioSpaceById; Chatman replay events use this as guestRemoteID. */
  periscope_user_id?: string;
  /** Numeric X/Twitter rest_id from user_results. */
  x_rest_id?: string;
  /** Display name from AudioSpaceById when distinct from handle. */
  display_name?: string;
}

/** Origin of a speaker segment; synthetic_* must not drive active-speaker highlights. */
export type SpaceSpeakerSegmentSource =
  | 'chatman_replay'
  | 'periscope'
  | 'hls_id3'
  | 'manual'
  | 'stage_join'
  | 'synthetic_equal'
  | 'synthetic_seed'
  | 'unknown';

export interface SpaceSpeakerSegment {
  id: string;
  speaker_id: string;
  start: number;
  end: number;
  /** When omitted, UI derives from segment id prefix for backward compatibility. */
  source?: SpaceSpeakerSegmentSource;
  periscope_user_id?: string;
  x_rest_id?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
  role?: SpaceParticipant['role'];
}

/** Replay timeline feed: stage roster changes and speaker highlights (from snapshots / API cues). */
export type SpaceTimelineEventType = 'joined_stage' | 'left_stage' | 'speaker_changed';

export interface SpaceTimelineEvent {
  id: string;
  t: number;
  type: SpaceTimelineEventType;
  user_ids: string[];
  detail?: string;
}

/** On-stage roster at playlist time `t` (seconds), from HLS ID3 when available. */
export interface SpaceStageSnapshot {
  id: string;
  t: number;
  on_stage_user_ids: string[];
}

export interface DownloadedSpaceMetadata {
  id: string;
  audio_id: string;
  source_url: string | null;
  title: string | null;
  participants_json: string | null;
  speaker_segments_json: string | null;
  stage_snapshots_json: string | null;
  /** Join/leave stage cues and related replay events (JSON array). */
  timeline_events_json: string | null;
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface AudioPlaylist {
  id: string;
  name: string;
  description: string | null;
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface AudioPlaylistItem {
  id: string;
  playlist_id: string;
  audio_id: string;
  position: number;
  created_at: number;
}
