import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { CreatorProfile, CreatorPlatformLink, CreatorProfileWithLinks } from './types';

async function ensureAutoDvrColumn(db: any) {
  const columns = (await db.select('PRAGMA table_info(creator_profiles)')) as { name: string }[];
  const hasAutoDvr = columns.some((c: { name: string }) => c.name === 'auto_dvr_enabled');
  if (!hasAutoDvr) {
    await db.execute('ALTER TABLE creator_profiles ADD COLUMN auto_dvr_enabled INTEGER DEFAULT 0');
  }
}

async function ensureIntroOutroSettingsColumn(db: any) {
  const columns = (await db.select('PRAGMA table_info(creator_profiles)')) as { name: string }[];
  const hasIntroOutroSettings = columns.some((c: { name: string }) => c.name === 'intro_outro_settings');
  if (!hasIntroOutroSettings) {
    await db.execute('ALTER TABLE creator_profiles ADD COLUMN intro_outro_settings TEXT DEFAULT NULL');
  }
}

async function ensureRatioSettingsColumns(db: any) {
  const columns = (await db.select('PRAGMA table_info(creator_profiles)')) as { name: string }[];
  const hasIntroRatio = columns.some((c: { name: string }) => c.name === 'intro_ratio_settings');
  if (!hasIntroRatio) {
    await db.execute('ALTER TABLE creator_profiles ADD COLUMN intro_ratio_settings TEXT DEFAULT NULL');
  }
  const hasOutroRatio = columns.some((c: { name: string }) => c.name === 'outro_ratio_settings');
  if (!hasOutroRatio) {
    await db.execute('ALTER TABLE creator_profiles ADD COLUMN outro_ratio_settings TEXT DEFAULT NULL');
  }
}

async function ensureScopeColumn(db: any) {
  const columns = (await db.select('PRAGMA table_info(creator_profiles)')) as { name: string }[];
  const hasScope = columns.some((c: { name: string }) => c.name === 'scope');
  if (!hasScope) {
    await db.execute("ALTER TABLE creator_profiles ADD COLUMN scope TEXT NOT NULL DEFAULT 'streamer'");
  }
}

async function ensureLayoutOverlaysColumn(db: any) {
  const columns = (await db.select('PRAGMA table_info(creator_profiles)')) as { name: string }[];
  const has = columns.some((c: { name: string }) => c.name === 'layout_overlays');
  if (!has) {
    await db.execute('ALTER TABLE creator_profiles ADD COLUMN layout_overlays TEXT DEFAULT NULL');
  }
}

async function ensureSelectedBrandingColumn(db: any) {
  const columns = (await db.select('PRAGMA table_info(projects)')) as { name: string }[];
  const has = columns.some((c: { name: string }) => c.name === 'selected_branding_profile_id');
  if (!has) {
    await db.execute('ALTER TABLE projects ADD COLUMN selected_branding_profile_id TEXT REFERENCES creator_profiles(id) ON DELETE SET NULL');
  }
}

// ==================== Creator Profiles ====================

export async function getAllCreatorProfiles(): Promise<CreatorProfileWithLinks[]> {
  const db = await getDatabase();
  await ensureAutoDvrColumn(db);
  await ensureIntroOutroSettingsColumn(db);
  await ensureRatioSettingsColumns(db);
  await ensureScopeColumn(db);
  await ensureLayoutOverlaysColumn(db);
  const userId = getCurrentUserId();

  // Get all profiles for current user
  let profiles: CreatorProfile[];
  if (userId === null) {
    profiles = await db.select<CreatorProfile[]>(
      'SELECT * FROM creator_profiles WHERE user_id IS NULL ORDER BY created_at DESC'
    );
  } else {
    profiles = await db.select<CreatorProfile[]>(
      'SELECT * FROM creator_profiles WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
      [userId]
    );
  }

  // Get profile IDs for filtering links
  const profileIds = profiles.map((p) => p.id);

  if (profileIds.length === 0) {
    return [];
  }

  // Get all platform links for these profiles
  const placeholders = profileIds.map(() => '?').join(',');
  const links = await db.select<CreatorPlatformLink[]>(
    `SELECT * FROM creator_platform_links WHERE creator_profile_id IN (${placeholders}) ORDER BY is_primary DESC, created_at ASC`,
    profileIds
  );

  // Group links by profile
  const linksByProfile = new Map<string, CreatorPlatformLink[]>();
  for (const link of links) {
    const existing = linksByProfile.get(link.creator_profile_id) || [];
    existing.push(link);
    linksByProfile.set(link.creator_profile_id, existing);
  }

  // Combine profiles with their links
  return profiles.map((profile) => ({
    ...profile,
    auto_dvr_enabled: profile.auto_dvr_enabled ?? 0,
    platform_links: linksByProfile.get(profile.id) || [],
  }));
}

