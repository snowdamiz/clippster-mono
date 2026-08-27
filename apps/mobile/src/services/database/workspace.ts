import type { Clip, ClipSegment, ClipVersion, Project, RawVideo, Transcript } from '@clippster/shared-types';
import { generateId, getDatabase, timestamp } from './index';

export type { RawVideo, Clip, ClipVersion, ClipSegment, Transcript };

export interface CreateRawVideoInput {
  projectId: string;
  filePath: string;
  originalFilename?: string | null;
  thumbnailPath?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  codec?: string | null;
  fileSize?: number | null;
  platform?: string | null;
  sourceUrl?: string | null;
}

export async function createRawVideo(input: CreateRawVideoInput): Promise<RawVideo> {
  const db = getDatabase();
  const now = timestamp();
  const row: RawVideo = {
    id: generateId(),
    project_id: input.projectId,
    file_path: input.filePath,
    original_filename: input.originalFilename ?? null,
    thumbnail_path: input.thumbnailPath ?? null,
    duration: input.duration ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    frame_rate: null,
    codec: input.codec ?? null,
    file_size: input.fileSize ?? null,
    platform: input.platform ?? null,
    source_url: input.sourceUrl ?? null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO raw_videos (
      id, project_id, file_path, original_filename, thumbnail_path,
      duration, width, height, frame_rate, codec, file_size, platform, source_url,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.project_id,
      row.file_path,
      row.original_filename ?? null,
      row.thumbnail_path ?? null,
      row.duration ?? null,
      row.width ?? null,
      row.height ?? null,
      row.frame_rate ?? null,
      row.codec ?? null,
      row.file_size ?? null,
      row.platform ?? null,
      row.source_url ?? null,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export async function getRawVideoByProjectId(projectId: string): Promise<RawVideo | null> {
  const db = getDatabase();
  return db.getFirstAsync<RawVideo>(
    `SELECT id, project_id, file_path, original_filename, thumbnail_path,
            duration, width, height, frame_rate, codec, file_size, platform, source_url,
            created_at, updated_at
     FROM raw_videos WHERE project_id = ?`,
    [projectId],
  );
}

export async function updateRawVideoFilePath(
  projectId: string,
  filePath: string,
  extras?: { fileSize?: number | null; thumbnailPath?: string | null },
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE raw_videos SET
      file_path = ?,
      file_size = COALESCE(?, file_size),
      thumbnail_path = COALESCE(?, thumbnail_path),
      updated_at = ?
     WHERE project_id = ?`,
    [
      filePath,
      extras?.fileSize ?? null,
      extras?.thumbnailPath ?? null,
      timestamp(),
      projectId,
    ],
  );
}

export async function updateProjectThumbnail(projectId: string, thumbnailPath: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE projects SET thumbnail_path = ?, updated_at = ? WHERE id = ?', [
    thumbnailPath,
    timestamp(),
    projectId,
  ]);
}

export async function createTranscriptRecord(input: {
  rawVideoId: string;
  rawJson: string;
  text: string;
  language?: string | null;
  duration?: number | null;
}): Promise<Transcript> {
  const db = getDatabase();
  const now = timestamp();
  const row: Transcript = {
    id: generateId(),
    raw_video_id: input.rawVideoId,
    raw_json: input.rawJson,
    text: input.text,
    language: input.language ?? null,
    duration: input.duration ?? null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO transcripts (id, raw_video_id, raw_json, text, language, duration, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(raw_video_id) DO UPDATE SET
       raw_json = excluded.raw_json,
       text = excluded.text,
       language = excluded.language,
       duration = excluded.duration,
       updated_at = excluded.updated_at`,
    [
      row.id,
      row.raw_video_id,
      row.raw_json ?? '',
      row.text ?? '',
      row.language ?? null,
      row.duration ?? null,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export async function getTranscriptByProjectId(projectId: string): Promise<Transcript | null> {
  const db = getDatabase();
  return db.getFirstAsync<Transcript>(
    `SELECT t.id, t.raw_video_id, t.raw_json, t.text, t.language, t.duration, t.created_at, t.updated_at
     FROM transcripts t
     JOIN raw_videos rv ON rv.id = t.raw_video_id
     WHERE rv.project_id = ?
     LIMIT 1`,
    [projectId],
  );
}

export async function deleteClipsByProjectId(projectId: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM clips WHERE project_id = ?', [projectId]);
}

export interface DetectedClipInput {
  name: string;
  startTime: number;
  endTime: number;
  description?: string | null;
  confidenceScore?: number | null;
  viralityScore?: number | null;
  segments?: Array<{
    start_time: number;
    end_time: number;
    duration: number;
    transcript?: string | null;
  }>;
}

export async function persistDetectedClips(
  projectId: string,
  prompt: string,
  clips: DetectedClipInput[],
  videoFilePath: string,
): Promise<string> {
  const db = getDatabase();
  const sessionId = generateId();
  const now = timestamp();

  await db.runAsync(
    `INSERT INTO clip_detection_sessions (
      id, project_id, prompt, detection_model, total_clips_detected, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, projectId, prompt, 'claude-3.5-sonnet-chunked', clips.length, now],
  );

  await deleteClipsByProjectId(projectId);

  for (const [index, clip] of clips.entries()) {
    const clipId = generateId();
    const versionId = generateId();
    const duration = clip.endTime - clip.startTime;

    await db.runAsync(
      `INSERT INTO clips (
        id, project_id, name, file_path, duration, start_time, end_time,
        order_index, current_version_id, detection_session_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clipId,
        projectId,
        clip.name,
        videoFilePath,
        duration,
        clip.startTime,
        clip.endTime,
        index,
        versionId,
        sessionId,
        now,
        now,
      ],
    );

    await db.runAsync(
      `INSERT INTO clip_versions (
        id, clip_id, session_id, version_number, name, description,
        start_time, end_time, confidence_score, virality_score,
        change_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionId,
        clipId,
        sessionId,
        1,
        clip.name,
        clip.description ?? null,
        clip.startTime,
        clip.endTime,
        clip.confidenceScore ?? null,
        clip.viralityScore ?? null,
        'detected',
        now,
      ],
    );

    const segments = clip.segments ?? [
      {
        start_time: clip.startTime,
        end_time: clip.endTime,
        duration,
        transcript: null,
      },
    ];

    for (const [segmentIndex, segment] of segments.entries()) {
      await db.runAsync(
        `INSERT INTO clip_segments (
          id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          versionId,
          segmentIndex,
          segment.start_time,
          segment.end_time,
          segment.duration,
          segment.transcript ?? null,
          now,
        ],
      );
    }
  }

  return sessionId;
}

async function getOrCreateManualSessionId(projectId: string): Promise<string> {
  const db = getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM clip_detection_sessions
     WHERE project_id = ? AND prompt = 'Manual clip creation'
     ORDER BY created_at DESC LIMIT 1`,
    [projectId],
  );
  if (existing?.id) {
    await db.runAsync(
      `UPDATE clip_detection_sessions
       SET total_clips_detected = COALESCE(total_clips_detected, 0) + 1
       WHERE id = ?`,
      [existing.id],
    );
    return existing.id;
  }

  const sessionId = generateId();
  await db.runAsync(
    `INSERT INTO clip_detection_sessions (
      id, project_id, prompt, detection_model, total_clips_detected, run_color, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, projectId, 'Manual clip creation', 'manual', 1, '#22C55E', timestamp()],
  );
  return sessionId;
}

export async function addManualClip(
  projectId: string,
  videoFilePath: string,
  startTime: number,
  endTime: number,
  name?: string,
): Promise<string> {
  const db = getDatabase();
  const clipId = generateId();
  const versionId = generateId();
  const sessionId = await getOrCreateManualSessionId(projectId);
  const now = timestamp();
  const duration = endTime - startTime;
  const existing = await getClipsByProjectId(projectId);
  const orderIndex = existing.length;
  const clipName = name?.trim() || `Clip ${orderIndex + 1}`;

  await db.runAsync(
    `INSERT INTO clips (
      id, project_id, name, file_path, duration, start_time, end_time,
      order_index, current_version_id, detection_session_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clipId,
      projectId,
      clipName,
      videoFilePath,
      duration,
      startTime,
      endTime,
      orderIndex,
      versionId,
      sessionId,
      now,
      now,
    ],
  );

  await db.runAsync(
    `INSERT INTO clip_versions (
      id, clip_id, session_id, version_number, name, start_time, end_time, change_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [versionId, clipId, sessionId, 1, clipName, startTime, endTime, 'detected', now],
  );

  await db.runAsync(
    `INSERT INTO clip_segments (
      id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), versionId, 0, startTime, endTime, duration, null, now],
  );

  return clipId;
}

export async function getClipsByProjectId(projectId: string): Promise<Clip[]> {
  const db = getDatabase();
  return db.getAllAsync<Clip>(
    `SELECT id, project_id, name, file_path, duration, start_time, end_time,
            current_version_id, detection_session_id,
            subtitle_enabled, subtitle_preset_id, subtitle_settings, clip_text_overlay,
            created_at, updated_at
     FROM clips WHERE project_id = ?
     ORDER BY COALESCE(order_index, 999999), start_time ASC`,
    [projectId],
  );
}

export async function getAllClips(): Promise<Clip[]> {
  const db = getDatabase();
  return db.getAllAsync<Clip>(
    `SELECT id, project_id, name, file_path, duration, start_time, end_time,
            current_version_id, detection_session_id,
            subtitle_enabled, subtitle_preset_id, subtitle_settings, clip_text_overlay,
            created_at, updated_at
     FROM clips
     ORDER BY updated_at DESC`,
  );
}

export type ProjectWithRawVideo = {
  project: Project;
  rawVideo: RawVideo | null;
};
