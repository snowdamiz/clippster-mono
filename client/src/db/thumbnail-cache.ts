import { getDatabase } from '../services/database/core';

export interface ThumbnailCacheEntry {
  post_id: number;
  thumbnail_url: string;
  cached_at: number;
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function initThumbnailCache() {
  const db = await getDatabase();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS thumbnail_cache (
      post_id INTEGER PRIMARY KEY,
      thumbnail_url TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_cached_at 
    ON thumbnail_cache(cached_at)
  `);
}

export async function getCachedThumbnail(postId: number): Promise<string | null> {
  const db = await getDatabase();
  const result = await db.select<ThumbnailCacheEntry[]>(
    'SELECT thumbnail_url, cached_at FROM thumbnail_cache WHERE post_id = ?',
    [postId]
  );

  if (result.length === 0) return null;

  const entry = result[0];
  const now = Date.now();

  // Check if cache is still valid
  if (now - entry.cached_at > CACHE_DURATION_MS) {
    await deleteCachedThumbnail(postId);
    return null;
  }

  return entry.thumbnail_url;
}

export async function setCachedThumbnail(postId: number, thumbnailUrl: string): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  
  await db.execute(
    `INSERT OR REPLACE INTO thumbnail_cache (post_id, thumbnail_url, cached_at)
     VALUES (?, ?, ?)`,
    [postId, thumbnailUrl, now]
  );
}

export async function deleteCachedThumbnail(postId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM thumbnail_cache WHERE post_id = ?', [postId]);
}

export async function clearExpiredThumbnails(): Promise<void> {
  const db = await getDatabase();
  const cutoff = Date.now() - CACHE_DURATION_MS;
  await db.execute('DELETE FROM thumbnail_cache WHERE cached_at < ?', [cutoff]);
}

export async function clearAllThumbnails(): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM thumbnail_cache');
}