export async function getCreatorProfile(id: string): Promise<CreatorProfileWithLinks | null> {
  const db = await getDatabase();
  await ensureAutoDvrColumn(db);
  await ensureIntroOutroSettingsColumn(db);
  await ensureRatioSettingsColumns(db);
  await ensureScopeColumn(db);
  await ensureLayoutOverlaysColumn(db);

  const profiles = await db.select<CreatorProfile[]>(
    'SELECT * FROM creator_profiles WHERE id = ?',
    [id]
  );

  if (profiles.length === 0) {
    return null;
  }

  const links = await db.select<CreatorPlatformLink[]>(
    'SELECT * FROM creator_platform_links WHERE creator_profile_id = ? ORDER BY is_primary DESC, created_at ASC',
    [id]
  );

  return {
    ...profiles[0],
    auto_dvr_enabled: profiles[0].auto_dvr_enabled ?? 0,
    platform_links: links,
  };
}

// Default watermark settings - only 16:9 enabled by default
// null means watermark is disabled for that aspect ratio
// Each ratio can now have its own watermarkId AND position settings
// Default position is bottom-left (12% horizontal, 92% vertical, 20% size)
const DEFAULT_WATERMARK_SETTINGS = JSON.stringify({
  '16:9': { watermarkId: null, position: { x: 12, y: 92, opacity: 80, scale: 20 } },
  '9:16': null,
  '1:1': null,
  '4:5': null,
});

// Default intro/outro settings - all ratios disabled by default
// Users can enable specific ratios in the UI
const DEFAULT_INTRO_OUTRO_SETTINGS = JSON.stringify({
  '16:9': { introId: null, outroId: null },
  '9:16': null,
  '1:1': null,
  '4:5': null,
});

