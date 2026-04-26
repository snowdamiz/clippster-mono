import { getDatabase } from './core';

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

    await db.execute(`CREATE TABLE IF NOT EXISTS downloaded_space_metadata (
      id TEXT PRIMARY KEY,
      audio_id TEXT NOT NULL,
      source_url TEXT,
      title TEXT,
      participants_json TEXT,
      speaker_segments_json TEXT,
      stage_snapshots_json TEXT,
      user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (audio_id) REFERENCES downloaded_audio(id) ON DELETE CASCADE
    )`);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_downloaded_space_metadata_audio_id ON downloaded_space_metadata(audio_id)'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_downloaded_space_metadata_user_id ON downloaded_space_metadata(user_id)'
    );
    await addColumnIfMissing(db, 'downloaded_space_metadata', 'stage_snapshots_json', 'TEXT');

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

    healed = true;
    console.log('[schema-healing] Schema healing complete');
  } catch (e) {
    console.error('[schema-healing] Schema healing failed:', e);
  }
}
