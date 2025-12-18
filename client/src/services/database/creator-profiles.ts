import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { CreatorProfile, CreatorPlatformLink, CreatorProfileWithLinks } from './types';

// ==================== Creator Profiles ====================

export async function getAllCreatorProfiles(): Promise<CreatorProfileWithLinks[]> {
  const db = await getDatabase();
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
    platform_links: linksByProfile.get(profile.id) || [],
  }));
}

export async function getCreatorProfile(id: string): Promise<CreatorProfileWithLinks | null> {
  const db = await getDatabase();

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

export async function createCreatorProfile(
  name: string,
  description?: string | null,
  profileImagePath?: string | null,
  introId?: string | null,
  outroId?: string | null,
  watermarkId?: string | null,
  watermarkSettings?: string | null
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO creator_profiles (id, name, description, profile_image_path, intro_id, outro_id, watermark_id, watermark_settings, user_id, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description || null,
      profileImagePath || null,
      introId || null,
      outroId || null,
      watermarkId || null,
      watermarkSettings || DEFAULT_WATERMARK_SETTINGS,
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
  }>
): Promise<void> {
  const db = await getDatabase();
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
    display_name: string | null;
    profile_image_url: string | null;
    monitored_streamer_id: string | null;
    is_primary: boolean;
  }>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

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

export async function getCreatorProfileByProjectId(
  projectId: string
): Promise<CreatorProfileWithLinks | null> {
  const db = await getDatabase();

  // Method 1: Find via livestream session (for live monitoring projects)
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

  // Method 2: Find via project platform + raw video source_mint_id (for VOD downloads)
  // Get the project's platform
  const projects = await db.select<{ platform: string | null }[]>(
    'SELECT platform FROM projects WHERE id = ?',
    [projectId]
  );

  if (projects.length === 0 || !projects[0].platform) {
    console.log('[CreatorProfiles] No project or platform found for:', projectId);
    return null;
  }

  const projectPlatform = projects[0].platform;
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
