import { getDatabase, timestamp } from './core';
import { UNIX_SECONDS_THRESHOLD } from '@/utils/dateTimeUtils';

/**
 * Self-healing schema module.
 *
 * SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
 * Migrations that add columns may fail with "duplicate column name" if the
 * column was previously added by another code path (e.g. an unregistered
 * migration or earlier self-healing code).
 *
 * This module runs once at app startup and ensures every expected column
 * exists, using PRAGMA table_info checks before each ALTER TABLE.
 */

let healed = false;

async function hasColumn(db: any, table: string, column: string): Promise<boolean> {
  const cols = (await db.select(`PRAGMA table_info(${table})`)) as { name: string }[];
  return cols.some((c) => c.name === column);
}

export async function addColumnIfMissing(
  db: any,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  if (await hasColumn(db, table, column)) return;
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`[schema-healing] Added ${table}.${column}`);
}

/** Fix project timestamps stored as milliseconds instead of Unix seconds. */
async function healProjectTimestamps(db: any): Promise<void> {
  try {
    const corrupted = (await db.select(
      `SELECT id, created_at, updated_at FROM projects
       WHERE created_at > ? OR updated_at > ?`,
      [UNIX_SECONDS_THRESHOLD, UNIX_SECONDS_THRESHOLD]
    )) as { id: string; created_at: number; updated_at: number }[];

    for (const project of corrupted) {
      const createdAt =
        project.created_at > UNIX_SECONDS_THRESHOLD
          ? Math.floor(project.created_at / 1000)
          : project.created_at;
      const updatedAt =
        project.updated_at > UNIX_SECONDS_THRESHOLD
          ? Math.floor(project.updated_at / 1000)
          : project.updated_at;

      await db.execute('UPDATE projects SET created_at = ?, updated_at = ? WHERE id = ?', [
        createdAt,
        updatedAt,
        project.id,
      ]);
    }

    if (corrupted.length > 0) {
      console.log(
        `[schema-healing] Normalized ${corrupted.length} project timestamp(s) from ms to seconds`
      );
    }
  } catch (e) {
    console.warn('[schema-healing] Project timestamp heal skipped:', e);
  }
}

/** Clear watermarks/branding selections left from incorrect auto-apply rules. */
async function healStaleProjectBranding(db: any): Promise<void> {
  try {
    const { resolveAutoBrandingProfile, isOrgSuppliedAccount } =
      await import('@/composables/useBrandingProfileSelection');

    if (isOrgSuppliedAccount()) {
      return;
    }

    const projects = (await db.select(
      `SELECT id, default_watermark_settings, selected_branding_profile_id FROM projects
       WHERE default_watermark_settings IS NOT NULL OR selected_branding_profile_id IS NOT NULL`
    )) as {
      id: string;
      default_watermark_settings: string | null;
      selected_branding_profile_id: string | null;
    }[];

    for (const project of projects) {
      const autoProfile = await resolveAutoBrandingProfile(project.id);
      const validWatermarkId = autoProfile?.watermark_id ? String(autoProfile.watermark_id) : null;

      if (project.default_watermark_settings) {
        try {
          const stored = JSON.parse(project.default_watermark_settings);
          const storedId = stored?.watermarkId ? String(stored.watermarkId) : null;
          if (storedId && storedId !== validWatermarkId) {
            await db.execute(
              'UPDATE projects SET default_watermark_settings = NULL, updated_at = ? WHERE id = ?',
              [timestamp(), project.id]
            );
            console.log(
              '[schema-healing] Cleared stale default_watermark_settings for project',
              project.id
            );
          }
        } catch {
          await db.execute(
            'UPDATE projects SET default_watermark_settings = NULL, updated_at = ? WHERE id = ?',
            [timestamp(), project.id]
          );
        }
      }

      if (project.selected_branding_profile_id) {
        const validProfileId = autoProfile?.id ? String(autoProfile.id) : null;
        if (project.selected_branding_profile_id !== validProfileId) {
          await db.execute(
            'UPDATE projects SET selected_branding_profile_id = NULL, updated_at = ? WHERE id = ?',
            [timestamp(), project.id]
          );
          console.log(
            '[schema-healing] Cleared stale selected_branding_profile_id for project',
            project.id
          );
        }
      }
    }
  } catch (e) {
    console.warn('[schema-healing] Stale branding heal skipped:', e);
  }
}

