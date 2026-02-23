import { getDatabase } from './index';

const TABLE_NAME = 'user_preferences';

export interface UserPreferences {
  time_format_preference: '12hr' | '24hr';
  toast_enabled: boolean;
  toast_duration: number;
  toast_position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  toast_sound_enabled: boolean;
  toast_background_enabled: boolean;
  notify_livestream: boolean;
  notify_clips: boolean;
  notify_downloads: boolean;
  notify_projects: boolean;
  notify_social: boolean;
  notify_organization: boolean;
  notify_system: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  time_format_preference: '12hr',
  toast_enabled: true,
  toast_duration: 5000,
  toast_position: 'bottom-right',
  toast_sound_enabled: false,
  toast_background_enabled: true,
  notify_livestream: true,
  notify_clips: true,
  notify_downloads: true,
  notify_projects: true,
  notify_social: true,
  notify_organization: true,
  notify_system: true,
};

/**
 * Ensures the user_preferences table exists.
 * Local cache of user preferences synced with server.
 */
export async function ensureUserPreferencesTable(): Promise<void> {
  const db = await getDatabase();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      user_id TEXT PRIMARY KEY,
      time_format_preference TEXT NOT NULL DEFAULT '12hr',
      toast_enabled INTEGER NOT NULL DEFAULT 1,
      toast_duration INTEGER NOT NULL DEFAULT 5000,
      toast_position TEXT NOT NULL DEFAULT 'bottom-right',
      toast_sound_enabled INTEGER NOT NULL DEFAULT 0,
      toast_background_enabled INTEGER NOT NULL DEFAULT 1,
      notify_livestream INTEGER NOT NULL DEFAULT 1,
      notify_clips INTEGER NOT NULL DEFAULT 1,
      notify_downloads INTEGER NOT NULL DEFAULT 1,
      notify_projects INTEGER NOT NULL DEFAULT 1,
      notify_social INTEGER NOT NULL DEFAULT 1,
      notify_organization INTEGER NOT NULL DEFAULT 1,
      notify_system INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Gets user preferences from local SQLite cache.
 * Returns defaults if no preferences are stored.
 */
export async function getLocalPreferences(userId: string): Promise<UserPreferences> {
  const db = await getDatabase();
  await ensureUserPreferencesTable();

  const results = await db.select<any[]>(
    `SELECT * FROM ${TABLE_NAME} WHERE user_id = ?`,
    [userId]
  );

  if (results.length === 0) {
    return { ...DEFAULT_PREFERENCES };
  }

  const row = results[0];
  return {
    time_format_preference: row.time_format_preference || '12hr',
    toast_enabled: Boolean(row.toast_enabled),
    toast_duration: row.toast_duration || 5000,
    toast_position: row.toast_position || 'bottom-right',
    toast_sound_enabled: Boolean(row.toast_sound_enabled),
    toast_background_enabled: Boolean(row.toast_background_enabled),
    notify_livestream: Boolean(row.notify_livestream),
    notify_clips: Boolean(row.notify_clips),
    notify_downloads: Boolean(row.notify_downloads),
    notify_projects: Boolean(row.notify_projects),
    notify_social: Boolean(row.notify_social),
    notify_organization: Boolean(row.notify_organization),
    notify_system: Boolean(row.notify_system),
  };
}

/**
 * Saves user preferences to local SQLite cache.
 * Uses UPSERT to insert or update.
 */
export async function saveLocalPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void> {
  const db = await getDatabase();
  await ensureUserPreferencesTable();

  const current = await getLocalPreferences(userId);
  const merged = { ...current, ...prefs };

  await db.execute(
    `INSERT INTO ${TABLE_NAME} (
      user_id, time_format_preference, toast_enabled, toast_duration, toast_position,
      toast_sound_enabled, toast_background_enabled,
      notify_livestream, notify_clips, notify_downloads,
      notify_projects, notify_social, notify_organization, notify_system,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      time_format_preference = excluded.time_format_preference,
      toast_enabled = excluded.toast_enabled,
      toast_duration = excluded.toast_duration,
      toast_position = excluded.toast_position,
      toast_sound_enabled = excluded.toast_sound_enabled,
      toast_background_enabled = excluded.toast_background_enabled,
      notify_livestream = excluded.notify_livestream,
      notify_clips = excluded.notify_clips,
      notify_downloads = excluded.notify_downloads,
      notify_projects = excluded.notify_projects,
      notify_social = excluded.notify_social,
      notify_organization = excluded.notify_organization,
      notify_system = excluded.notify_system,
      updated_at = datetime('now')`,
    [
      userId,
      merged.time_format_preference,
      merged.toast_enabled ? 1 : 0,
      merged.toast_duration,
      merged.toast_position,
      merged.toast_sound_enabled ? 1 : 0,
      merged.toast_background_enabled ? 1 : 0,
      merged.notify_livestream ? 1 : 0,
      merged.notify_clips ? 1 : 0,
      merged.notify_downloads ? 1 : 0,
      merged.notify_projects ? 1 : 0,
      merged.notify_social ? 1 : 0,
      merged.notify_organization ? 1 : 0,
      merged.notify_system ? 1 : 0,
    ]
  );
}
