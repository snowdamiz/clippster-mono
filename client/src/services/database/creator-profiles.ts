import { getDatabase, timestamp, generateId } from './core';
import type { CreatorProfile, CreatorPlatformLink, CreatorProfileWithLinks } from './types';

// ==================== Creator Profiles ====================

export async function getAllCreatorProfiles(): Promise<CreatorProfileWithLinks[]> {
  const db = await getDatabase();

  // Get all profiles
  const profiles = await db.select<CreatorProfile[]>(
    'SELECT * FROM creator_profiles ORDER BY created_at DESC'
  );

  // Get all platform links
  const links = await db.select<CreatorPlatformLink[]>(
    'SELECT * FROM creator_platform_links ORDER BY is_primary DESC, created_at ASC'
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

export async function createCreatorProfile(
  name: string,
  description?: string | null,
  profileImagePath?: string | null,
  introId?: string | null,
  outroId?: string | null,
  watermarkId?: string | null
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO creator_profiles (id, name, description, profile_image_path, intro_id, outro_id, watermark_id, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description || null,
      profileImagePath || null,
      introId || null,
      outroId || null,
      watermarkId || null,
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
