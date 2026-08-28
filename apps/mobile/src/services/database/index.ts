import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { APP_METADATA_TABLE_SQL, LATEST_SCHEMA_VERSION, MIGRATIONS } from '@clippster/sqlite-schema';
import type { Project } from '@clippster/shared-types';

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

function isDeletableLocalPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (
    path.startsWith('pending://') ||
    path.startsWith('clip://') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return false;
  }
  return true;
}

function playableSiblingPath(path: string): string | null {
  if (path.endsWith('.play.mp4')) return null;
  return path.replace(/\.[^./]+$/, '') + '.play.mp4';
}

async function deleteLocalMediaFile(path: string): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // File may already be gone.
  }
  const playable = playableSiblingPath(path);
  if (playable) {
    try {
      await FileSystem.deleteAsync(playable, { idempotent: true });
    } catch {
      // ignore
    }
  }
}

/** Collect on-disk media for a project, delete those files, then cascade-delete DB rows. */
export async function deleteProject(id: string): Promise<void> {
  const db = getDatabase();
  const paths = new Set<string>();

  const project = await getProject(id);
  if (isDeletableLocalPath(project?.thumbnail_path)) {
    paths.add(project.thumbnail_path);
  }

  const rawVideos = await db.getAllAsync<{ file_path: string | null; thumbnail_path: string | null }>(
    'SELECT file_path, thumbnail_path FROM raw_videos WHERE project_id = ?',
    [id],
  );
  for (const raw of rawVideos) {
    if (isDeletableLocalPath(raw.file_path)) paths.add(raw.file_path);
    if (isDeletableLocalPath(raw.thumbnail_path)) paths.add(raw.thumbnail_path);
  }

  const clips = await db.getAllAsync<{
    file_path: string | null;
    built_thumbnail_path: string | null;
  }>('SELECT file_path, built_thumbnail_path FROM clips WHERE project_id = ?', [id]);
  for (const clip of clips) {
    if (isDeletableLocalPath(clip.file_path)) paths.add(clip.file_path);
    if (isDeletableLocalPath(clip.built_thumbnail_path)) paths.add(clip.built_thumbnail_path);
  }

  const builds = await db.getAllAsync<{ file_path: string | null; thumbnail_path: string | null }>(
    `SELECT cb.file_path, cb.thumbnail_path
     FROM clip_builds cb
     INNER JOIN clips c ON c.id = cb.clip_id
     WHERE c.project_id = ?`,
    [id],
  );
  for (const build of builds) {
    if (isDeletableLocalPath(build.file_path)) paths.add(build.file_path);
    if (isDeletableLocalPath(build.thumbnail_path)) paths.add(build.thumbnail_path);
  }

  for (const path of paths) {
    await deleteLocalMediaFile(path);
  }

  await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
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
