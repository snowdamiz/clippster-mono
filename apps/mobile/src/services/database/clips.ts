import {
  parseClipTextOverlayJson,
  parseSubtitleSettings,
  serializeClipTextBoxState,
  type Clip,
  type ClipTextBoxState,
  type SubtitleSettings,
} from '@clippster/shared-types';
import { generateId, getDatabase, timestamp } from './index';

const CLIP_COLUMNS = `id, project_id, project_name, name, file_path, duration, start_time, end_time,
  current_version_id, detection_session_id,
  subtitle_enabled, subtitle_preset_id, subtitle_settings, clip_text_overlay,
  created_at, updated_at`;

export async function getClipById(clipId: string): Promise<Clip | null> {
  const db = getDatabase();
  return db.getFirstAsync<Clip>(`SELECT ${CLIP_COLUMNS} FROM clips WHERE id = ?`, [clipId]);
}

export async function updateClipSubtitleSettings(
  clipId: string,
  enabled: boolean,
  presetId: string | null,
  settings: SubtitleSettings,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE clips SET subtitle_enabled = ?, subtitle_preset_id = ?, subtitle_settings = ?, updated_at = ?
     WHERE id = ?`,
    [enabled ? 1 : 0, presetId, JSON.stringify(settings), timestamp(), clipId],
  );
}

export async function updateClipSubtitlePosition(
  clipId: string,
  settings: SubtitleSettings,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE clips SET subtitle_settings = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(settings),
    timestamp(),
    clipId,
  ]);
}

export async function getClipSubtitleSettings(clipId: string): Promise<SubtitleSettings | null> {
  const clip = await getClipById(clipId);
  if (!clip?.subtitle_settings) return null;
  return parseSubtitleSettings(clip.subtitle_settings);
}

export async function updateClipTextOverlay(
  clipId: string,
  state: ClipTextBoxState | null,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE clips SET clip_text_overlay = ?, updated_at = ? WHERE id = ?', [
    state ? serializeClipTextBoxState(state) : null,
    timestamp(),
    clipId,
  ]);
}

export async function getClipTextOverlay(clipId: string): Promise<ClipTextBoxState | null> {
  const clip = await getClipById(clipId);
  return parseClipTextOverlayJson(clip?.clip_text_overlay);
}

export async function deleteClipTextOverlay(clipId: string): Promise<void> {
  await updateClipTextOverlay(clipId, null);
}

export interface ClipBuildRow {
  id: string;
  clip_id: string;
  aspect_ratios: string | null;
  quality: string | null;
  frame_rate: number | null;
  output_format: string | null;
  include_subtitles: number;
  file_path: string;
  thumbnail_path: string | null;
  file_size: number | null;
  duration: number | null;
  build_number: number;
  status: 'building' | 'completed' | 'failed';
  error_message: string | null;
  progress: number;
  started_at: number;
  completed_at: number | null;
  created_at: number;
}

export async function getNextBuildNumber(clipId: string): Promise<number> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ max_num: number | null }>(
    'SELECT MAX(build_number) as max_num FROM clip_builds WHERE clip_id = ?',
    [clipId],
  );
  return (row?.max_num ?? 0) + 1;
}

export async function createClipBuild(input: {
  clipId: string;
  filePath: string;
  aspectRatios: string[];
  includeSubtitles?: boolean;
}): Promise<ClipBuildRow> {
  const db = getDatabase();
  const now = timestamp();
  const buildNumber = await getNextBuildNumber(input.clipId);
  const row: ClipBuildRow = {
    id: generateId(),
    clip_id: input.clipId,
    aspect_ratios: JSON.stringify(input.aspectRatios),
    quality: 'high',
    frame_rate: 30,
    output_format: 'mp4',
    include_subtitles: input.includeSubtitles ? 1 : 0,
    file_path: input.filePath,
    thumbnail_path: null,
    file_size: null,
    duration: null,
    build_number: buildNumber,
    status: 'building',
    error_message: null,
    progress: 0,
    started_at: now,
    completed_at: null,
    created_at: now,
  };

  await db.runAsync(
    `INSERT INTO clip_builds (
      id, clip_id, aspect_ratios, quality, frame_rate, output_format,
      include_subtitles, file_path, thumbnail_path, file_size, duration,
      build_number, status, error_message, progress, started_at, completed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.clip_id,
      row.aspect_ratios,
      row.quality,
      row.frame_rate,
      row.output_format,
      row.include_subtitles,
      row.file_path,
      row.thumbnail_path,
      row.file_size,
      row.duration,
      row.build_number,
      row.status,
      row.error_message,
      row.progress,
      row.started_at,
      row.completed_at,
      row.created_at,
    ],
  );

  return row;
}

