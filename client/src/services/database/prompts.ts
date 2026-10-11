import { defaultPromptContent, gamingPromptContent, gamblingPromptContent, breakingNewsPromptContent, irlPromptContent, musicPromptContent } from '@clippster/shared-types';
import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { Prompt } from './types';

// Prompt queries
export async function createPrompt(name: string, content: string): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, content, userId, now, now]
  );

  return id;
}

export async function getPrompt(id: string): Promise<Prompt | null> {
  const db = await getDatabase();
  const result = await db.select<Prompt[]>('SELECT * FROM prompts WHERE id = ?', [id]);
  return result[0] || null;
}

export async function getAllPrompts(): Promise<Prompt[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  // Custom ordering: Default Clip Detector first, then other system prompts alphabetically, then user prompts
  const orderClause = `ORDER BY 
    CASE 
      WHEN name = 'Default Clip Detector' THEN 1
      WHEN user_id IS NULL THEN 2
      ELSE 3
    END,
    name`;

  if (userId === null) {
    return await db.select<Prompt[]>(`SELECT * FROM prompts WHERE user_id IS NULL ${orderClause}`);
  }

  return await db.select<Prompt[]>(
    `SELECT * FROM prompts WHERE user_id = ? OR user_id IS NULL ${orderClause}`,
    [userId]
  );
}

export async function updatePrompt(id: string, name?: string, content?: string): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM prompts WHERE id = ?', [id]);
}

// Seed default prompt
export async function seedDefaultPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing default prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Default Clip Detector',
  ]);

  // Create the default prompt with user_id = NULL (system-wide, visible to all users)


  const id = generateId();
  const now = timestamp();

  try {
    // Insert directly with user_id = NULL to make it a system-wide prompt
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Default Clip Detector', defaultPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed Gaming Stream Clip Detector prompt
export async function seedGamingPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing gaming prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Gaming Stream Clip Detector',
  ]);



  const id = generateId();
  const now = timestamp();

  try {
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Gaming Stream Clip Detector', gamingPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed Gambling Stream Clip Detector prompt
export async function seedGamblingPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing gambling prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Gambling Stream Clip Detector',
  ]);



  const id = generateId();
  const now = timestamp();

  try {
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Gambling Stream Clip Detector', gamblingPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed Breaking News & Trending Viral prompt
export async function seedBreakingNewsPrompt(): Promise<void> {
  const db = await getDatabase();

  // Delete existing breaking news prompt to force update
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Breaking News & Trending Viral',
  ]);



  const id = generateId();
  const now = timestamp();

  try {
    await db.execute(
      'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, 'Breaking News & Trending Viral', breakingNewsPromptContent, now, now]
    );
  } catch (error) {
    throw error;
  }
}

// Seed IRL / Just Chatting prompt
export async function seedIrlPrompt(): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'IRL & Just Chatting Clip Detector',
  ]);



  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
    [id, 'IRL & Just Chatting Clip Detector', irlPromptContent, now, now]
  );
}

// Seed Music / Performance prompt
export async function seedMusicPrompt(): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM prompts WHERE name = ? AND user_id IS NULL', [
    'Music & Performance Clip Detector',
  ]);



  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO prompts (id, name, content, user_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
    [id, 'Music & Performance Clip Detector', musicPromptContent, now, now]
  );
}
