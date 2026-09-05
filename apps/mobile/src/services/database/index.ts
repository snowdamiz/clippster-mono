import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { APP_METADATA_TABLE_SQL, LATEST_SCHEMA_VERSION, MIGRATIONS } from '@clippster/sqlite-schema';
import type { Project } from '@clippster/shared-types';
import { deleteLocalMediaFile, isDeletableLocalPath } from '@/services/localMediaFiles';

const DB_NAME = 'clippster_mobile.db';

let dbInstance: SQLiteDatabase | null = null;
let currentUserId: string | null = null;

export function generateId(): string {
  return Crypto.randomUUID();
}

export function timestamp(): number {
  return Date.now();
}

export function setCurrentUserId(userId: string | null) {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_metadata WHERE key = 'schema_version'",
    );
    return row ? Number.parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

async function setSchemaVersion(db: SQLiteDatabase, version: number): Promise<void> {
  await db.runAsync(
    "INSERT INTO app_metadata (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [String(version)],
  );
}

export async function initDatabase(openDatabase: () => SQLiteDatabase): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = openDatabase();
  dbInstance = db;

  // Required for ON DELETE CASCADE. Default is OFF in SQLite / expo-sqlite.
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync(APP_METADATA_TABLE_SQL);

  const currentVersion = await getSchemaVersion(db);
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion);

  for (const migration of pending) {
    await db.execAsync(migration.sql);
    await setSchemaVersion(db, migration.version);
  }

  if (currentVersion === 0 && pending.length === 0) {
    await setSchemaVersion(db, LATEST_SCHEMA_VERSION);
  }

  return db;
}

export function getDatabase(): SQLiteDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  return dbInstance;
}

export async function createProject(name: string, description: string | null = null): Promise<Project> {
  const db = getDatabase();
  const now = timestamp();
  const project: Project = {
    id: generateId(),
    name,
    description,
    thumbnail_path: null,
    parent_id: null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO projects (id, name, description, thumbnail_path, parent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.name,
      project.description,
      project.thumbnail_path,
      project.parent_id,
      project.created_at,
      project.updated_at,
    ],
  );

  return project;
}

export async function getAllProjects(): Promise<Project[]> {
  const db = getDatabase();
  return db.getAllAsync<Project>(
    `SELECT id, name, description, thumbnail_path, parent_id,
            active_vod_preset_id, active_vod_preset_config,
            created_at, updated_at
     FROM projects ORDER BY updated_at DESC`,
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const db = getDatabase();
  return db.getFirstAsync<Project>(
    `SELECT id, name, description, thumbnail_path, parent_id,
            active_vod_preset_id, active_vod_preset_config,
            created_at, updated_at
     FROM projects WHERE id = ?`,
    [id],
  );
}

/**
 * Delete a project like desktop retention:
 * - Keeps clips that have a completed build or are open in the timeline editor
 * - Deletes unbuilt clips, raw VOD files, and the project row
 */
export async function deleteProjectWithRetention(
  id: string,
  inEditorClipIds: Set<string> = new Set(),
): Promise<{ deletedClipIds: string[]; retainedClipIds: string[] }> {
  const db = getDatabase();
  const project = await getProject(id);
  const projectName = project?.name ?? null;

  const allClips = await db.getAllAsync<{
    id: string;
    built_thumbnail_path: string | null;
  }>('SELECT id, built_thumbnail_path FROM clips WHERE project_id = ?', [id]);

  const builtRows = await db.getAllAsync<{ clip_id: string }>(
    `SELECT DISTINCT cb.clip_id
     FROM clip_builds cb
     INNER JOIN clips c ON c.id = cb.clip_id
     WHERE c.project_id = ? AND cb.status = 'completed'`,
    [id],
  );
  const builtClipIds = new Set(builtRows.map((row) => row.clip_id));

  const retainedClipIds = allClips
    .filter((clip) => builtClipIds.has(clip.id) || inEditorClipIds.has(clip.id))
    .map((clip) => clip.id);
  const retainedSet = new Set(retainedClipIds);
  const deletedClipIds = allClips.filter((clip) => !retainedSet.has(clip.id)).map((clip) => clip.id);

  const paths = new Set<string>();
  if (isDeletableLocalPath(project?.thumbnail_path)) {
    paths.add(project.thumbnail_path);
  }

  const rawVideos = await db.getAllAsync<{
    id: string;
    file_path: string | null;
    thumbnail_path: string | null;
  }>('SELECT id, file_path, thumbnail_path FROM raw_videos WHERE project_id = ?', [id]);
  for (const raw of rawVideos) {
    if (isDeletableLocalPath(raw.file_path)) paths.add(raw.file_path);
    if (isDeletableLocalPath(raw.thumbnail_path)) paths.add(raw.thumbnail_path);
  }

  for (const clipId of deletedClipIds) {
    const clip = allClips.find((row) => row.id === clipId);
    if (isDeletableLocalPath(clip?.built_thumbnail_path)) {
      paths.add(clip.built_thumbnail_path);
    }
    const builds = await db.getAllAsync<{ file_path: string | null; thumbnail_path: string | null }>(
      'SELECT file_path, thumbnail_path FROM clip_builds WHERE clip_id = ?',
      [clipId],
    );
    for (const build of builds) {
      if (isDeletableLocalPath(build.file_path)) paths.add(build.file_path);
      if (isDeletableLocalPath(build.thumbnail_path)) paths.add(build.thumbnail_path);
    }
  }

  for (const path of paths) {
    await deleteLocalMediaFile(path);
  }

  for (const clipId of deletedClipIds) {
    const versions = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM clip_versions WHERE clip_id = ?',
      [clipId],
    );
    for (const version of versions) {
      await db.runAsync('DELETE FROM clip_segments WHERE clip_version_id = ?', [version.id]);
    }
    await db.runAsync('DELETE FROM clip_builds WHERE clip_id = ?', [clipId]);
    await db.runAsync('DELETE FROM clip_versions WHERE clip_id = ?', [clipId]);
    await db.runAsync('DELETE FROM clips WHERE id = ?', [clipId]);
  }

  if (retainedClipIds.length > 0) {
    if (projectName) {
      await db.runAsync(
        `UPDATE clips
         SET project_name = ?, project_id = NULL, updated_at = ?
         WHERE project_id = ? AND (project_name IS NULL OR project_name = '')`,
        [projectName, timestamp(), id],
      );
    }
    await db.runAsync('UPDATE clips SET project_id = NULL, updated_at = ? WHERE project_id = ?', [
      timestamp(),
      id,
    ]);
  }

  for (const raw of rawVideos) {
    await db.runAsync('DELETE FROM raw_videos WHERE id = ?', [raw.id]);
  }

  await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);

  return { deletedClipIds, retainedClipIds };
}