export async function createCreatorProfile(
  name: string,
  description?: string | null,
  profileImagePath?: string | null,
  introId?: string | null,
  outroId?: string | null,
  watermarkId?: string | null,
  watermarkSettings?: string | null,
  introOutroSettings?: string | null,
  autoDvrEnabled: boolean = false,
  introRatioSettings?: string | null,
  outroRatioSettings?: string | null,
  scope: 'streamer' | 'global' = 'streamer',
  layoutOverlays?: string | null
): Promise<string> {
  const db = await getDatabase();
  await ensureAutoDvrColumn(db);
  await ensureIntroOutroSettingsColumn(db);
  await ensureRatioSettingsColumns(db);
  await ensureScopeColumn(db);
  await ensureLayoutOverlaysColumn(db);
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO creator_profiles (id, name, description, profile_image_path, intro_id, outro_id, watermark_id, watermark_settings, intro_outro_settings, auto_dvr_enabled, intro_ratio_settings, outro_ratio_settings, scope, layout_overlays, user_id, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description || null,
      profileImagePath || null,
      introId || null,
      outroId || null,
      watermarkId || null,
      watermarkSettings || DEFAULT_WATERMARK_SETTINGS,
      introOutroSettings || DEFAULT_INTRO_OUTRO_SETTINGS,
      autoDvrEnabled ? 1 : 0,
      introRatioSettings || null,
      outroRatioSettings || null,
      scope,
      layoutOverlays || null,
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function updateCreatorProfile(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    profile_image_path: string | null;
    intro_id: string | null;
    outro_id: string | null;
    watermark_id: string | null;
    watermark_settings: string | null;
    intro_outro_settings: string | null;
    intro_ratio_settings: string | null;
    outro_ratio_settings: string | null;
    auto_dvr_enabled: number | boolean;
    scope: 'streamer' | 'global';
    layout_overlays: string | null;
  }>
): Promise<void> {
  const db = await getDatabase();
  await ensureAutoDvrColumn(db);
  await ensureIntroOutroSettingsColumn(db);
  await ensureRatioSettingsColumns(db);
  await ensureScopeColumn(db);
  await ensureLayoutOverlaysColumn(db);
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }

  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }

  if (updates.profile_image_path !== undefined) {
    fields.push('profile_image_path = ?');
    values.push(updates.profile_image_path);
  }

  if (updates.intro_id !== undefined) {
    fields.push('intro_id = ?');
    values.push(updates.intro_id);
  }

  if (updates.outro_id !== undefined) {
    fields.push('outro_id = ?');
    values.push(updates.outro_id);
  }

  if (updates.watermark_id !== undefined) {
    fields.push('watermark_id = ?');
    values.push(updates.watermark_id);
  }

  if (updates.watermark_settings !== undefined) {
    fields.push('watermark_settings = ?');
    values.push(updates.watermark_settings);
  }

  if (updates.intro_outro_settings !== undefined) {
    fields.push('intro_outro_settings = ?');
    values.push(updates.intro_outro_settings);
  }

  if (updates.intro_ratio_settings !== undefined) {
    fields.push('intro_ratio_settings = ?');
    values.push(updates.intro_ratio_settings);
  }

  if (updates.outro_ratio_settings !== undefined) {
    fields.push('outro_ratio_settings = ?');
    values.push(updates.outro_ratio_settings);
  }

  if (updates.auto_dvr_enabled !== undefined) {
    fields.push('auto_dvr_enabled = ?');
    values.push(updates.auto_dvr_enabled ? 1 : 0);
  }

  if (updates.scope !== undefined) {
    fields.push('scope = ?');
    values.push(updates.scope);
  }

  if (updates.layout_overlays !== undefined) {
    fields.push('layout_overlays = ?');
    values.push(updates.layout_overlays);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = ?');
  values.push(timestamp());
  values.push(id);

  await db.execute(`UPDATE creator_profiles SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteCreatorProfile(id: string): Promise<void> {
  const db = await getDatabase();
  // Platform links will be cascade deleted
  await db.execute('DELETE FROM creator_profiles WHERE id = ?', [id]);
}

// ==================== Global Branding Profiles ====================

export async function getAllGlobalProfiles(): Promise<CreatorProfileWithLinks[]> {
  const db = await getDatabase();
  await ensureAutoDvrColumn(db);
  await ensureIntroOutroSettingsColumn(db);
  await ensureRatioSettingsColumns(db);
  await ensureScopeColumn(db);
  const userId = getCurrentUserId();

  let profiles: CreatorProfile[];
  if (userId === null) {
    profiles = await db.select<CreatorProfile[]>(
      "SELECT * FROM creator_profiles WHERE scope = 'global' AND user_id IS NULL ORDER BY created_at DESC"
    );
  } else {
    profiles = await db.select<CreatorProfile[]>(
      "SELECT * FROM creator_profiles WHERE scope = 'global' AND (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC",
      [userId]
    );
  }

  // Global profiles don't need platform links, but return them for interface consistency
  return profiles.map((profile) => ({
    ...profile,
    auto_dvr_enabled: profile.auto_dvr_enabled ?? 0,
    platform_links: [],
  }));
}

export async function getAllStreamerProfiles(): Promise<CreatorProfileWithLinks[]> {
  const db = await getDatabase();
  await ensureAutoDvrColumn(db);
  await ensureIntroOutroSettingsColumn(db);
  await ensureRatioSettingsColumns(db);
  await ensureScopeColumn(db);
  const userId = getCurrentUserId();

  let profiles: CreatorProfile[];
  if (userId === null) {
    profiles = await db.select<CreatorProfile[]>(
      "SELECT * FROM creator_profiles WHERE scope = 'streamer' AND user_id IS NULL ORDER BY created_at DESC"
    );
  } else {
    profiles = await db.select<CreatorProfile[]>(
      "SELECT * FROM creator_profiles WHERE scope = 'streamer' AND (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC",
      [userId]
    );
  }

  const profileIds = profiles.map((p) => p.id);
  if (profileIds.length === 0) return [];

  const placeholders = profileIds.map(() => '?').join(',');
  const links = await db.select<CreatorPlatformLink[]>(
    `SELECT * FROM creator_platform_links WHERE creator_profile_id IN (${placeholders}) ORDER BY is_primary DESC, created_at ASC`,
    profileIds
  );

  const linksByProfile = new Map<string, CreatorPlatformLink[]>();
  for (const link of links) {
    const existing = linksByProfile.get(link.creator_profile_id) || [];
    existing.push(link);
    linksByProfile.set(link.creator_profile_id, existing);
  }

  return profiles.map((profile) => ({
    ...profile,
    auto_dvr_enabled: profile.auto_dvr_enabled ?? 0,
    platform_links: linksByProfile.get(profile.id) || [],
  }));
}

export async function setProjectBrandingProfile(
  projectId: string,
  brandingProfileId: string | null
): Promise<void> {
  const db = await getDatabase();
  await ensureSelectedBrandingColumn(db);
  const now = timestamp();
  await db.execute(
    'UPDATE projects SET selected_branding_profile_id = ?, updated_at = ? WHERE id = ?',
    [brandingProfileId, now, projectId]
  );
}

export async function getProjectBrandingProfileId(
  projectId: string
): Promise<string | null> {
  const db = await getDatabase();
  await ensureSelectedBrandingColumn(db);
  const results = await db.select<{ selected_branding_profile_id: string | null }[]>(
    'SELECT selected_branding_profile_id FROM projects WHERE id = ?',
    [projectId]
  );
  return results[0]?.selected_branding_profile_id || null;
}

// ==================== Platform Links ====================

export async function addPlatformLink(
  creatorProfileId: string,
  platform: CreatorPlatformLink['platform'],
  platformId: string,
  displayName?: string | null,
  profileImageUrl?: string | null,
  monitoredStreamerId?: string | null,
  isPrimary: boolean = false
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  // If this is set as primary, unset any existing primary for this profile
  if (isPrimary) {
    await db.execute(
      'UPDATE creator_platform_links SET is_primary = 0 WHERE creator_profile_id = ?',
      [creatorProfileId]
    );
  }

  await db.execute(
    `INSERT INTO creator_platform_links (id, creator_profile_id, platform, platform_id, display_name, profile_image_url, monitored_streamer_id, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      creatorProfileId,
      platform,
      platformId,
      displayName || null,
      profileImageUrl || null,
      monitoredStreamerId || null,
      isPrimary ? 1 : 0,
      now,
    ]
  );

  // Update the parent profile's updated_at
  await db.execute('UPDATE creator_profiles SET updated_at = ? WHERE id = ?', [
    now,
    creatorProfileId,
  ]);

  return id;
}

