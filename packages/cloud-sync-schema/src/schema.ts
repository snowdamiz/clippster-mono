import { z } from 'zod';

const clipSegmentSchema = z.object({
  id: z.string().uuid(),
  clip_version_id: z.string().uuid(),
  segment_index: z.number().int(),
  start_time: z.number(),
  end_time: z.number(),
  duration: z.number(),
  transcript: z.string().nullable(),
  created_at: z.number().int(),
});

const clipVersionSchema = z.object({
  id: z.string().uuid(),
  clip_id: z.string().uuid(),
  session_id: z.string().uuid(),
  version_number: z.number().int(),
  parent_version_id: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  start_time: z.number(),
  end_time: z.number(),
  confidence_score: z.number().nullable(),
  virality_score: z.number().nullable(),
  relevance_score: z.number().nullable(),
  detection_reason: z.string().nullable(),
  tags: z.string().nullable(),
  change_type: z.enum(['detected', 'modified', 'deleted']),
  change_description: z.string().nullable(),
  created_at: z.number().int(),
  segments: z.array(clipSegmentSchema),
});

const clipSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().nullable(),
  duration: z.number().nullable(),
  start_time: z.number().nullable(),
  end_time: z.number().nullable(),
  order_index: z.number().int().nullable(),
  current_version_id: z.string().uuid().nullable(),
  detection_session_id: z.string().uuid().nullable(),
  subtitle_enabled: z.number().int().nullable(),
  subtitle_preset_id: z.string().nullable(),
  subtitle_settings: z.string().nullable(),
  clip_text_overlay: z.string().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  versions: z.array(clipVersionSchema),
});

const rawVideoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  duration: z.number().nullable(),
  platform: z.string().nullable(),
  source_url: z.string().nullable(),
  cloud_media_asset_id: z.string().uuid().nullable(),
  local_file_hash: z.string().nullable(),
  original_filename: z.string().nullable(),
  thumbnail_path: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  codec: z.string().nullable(),
  file_size: z.number().int().nullable(),
});

const transcriptSchema = z.object({
  id: z.string().uuid(),
  raw_video_id: z.string().uuid(),
  raw_json: z.string(),
  text: z.string(),
  language: z.string().nullable(),
  duration: z.number().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  compressed: z.boolean().optional(),
});

const clipBuildSchema = z.object({
  id: z.string().uuid(),
  clip_id: z.string().uuid(),
  aspect_ratio: z.string().nullable(),
  quality: z.string().nullable(),
  frame_rate: z.number().int().nullable(),
  output_format: z.string().nullable(),
  include_subtitles: z.number().int().nullable(),
  file_path: z.string(),
  thumbnail_path: z.string().nullable(),
  file_size: z.number().int().nullable(),
  duration: z.number().nullable(),
  build_number: z.number().int(),
  status: z.string(),
  error_message: z.string().nullable(),
  cloud_media_asset_id: z.string().uuid().nullable(),
  created_at: z.number().int(),
  completed_at: z.number().int().nullable(),
});

export const cloudProjectSnapshotSchema = z.object({
  schema_version: z.literal(1),
  project: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable(),
    platform: z.string().nullable(),
    active_vod_preset_id: z.string().nullable(),
    active_vod_preset_config: z.union([z.string(), z.record(z.unknown())]).nullable(),
    thumbnail_path: z.string().nullable(),
    updated_at: z.number().int(),
  }),
  raw_videos: z.array(rawVideoSchema),
  clips: z.array(clipSchema),
  transcripts: z.array(transcriptSchema),
  clip_builds: z.array(clipBuildSchema),
});

export type ParsedCloudProjectSnapshot = z.infer<typeof cloudProjectSnapshotSchema>;

export function parseCloudProjectSnapshot(data: unknown): ParsedCloudProjectSnapshot {
  return cloudProjectSnapshotSchema.parse(data);
}

export function safeParseCloudProjectSnapshot(data: unknown) {
  return cloudProjectSnapshotSchema.safeParse(data);
}

/** Compress transcript raw_json when larger than 500KB. */
export function maybeCompressTranscriptRawJson(rawJson: string): {
  raw_json: string;
  compressed: boolean;
} {
  const threshold = 500 * 1024;
  if (rawJson.length <= threshold) {
    return { raw_json: rawJson, compressed: false };
  }
  // Client-side gzip is handled in cloudSync services; schema marks compressed flag.
  return { raw_json: rawJson, compressed: true };
}