/** @deprecated Prefer deleteProjectWithRetention — kept for sync helpers that wipe a project entirely. */
export async function deleteProject(id: string): Promise<void> {
  await deleteProjectWithRetention(id, new Set());
}

export async function touchProject(projectId: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE projects SET updated_at = ? WHERE id = ?', [timestamp(), projectId]);
}

export { DB_NAME };
export {
  createRawVideo,
  getRawVideoByProjectId,
  updateRawVideoFilePath,
  updateProjectThumbnail,
  createTranscriptRecord,
  getTranscriptByProjectId,
  getClipsByProjectId,
  getProjectClipRows,
  getAllClips,
  persistDetectedClips,
  addManualClip,
  deleteClip,
  deleteClipsByProjectId,
  updateClipBuiltThumbnail,
  type ProjectClipRow,
} from './workspace';
export {
  getClipSegmentsByClipId,
  getAdjacentClipSegments,
  updateClipSegment,
  updateClipTimeRange,
  splitClipSegment,
  deleteClipSegment,
  mergeAdjacentClipSegments,
  syncClipBoundsFromSegments,
  replaceClipSegments,
  segmentsToClipRelative,
  segmentsFromClipRelative,
} from './clip-segments';
export {
  getClipById,
  updateClipSubtitleSettings,
  updateClipSubtitlePosition,
  getClipSubtitleSettings,
  updateClipTextOverlay,
  getClipTextOverlay,
  deleteClipTextOverlay,
  createClipBuild,
  updateClipBuildProgress,
  completeClipBuild,
  deleteClipBuild,
  setClipBuildThumbnail,
  getClipBuildsByClipId,
  getClipBuildById,
  getCompletedClipBuilds,
  getCompletedClipBuildsWithDetails,
  type BuiltClipItem,
} from './clips';
export {
  getProjectVodPresetConfig,
  setProjectVodPresetConfig,
  getOrCreateProjectVodPresetConfig,
  clearProjectVodPresetConfig,
} from './vod-presets';
export {
  getCloudSyncMeta,
  upsertCloudSyncMeta,
  markProjectPending,
  markProjectSynced,
  markProjectConflict,
} from './cloud-sync-meta';