export async function updatePlatformLink(
  id: string,
  updates: Partial<{
    platform: CreatorPlatformLink['platform'];
    platform_id: string;
    display_name: string | null;
    profile_image_url: string | null;
    monitored_streamer_id: string | null;
    is_primary: boolean;
  }>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  console.log(`[DB] updatePlatformLink called for ${id}`, updates);

  if (updates.platform !== undefined) {
    fields.push('platform = ?');
    values.push(updates.platform);
  }

  if (updates.platform_id !== undefined) {
    fields.push('platform_id = ?');
    values.push(updates.platform_id);
  }

  if (updates.display_name !== undefined) {
    fields.push('display_name = ?');
    values.push(updates.display_name);
  }

  if (updates.profile_image_url !== undefined) {
    fields.push('profile_image_url = ?');
    values.push(updates.profile_image_url);
  }

  if (updates.monitored_streamer_id !== undefined) {
    fields.push('monitored_streamer_id = ?');
    values.push(updates.monitored_streamer_id);
  }

  if (updates.is_primary !== undefined) {
    // If setting as primary, unset others first
    if (updates.is_primary) {
      const link = await db.select<CreatorPlatformLink[]>(
        'SELECT creator_profile_id FROM creator_platform_links WHERE id = ?',
        [id]
      );
      if (link.length > 0) {
        await db.execute(
          'UPDATE creator_platform_links SET is_primary = 0 WHERE creator_profile_id = ?',
          [link[0].creator_profile_id]
        );
      }
    }
    fields.push('is_primary = ?');
    values.push(updates.is_primary ? 1 : 0);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);

  await db.execute(`UPDATE creator_platform_links SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deletePlatformLink(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM creator_platform_links WHERE id = ?', [id]);
}

export async function getPlatformLinksByCreator(
  creatorProfileId: string
): Promise<CreatorPlatformLink[]> {
  const db = await getDatabase();
  return await db.select<CreatorPlatformLink[]>(
    'SELECT * FROM creator_platform_links WHERE creator_profile_id = ? ORDER BY is_primary DESC, created_at ASC',
    [creatorProfileId]
  );
}

export async function getPlatformLinkByPlatformId(
  platform: CreatorPlatformLink['platform'],
  platformId: string
): Promise<CreatorPlatformLink | null> {
  const db = await getDatabase();
  const links = await db.select<CreatorPlatformLink[]>(
    'SELECT * FROM creator_platform_links WHERE platform = ? AND platform_id = ?',
    [platform, platformId]
  );
  return links[0] || null;
}

// ==================== Helper Functions ====================

export async function linkMonitoredStreamer(
  platformLinkId: string,
  monitoredStreamerId: string
): Promise<void> {
  await updatePlatformLink(platformLinkId, { monitored_streamer_id: monitoredStreamerId });
}

export async function unlinkMonitoredStreamer(platformLinkId: string): Promise<void> {
  await updatePlatformLink(platformLinkId, { monitored_streamer_id: null });
}

export async function getCreatorProfileByMonitoredStreamer(
  monitoredStreamerId: string
): Promise<CreatorProfileWithLinks | null> {
  const db = await getDatabase();

  const links = await db.select<CreatorPlatformLink[]>(
    'SELECT * FROM creator_platform_links WHERE monitored_streamer_id = ?',
    [monitoredStreamerId]
  );

  if (links.length === 0) {
    return null;
  }

  return await getCreatorProfile(links[0].creator_profile_id);
}

/**
 * Get a creator profile by platform and platform ID (e.g., 'pumpfun' + mint ID, or 'kick' + username)
 * This is useful when downloading from the VODs page to apply creator watermark settings
 */
export async function getCreatorProfileByPlatformId(
  platform: CreatorPlatformLink['platform'],
  platformId: string
): Promise<CreatorProfileWithLinks | null> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  const normalize = (val: string | null | undefined) => val?.trim().toLowerCase() || '';
  const stripPump = (val: string) => (val.toLowerCase().endsWith('pump') ? val.slice(0, -4) : val);

  const candidates = Array.from(
    new Set([normalize(platformId), normalize(stripPump(platformId))])
  ).filter(Boolean);

  // Try exact normalized matches first
  for (const candidate of candidates) {
    const links = await db.select<CreatorPlatformLink[]>(
      'SELECT * FROM creator_platform_links WHERE platform = ? AND LOWER(TRIM(platform_id)) = ?',
      [platform, candidate]
    );
    if (links.length > 0) {
      const profile = await getCreatorProfile(links[0].creator_profile_id);
      if (profile) return profile;
    }
  }

  // Fallback: fetch all links for this platform and match by prefix/strip rules
  const allLinks = await db.select<CreatorPlatformLink[]>(
    'SELECT * FROM creator_platform_links WHERE platform = ?',
    [platform]
  );

  for (const link of allLinks) {
    const linkNorm = normalize(link.platform_id);
    const linkNormStripped = normalize(stripPump(link.platform_id));

    const hasMatch =
      candidates.includes(linkNorm) ||
      candidates.includes(linkNormStripped) ||
      linkNorm.startsWith(candidates[0]) ||
      candidates[0].startsWith(linkNorm);

    if (hasMatch) {
      const profile = await getCreatorProfile(link.creator_profile_id);
      if (profile) return profile;
    }
  }

  return null;
}

export async function getCreatorProfileByProjectId(
  projectId: string
): Promise<CreatorProfileWithLinks | null> {
  const db = await getDatabase();

  // Method 1: Check for direct creator_profile_id association (for local video imports)
  const projects = await db.select<{ creator_profile_id: string | null }[]>(
    'SELECT creator_profile_id FROM projects WHERE id = ?',
    [projectId]
  );

  if (projects.length > 0 && projects[0].creator_profile_id) {
    const profile = await getCreatorProfile(projects[0].creator_profile_id);
    if (profile) {
      console.log('[CreatorProfiles] Found profile via direct association');
      return profile;
    }
  }

  // Method 2: Find via livestream session (for live monitoring projects)
  const sessions = await db.select<{ monitored_streamer_id: string }[]>(
    'SELECT monitored_streamer_id FROM livestream_sessions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
    [projectId]
  );

  if (sessions.length > 0 && sessions[0].monitored_streamer_id) {
    const profile = await getCreatorProfileByMonitoredStreamer(sessions[0].monitored_streamer_id);
    if (profile) {
      console.log('[CreatorProfiles] Found profile via livestream session');
      return profile;
    }
  }

  // Method 3: Find via project platform + raw video source_mint_id (for VOD downloads)
  // Get the project's platform
  const projectData = await db.select<{ platform: string | null }[]>(
    'SELECT platform FROM projects WHERE id = ?',
    [projectId]
  );

  if (projectData.length === 0 || !projectData[0].platform) {
    console.log('[CreatorProfiles] No project or platform found for:', projectId);
    return null;
  }

  const projectPlatform = projectData[0].platform;
  console.log('[CreatorProfiles] Project platform:', projectPlatform);

  // Map project platform names to creator_platform_links platform values
  const platformMap: Record<string, CreatorPlatformLink['platform']> = {
    PumpFun: 'pumpfun',
    Kick: 'kick',
    Twitch: 'twitch',
    Youtube: 'youtube',
  };

  const linkPlatform = platformMap[projectPlatform];
  if (!linkPlatform) {
    console.log('[CreatorProfiles] Unknown platform:', projectPlatform);
    return null;
  }

  // Get the source_mint_id from raw videos in this project
  const rawVideos = await db.select<{ source_mint_id: string | null }[]>(
    'SELECT source_mint_id FROM raw_videos WHERE project_id = ? AND source_mint_id IS NOT NULL LIMIT 1',
    [projectId]
  );

  if (rawVideos.length === 0 || !rawVideos[0].source_mint_id) {
    console.log(
      '[CreatorProfiles] No raw videos with source_mint_id found for project:',
      projectId
    );
    return null;
  }

  const sourceMintId = rawVideos[0].source_mint_id;
  console.log(
    '[CreatorProfiles] Looking for creator link with platform:',
    linkPlatform,
    'platformId:',
    sourceMintId
  );

  // Find creator platform link by platform + platform_id
  // Use case-insensitive comparison for Kick channel slugs (and other platforms just in case)
  const links = await db.select<CreatorPlatformLink[]>(
    'SELECT * FROM creator_platform_links WHERE platform = ? AND LOWER(platform_id) = LOWER(?)',
    [linkPlatform, sourceMintId]
  );

  if (links.length === 0) {
    console.log(
      '[CreatorProfiles] No creator platform link found for:',
      linkPlatform,
      sourceMintId
    );
    return null;
  }

  console.log('[CreatorProfiles] Found creator platform link:', links[0].creator_profile_id);
  return await getCreatorProfile(links[0].creator_profile_id);
}