export async function updateClipBuildProgress(
  buildId: string,
  progress: number,
  status?: ClipBuildRow['status'],
  errorMessage?: string | null,
): Promise<void> {
  const db = getDatabase();
  const completedAt = status === 'completed' || status === 'failed' ? timestamp() : null;
  await db.runAsync(
    'UPDATE clip_builds SET progress = ?, status = COALESCE(?, status), error_message = COALESCE(?, error_message), completed_at = COALESCE(?, completed_at) WHERE id = ?',
    [progress, status ?? null, errorMessage ?? null, completedAt, buildId],
  );
}

export async function completeClipBuild(
  buildId: string,
  filePath: string,
  fileSize?: number,
  duration?: number,
  thumbnailPath?: string,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE clip_builds SET
      file_path = ?, file_size = ?, duration = ?, thumbnail_path = ?,
      progress = 1, status = 'completed', completed_at = ?
     WHERE id = ?`,
    [filePath, fileSize ?? null, duration ?? null, thumbnailPath ?? null, timestamp(), buildId],
  );
}

export async function deleteClipBuild(buildId: string): Promise<void> {
  const db = getDatabase();
  const { deleteLocalMediaFile } = await import('@/services/localMediaFiles');
  const build = await getClipBuildById(buildId);
  if (!build) return;
  await deleteLocalMediaFile(build.file_path);
  await deleteLocalMediaFile(build.thumbnail_path);
  await db.runAsync('DELETE FROM clip_builds WHERE id = ?', [buildId]);
}

export async function setClipBuildThumbnail(buildId: string, thumbnailPath: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE clip_builds SET thumbnail_path = ? WHERE id = ?', [
    thumbnailPath,
    buildId,
  ]);
}

export async function getClipBuildsByClipId(clipId: string): Promise<ClipBuildRow[]> {
  const db = getDatabase();
  return db.getAllAsync<ClipBuildRow>(
    'SELECT * FROM clip_builds WHERE clip_id = ? ORDER BY build_number DESC',
    [clipId],
  );
}

export async function getClipBuildById(buildId: string): Promise<ClipBuildRow | null> {
  const db = getDatabase();
  return db.getFirstAsync<ClipBuildRow>('SELECT * FROM clip_builds WHERE id = ?', [buildId]);
}

export async function getCompletedClipBuilds(limit = 50): Promise<ClipBuildRow[]> {
  const db = getDatabase();
  return db.getAllAsync<ClipBuildRow>(
    `SELECT * FROM clip_builds WHERE status = 'completed' ORDER BY completed_at DESC LIMIT ?`,
    [limit],
  );
}

export interface BuiltClipItem {
  build: ClipBuildRow;
  clipName: string;
  projectId: string | null;
  projectName: string | null;
}

export async function getCompletedClipBuildsWithDetails(limit = 50): Promise<BuiltClipItem[]> {
  const db = getDatabase();
  const builds = await getCompletedClipBuilds(limit);
  const items: BuiltClipItem[] = [];

  for (const build of builds) {
    const clip = await getClipById(build.clip_id);
    const projectId = clip?.project_id ?? null;
    let projectName: string | null = clip?.project_name ?? null;
    if (!projectName && projectId) {
      const project = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM projects WHERE id = ?',
        [projectId],
      );
      projectName = project?.name ?? null;
    }
    items.push({
      build,
      clipName: clip?.name ?? 'Untitled clip',
      projectId,
      projectName,
    });
  }

  return items;
}
