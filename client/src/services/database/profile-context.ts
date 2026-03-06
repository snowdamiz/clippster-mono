import { getDatabase, generateId, timestamp } from './core';

export interface ProfileUsageContext {
  id: string;
  user_id: string;
  creator_profile_id: string;
  context_type: 'personal' | 'organization' | 'campaign';
  organization_id: number | null;
  organization_name: string | null;
  campaign_id: number | null;
  campaign_title: string | null;
  last_used_at: number;
  created_at: number;
}

export async function ensureProfileContextSchema(db: any) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profile_usage_context (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      creator_profile_id TEXT NOT NULL,
      context_type TEXT NOT NULL,
      organization_id INTEGER,
      organization_name TEXT,
      campaign_id INTEGER,
      campaign_title TEXT,
      last_used_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_profile_usage_user 
    ON profile_usage_context(user_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_profile_usage_profile 
    ON profile_usage_context(creator_profile_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_profile_usage_context_type 
    ON profile_usage_context(context_type)
  `);
}

export async function recordProfileUsage(
  userId: string,
  creatorProfileId: string,
  contextType: 'personal' | 'organization' | 'campaign',
  organizationId?: number | null,
  organizationName?: string | null,
  campaignId?: number | null,
  campaignTitle?: string | null
): Promise<void> {
  const db = await getDatabase();
  await ensureProfileContextSchema(db);

  const now = timestamp();

  // Check if a context record already exists for this user + profile + context combination
  const existing = await db.select<ProfileUsageContext[]>(
    `SELECT * FROM profile_usage_context 
     WHERE user_id = ? 
     AND creator_profile_id = ? 
     AND context_type = ?
     AND (organization_id = ? OR (organization_id IS NULL AND ? IS NULL))
     AND (campaign_id = ? OR (campaign_id IS NULL AND ? IS NULL))`,
    [userId, creatorProfileId, contextType, organizationId, organizationId, campaignId, campaignId]
  );

  if (existing.length > 0) {
    // Update last_used_at
    await db.execute(
      `UPDATE profile_usage_context 
       SET last_used_at = ? 
       WHERE id = ?`,
      [now, existing[0].id]
    );
  } else {
    // Insert new record
    await db.execute(
      `INSERT INTO profile_usage_context (
        id, user_id, creator_profile_id, context_type, 
        organization_id, organization_name, campaign_id, campaign_title,
        last_used_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        userId,
        creatorProfileId,
        contextType,
        organizationId || null,
        organizationName || null,
        campaignId || null,
        campaignTitle || null,
        now,
        now,
      ]
    );
  }
}

export async function getLastUsedContext(
  userId: string,
  creatorProfileId: string
): Promise<ProfileUsageContext | null> {
  const db = await getDatabase();
  await ensureProfileContextSchema(db);

  const results = await db.select<ProfileUsageContext[]>(
    `SELECT * FROM profile_usage_context 
     WHERE user_id = ? 
     AND creator_profile_id = ?
     ORDER BY last_used_at DESC 
     LIMIT 1`,
    [userId, creatorProfileId]
  );

  return results.length > 0 ? results[0] : null;
}

export async function getAllProfileContexts(userId: string): Promise<ProfileUsageContext[]> {
  const db = await getDatabase();
  await ensureProfileContextSchema(db);

  return await db.select<ProfileUsageContext[]>(
    `SELECT * FROM profile_usage_context 
     WHERE user_id = ? 
     ORDER BY last_used_at DESC`,
    [userId]
  );
}

export async function clearProfileContext(
  userId: string,
  creatorProfileId: string,
  contextType?: 'personal' | 'organization' | 'campaign'
): Promise<void> {
  const db = await getDatabase();
  await ensureProfileContextSchema(db);

  if (contextType) {
    await db.execute(
      `DELETE FROM profile_usage_context 
       WHERE user_id = ? 
       AND creator_profile_id = ? 
       AND context_type = ?`,
      [userId, creatorProfileId, contextType]
    );
  } else {
    await db.execute(
      `DELETE FROM profile_usage_context 
       WHERE user_id = ? 
       AND creator_profile_id = ?`,
      [userId, creatorProfileId]
    );
  }
}
