import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from '@clippster/sqlite-schema';
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

export async function deleteProject(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
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
  persistDetectedClips,
  deleteClipsByProjectId,
} from './workspace';
export {
  getClipSegmentsByClipId,
  getAdjacentClipSegments,
  updateClipSegment,
  splitClipSegment,
  deleteClipSegment,
  mergeAdjacentClipSegments,
  syncClipBoundsFromSegments,
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
