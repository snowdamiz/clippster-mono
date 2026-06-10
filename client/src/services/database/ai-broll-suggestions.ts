import { getDatabase, generateId, timestamp } from './core';
import type { AiBrollSuggestion } from '@/types/ai-broll';

interface AiBrollSuggestionRow {
  id: string;
  clip_id: string;
  data_json: string;
  created_at: number;
  updated_at: number;
}

let tableReady = false;

async function ensureTable(): Promise<boolean> {
  if (tableReady) return true;
  const db = await getDatabase();
  try {
    await db.execute('SELECT 1 FROM ai_broll_suggestions LIMIT 1', []);
    tableReady = true;
    return true;
  } catch {
    try {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ai_broll_suggestions (
          id TEXT PRIMARY KEY NOT NULL,
          clip_id TEXT NOT NULL,
          data_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
        [],
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_ai_broll_clip ON ai_broll_suggestions(clip_id)',
        [],
      );
      tableReady = true;
      return true;
    } catch (e) {
      console.error('[ai-broll-suggestions] Failed to create table:', e);
      return false;
    }
  }
}

export async function getAiBrollSuggestionsForClip(clipId: string): Promise<AiBrollSuggestion[]> {
  if (!(await ensureTable())) return [];
  const db = await getDatabase();
  const rows = await db.select<AiBrollSuggestionRow[]>(
    'SELECT * FROM ai_broll_suggestions WHERE clip_id = ? ORDER BY created_at ASC',
    [clipId],
  );
  return rows.map((r) => JSON.parse(r.data_json) as AiBrollSuggestion);
}

export async function saveAiBrollSuggestions(
  clipId: string,
  suggestions: AiBrollSuggestion[],
): Promise<void> {
  if (!(await ensureTable())) return;
  const db = await getDatabase();
  await db.execute('DELETE FROM ai_broll_suggestions WHERE clip_id = ?', [clipId]);
  const now = timestamp();
  for (const s of suggestions) {
    await db.execute(
      `INSERT INTO ai_broll_suggestions (id, clip_id, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [s.id, clipId, JSON.stringify(s), now, now],
    );
  }
}

export async function updateAiBrollSuggestion(suggestion: AiBrollSuggestion): Promise<void> {
  if (!(await ensureTable())) return;
  const db = await getDatabase();
  const now = timestamp();
  await db.execute(
    `UPDATE ai_broll_suggestions SET data_json = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(suggestion), now, suggestion.id],
  );
}

export async function clearAiBrollSuggestions(clipId: string): Promise<void> {
  if (!(await ensureTable())) return;
  const db = await getDatabase();
  await db.execute('DELETE FROM ai_broll_suggestions WHERE clip_id = ?', [clipId]);
}
