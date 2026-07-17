import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { IntroOutro, WatermarkImage, AudioAsset, ImageAsset } from './types';

/**
 * Ensures the organization_id column exists on all asset tables.
 * Also adds server_id column for sync tracking.
 * Should be called on app startup.
 */
export async function ensureOrganizationAssetColumns(): Promise<void> {
  const db = await getDatabase();

  const tables = ['intro_outros', 'watermark_images', 'audio_assets', 'image_assets'];

  for (const table of tables) {
    try {
      // Check existing columns
      const columns = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
      const columnNames = columns.map((col) => col.name);

      // Add organization_id column if missing
      if (!columnNames.includes('organization_id')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN organization_id TEXT`);
        console.log(`[OrgAssets] Added organization_id column to ${table}`);
      }

      // Add server_id column if missing (for sync tracking)
      if (!columnNames.includes('server_id')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN server_id INTEGER`);
        console.log(`[OrgAssets] Added server_id column to ${table}`);
      }

      // Add organization_name column if missing (for display)
      if (!columnNames.includes('organization_name')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN organization_name TEXT`);
        console.log(`[OrgAssets] Added organization_name column to ${table}`);
      }

      // Add sync_status column if missing
      if (!columnNames.includes('sync_status')) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN sync_status TEXT DEFAULT 'synced'`);
        console.log(`[OrgAssets] Added sync_status column to ${table}`);
      }
    } catch (error) {
      console.error(`[OrgAssets] Error adding columns to ${table}:`, error);
    }
  }

  // Create indexes for organization queries
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_intro_outros_org ON intro_outros(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_watermark_images_org ON watermark_images(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_org ON audio_assets(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_image_assets_org ON image_assets(organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_intro_outros_server ON intro_outros(server_id)',
    'CREATE INDEX IF NOT EXISTS idx_watermark_images_server ON watermark_images(server_id)',
    'CREATE INDEX IF NOT EXISTS idx_audio_assets_server ON audio_assets(server_id)',
    'CREATE INDEX IF NOT EXISTS idx_image_assets_server ON image_assets(server_id)',
  ];

  for (const indexSql of indexes) {
    try {
      await db.execute(indexSql);
    } catch (error) {
      // Index may already exist, ignore
    }
  }

  console.log('[OrgAssets] Migration completed');
}

// ============================================
// Organization Intro/Outro Functions
// ============================================

export async function createOrganizationIntroOutro(
  type: 'intro' | 'outro',
  name: string,
  filePath: string,
  organizationId: string,
  organizationName: string,
  serverId: number,
  options?: {
    duration?: number;
    thumbnailPath?: string | null;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO intro_outros (
      id, type, name, file_path, duration, thumbnail_path, thumbnail_generation_status,
      user_id, organization_id, organization_name, server_id, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      type,
      name,
      filePath,
      options?.duration || null,
      options?.thumbnailPath || null,
      'completed',
      userId,
      organizationId,
      organizationName,
      serverId,
      'synced',
      now,
      now,
    ]
  );

  return id;
}

export async function getOrganizationIntroOutros(organizationId: string): Promise<IntroOutro[]> {
  const db = await getDatabase();
  return await db.select<IntroOutro[]>(
    'SELECT * FROM intro_outros WHERE organization_id = ? ORDER BY type, name',
    [organizationId]
  );
}

export async function getAllOrganizationIntroOutros(): Promise<IntroOutro[]> {
  const db = await getDatabase();
  return await db.select<IntroOutro[]>(
    'SELECT * FROM intro_outros WHERE organization_id IS NOT NULL ORDER BY organization_name, type, name'
  );
}

export async function getIntroOutroByServerId(serverId: number): Promise<IntroOutro | null> {
  const db = await getDatabase();
  const results = await db.select<IntroOutro[]>('SELECT * FROM intro_outros WHERE server_id = ?', [
    serverId,
  ]);
  return results[0] || null;
}

// ============================================
// Organization Watermark Functions
// ============================================

export async function createOrganizationWatermark(
  name: string,
  filePath: string,
  organizationId: string,
  organizationName: string,
  serverId: number,
  options?: {
    width?: number;
    height?: number;
    fileSize?: number;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO watermark_images (
      id, name, file_path, width, height, file_size,
      user_id, organization_id, organization_name, server_id, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      filePath,
      options?.width || null,
      options?.height || null,
      options?.fileSize || null,
      userId,
      organizationId,
      organizationName,
      serverId,
      'synced',
      now,
      now,
    ]
  );

  return id;
}

export async function getOrganizationWatermarks(organizationId: string): Promise<WatermarkImage[]> {
  const db = await getDatabase();
  return await db.select<WatermarkImage[]>(
    'SELECT * FROM watermark_images WHERE organization_id = ? ORDER BY name',
    [organizationId]
  );
}

export async function getAllOrganizationWatermarks(): Promise<WatermarkImage[]> {
  const db = await getDatabase();
  return await db.select<WatermarkImage[]>(
    'SELECT * FROM watermark_images WHERE organization_id IS NOT NULL ORDER BY organization_name, name'
  );
}

export async function getWatermarkByServerId(serverId: number): Promise<WatermarkImage | null> {
  const db = await getDatabase();
  const results = await db.select<WatermarkImage[]>(
    'SELECT * FROM watermark_images WHERE server_id = ?',
    [serverId]
  );
  return results[0] || null;
}

// ============================================
// Organization Audio Asset Functions
// ============================================

/** Server ID offset for shared audio (distinct from organization_assets IDs). */
export const SHARED_AUDIO_SERVER_ID_OFFSET = 2_000_000_000;

export function sharedAudioServerId(sharedAudioId: number): number {
  return SHARED_AUDIO_SERVER_ID_OFFSET + sharedAudioId;
}

export async function createOrganizationAudioAsset(
  name: string,
  filePath: string,
  organizationId: string,
  organizationName: string,
  serverId: number,
  options?: {
    duration?: number;
    fileSize?: number;
    sampleRate?: number;
    channels?: number;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO audio_assets (
      id, name, file_path, duration, file_size, sample_rate, channels,
      user_id, organization_id, organization_name, server_id, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      filePath,
      options?.duration || null,
      options?.fileSize || null,
      options?.sampleRate || null,
      options?.channels || null,
      userId,
      organizationId,
      organizationName,
      serverId,
      'synced',
      now,
      now,
    ]
  );

  return id;
}

export async function getOrganizationAudioAssets(organizationId: string): Promise<AudioAsset[]> {
  const db = await getDatabase();
  return await db.select<AudioAsset[]>(
    'SELECT * FROM audio_assets WHERE organization_id = ? ORDER BY name',
    [organizationId]
  );
}

export async function getAllOrganizationAudioAssets(): Promise<AudioAsset[]> {
  const db = await getDatabase();
  return await db.select<AudioAsset[]>(
    'SELECT * FROM audio_assets WHERE organization_id IS NOT NULL ORDER BY organization_name, name'
  );
}

export async function getAudioAssetByServerId(serverId: number): Promise<AudioAsset | null> {
  const db = await getDatabase();
  const results = await db.select<AudioAsset[]>('SELECT * FROM audio_assets WHERE server_id = ?', [
    serverId,
  ]);
  return results[0] || null;
}

// ============================================
// Organization Image Asset Functions
// ============================================

export async function createOrganizationImageAsset(
  name: string,
  filePath: string,
  organizationId: string,
  organizationName: string,
  serverId: number,
  options?: {
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO image_assets (
      id, name, file_path, width, height, file_size, mime_type,
      user_id, organization_id, organization_name, server_id, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      filePath,
      options?.width || null,
      options?.height || null,
      options?.fileSize || null,
      options?.mimeType || null,
      userId,
      organizationId,
      organizationName,
      serverId,
      'synced',
      now,
      now,
    ]
  );

  return id;
}

export async function getOrganizationImageAssets(organizationId: string): Promise<ImageAsset[]> {
  const db = await getDatabase();
  return await db.select<ImageAsset[]>(
    'SELECT * FROM image_assets WHERE organization_id = ? ORDER BY name',
    [organizationId]
  );
}

export async function getAllOrganizationImageAssets(): Promise<ImageAsset[]> {
  const db = await getDatabase();
  return await db.select<ImageAsset[]>(
    'SELECT * FROM image_assets WHERE organization_id IS NOT NULL ORDER BY organization_name, name'
  );
}

export async function getImageAssetByServerId(serverId: number): Promise<ImageAsset | null> {
  const db = await getDatabase();
  const results = await db.select<ImageAsset[]>('SELECT * FROM image_assets WHERE server_id = ?', [
    serverId,
  ]);
  return results[0] || null;
}

// ============================================
// Sync Helper Functions
// ============================================

/**
 * Get all local organization asset server IDs for a given organization.
 * Used for sync comparison.
 */
export async function getLocalOrgAssetServerIds(organizationId: string): Promise<{
  introOutros: number[];
  watermarks: number[];
  audioAssets: number[];
  imageAssets: number[];
}> {
  const db = await getDatabase();

  const introOutros = await db.select<{ server_id: number }[]>(
    'SELECT server_id FROM intro_outros WHERE organization_id = ? AND server_id IS NOT NULL',
    [organizationId]
  );

  const watermarks = await db.select<{ server_id: number }[]>(
    'SELECT server_id FROM watermark_images WHERE organization_id = ? AND server_id IS NOT NULL',
    [organizationId]
  );

  const audioAssets = await db.select<{ server_id: number }[]>(
    'SELECT server_id FROM audio_assets WHERE organization_id = ? AND server_id IS NOT NULL',
    [organizationId]
  );

  const imageAssets = await db.select<{ server_id: number }[]>(
    'SELECT server_id FROM image_assets WHERE organization_id = ? AND server_id IS NOT NULL',
    [organizationId]
  );

  return {
    introOutros: introOutros.map((r) => r.server_id),
    watermarks: watermarks.map((r) => r.server_id),
    audioAssets: audioAssets.map((r) => r.server_id),
    imageAssets: imageAssets.map((r) => r.server_id),
  };
}

/**
 * Delete all organization assets for organizations the user is no longer a member of.
 */
export async function deleteAssetsForRemovedOrganizations(
  currentOrgIds: string[]
): Promise<number> {
  const db = await getDatabase();
  let deletedCount = 0;

  if (currentOrgIds.length === 0) {
    // User is not in any org, delete all org assets
    const tables = ['intro_outros', 'watermark_images', 'audio_assets', 'image_assets'];
    for (const table of tables) {
      const result = await db.execute(`DELETE FROM ${table} WHERE organization_id IS NOT NULL`);
      deletedCount += result.rowsAffected || 0;
    }
  } else {
    // Delete assets from orgs user is no longer in
    const placeholders = currentOrgIds.map(() => '?').join(', ');
    const tables = ['intro_outros', 'watermark_images', 'audio_assets', 'image_assets'];

    for (const table of tables) {
      const result = await db.execute(
        `DELETE FROM ${table} WHERE organization_id IS NOT NULL AND organization_id NOT IN (${placeholders})`,
        currentOrgIds
      );
      deletedCount += result.rowsAffected || 0;
    }
  }

  if (deletedCount > 0) {
    console.log(`[OrgAssets] Deleted ${deletedCount} assets from removed organizations`);
  }

  return deletedCount;
}

/**
 * Delete a specific organization asset by server ID.
 */
export async function deleteOrgAssetByServerId(
  assetType: 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'overlay',
  serverId: number
): Promise<boolean> {
  const db = await getDatabase();

  let table: string;
  switch (assetType) {
    case 'intro':
    case 'outro':
      table = 'intro_outros';
      break;
    case 'watermark':
      table = 'watermark_images';
      break;
    case 'audio':
      table = 'audio_assets';
      break;
    case 'image':
    case 'overlay':
      table = 'image_assets';
      break;
    default:
      return false;
  }

  const result = await db.execute(`DELETE FROM ${table} WHERE server_id = ?`, [serverId]);
  return (result.rowsAffected || 0) > 0;
}

/**
 * Update sync status for an asset.
 */
export async function updateAssetSyncStatus(
  assetType: 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'overlay',
  serverId: number,
  status: 'synced' | 'downloading' | 'error'
): Promise<void> {
  const db = await getDatabase();

  let table: string;
  switch (assetType) {
    case 'intro':
    case 'outro':
      table = 'intro_outros';
      break;
    case 'watermark':
      table = 'watermark_images';
      break;
    case 'audio':
      table = 'audio_assets';
      break;
    case 'image':
    case 'overlay':
      table = 'image_assets';
      break;
    default:
      return;
  }

  await db.execute(`UPDATE ${table} SET sync_status = ? WHERE server_id = ?`, [status, serverId]);
}