export async function healSchema(): Promise<void> {
  if (healed) return;
  const db = await getDatabase();

  try {
    // --- Migration 084: global branding profiles ---
    await addColumnIfMissing(db, 'creator_profiles', 'scope', "TEXT NOT NULL DEFAULT 'streamer'");
    await addColumnIfMissing(
      db,
      'projects',
      'selected_branding_profile_id',
      'TEXT REFERENCES creator_profiles(id) ON DELETE SET NULL'
    );

    // --- Migration 085: campaign_id on clips ---
    await addColumnIfMissing(db, 'clips', 'campaign_id', 'INTEGER');

    // --- Migration 092: source on clips (to identify video editor exports) ---
    await addColumnIfMissing(db, 'clips', 'source', "TEXT DEFAULT 'clip_detection'");

    // --- Migration 098: subtitle position columns ---
    await addColumnIfMissing(db, 'clips', 'subtitle_position_x', 'REAL');
    await addColumnIfMissing(db, 'clips', 'subtitle_position_y', 'REAL');

    // --- clip_text_overlay JSON on clips ---
    await addColumnIfMissing(db, 'clips', 'clip_text_overlay', 'TEXT');

    // --- Migration 086: source_start_time on audio tracks ---
    await addColumnIfMissing(
      db,
      'video_editor_audio_tracks',
      'source_start_time',
      'REAL NOT NULL DEFAULT 0'
    );

    // --- Migration 087: transcript_raw_json on clip_segments ---
    await addColumnIfMissing(db, 'clip_segments', 'transcript_raw_json', 'TEXT');

    // --- Migration 081 (original): audio_peaks on clip_segments ---
    await addColumnIfMissing(db, 'clip_segments', 'audio_peaks', 'TEXT');

    // --- Migration 088: layer columns on editor overlay tables ---
    await addColumnIfMissing(db, 'video_editor_text_overlays', 'layer', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'video_editor_stickers', 'layer', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'video_editor_watermarks', 'layer', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'clip_watermarks', 'layer', 'INTEGER DEFAULT 0');

    // --- Migration 091: track_index on video_editor_sources ---
    await addColumnIfMissing(db, 'video_editor_sources', 'track_index', 'INTEGER DEFAULT 0');

    // --- Migration 089: auto_dvr_enabled on creator_profiles ---
    await addColumnIfMissing(db, 'creator_profiles', 'auto_dvr_enabled', 'INTEGER DEFAULT 0');

    // --- Migration 100: persistent live monitoring on monitored_streamers ---
    await addColumnIfMissing(
      db,
      'monitored_streamers',
      'persistent_auto_detect',
      'INTEGER DEFAULT 0'
    );
    await addColumnIfMissing(db, 'monitored_streamers', 'persistent_record', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'monitored_streamers', 'auto_detect_prompt_id', 'TEXT');
    await addColumnIfMissing(db, 'monitored_streamers', 'auto_detect_prompt_content', 'TEXT');
    await addColumnIfMissing(
      db,
      'monitored_streamers',
      'auto_detect_use_creator_layout',
      'INTEGER DEFAULT 0'
    );
    await addColumnIfMissing(db, 'monitored_streamers', 'auto_detect_creator_profile_id', 'TEXT');
    await addColumnIfMissing(
      db,
      'monitored_streamers',
      'record_use_creator_layout',
      'INTEGER DEFAULT 0'
    );
    await addColumnIfMissing(db, 'monitored_streamers', 'record_creator_profile_id', 'TEXT');

    // --- Migration 099: clip_build_defaults on creator_profiles (opt-in clip-build defaults) ---
    await addColumnIfMissing(db, 'creator_profiles', 'clip_build_defaults', 'TEXT DEFAULT NULL');

    // --- Migration 083: vod_presets table + project columns (also in vod-presets.ts) ---
    await addColumnIfMissing(db, 'projects', 'active_vod_preset_id', 'TEXT');
    await addColumnIfMissing(db, 'projects', 'active_vod_preset_config', 'TEXT');

    // --- Indexes (safe with IF NOT EXISTS) ---
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_creator_profiles_scope ON creator_profiles(scope)'
    );

    // --- Migration 083: vod_presets table (safe with IF NOT EXISTS) ---
    await db.execute(`CREATE TABLE IF NOT EXISTS vod_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      creator_profile_id TEXT,
      target_aspect_ratio TEXT NOT NULL,
      framing_config TEXT,
      layout_overlays TEXT,
      watermark_mode TEXT NOT NULL DEFAULT 'creator',
      custom_watermark_settings TEXT,
      user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE SET NULL
    )`);

    // --- Design Studio: image_assets new columns ---
    await addColumnIfMissing(db, 'image_assets', 'image_type', 'TEXT');
    await addColumnIfMissing(db, 'image_assets', 'source_type', 'TEXT');
    await addColumnIfMissing(db, 'image_assets', 'source_clip_id', 'TEXT');
    await addColumnIfMissing(db, 'image_assets', 'source_project_id', 'TEXT');
    await addColumnIfMissing(db, 'image_assets', 'canvas_width', 'INTEGER');
    await addColumnIfMissing(db, 'image_assets', 'canvas_height', 'INTEGER');
    await addColumnIfMissing(db, 'image_assets', 'export_format', 'TEXT');
    await addColumnIfMissing(db, 'image_assets', 'editor_project_json', 'TEXT');

    // --- Design Studio: clips cover image columns ---
    await addColumnIfMissing(db, 'clips', 'cover_image_id', 'TEXT');
    await addColumnIfMissing(db, 'clips', 'cover_image_path', 'TEXT');

    // --- Migrations 095-097: audio download tables ---
    await db.execute(`CREATE TABLE IF NOT EXISTS downloaded_audio (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('youtube', 'twitter', 'upload')),
      platform TEXT,
      source_url TEXT,
      file_path TEXT NOT NULL,
      duration REAL,
      file_size INTEGER,
      sample_rate INTEGER,
      channels INTEGER,
      thumbnail_url TEXT,
      user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_downloaded_audio_user_id ON downloaded_audio(user_id)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_downloaded_audio_created_at ON downloaded_audio(created_at DESC)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_downloaded_audio_source ON downloaded_audio(source)'
    );

    await db.execute(`CREATE TABLE IF NOT EXISTS audio_playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_audio_playlists_user_id ON audio_playlists(user_id)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_audio_playlists_created_at ON audio_playlists(created_at DESC)'
    );

    await db.execute(`CREATE TABLE IF NOT EXISTS audio_playlist_items (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      audio_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES audio_playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (audio_id) REFERENCES downloaded_audio(id) ON DELETE CASCADE
    )`);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_audio_playlist_items_playlist_id ON audio_playlist_items(playlist_id)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_audio_playlist_items_audio_id ON audio_playlist_items(audio_id)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_audio_playlist_items_position ON audio_playlist_items(playlist_id, position)'
    );

    // --- Cloud sync: raw_videos source metadata ---
    await addColumnIfMissing(db, 'raw_videos', 'platform', 'TEXT');
    await addColumnIfMissing(db, 'raw_videos', 'source_url', 'TEXT');

    await healProjectTimestamps(db);
    await healStaleProjectBranding(db);

    healed = true;
    console.log('[schema-healing] Schema healing complete');
  } catch (e) {
    console.error('[schema-healing] Schema healing failed:', e);
  }
}
