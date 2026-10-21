import type { ServerUserCreatorProfile } from '@clippster/api-client';
import type { CreatorProfileWithLinks } from './database/types';
import { getDatabase, getCurrentUserId, generateId } from './database/core';
import { getIntroOutroByServerId, getWatermarkByServerId } from './database';

export const creatorTimestamp = (value: number) => (value < 1e12 ? value * 1000 : value);
const json = (value: unknown) =>
  value == null ? null : typeof value === 'string' ? value : JSON.stringify(value);

/** Keep local IDs (including monitored links) stable while importing account profiles. */
export async function importPersonalCreator(
  remote: ServerUserCreatorProfile,
  local: CreatorProfileWithLinks | undefined,
  userId: number
) {
  if (getCurrentUserId() !== userId) throw new Error('Account changed during creator sync');
  const updated = Date.parse(remote.updated_at);
  if (!Number.isFinite(updated)) throw new Error(`Invalid updated_at for creator ${remote.id}`);
  if (local && creatorTimestamp(local.updated_at) >= updated) return false;
  const id = local?.id ?? generateId();
  const assetId = async (serverId: number | null, watermark = false) => {
    if (!serverId) return null;
    const asset = await (watermark
      ? getWatermarkByServerId(serverId)
      : getIntroOutroByServerId(serverId));
    if (!asset) throw new Error(`Creator asset ${serverId} has not downloaded yet`);
    return asset.id;
  };
  const [intro, outro, watermark] = await Promise.all([
    assetId(remote.intro_id),
    assetId(remote.outro_id),
    assetId(remote.watermark_id, true),
  ]);
  if (getCurrentUserId() !== userId) throw new Error('Account changed during creator sync');
  const db = await getDatabase();
  const fields = [
    'server_id',
    'name',
    'description',
    'profile_image_path',
    'intro_id',
    'outro_id',
    'watermark_id',
    'watermark_settings',
    'intro_outro_settings',
    'intro_ratio_settings',
    'outro_ratio_settings',
    'layout_overlays',
    'clip_build_defaults',
    'scope',
    'disabled',
    'auto_dvr_enabled',
    'user_id',
  ];
  const values = [
    remote.id,
    remote.name,
    remote.description ?? null,
    remote.profile_image_url ?? null,
    intro,
    outro,
    watermark,
    json(remote.watermark_settings),
    json(remote.intro_outro_settings),
    json(remote.intro_ratio_settings),
    json(remote.outro_ratio_settings),
    json(remote.layout_overlays),
    json(remote.clip_build_defaults),
    remote.scope || 'streamer',
    remote.disabled ? 1 : 0,
    remote.auto_dvr_enabled ? 1 : 0,
    userId,
  ];
  // Preserve the old timestamp until links finish, so interrupted imports retry.
  await db.execute(
    `INSERT INTO creator_profiles (id, ${fields.join(', ')}, created_at, updated_at)
    VALUES (?, ${fields.map(() => '?').join(', ')}, ?, ?)
    ON CONFLICT(id) DO UPDATE SET ${fields.map((field) => `${field} = excluded.${field}`).join(', ')}`,
    [id, ...values, Date.parse(remote.inserted_at || remote.updated_at) / 1000, 0]
  );
  const retained = new Set<string>();
  for (const link of remote.platform_links ?? []) {
    const platform = link.platform.toLowerCase() === 'youtube' ? 'YouTube' : link.platform;
    const existing = local?.platform_links.find(
      (item) => item.platform === platform && item.platform_id === link.platform_id
    );
    const linkId = existing?.id ?? generateId();
    retained.add(linkId);
    await db.execute(
      `INSERT INTO creator_platform_links
      (id, creator_profile_id, platform, platform_id, display_name, profile_image_url, is_primary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, profile_image_url = excluded.profile_image_url, is_primary = excluded.is_primary`,
      [
        linkId,
        id,
        platform,
        link.platform_id,
        link.display_name ?? null,
        link.profile_image_url ?? null,
        link.is_primary ? 1 : 0,
        updated / 1000,
      ]
    );
  }
  for (const link of local?.platform_links ?? []) {
    if (!retained.has(link.id))
      await db.execute('DELETE FROM creator_platform_links WHERE id = ?', [link.id]);
  }
  await db.execute('UPDATE creator_profiles SET updated_at = ? WHERE id = ?', [updated / 1000, id]);
  return true;
}
