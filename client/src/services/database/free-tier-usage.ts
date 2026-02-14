import { getDatabase } from './index';

const TABLE_NAME = 'free_tier_usage';

/**
 * Ensures the free_tier_usage table exists.
 * Tracks daily action counts for free tier users.
 */
export async function ensureFreeTierUsageTable(): Promise<void> {
  const db = await getDatabase();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, action_type, usage_date)
    )
  `);
}

/**
 * Gets the current usage count for a specific action on today's date.
 */
export async function getUsageCount(userId: string, actionType: string): Promise<number> {
  const db = await getDatabase();
  await ensureFreeTierUsageTable();

  const today = getTodayDateString();
  const result = await db.select<{ count: number }[]>(
    `SELECT count FROM ${TABLE_NAME} WHERE user_id = ? AND action_type = ? AND usage_date = ?`,
    [userId, actionType, today]
  );

  return result.length > 0 ? result[0].count : 0;
}

/**
 * Records a usage of a specific action for today.
 * Uses UPSERT to increment the count.
 */
export async function recordUsage(userId: string, actionType: string): Promise<number> {
  const db = await getDatabase();
  await ensureFreeTierUsageTable();

  const today = getTodayDateString();
  await db.execute(
    `INSERT INTO ${TABLE_NAME} (user_id, action_type, usage_date, count, updated_at)
     VALUES (?, ?, ?, 1, datetime('now'))
     ON CONFLICT(user_id, action_type, usage_date)
     DO UPDATE SET count = count + 1, updated_at = datetime('now')`,
    [userId, actionType, today]
  );

  // Return the new count
  return await getUsageCount(userId, actionType);
}

/**
 * Gets all usage counts for a user on today's date.
 */
export async function getAllUsageCounts(
  userId: string
): Promise<Record<string, number>> {
  const db = await getDatabase();
  await ensureFreeTierUsageTable();

  const today = getTodayDateString();
  const results = await db.select<{ action_type: string; count: number }[]>(
    `SELECT action_type, count FROM ${TABLE_NAME} WHERE user_id = ? AND usage_date = ?`,
    [userId, today]
  );

  const counts: Record<string, number> = {};
  for (const row of results) {
    counts[row.action_type] = row.count;
  }
  return counts;
}

/**
 * Gets today's date string in YYYY-MM-DD format (EST timezone).
 * Resets at midnight EST.
 */
function getTodayDateString(): string {
  const now = new Date();
  // Convert to EST (UTC-5)
  const estOffset = -5 * 60;
  const utcOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60000);
  const year = estTime.getFullYear();
  const month = String(estTime.getMonth() + 1).padStart(2, '0');
  const day = String(estTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
